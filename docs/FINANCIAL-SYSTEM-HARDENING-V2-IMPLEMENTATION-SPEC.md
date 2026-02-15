# Financial System Hardening V2 — Implementation Spec

อิงจาก implementation ปัจจุบันใน codebase เท่านั้น

---

## SECTION 1 — REFUND MUST WRITE AUDIT LOG (CRITICAL)

### 1.1 Code path ปัจจุบันของ createRefund

**Call chain:**

1. **API:** `POST /api/clinic/invoices/[id]/refunds` — `src/app/api/clinic/invoices/[id]/refunds/route.ts`
   - ตรวจ session, role (owner/manager), branch access
   - อ่าน invoice, ตรวจ status === "PAID"
   - อ่าน payment, ตรวจ refund <= (payment.amount_satang - alreadyRefundedSatang)
   - เรียก `createRefund({ org_id, invoice_id, payment_id, amount_satang, reason, created_by })`

2. **Data layer:** `src/lib/financial-data.ts` — `createRefund(data: RefundCreate): Promise<string>`
   - มีแค่:
     ```ts
     const ref = await db.collection(COLLECTIONS.refunds).add({
       org_id, invoice_id, payment_id, amount_satang, reason, created_by, created_at: ts,
     });
     return ref.id;
     ```
   - **ไม่เรียก** `appendFinancialAuditLog` หรือเขียน `financial_audit_log`
   - **ไม่ใช้** `db.runTransaction`

**สรุป:** Refund เขียนเฉพาะ collection `refunds`; ไม่มี audit log; ไม่มี transaction.

---

### 1.2 โครงสร้าง audit log สำหรับ refund

**Collection:** `financial_audit_log` (มีอยู่แล้ว)

**Document structure ต่อ record:**

| Field        | Value |
|-------------|--------|
| org_id      | string (จาก RefundCreate) |
| entity_type | `"refund"` |
| entity_id   | refundId (id ของ document ใน `refunds` หลัง tx.set) |
| action      | `"create"` |
| user_id     | created_by |
| timestamp   | Firestore.Timestamp (เวลาเดียวกับ refund.created_at) |
| payload     | `{ invoice_id: string, payment_id: string, amount_satang: number }` |

**Type:** ใช้ `FinancialEntityType` และ `FinancialAuditAction` ที่มีอยู่ — มี "refund" และ "create" อยู่แล้วใน `src/types/financial.ts`.

---

### 1.3 ตัวอย่าง db.runTransaction (pseudo code)

```ts
// createRefundTransactional — รับ tx จาก caller ที่เรียก db.runTransaction
function createRefundInTransaction(
  tx: FirebaseFirestore.Transaction,
  data: RefundCreate,
  now: Date
): { refundRef: FirebaseFirestore.DocumentReference } {
  const Firestore = require("firebase-admin/firestore");
  const ts = Firestore.Timestamp.fromDate(now);

  const refundRef = db.collection(COLLECTIONS.refunds).doc(); // หรือ .doc() แล้วได้ ref
  tx.set(refundRef, {
    org_id: data.org_id,
    invoice_id: data.invoice_id,
    payment_id: data.payment_id,
    amount_satang: data.amount_satang,
    reason: data.reason,
    created_by: data.created_by,
    created_at: ts,
  });

  const auditRef = db.collection(COLLECTIONS.financial_audit_log).doc();
  tx.set(auditRef, {
    org_id: data.org_id,
    entity_type: "refund",
    entity_id: refundRef.id,
    action: "create",
    user_id: data.created_by,
    timestamp: ts,
    payload: {
      invoice_id: data.invoice_id,
      payment_id: data.payment_id,
      amount_satang: data.amount_satang,
    },
  });

  return { refundRef };
}

// Caller (e.g. new createRefundWithAudit):
export async function createRefundWithAudit(data: RefundCreate): Promise<string> {
  const now = new Date();
  const result = await db.runTransaction(async (tx) => {
    const { refundRef } = createRefundInTransaction(tx, data, now);
    return refundRef.id;
  });
  return result;
}
```

