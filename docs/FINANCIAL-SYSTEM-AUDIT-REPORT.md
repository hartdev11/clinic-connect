# Financial System — Technical Audit Report (Implementation-Based)

รายงานนี้ตรวจสอบจาก implementation จริงใน codebase เท่านั้น

---

## SECTION 1 — REFUND TIMING LOGIC (CRITICAL)

### 1.1 revenueByDay คำนวณอย่างไร (implementation จริง)

**ที่มา:** `src/lib/financial-data.ts` — `getRevenueByDayFromPaidInvoices`

**Logic ปัจจุบัน:**

1. **รายได้ต่อวัน (จาก invoice):**
   - Query: `invoices` where `org_id` + `status === "PAID"`, limit 2000.
   - สำหรับแต่ละ document: อ่าน `data.paid_at` → แปลงเป็น date → `key = t.toISOString().slice(0, 10)` (YYYY-MM-DD).
   - ถ้า `dayMap.has(key)` (อยู่ใน 7 วันล่าสุด): บวก `grand_total_satang` (หรือ fallback `grand_total`) เข้า `dayMap[key]`.
   - **ฐานรายได้ = `invoice.paid_at`** (ไม่ใช้ `created_at`).

2. **การหัก refund ต่อวัน:**
   - Query: `refunds` where `org_id`, limit 2000.
   - สำหรับแต่ละ document: อ่าน `data.created_at` → `key = createdAt.toISOString().slice(0, 10)`.
   - ถ้า `dayMap.has(key)`: หัก `amount_satang` ออกจาก `dayMap[key]` (ไม่ให้ต่ำกว่า 0).
   - **วันที่หัก = `refund.created_at`** (วันที่มีการทำ refund).

### 1.2 กรณี: Invoice PAID วันที่ 1, Refund วันที่ 10

- **วันที่ 1:** รายได้เต็มจาก invoice (จาก `paid_at` = วันที่ 1).
- **วันที่ 10:** revenue ของวันนั้นถูกหักด้วยจำนวน refund (จาก `created_at` = วันที่ 10).
- **ไม่มีการย้อนกลับไปแก้ revenue วันที่ 1.**

### 1.3 สรุป Section 1

| รายการ | ค่าใน implementation | ผ่าน/ไม่ผ่าน |
|--------|----------------------|--------------|
| ใช้ refund.created_at เป็นวันที่หัก | ใช่ — บรรทัด 123–126 ใช้ `data.created_at` เป็น key ของวัน | ผ่าน |
| ใช้ invoice.paid_at เป็นฐานรายได้ | ใช่ — บรรทัด 105–108 ใช้ `data.paid_at` | ผ่าน |
| Logic เป็นแบบ A (วันที่ 1 เต็ม, วันที่ 10 ติดลบตาม refund) | ใช่ — รายได้ตาม paid_at, refund หักตาม created_at ต่อวัน | ผ่าน |

**Risk Level:** Low  
**สถานะ:** ผ่าน — เป็นแบบ A (Correct Enterprise).

---

## SECTION 2 — REFUND AUTHORIZATION INTEGRITY

### 2.1 Schema refunds (implementation จริง)

**ที่มา:** `src/types/financial.ts` (Refund, RefundCreate), `src/lib/financial-data.ts` (createRefund)

**Fields ที่มี:**

- `id`, `org_id`, `invoice_id`, `payment_id`, `amount_satang`, `reason`, `created_by`, `created_at`

**Fields ที่ไม่มี:**

- ไม่มี `approved_by`
- ไม่มี `confirmed_by`
- ไม่มี `approved_at`

### 2.2 Permission finance:refund

**ที่มา:** `src/app/api/clinic/invoices/[id]/refunds/route.ts`

- POST refund ตรวจ: `requireRole(user.role, REFUND_ROLES)` โดย `REFUND_ROLES = ["owner", "manager"]`.
- ถ้าไม่ใช่ owner/manager → 403 พร้อมข้อความ "ไม่มีสิทธิ์ทำรายการคืนเงิน (finance:refund)".
- **สรุป:** สิทธิ์ refund ตรวจด้วย role จริง (owner/manager) ไม่มี RBAC แยก permission name "finance:refund" ใน DB แต่พฤติกรรมเทียบเท่า finance:refund.

**ผ่าน:** ใช่ — การทำ refund ต้องผ่าน role ที่กำหนด.

### 2.3 Audit log เมื่อทำ refund

**ที่มา:** `src/lib/financial-data.ts` — `createRefund`

