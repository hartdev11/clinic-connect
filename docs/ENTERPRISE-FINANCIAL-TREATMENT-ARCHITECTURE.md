# Enterprise Financial & Treatment Architecture

**Scope:** Clinic Admin Dashboard — Dynamic Treatment, Invoice, Payment, Revenue  
**Principles:** Booking ≠ Revenue | Invoice PENDING ≠ Revenue | Invoice PAID = Revenue | AI ห้าม mark paid

---

## 1. Full Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TREATMENT CATALOG (Dynamic Data)                                            │
│ treatments, treatment_pricing_overrides (branch/doctor)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BOOKING (Not Revenue)                                                        │
│ customer_id, selected_treatments[], estimated_total, status                 │
│ → Draft / Pending / Confirmed / In Progress                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼ (เมื่อทำบริการจริง)
┌─────────────────────────────────────────────────────────────────────────────┐
│ TREATMENT EXECUTION                                                          │
│ สร้าง Invoice: line_items[], subtotal, discount_total, tax_total, grand_total │
│ status = PENDING                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAYMENT (Strict Validation)                                                  │
│ CASH | TRANSFER | CARD | MIXED                                               │
│ Validate: PENDING, amount >= grand_total, no duplicate, permission, confirm   │
│ → Create Payment Record → invoice.status = PAID                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ REVENUE                                                                      │
│ SUM(invoice.grand_total WHERE status = 'PAID')                               │
│ Projected = SUM(invoice.grand_total WHERE status = 'PENDING')                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ER Diagram (Text-based)

```
Organization 1──* Branch
Organization 1──* User
Organization 1──* Customer
Organization 1──* TreatmentCatalog (treatment definitions)
Organization 1──* Booking
Organization 1──* Invoice
Organization 1──* Payment
Organization 1──* Package (customer package: sessions, expiry)

Branch 1──* TreatmentPricingOverride (optional branch-specific price)
Branch 1──* Booking
Branch 1──* Invoice

Booking *──1 Customer
Booking 1──0..1 Invoice (one invoice per booking when executed)
Booking 0..*──* TreatmentCatalog (selected_treatments as refs)

Invoice 1──* InvoiceLineItem (treatment_id, quantity, unit_price, discount, total)
Invoice 1──* Payment (when PAID: one or more payment records for mixed)

Package *──1 Customer
Package 0..*──* Booking (session deducted when booking completed)

FinancialAuditLog: org_id, entity_type, entity_id, action, user_id, timestamp, payload (immutable)
```

---

## 3. Database Schema (Firestore / SQL-ready)

### 3.1 treatments (Treatment Catalog — Dynamic)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | ✓ | Auto |
| org_id | string | ✓ | |
| treatment_id | string | ✓ | Unique within org (e.g. code) |
| treatment_name | string | ✓ | |
| category | string | | e.g. "botox", "filler", "facial" |
| base_price | number | ✓ | บาท |
| duration_minutes | number | | |
| commission_rule | string / object | | Optional JSON |
| consumable_cost | number | | บาท |
| tax_applicable | boolean | | default true |
| active_status | "active" \| "inactive" | ✓ | |
| created_at | ISO | ✓ | |
| updated_at | ISO | ✓ | |

### 3.2 treatment_pricing_overrides (Optional)

| Field | Type | Description |
|-------|------|-------------|
| org_id | string | |
| treatment_id | string | FK to treatment |
| branch_id | string? | Null = org-wide |
| doctor_id | string? | Optional doctor-specific |
| override_price | number | บาท |
| valid_from | ISO? | |
| valid_to | ISO? | |

### 3.3 packages (Customer Package — Sessions)

| Field | Type | Description |
|-------|------|-------------|
| id | string | |
| org_id | string | |
| customer_id | string | |
| package_id | string | Reference to package definition (if any) or name |
| total_sessions | number | |
| used_sessions | number | |
| remaining_sessions | number | |
| package_price | number | บาท (for deferred revenue) |
| expiry_date | ISO | |
| status | "active" \| "expired" \| "consumed" | |
| created_at | ISO | |
| updated_at | ISO | |

### 3.4 bookings (Extended — Not Revenue)

Existing fields +:

| Field | Type | Description |
|-------|------|-------------|
| selected_treatments | array | [{ treatment_id, quantity, unit_price?, package_session_used? }] |
| estimated_total | number | บาท (from catalog at booking time) |
| invoice_id | string? | Set when invoice created (execution) |

Booking ≠ Revenue. Revenue only when Invoice PAID.

### 3.5 invoices (Enterprise: เงินเก็บเป็น satang — integer เท่านั้น)