**หมายเหตุ:** ใน Firestore, `db.collection().doc()` โดยไม่ส่ง id จะ generate id ใหม่; ภายใน transaction ใช้ `refundRef.id` ได้หลัง `tx.set(refundRef, ...)` เพราะ ref มี id แล้ว.

---

### 1.4 ต้อง read invoice/payment ภายใน transaction หรือไม่?

**แนะนำ: อ่าน invoice ภายใน transaction**

- **เหตุผล:** เพื่อให้ refund และการอัปเดต invoice (เช่น `refunded_total_satang`) อยู่บน snapshot เดียวกัน — ถ้าอ่าน invoice นอก transaction แล้วอีก request อัปเดต invoice ระหว่างนั้น จะเกิด race. ภายใน transaction: อ่าน invoice → ตรวจ status === "PAID" และ refunded_total_satang + amount_satang <= grand_total_satang → เขียน refund → อัปเดต invoice.refunded_total_satang → เขียน audit.
- **Payment:** อ่านภายใน transaction ก็ได้ เพื่อตรวจ amount_satang และความสัมพันธ์ invoice_id (ป้องกันการอ้างถึง payment ปลอม). ถ้าอ่านนอก transaction แล้วส่ง payment_id + amount มาจาก API ที่ validate ไปแล้ว ก็ลดโอกาสผิดพลาดได้ แต่เพื่อความสอดคล้องและป้องกัน concurrent refund ต่อ payment เดียวกัน — อ่าน payment ใน transaction แล้วตรวจ amount และ refunded ของ payment นั้น (ถ้ามี field refunded_satang ต่อ payment) หรือรวม refund ของ payment นั้นจาก collection refunds ใน transaction (query ใน transaction) ก็ได้. ใน spec นี้แนะนำให้ **อ่าน invoice + payment ใน transaction** เพื่อ validation และอัปเดต invoice.refunded_total_satang แบบ atomic.

**สรุป:** ควร read invoice (และ payment) ภายใน transaction เพื่อ validation แบบ atomic และอัปเดต invoice.refunded_total_satang ใน transaction เดียว.

---

### 1.5 Risk ถ้าไม่ใช้ transaction

- **Refund เขียนสำเร็จ แต่ audit log ไม่ได้เขียน:** เช่น network/process ตายหลัง add(refunds) ก่อน add(audit_log) — จะไม่มีหลักฐานใน audit ว่าใคร refund เท่าไร; audit trail ขาด (Audit risk).
- **Refund เขียนสำเร็จ แต่การอัปเดต invoice.refunded_total_satang ล้มเหลว:** ถ้าแยก write — refund มีแล้วแต่ invoice ยังไม่เพิ่ม refunded_total_satang → ข้อมูลไม่สอดคล้อง; ถ้ามี logic อิง refunded_total_satang (เช่น กัน refund เกิน) จะผิดพลาด (Integrity risk).
- **Concurrent refund:** สอง request refund พร้อมกัน ถ้าไม่ lock invoice (อ่าน+อัปเดตใน transaction) อาจรวม refund เกิน grand_total (Business risk).

---

## SECTION 2 — REFUND WITH TRANSACTION SAFETY

### 2.1 createRefundTransactional(tx, input)

**Signature (pseudo):**