- มีแค่ `db.collection(COLLECTIONS.refunds).add({ ... })`.
- ไม่มีการเรียก `appendFinancialAuditLog` หรือเขียนไปที่ `financial_audit_log`.
- **ไม่ผ่าน:** ไม่มีการเขียน audit log สำหรับการ refund.

**Risk Level:** Medium (ไม่มี trace ว่าใคร refund เมื่อไหร่ใน audit log).

### 2.4 Firestore transaction เมื่อทำ refund

**ที่มา:** `createRefund` — ใช้ `db.collection(COLLECTIONS.refunds).add(...)` เดียว ไม่มี `db.runTransaction(...)`.

- **ไม่ผ่าน:** การสร้าง refund ไม่ได้อยู่ภายใน Firestore transaction (ไม่มี lock หรือ atomic กับ document อื่น).

**Risk Level:** Low–Medium (ถ้ามีการอ่าน/อัปเดต invoice หรือ payment พร้อมกัน อาจไม่ atomic).

### 2.5 แนวทางแก้ (implementation)

**Schema เพิ่ม (Refund):**

- `approved_by: string | null` — user id ผู้อนุมัติ (ถ้ามี workflow อนุมัติ).
- `approved_at: string | null` (ISO) — เวลาที่อนุมัติ.

**Flow ที่แนะนำ:**

1. **Option A (สองขั้น):** สร้าง refund สถานะ "pending" → endpoint แยก (หรือ role แยก) อนุมัติ → อัปเดต `approved_by`, `approved_at` แล้วจึงถือว่า "มีผล" ต่อ revenue. Logic revenue ต้องอ่านเฉพาะ refund ที่ approved แล้ว (หรือใช้ status field).
2. **Option B (ขั้นเดียว + audit):** ถ้าทำแบบขั้นเดียว (สร้างแล้วมีผลทันที) อย่างน้อยต้อง:
   - หลัง `createRefund` เรียก `appendFinancialAuditLog({ entity_type: "refund", entity_id: refundId, action: "create", user_id: created_by, payload: { amount_satang, invoice_id, payment_id } })`.
   - ถ้าต้องการ approval แยก: เพิ่ม field `approved_by`, `approved_at` และอาจ `status: "pending" | "approved"` แล้วให้ revenue นับเฉพาะ approved.

**Transaction:**

- ถ้าต้องการ atomic กับ invoice/payment: ห่อการสร้าง refund + การเขียน audit log ไว้ใน `db.runTransaction(...)` (อ่าน invoice/payment ใน transaction ถ้าจำเป็น validate อีกครั้งก่อนเขียน refund).

---

## SECTION 3 — OVERPAYMENT POLICY (CRITICAL)

### 3.1 เงื่อนไข confirm-payment (implementation จริง)

**ที่มา:** `src/lib/payment-validation.ts` — `validatePaymentConfirm`

- คำนวณ: `totalPaidSatang = sum(existingPayments.amount_satang)`, `afterSatang = totalPaidSatang + newPayment.amount_satang`.
- ตรวจเฉพาะ: `if (afterSatang < invoice.grand_total_satang)` → return ไม่ผ่าน (INSUFFICIENT_AMOUNT).
- ถ้า `afterSatang >= invoice.grand_total_satang` → return ผ่าน.
- **ไม่มีการตรวจว่า `afterSatang > grand_total_satang`** — ไม่ reject กรณีจ่ายเกิน.

### 3.2 พฤติกรรมเมื่อ totalPaid > grand_total_satang

- Validation ผ่าน → ภายใน transaction: สร้าง payment ตาม `amount_satang` ที่ส่งมา, อัปเดต invoice เป็น PAID.
- **ไม่มีการเก็บ credit.**
- **ไม่มีการบันทึกส่วนเกิน (overpayment).**
- **ไม่บังคับให้ amount เท่ากับ grand_total พอดี** — ระบบยอมรับ overpayment และ mark PAID ได้.

### 3.3 Field เก็บ overpayment

**ที่มา:** `src/types/financial.ts` (Payment, Invoice), `src/lib/financial-data.ts` (confirmPaymentAndCreateRecord)

- Payment: มีแค่ `amount_satang`, ไม่มี `overpayment_satang`.
- Invoice: ไม่มี field ส่วนเกินหรือ credit.
- **ไม่มี:** ไม่มีการคำนวณหรือจัดเก็บ overpayment_satang.

**Risk Level:** Medium (ยอดรับจริงกับยอดใบแจ้งหนี้ไม่ตรงกันได้ ไม่มีหลักฐานส่วนเกิน).

### 3.4 แนวทางแก้ (policy + implementation)

**Enterprise standard ที่เสนอ:**