| Field | Type | Description |
|-------|------|-------------|
| id | string | |
| org_id | string | |
| branch_id | string? | |
| booking_id | string? | |
| customer_id | string? | |
| line_items | array | [{ treatment_id, treatment_name, quantity, unit_price_satang, discount_satang, final_line_total_satang }] |
| subtotal_satang | number | integer สตางค์ |
| discount_total_satang | number | integer สตางค์ |
| tax_total_satang | number | integer สตางค์ |
| grand_total_satang | number | integer สตางค์ |
| status | "PENDING" \| "PAID" \| "CANCELLED" | ห้าม endpoint ใดอัปเดตโดยตรง ยกเว้น confirm-payment ใน transaction |
| created_by | string | user id |
| created_at | ISO | |
| updated_at | ISO | |
| paid_at | ISO? | |
| confirmed_by | string? | user id who confirmed payment |

### 3.6 invoice_line_items (Embedded; หน่วยสตางค์)

| Field | Type | |
|-------|------|--|
| treatment_id | string | |
| treatment_name | string | |
| quantity | number | |
| unit_price_satang | number | integer |
| discount_satang | number | integer |
| final_line_total_satang | number | integer |

### 3.7 payments (Enterprise: amount_satang + idempotency_key)

| Field | Type | Description |
|-------|------|-------------|
| id | string | |
| org_id | string | |
| invoice_id | string | |
| amount_satang | number | integer สตางค์ |
| method | "CASH" \| "TRANSFER" \| "CARD" \| "OTHER" | |
| reference | string? | e.g. slip no, last 4 digits |
| idempotency_key | string | UUID — ป้องกัน duplicate payment |
| created_by | string | |
| confirmed_by | string? | |
| created_at | ISO | |
| updated_at | ISO | |

### 3.8 refunds (Enterprise)

| Field | Type | Description |
|-------|------|-------------|
| id | string | |
| org_id | string | |
| invoice_id | string | |
| payment_id | string | |
| amount_satang | number | integer สตางค์ — ห้ามเกินยอด payment |
| reason | string | |
| created_by | string | |
| created_at | ISO | |

- ห้าม refund ถ้า invoice ไม่ใช่ PAID
- ห้าม refund เกินยอด payment (รวม refund เดิมของ payment นั้น)
- สิทธิ์: finance:refund (owner/manager)

### 3.9 financial_audit_log (Immutable)

| Field | Type | |
|-------|------|--|
| org_id | string | |
| entity_type | "invoice" \| "payment" \| "refund" \| "booking" | |
| entity_id | string | |
| action | "create" \| "update" \| "confirm_payment" \| "cancel" | |
| user_id | string | |
| timestamp | ISO | |
| payload | object | Snapshot / diff (no PII in logs if needed) |

---

## 4. Payment Validation Logic (Enterprise)

Before setting `invoice.status = PAID` (ภายใน Firestore transaction เท่านั้น):

1. **invoice.status === "PENDING"** — ห้าม mark paid ถ้าไม่ใช่ PENDING
2. **Sum(payments for this invoice) + newPayment.amount_satang >= invoice.grand_total_satang** — หน่วยสตางค์ (integer)
3. **Idempotency** — ถ้า idempotency_key นี้เคยใช้กับ invoice นี้แล้ว → return 200 + payment record เดิม ห้ามสร้างซ้ำ
4. **User permission** — owner, manager, staff เท่านั้น
5. **Invoice not cancelled** — status !== "CANCELLED"
6. **Confirmation step** — UI ต้องยืนยัน "ยืนยันการรับเงิน" ก่อนเรียก API
7. **Transaction** — read invoice → validate PENDING → check idempotency → create payment → update invoice PAID → audit log ใน transaction เดียว
8. **AI ห้าม mark paid** — ไม่มี endpoint ใดให้ AI อัปเดต invoice.status โดยตรง

---

## 5. Revenue Calculation Strategy (Enterprise)

- **Actual Revenue (Dashboard / Reports):**  
  `SUM(invoice.grand_total_satang WHERE status='PAID') - SUM(refund.amount_satang)`  
  แปลงเป็นบาทเฉพาะตอนแสดงผล UI เท่านั้น  
  ใช้ `getRevenueFromPaidInvoices(orgId, { branchId?, from?, to? })` — ห้ามดึงจาก `transactions`.

- **Revenue by day (Chart):**  
  จาก PAID invoices ตาม paid_at ลดด้วย refund ตาม created_at ต่อวัน — `getRevenueByDayFromPaidInvoices(orgId, { branchId? })`.

- **Projected Revenue (Optional):**  
  `SUM(invoice.grand_total_satang)` WHERE `status = 'PENDING'` — `getProjectedRevenueFromPendingInvoices`.