```ts
type CreateRefundTransactionalParams = {
  data: RefundCreate;
  invoiceRef: FirebaseFirestore.DocumentReference;
  paymentRef: FirebaseFirestore.DocumentReference | null; // optional ถ้าไม่ใช้ payment
};

function createRefundTransactional(
  tx: FirebaseFirestore.Transaction,
  params: CreateRefundTransactionalParams
): { refundId: string } {
  const { data, invoiceRef, paymentRef } = params;
  const now = new Date();
  const ts = Firestore.Timestamp.fromDate(now);

  const invSnap = tx.get(invoiceRef);
  if (!invSnap.exists) throw new Error("Invoice not found");
  const invData = invSnap.data()!;
  if (invData.status !== "PAID") throw new Error("Invoice must be PAID");
  const grandTotal = readSatang(invData, "grand_total_satang", "grand_total");
  const refundedTotal = Number(invData.refunded_total_satang ?? 0);
  if (refundedTotal + data.amount_satang > grandTotal)
    throw new Error("Refund would exceed invoice grand total");

  if (paymentRef) {
    const paySnap = tx.get(paymentRef);
    if (!paySnap.exists) throw new Error("Payment not found");
    const payData = paySnap.data()!;
    const payAmount = readSatang(payData, "amount_satang", "amount");
    if (data.amount_satang > payAmount) throw new Error("Refund exceeds payment amount");
    // ถ้ามี refunded_satang ต่อ payment: ตรวจ data.amount_satang <= payAmount - refunded_satang
  }

  const refundRef = db.collection(COLLECTIONS.refunds).doc();
  tx.set(refundRef, { ... });

  tx.update(invoiceRef, {
    refunded_total_satang: refundedTotal + data.amount_satang,
    updated_at: ts,
  });

  const auditRef = db.collection(COLLECTIONS.financial_audit_log).doc();
  tx.set(auditRef, { ... });

  return { refundId: refundRef.id };
}
```

**Validation สรุป:**

- invoice.status === "PAID"
- refunded_total_satang + amount_satang <= invoice.grand_total_satang
- ถ้ามี payment_id: amount_satang <= payment.amount_satang (และถ้ามีการเก็บ refunded ต่อ payment ต้องไม่เกินยอดที่เหลือ)

---

### 2.2 Schema เพิ่มใน Invoice

**Firestore document (invoices):**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| refunded_total_satang | number | no (nullable ใน Phase 1) | 0 | ผลรวม refund ที่เกิดขึ้นแล้วของใบแจ้งหนี้นี้ (integer satang) |

**Type definition (Invoice):**

```ts
// src/types/financial.ts — เพิ่มใน Invoice
refunded_total_satang?: number; // optional สำหรับ backward compat; ถ้าไม่มีให้ถือว่า 0
```

**Logic ป้องกัน:**

- ก่อนเขียน refund ภายใน transaction: อ่าน invoice แล้วตรวจ  
  `(invData.refunded_total_satang ?? 0) + data.amount_satang <= grand_total_satang`  
- ถ้าเกิน → throw (หรือ return validation error); ไม่เขียน refund และไม่อัปเดต invoice.

---

## SECTION 3 — OVERPAYMENT ACCOUNTING FIX (CRITICAL)

### 3.1 Logic ใหม่ใน confirmPaymentAndCreateRecord (ภายใน transaction)

**ตัวแปร (ภายใน transaction หลัง tx.get(invoice)):**

- อ่าน payments ที่มีอยู่ของ invoice นี้ — ใน transaction ต้อง query payments where invoice_id == params.invoiceId (หรือส่ง totalPaidSatang จากนอก transaction แล้วอ่าน invoice อย่างเดียว; แต่เพื่อความแม่นยำใน concurrent กรณี แนะนำให้ query payments ใน transaction).
- `totalPaidSatang` = sum(payments[].amount_satang) หรือ sum(payments[].applied_satang) ถ้ามี field applied_satang.
- `remaining` = invoice.grand_total_satang - totalPaidSatang
- `newPaymentAmount` = params.payment.amount_satang
- `applied_satang` = min(newPaymentAmount, remaining) = จำนวนที่นำไปชำระใบแจ้งหนี้จริง
- `overpayment_satang` = max(0, newPaymentAmount - remaining)

**การเขียน Payment document:**

| Field | ค่า |
|-------|-----|
| amount_satang | params.payment.amount_satang (ยอดที่ลูกค้าจ่าย) |
| applied_satang | applied_satang (ยอดที่นำไป offset ใบแจ้งหนี้) |
| overpayment_satang | overpayment_satang (ส่วนเกิน) |

**การอัปเดต Invoice (นอกจาก status, paid_at, confirmed_by):**