1. **Schema**
   - Payment: เพิ่ม `overpayment_satang?: number` (optional, 0 ถ้าไม่เกิน).
   - หรือเก็บที่ invoice: `overpayment_satang?: number` (รวมของทุก payment ที่เกินใบนี้).

2. **Logic ใน confirm-payment (ภายใน transaction)**
   - หลังคำนวณ `afterSatang`:
     - ถ้า `afterSatang > invoice.grand_total_satang`:  
       `overpayment_satang = afterSatang - invoice.grand_total_satang`  
       เขียนค่านี้ลง payment record (หรือรวมลง invoice ตามนโยบาย).
     - ถ้าไม่เกิน: `overpayment_satang = 0` (หรือไม่ใส่).

3. **นโยบายที่เลือกได้**
   - **A. อนุญาตเกิน + บันทึก:** อย่างน้อยบันทึก overpayment_satang เพื่อรายงาน/credit ภายหลัง.
   - **B. อนุญาตเกิน + credit:** มี collection credit หรือ field customer credit แล้วลดยอดใช้จ่ายครั้งถัดไป.
   - **C. บังคับเท่ากันพอดี:** ปฏิเสธถ้า `amount_satang > (grand_total_satang - totalPaidSatang)` ให้ client ส่งยอดที่เท่ากับยอดค้างเท่านั้น.

**สถานะปัจจุบัน:** ไม่ผ่าน (ไม่มีคำนวณ/จัดเก็บ overpayment).

---

## SECTION 4 — FINAL PRODUCTION VERIFICATION

### 4.1 Refund หัก revenue ตาม refund.created_at หรือย้อนหลัง?

**Implementation:** `getRevenueByDayFromPaidInvoices` หัก refund ตาม `refund.created_at` (วันที่สร้าง refund). ไม่มีการย้อนไปแก้ revenue วันที่ invoice ถูก paid.

**ผล:** หักตาม **refund.created_at** (ไม่ย้อนหลัง). ผ่าน.

---

### 4.2 confirm-payment ใช้ Firestore transaction และ lock invoice document จริงหรือไม่?

**Implementation:** `confirmPaymentAndCreateRecord` ใช้ `db.runTransaction(async (tx) => { ... })`. ภายใน transaction:

- `tx.get(invRef)` — อ่าน invoice
- ตรวจ status === "PENDING"
- `tx.set(paymentRef, ...)` — สร้าง payment
- `tx.update(invRef, { status: "PAID", paid_at, confirmed_by, updated_at })`
- `tx.set(auditRef, ...)` — เขียน audit log

Firestore transaction ให้ serializable isolation: การ read แล้ว write document เดิม (invRef) จะทำให้ concurrent transaction ที่เขียน document เดิม fail หรือ retry. จึงถือได้ว่ามีการ "lock" ในระดับ transaction (ไม่มี explicit lock field).

**ผล:** ใช้ Firestore transaction จริง และ invoice ถูก read-then-update ใน transaction เดียว. ผ่าน.

---

### 4.3 Client retry API 3 ครั้ง — idempotency ป้องกัน duplicate ได้ครบหรือไม่?

**Implementation:** `POST .../confirm-payment`:

1. อ่าน `idempotency_key` จาก body (required).
2. เรียก `getPaymentByInvoiceIdAndIdempotencyKey(invoiceId, idempotencyKey)` **ก่อน** เรียก `confirmPaymentAndCreateRecord`.
3. ถ้าเจอ payment เดิม → return 200 พร้อม `payment` เดิม, `idempotency: true` — **ไม่เข้า transaction.**
4. Request ที่ 2 และ 3 ที่ใช้ `idempotency_key` เดิม: จะเจอ payment ที่ request 1 สร้าง → ได้ 200 และ payment เดิม ไม่สร้าง payment ซ้ำ.

**ผล:** ป้องกัน duplicate ได้ครบ (request 2 และ 3 ได้ 200 + payment เดิม, ไม่สร้าง record ซ้ำ). ผ่าน.

---

### 4.4 revenueByDay ใช้ invoice.paid_at หรือ created_at?

**Implementation:** `getRevenueByDayFromPaidInvoices` ใช้ `data.paid_at` เพื่อได้ `key` (วันที่) สำหรับบวก revenue (บรรทัด 105–108). ไม่ใช้ `created_at`.

**ผล:** ใช้ **invoice.paid_at**. ผ่าน.

---

### 4.5 Dashboard query มี composite index รองรับ org_id + status + date filter หรือไม่?

**Implementation:**