- **Deprecated:** Dashboard ห้ามใช้ collection `transactions` เป็นแหล่งรายได้อีก — เลือก invoices เท่านั้น (และ refund หักออก).
- **Deferred Revenue (Packages):** เมื่อมี package ขาย รู้จักรายได้ตามเวลา (optional).

---

## 6. Multi-Branch Support

- Every `invoice`, `booking`, `payment` has `org_id` and optional `branch_id`.
- Revenue reports filter by `branch_id` when user selects branch.
- Treatment pricing can have `treatment_pricing_overrides` by `branch_id` and optionally `doctor_id`.
- Permissions: user can only confirm payment for branches they have access to (`branch_ids` / `branch_roles`).

---

## 7. Role Permission Matrix

| Action | Owner | Manager | Staff (finance) | Staff (other) | AI |
|--------|-------|---------|------------------|---------------|-----|
| View treatments | ✓ | ✓ | ✓ | ✓ | ✓ (read) |
| Create/Edit booking | ✓ | ✓ | ✓ | ✓ | Draft only |
| Create invoice (from execution) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Confirm payment / Mark PAID | ✓ | ✓ | ✓* | ✗ | ✗ |
| Cancel invoice | ✓ | ✓ | ✓* | ✗ | ✗ |
| View revenue | ✓ | ✓ | ✓ | ✓ | ✓ (aggregate only) |
| Edit payment record | ✗ | ✗ | ✗ | ✗ | ✗ |
| Delete financial record | ✗ (soft only) | ✗ | ✗ | ✗ | ✗ |

*If role has finance permission.

---

## 8. Security & Audit Model

- **Immutable log:** Append-only `financial_audit_log`; no update/delete.
- **Soft delete only:** Invoices/payments use `deleted_at` or `status = CANCELLED`; never hard delete.
- **created_by / confirmed_by:** Every write stores user id.
- **Security events:** Log login failures, permission denied for payment confirm, bulk export.
- **AI boundary:** API layer rejects AI-originated requests to set `invoice.status = PAID` or to create/update/delete payment records.

---

## 9. Edge Case Handling

| Case | Handling |
|------|----------|
| Overpayment | Allow mark PAID; store excess as credit or separate refund record (policy-based). |
| Partial payment | Keep invoice PENDING until total payments >= grand_total; support multiple payment records. |
| Invoice already PAID | Reject duplicate confirm; return 409 or clear message. |
| Booking cancelled after invoice created | Invoice can be CANCELLED; no revenue. |
| Package session used | Deduct `used_sessions`; do not create new invoice for same session (booking linked to package). |
| Tax rounding | เก็บเป็น integer satang ใน DB เท่านั้น; แปลงเป็นบาทเฉพาะตอนแสดงผล (ไม่มี float rounding error). |
| Concurrent confirm | Firestore transaction: read invoice → validate PENDING → check idempotency_key → create payment → update PAID → audit log. |
| Duplicate request | Same idempotency_key สำหรับ invoice เดิม → return 200 + payment เดิม ไม่สร้างซ้ำ. |
| Refund | ห้ามเกินยอด payment; invoice ต้อง PAID; สิทธิ์ finance:refund. |

---

## 10. Future Scalability Plan

- **Deferred revenue:** Package sales → recognize per session or time-based.
- **Multi-currency:** Add `currency` to invoice; revenue in base currency with FX rate snapshot.
- **Refunds:** Implemented — collection `refunds`, revenue = PAID - SUM(refund.amount_satang); API POST/GET `/api/clinic/invoices/[id]/refunds`.
- **Integrations:** POS, bank feed — import as pending payments; human confirm before PAID.
- **Reporting:** Materialized views or scheduled jobs for daily/monthly revenue by branch, by treatment category.
- **No hardcode:** All treatment names, categories, and pricing from `treatments` + overrides; no treatment-specific logic in code.

---

## 11. Implementation Summary (Codebase)

| Item | Location |
|------|----------|
| Architecture doc | `docs/ENTERPRISE-FINANCIAL-TREATMENT-ARCHITECTURE.md` |
| Types | `src/types/financial.ts` (Treatment, Package, Invoice, Payment, Audit) |
| Payment validation | `src/lib/payment-validation.ts` (validatePaymentConfirm, isDuplicatePayment) |
| Financial data | `src/lib/financial-data.ts` (invoices, payments, revenue from PAID, audit log) |
| Revenue from PAID | `getRevenueFromPaidInvoices(orgId, { branchId?, from?, to? })` |
| Projected revenue | `getProjectedRevenueFromPendingInvoices(orgId, { branchId? })` |
| Confirm payment API | `POST /api/clinic/invoices/[id]/confirm-payment` (body: amount, method, reference?) |
| Get invoice API | `GET /api/clinic/invoices/[id]` (returns invoice + payments) |