| Field | ค่า |
|-------|-----|
| paid_total_satang | totalPaidSatang + applied_satang (ยอดที่ชำระแล้วรวม) |
| overpayment_total_satang | (invoice.overpayment_total_satang ?? 0) + overpayment_satang (optional ตามนโยบาย) |

**Revenue:** นับจาก applied_satang ของ payments (หรือจาก invoice.paid_total_satang เมื่อครบแล้วเท่ากับ grand_total) ไม่นับ overpayment เป็น revenue.

---

### 3.2 Schema change (Payment, Invoice)

**Payment (Firestore + type):**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| amount_satang | number | yes | - |
| applied_satang | number | no (Phase 1 nullable) | เท่ากับ amount_satang ถ้าไม่มี (backfill) |
| overpayment_satang | number | no | 0 |

**Invoice (Firestore + type):**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| paid_total_satang | number | no | 0 หรือ null ใน Phase 1 |
| overpayment_total_satang | number | no | 0 |

**Type definition:**

```ts
// Payment
applied_satang?: number;
overpayment_satang?: number;

// Invoice
paid_total_satang?: number;
overpayment_total_satang?: number;
```

---

### 3.3 Migration strategy สำหรับ payment เก่า

- **Payment เก่า (ไม่มี applied_satang / overpayment_satang):**
  - อ่าน amount_satang; ตั้ง `applied_satang = amount_satang`, `overpayment_satang = 0` (ถือว่าจ่ายพอดีหรือระบบเดิมไม่แยก overpayment).
- **Invoice เก่า (ไม่มี paid_total_satang):**
  - คำนวณจาก payments ของ invoice นั้น: `paid_total_satang = sum(payments[].applied_satang ?? payments[].amount_satang)`.
  - `overpayment_total_satang = sum(payments[].overpayment_satang ?? 0)`.

**Backfill script (Phase 3):** ดู Section 5.

---

### 3.4 Overpayment > 0 — เก็บเป็น customer_credit หรือแค่บันทึก?

**ตัวเลือก:**

- **A. แค่บันทึก (record-only):** เก็บใน payment.overpayment_satang และ invoice.overpayment_total_satang เพื่อรายงานและ audit. ไม่มี collection customer_credit; การนำไปใช้ครั้งถัดไปทำด้วย process อื่นหรือมือ.
- **B. Customer credit:** สร้าง collection `customer_credits` (org_id, customer_id, balance_satang, updated_at) และเมื่อ overpayment > 0 ให้เพิ่ม balance; ตอนสร้าง invoice/ชำระครั้งถัดไปลด balance. ซับซ้อนกว่าและต้องออกแบบ flow การใช้ credit.

**แนะนำสำหรับ V2:** เริ่มด้วย **A (record-only)** เพื่อให้ audit trail ครบและรายงานถูก; ถ้าต้องการระบบ credit ค่อยเพิ่ม Phase แยก (B).

---

### 3.5 Risk ถ้าไม่แก้

- รายได้และยอดรับไม่แยกส่วนเกิน → รายงานทางการเงินผิด (overpayment ถูกนับเป็น revenue).
- ไม่มีหลักฐานส่วนเกิน → audit ไม่ครบ.
- ลูกค้ามีส่วนเกินแต่ระบบไม่บันทึก → ไม่สามารถนำไปใช้หรือคืนได้อย่างเป็นระบบ.

---

## SECTION 4 — DASHBOARD QUERY REFACTOR

### 4.1 Query ใหม่ (invoices)

**เดิม (implementation ปัจจุบัน):**

```ts
let q = db.collection("invoices").where("org_id", "==", orgId).where("status", "==", "PAID");
const snap = await q.limit(2000).get();
// แล้ว filter paid_at ใน memory ตาม options.from / options.to
```

**ใหม่:**

```ts
let q = db.collection("invoices")
  .where("org_id", "==", orgId)
  .where("status", "==", "PAID");
if (options.from != null)
  q = q.where("paid_at", ">=", Firestore.Timestamp.fromDate(options.from));
if (options.to != null)
  q = q.where("paid_at", "<=", Firestore.Timestamp.fromDate(options.to));
const snap = await q.limit(2000).get();
// ไม่ต้อง filter paid_at ใน memory
```

