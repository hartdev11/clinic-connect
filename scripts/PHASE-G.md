# Phase G — Security & Audit

## ต้องตรวจ (5 ข้อ)

### 1. Refund มี user_id ใน audit

- **ที่ตรวจ:** `createRefundWithAudit` ใน `src/lib/financial-data.ts` — บันทึก `financial_audit_log` ตอนสร้าง refund
- **ผล:** ผ่าน — audit record มี `user_id: data.created_by` (บรรทัด ~529)
- **ไฟล์:** `src/lib/financial-data.ts` (tx.set auditRef สำหรับ refund)

### 2. Payment มี created_by

- **ที่ตรวจ:** `confirmPaymentAndCreateRecord` — บันทึก payment document
- **ผล:** ผ่าน — payment document มี `created_by: params.payment.created_by` (บรรทัด ~414)
- **ไฟล์:** `src/lib/financial-data.ts`

### 3. ไม่มี public endpoint เขียน financial

- **ที่ตรวจ:** ทุก endpoint ที่เขียน invoices / payments / refunds ต้องมี auth (session) และ return 401 ถ้าไม่มี session
- **Financial write endpoints:**
  - `POST /api/clinic/invoices/[id]/confirm-payment` — ใช้ `getSessionFromCookies()`, 401 ถ้า `!session`
  - `POST /api/clinic/invoices/[id]/refunds` — ใช้ `getSessionFromCookies()`, 401 ถ้า `!session`
- **ไม่มี** `POST /api/clinic/invoices` (สร้าง invoice จาก client) — การสร้าง invoice ใช้ `createInvoice()` จาก lib เรียกจาก backend/script เท่านั้น
- **ผล:** ผ่าน — ไม่มี public endpoint เขียน financial

### 4. API ตรวจ org_id ทุกครั้ง

- **ที่ตรวจ:** ทุก API ที่อ่าน/เขียน financial ต้องตรวจ `invoice.org_id === session.org_id` (หรือ resource org ตรง session)
- **ผล:** ผ่าน
  - `GET/POST /api/clinic/invoices/[id]` — ตรวจ `invoice.org_id !== session.org_id` → 403
  - `POST .../confirm-payment` — ตรวจ `invoice.org_id !== session.org_id` → 403
  - `GET/POST .../refunds` — ตรวจ `invoice.org_id !== session.org_id` → 403
- **ไฟล์:** `src/app/api/clinic/invoices/[id]/route.ts`, `confirm-payment/route.ts`, `refunds/route.ts`

### 5. ไม่มี client-side calculated total

- **ที่ตรวจ:** ยอด total (subtotal, grand_total, applied_satang) ต้องไม่ใช้ค่าที่ client ส่งมาเป็นหลักในการเขียน — ต้องคำนวณหรือตรวจจาก server
- **ผล:** ผ่าน
  - **Invoice create:** ไม่มี API ให้ client สร้าง invoice โดยส่ง `grand_total_satang` มา — `createInvoice` ถูกเรียกจาก backend/script เท่านั้น
  - **Payment confirm:** Client ส่ง `amount_satang` มา แต่ server คำนวณ `applied_satang` และ `overpayment_satang` จาก `invoice` (remaining, grand_total) ภายใน transaction — ไม่ trust client total
  - **Refund:** Client ส่ง `amount_satang` แต่ server ตรวจ `afterRefund <= grandTotalSatang` และอ่าน `refunded_total_satang` จาก Firestore
- **ไฟล์:** `src/lib/financial-data.ts` (confirmPaymentAndCreateRecord, createRefundWithAudit)

---

## Validate

```bash
npx tsx scripts/validate-security-audit-phase-g.ts
```

สคริปต์ตรวจ 5 ข้อโดยอ่าน source และรายงาน PASS/FAIL.

---

Stop after Phase G.