**Firestore collections:** `invoices`, `payments`, `financial_audit_log`, `treatments`, `treatment_pricing_overrides`, `packages`.

**Index suggestion:** `invoices` — (org_id, status); `payments` — (invoice_id, created_at).

---

## 12. เงื่อนไขการใช้ (สรุป)

| เรื่อง | เงื่อนไข |
|--------|----------|
| **รายได้ (Revenue)** | นับเฉพาะเมื่อ **Invoice สถานะ PAID** เท่านั้น (SUM(invoice.grand_total WHERE status='PAID')) |
| **Booking** | ยังไม่ถือเป็นรายได้ แค่จอง/estimated_total |
| **Invoice PENDING** | ยังไม่ถือเป็นรายได้ แค่รอชำระ (Projected Revenue แยกแสดงได้) |
| **การยืนยันรับเงิน (Mark PAID)** | ต้องผ่าน validation เท่านั้น และ **AI ห้าม mark paid เอง** |
| **สิทธิ์ยืนยันการชำระ** | เฉพาะ role **owner, manager, staff** และต้องมีสิทธิ์เข้าถึงสาขาของ invoice |
| **ก่อนกดยืนยันรับเงิน** | 1) Invoice ต้องเป็น PENDING 2) ยอดชำระรวม ≥ grand_total 3) ไม่มีการชำระซ้ำ 4) User มี permission |

**Validation ก่อน PAID**
- Invoice ต้อง **status = PENDING** (ถ้า CANCELLED หรือ PAID แล้ว จะยืนยันอีกไม่ได้)
- **ยอดชำระรวม** (เงินเก่าที่บันทึกแล้ว + เงินรอบนี้) **≥ invoice.grand_total**
- **ไม่ซ้ำ**: ไม่มีการชำระจำนวนเท่ากันในเวลาใกล้เคียง (เช่น 1 นาที)
- **สิทธิ์**: เฉพาะคนที่มีสิทธิ์ยืนยันการรับเงิน และเข้าถึงสาขาของ invoice ได้

---

## 13. วิธีใช้

### ดูใบแจ้งหนี้ (Invoice)
- **GET** `/api/clinic/invoices/[id]`  
  ส่งคืน `{ invoice, payments }`  
  ต้อง login และ org ตรงกับ invoice และมีสิทธิ์เข้าถึงสาขา

### ยืนยันการรับเงิน (Mark Invoice = PAID)
1. เปิดใบแจ้งหนี้ที่ **status = PENDING**
2. เรียก **POST** `/api/clinic/invoices/[id]/confirm-payment`  
   **Body (JSON):**
   ```json
   {
     "amount": 1500,
     "method": "CASH",
     "reference": null
   }
   ```
   - **amount** (บาท) — จำนวนที่รับในรอบนี้ (ถ้ารับหลายรอบ รวมแล้วต้อง ≥ grand_total)
   - **method** — `"CASH"` | `"TRANSFER"` | `"CARD"` | `"OTHER"`
   - **reference** (ไม่บังคับ) — เช่น เลขที่อ้างอิง slip, บัตร 4 หลัก
3. ระบบจะตรวจ:
   - สิทธิ์ (owner/manager/staff + branch)
   - Invoice เป็น PENDING และยังไม่ CANCELLED
   - ยอดรวมชำระ ≥ grand_total
   - ไม่ซ้ำกับ payment ที่เพิ่งบันทึก
4. ผ่านแล้ว: สร้าง Payment record + อัปเดต Invoice เป็น **PAID** + ใส่ paid_at, confirmed_by + บันทึก audit log

### คำนวณรายได้ (ในโค้ด/รายงาน)
- **รายได้จริง:** เรียก `getRevenueFromPaidInvoices(orgId, { branchId?, from?, to? })` จาก `@/lib/financial-data`
- **รายได้คาดการณ์ (รอชำระ):** เรียก `getProjectedRevenueFromPendingInvoices(orgId, { branchId? })`

### สร้าง Invoice (เมื่อทำบริการจริง)
- เรียก `createInvoice(data)` จาก `@/lib/financial-data`  
  ใส่ org_id, branch_id?, booking_id?, customer_id?, line_items[], subtotal, discount_total, tax_total, grand_total, created_by  
  สถานะจะได้ **PENDING** — ยังไม่นับเป็นรายได้จนกว่าจะยืนยันรับเงินผ่าน confirm-payment