**หมายเหตุ:** Firestore composite index ต้องมี: `org_id` (ASC), `status` (ASC), `paid_at` (ASC หรือ DESC). ใช้ DESC ถ้าต้องการเรียงใหม่ล่าสุดก่อน.

---

### 4.2 Composite index — invoices

**firestore.indexes.json — เพิ่ม:**

```json
{
  "collectionGroup": "invoices",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "paid_at", "order": "DESCENDING" }
  ]
}
```

ถ้า query ใช้ `paid_at >= from` และ `paid_at <= to` Firestore ต้องการ index ที่มี equality (org_id, status) ตามด้วย range (paid_at). ลำดับ field ต้องเป็น org_id, status, paid_at.

---

### 4.3 Refund query + index

**Query ใหม่ (refunds):**

```ts
let q = db.collection("refunds").where("org_id", "==", orgId);
if (options.from != null)
  q = q.where("created_at", ">=", Firestore.Timestamp.fromDate(options.from));
if (options.to != null)
  q = q.where("created_at", "<=", Firestore.Timestamp.fromDate(options.to));
const snap = await q.limit(2000).get();
```

**Index — refunds:**

```json
{
  "collectionGroup": "refunds",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

---

### 4.4 ตัวอย่าง firestore.indexes.json (ส่วนที่เพิ่ม)

เพิ่มเข้า array `indexes` ในไฟล์ที่มีอยู่:

```json
{
  "collectionGroup": "invoices",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "paid_at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "invoices",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "paid_at", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "refunds",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "refunds",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "ASCENDING" }
  ]
}
```

(ใช้ ASC หรือ DESC ให้ตรงกับ query ที่เรียกใช้จริง; range query ใช้ได้ทั้ง ASC/DESC ของ paid_at/created_at.)

---

### 4.5 Cost impact

- **เดิม:** อ่าน documents ถึง 2000 จาก invoices (org_id + status) แล้วทิ้งส่วนที่ paid_at ไม่อยู่ใน range ใน memory — อ่านมากกว่าจำนวนที่ใช้.
- **ใหม่:** อ่านเฉพาะ documents ที่ paid_at อยู่ใน range (และยัง limit 2000) — อ่านน้อยลงเมื่อ range แคบ; ใช้ index จึงไม่ต้อง scan ทั้ง collection.
- **Cost:** ลด read count ต่อ request ใน typical case (มี date filter). Index ใช้ storage เล็กน้อยและไม่มี direct read cost แยก.

---

### 4.6 Performance เดิม vs ใหม่

- **เดิม:** Query 2 fields (org_id, status) + in-memory filter → อ่านมาก, CPU filter ใน app.
- **ใหม่:** Query 3 fields (org_id, status, paid_at range) ใช้ composite index → อ่านเฉพาะช่วงที่ต้องการ, ลดทั้ง read และ CPU.

---

## SECTION 5 — MIGRATION PLAN (ZERO DOWNTIME)

### Phase 1 — เพิ่ม field ใหม่ (nullable)

- **Invoices:** เพิ่ม `refunded_total_satang` (number, optional), `paid_total_satang` (number, optional), `overpayment_total_satang` (number, optional). ไม่เขียนจาก logic เดิม; ค่าเดิม = ไม่มี field (ถือเป็น 0 ใน code).
- **Payments:** เพิ่ม `applied_satang` (number, optional), `overpayment_satang` (number, optional).
- **Code:** อ่านแบบ backward compatible — `readSatang(d, "refunded_total_satang")` หรือ `d.refunded_total_satang ?? 0`; เหมือนกันสำหรับ applied_satang, overpayment_satang.
- **Deploy:** Deploy code ที่รองรับ field ใหม่ (อ่านได้, ยังไม่บังคับเขียน); schema ไม่บังคับให้มี field เหล่านี้.

---

### Phase 2 — Deploy new logic (เขียน field ใหม่)

- **Confirm payment:** ใน transaction หลังสร้าง payment — คำนวณ applied_satang, overpayment_satang; เขียน payment ด้วย amount_satang, applied_satang, overpayment_satang; อัปเดต invoice ด้วย paid_total_satang, overpayment_total_satang (และ status, paid_at ฯลฯ).
- **Refund:** เปลี่ยนเป็น createRefundWithAudit ที่ใช้ transaction; อ่าน invoice ใน transaction; อัปเดต refunded_total_satang; เขียน refund + audit log.
- **Revenue:** ใช้ applied_satang (หรือ paid_total_satang ของ invoice) สำหรับ revenue; ไม่นับ overpayment_satang เป็น revenue.
- **Dashboard:** เปลี่ยน getRevenueFromPaidInvoices / getTotalRefundSatang ให้ใช้ query ตาม paid_at / created_at และใช้ index ตาม Section 4.
- **Deploy:** Deploy แล้ว payment/refund ใหม่จะเขียน field ใหม่; invoice เก่าที่ยังไม่มี refunded_total_satang ยังอ่านเป็น 0.

---

### Phase 3 — Backfill script

**เป้าหมาย:**

- Invoices: ตั้ง `refunded_total_satang` = sum(refunds.amount_satang where invoice_id = invoice.id); ตั้ง `paid_total_satang` = sum(payments.applied_satang ?? amount_satang), `overpayment_total_satang` = sum(payments.overpayment_satang ?? 0).
- Payments: ตั้ง `applied_satang` = amount_satang, `overpayment_satang` = 0 (สำหรับ payment เก่าที่ไม่มี field เหล่านี้).

**Pseudo code (batch 500 docs ต่อครั้ง):**

```ts
const BATCH_SIZE = 500;

