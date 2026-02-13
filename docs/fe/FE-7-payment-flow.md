# FE-7 — Payment Flow (รองรับ E7)

## วัตถุประสงค์
- เชื่อม payment gateway (Stripe / Omise)
- Redirect / callback handling
- แสดงสถานะ: success, pending, failed

## Constraints
- Frontend ไม่ถือ logic การเงิน
- ทุก transaction ต้อง confirm จาก backend

## สิ่งที่ทำ

### 1. Payment Gateway — Stripe (มีอยู่แล้ว)
**File**: `src/app/api/clinic/checkout/route.ts`

- สร้าง Stripe Checkout Session → redirect ไป Stripe
- success_url: `?checkout=success&session_id={CHECKOUT_SESSION_ID}` (FE-7 — เพิ่ม session_id)
- cancel_url: `?checkout=cancelled`
- Omise: ยังไม่ implement — ใช้ pattern เดียวกันเมื่อเปิด

### 2. Verify API — ยืนยัน transaction จาก backend
**File**: `src/app/api/clinic/checkout/verify/route.ts`

- `GET /api/clinic/checkout/verify?session_id=xxx`
- ดึง Stripe Checkout Session ตรวจสอบ status, payment_status
- คืน `{ status: 'success' | 'pending' | 'failed', message?, plan? }`
- ตรวจว่า session เป็นของ org เดียวกับ user

### 3. BillingSection — แสดงสถานะจาก backend
**File**: `src/components/clinic/BillingSection.tsx`

- เมื่อ `checkout=success` และมี `session_id` → เรียก verify API ก่อนแสดงผล
- แสดงตาม status ที่ backend ส่งกลับ:
  - **success**: banner สีเขียว "ชำระเงินสำเร็จ"
  - **pending**: banner สีเหลือง "รอการชำระเงิน"
  - **failed**: banner สีแดง "การชำระเงินไม่สำเร็จ"
- รองรับ `?checkout=pending`, `?checkout=failed` โดยตรง (สำหรับ gateway อื่น)
- กรณี mid-cycle upgrade (ไม่มี redirect) → ใช้ upgradeSuccess เหมือนเดิม

### 4. Reuse Payment UI
- ใช้ BillingSection เดิม — เพิ่ม verify flow และสถานะ pending/failed

## Flow

```
User กดสมัคร/อัปเกรด
  → POST /api/clinic/checkout
  → Redirect ไป Stripe
  → ชำระเงิน
  → Redirect กลับ ?checkout=success&session_id=xxx
  → Frontend เรียก GET /api/clinic/checkout/verify?session_id=xxx
  → Backend ตรวจ Stripe → คืน status
  → Frontend แสดงผลตาม status (success/pending/failed)
```

## หมายเหตุ
- Webhook Stripe (`/api/webhooks/stripe`) ยังคงทำงาน — ใช้สำหรับ fulfillment หลัก
- Verify API เป็นการ confirm เพิ่มเติมสำหรับ UI — ไม่แทนที่ webhook