- `getRevenueFromPaidInvoices`: query `invoices` where `org_id` + `status === "PAID"`, limit 2000. กรอง `from`/`to` ตาม `paid_at` **ใน memory** (ไม่ได้ใช้ where paid_at ใน Firestore).
- `getRevenueByDayFromPaidInvoices`: query `invoices` where `org_id` + `status === "PAID"`, limit 2000. กรอง 7 วันและ branch ใน memory.

**firestore.indexes.json:** ไม่มี index ของ collection `invoices` หรือ `refunds` เลย. มีแค่ org_id+status สำหรับ collection อื่น (เช่น bookings, promotions).

- Query ที่ใช้จริง: `org_id` + `status` (equality). Firestore ใช้ single-field index ได้สำหรับ equality ต่อ field.
- **ไม่มี composite index ที่รวม `paid_at`** เพราะไม่ได้ใช้ `paid_at` ใน where clause (กรองใน memory). ดังนั้นถ้าอนาคตเปลี่ยนเป็น where `paid_at` >= / <= จะต้องมี composite index เช่น (org_id, status, paid_at).

**ผล:** ปัจจุบัน query ใช้แค่ org_id + status; **ไม่มี composite index สำหรับ invoices (org_id + status)** ในไฟล์ index (Firestore อาจสร้าง auto index สำหรับ equality 2 fields). **ไม่มี index สำหรับ date range บน paid_at** เพราะไม่ได้ query ตาม paid_at ใน Firestore.  
**สถานะ:** ไม่สมบูรณ์ — ถ้า scale ใหญ่และต้องการ filter ตาม paid_at ใน query ต้องเพิ่ม composite index และเปลี่ยน logic ให้ใช้ where paid_at; ปัจจุบัน filter ใน memory กับ 2000 docs ยังทำได้แต่ไม่เหมาะกับข้อมูลจำนวนมาก.

**Risk Level:** Low กับข้อมูลไม่มาก; Medium ถ้า invoice/refund มาก (2000+ ต่อ org).

---

## สรุปตารางการตรวจสอบ

| หัวข้อ | ผ่าน/ไม่ผ่าน | Risk Level |
|--------|---------------|------------|
| Refund timing — ใช้ created_at หักต่อวัน, ใช้ paid_at เป็นฐานรายได้ (แบบ A) | ผ่าน | Low |
| Refund — มี approved_by/confirmed_by | ไม่ผ่าน | Medium |
| Refund — permission finance:refund | ผ่าน (ผ่าน role) | Low |
| Refund — เขียน audit log | ไม่ผ่าน | Medium |
| Refund — ใช้ Firestore transaction | ไม่ผ่าน | Low–Medium |
| Overpayment — มีการคำนวณ/จัดเก็บ overpayment_satang | ไม่ผ่าน | Medium |
| confirm-payment ใช้ transaction + lock invoice | ผ่าน | Low |
| Idempotency ป้องกัน duplicate retry | ผ่าน | Low |
| revenueByDay ใช้ paid_at | ผ่าน | Low |
| Dashboard — composite index org_id+status+date | ไม่สมบูรณ์ (ไม่มี index invoices/refunds, filter date ใน memory) | Low–Medium |

---

## แนวทางแก้ไขเชิง implementation (สรุป)

1. **Refund audit log:** หลัง `createRefund` (หรือภายใน transaction ถ้าใช้ transaction) เรียก `appendFinancialAuditLog` สำหรับ entity_type "refund", action "create" พร้อม payload ที่จำเป็น.
2. **Refund approved_by/approved_at:** เพิ่ม field ใน schema และใน `createRefund`; ถ้ามี workflow อนุมัติ แยก endpoint อนุมัติแล้วอัปเดต approved_by, approved_at (และอาจ status).
3. **Refund transaction:** ห่อการสร้าง refund + audit log ใน `db.runTransaction`; ถ้ามีการอัปเดต invoice/payment (เช่น flag) ให้ทำใน transaction เดียวกัน.
4. **Overpayment:** ใน confirm-payment (ภายใน transaction) คำนวณ `overpayment_satang = max(0, afterSatang - invoice.grand_total_satang)` แล้วเขียนลง payment (หรือ invoice) ตามนโยบาย; เพิ่ม type/field ใน schema.
5. **Index:** เพิ่ม composite index สำหรับ `invoices` (org_id, status, paid_at) และถ้า query refund ตาม created_at + org_id ให้เพิ่ม index `refunds` (org_id, created_at). Deploy ด้วย `firebase deploy --only firestore:indexes`. ถ้าต้องการลด read กับข้อมูลใหญ่ พิจารณาเปลี่ยน logic ให้ filter paid_at ใน query แทนใน memory.

---

*รายงานนี้อิงจาก codebase ปัจจุบันเท่านั้น*