async function backfillInvoices() {
  const snap = await db.collection("invoices").limit(BATCH_SIZE).get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.refunded_total_satang !== undefined) continue; // already backfilled
    const refundsSnap = await db.collection("refunds").where("invoice_id", "==", doc.id).get();
    const refundedTotal = refundsSnap.docs.reduce((s, d) => s + (d.data().amount_satang ?? 0), 0);
    const paymentsSnap = await db.collection("payments").where("invoice_id", "==", doc.id).get();
    let paidTotal = 0, overTotal = 0;
    for (const p of paymentsSnap.docs) {
      const pd = p.data();
      const applied = pd.applied_satang ?? pd.amount_satang ?? 0;
      const over = pd.overpayment_satang ?? 0;
      paidTotal += applied;
      overTotal += over;
    }
    batch.update(doc.ref, {
      refunded_total_satang: refundedTotal,
      paid_total_satang: paidTotal,
      overpayment_total_satang: overTotal,
    });
  }
  await batch.commit();
}

async function backfillPayments() {
  const snap = await db.collection("payments").limit(BATCH_SIZE).get();
  const batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.applied_satang !== undefined) continue;
    const amount = data.amount_satang ?? 0;
    batch.update(doc.ref, { applied_satang: amount, overpayment_satang: 0 });
  }
  await batch.commit();
}
```

**การ run แบบ batch:** วนลูปจนไม่มี document ที่ยังไม่ backfill (หรือใช้ cursor/startAfter เพื่อไล่ทั้ง collection). จำกัด 500 docs ต่อครั้งเพื่อไม่ให้ transaction/batch ใหญ่เกินไป.

**Rollback ถ้ามี error:** ไม่ลบ field ที่เพิ่ม — แค่หยุดรัน script. ถ้าต้อง rollback logic ให้กลับไปใช้ code เวอร์ชันที่ไม่อ่าน field ใหม่ (หรืออ่านแต่ไม่บังคับ); ข้อมูลที่ backfill ไว้ไม่กระทบ logic เก่าถ้า code เก่าไม่อ่าน field เหล่านั้น.

---

### Phase 4 — เปิด strict validation และลบ logic เก่า

- เปิด validation: refund ต้องมี refunded_total_satang อัปเดตใน transaction; confirm payment ต้องเขียน applied_satang, overpayment_satang; revenue ต้องนับจาก applied_satang / paid_total_satang เท่านั้น.
- ลบ fallback: ไม่ใช้ amount_satang เป็น default สำหรับ applied_satang ใน logic ใหม่ (เฉพาะ backfill ใช้); อ่าน refunded_total_satang แบบต้องมี (หลัง backfill ครบ).
- Optional: บังคับให้ invoice ที่ PAID มี paid_total_satang (และ refunded_total_satang) จากการ migrate/backfill แล้ว.

---

## SECTION 6 — FINAL ENTERPRISE VERDICT

### 6.1 หลัง refactor นี้ ระบบจะ Audit-Ready หรือไม่?

- **Audit trail:** ทุก refund มี record ใน financial_audit_log (entity_type "refund", action "create") ใน transaction เดียวกับ refund → **Audit-Ready ระดับ refund.**
- **Overpayment:** มี applied_satang / overpayment_satang และ paid_total_satang / overpayment_total_satang → รายได้และยอดรับแยกจากส่วนเกินได้ → **Audit-Ready ระดับ payment/invoice.**
- **Refund + invoice consistency:** refunded_total_satang อัปเดตใน transaction กับ refund + audit → **Integrity-Ready.**

**สรุป:** หลัง refactor ตาม spec นี้ ระบบจะ **Audit-Ready** ในขอบเขตที่กำหนด (refund, payment, invoice, audit log).

---

### 6.2 รองรับ external financial audit หรือไม่?

- **รองรับในส่วนที่ refactor:** มี audit log ต่อ refund; ยอดชำระ/รายได้แยกจาก overpayment; refund ไม่เกิน grand_total และไม่เกิน payment; ใช้ transaction ทำให้ข้อมูลสอดคล้อง.
- **ข้อจำกัด:** External audit มักต้องการนโยบายการจัดเก็บเอกสาร, access control, และ retention — spec นี้เน้น data model และ logic; นโยบายและกระบวนการเป็นอีกชั้นหนึ่ง.

**สรุป:** ด้าน data และ logic **รองรับ external financial audit** ได้ดีขึ้นมาก; ควรเสริมด้วยนโยบายและกระบวนการตามมาตรฐานที่ auditor ต้องการ.

---

### 6.3 Risk Level ก่อน refactor

- Refund ไม่มี audit log: **High (Audit).**
- Refund ไม่ใช้ transaction: **Medium (Integrity/Concurrent).**
- ไม่มี overpayment accounting: **Medium (Financial reporting).**
- Dashboard filter ใน memory + ไม่มี index ตาม date: **Low–Medium (Scale/Performance).**

**รวมก่อน refactor:** **High** ในมุม audit และ integrity.

---

### 6.4 Risk Level หลัง refactor

- Refund มี audit log + transaction: **Low.**
- Overpayment แยกและบันทึก: **Low.**
- Query ใช้ index + date ใน Firestore: **Low.**

**รวมหลัง refactor:** **Low** ในขอบเขตที่ spec นี้ครอบคลุม.

---

### 6.5 Production readiness score (0–100)

**ก่อน refactor (จาก audit ก่อนหน้า):** ~60–65 (hardening พื้นฐานมีแล้ว เช่น satang, idempotency, revenue จาก invoices; ขาด audit refund, transaction refund, overpayment, index).

**หลัง refactor ตาม spec นี้:**

| มิติ | คะแนน |
|------|--------|
| Audit trail (refund + payment) | 90 |
| Data integrity (transaction, refunded_total) | 90 |
| Financial reporting (overpayment, revenue นับ applied) | 85 |
| Query/index (dashboard) | 85 |
| Migration safety (zero downtime, backfill) | 85 |

**คะแนนรวม (เฉลี่ย):** **87/100** — ถือว่า **Production-Ready ระดับ Enterprise** ในขอบเขตระบบการเงินที่ออกแบบใน spec นี้.

---

*Spec นี้อิงจาก implementation ปัจจุบันใน codebase เท่านั้น*
