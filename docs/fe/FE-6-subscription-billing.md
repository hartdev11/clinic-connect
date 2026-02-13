# FE-6 — Subscription & Billing UI (รองรับ E6)

## วัตถุประสงค์
- แสดง plan ปัจจุบัน (per-branch)
- Upgrade / Downgrade UI
- แสดง proration (estimate)
- Fair Use: warning (ไม่ block UI), soft block เมื่อ backend ส่ง flag
- Add-on: ซ่อนเมื่อ backend ยังไม่เปิด

## สิ่งที่ทำ

### 1. Subscription API — เพิ่ม fairUse, addOnEnabled
**File**: `src/app/api/clinic/subscription/route.ts`

- เรียก `enforceLimits(orgId, "check")` ร่วมกับ `getSubscriptionByOrgId`
- คืน `fairUse`: `{ warning, softBlock, usagePercent, currentBranches, maxBranches }`
- คืน `addOnEnabled`: `false` (E6.10 Design only — ยังไม่เปิด)

### 2. BillingSection — UI ทั้งหมด
**File**: `src/components/clinic/BillingSection.tsx`

#### แผนปัจจุบัน (per-branch)
- แสดง plan name, status, current period end
- แสดงสาขา: `currentBranches / maxBranches` จาก fairUse

#### Upgrade UI
- ปุ่ม "อัปเกรด" สำหรับ plan ที่สูงกว่า
- กดอัปเกรด → เรียก `GET /api/clinic/checkout/preview?plan=...` เพื่อดึง proration estimate
- แสดงส่วนต่าง (proration) จาก backend — ไม่คำนวณเอง
- ปุ่ม "ยืนยันอัปเกรด" หลังเห็น estimate

#### Downgrade UI
- แผนที่ต่ำกว่าปัจจุบัน → แสดง "Downgrade — มีผลสิ้นรอบปัจจุบัน"
- ปุ่ม "ติดต่อทีมขาย" (disabled) — backend ยังไม่มี downgrade API

#### Fair Use
- **warning (80%)**: แสดง banner "การใช้สาขา X% — ใกล้ถึงขีดจำกัด"
- **softBlock (100%)**: แสดง "ถึงขีดจำกัดสาขาแล้ว — กรุณาอัปเกรด plan"
- ไม่ block UI — แค่แจ้งเตือน

#### Add-on
- แสดงเฉพาะเมื่อ `addOnEnabled === true` — ปัจจุบันซ่อนไว้

### 3. Proration Preview
- ใช้ `GET /api/clinic/checkout/preview?plan=xxx` จาก backend
- แสดง `prorationAmount` ในหน่วยที่ backend ส่ง (THB = satang, หาร 100 สำหรับ display)

## Constraints

✅ **Pricing เดิม** — ใช้ต่อ (hasPrice, plans)
✅ **อย่าคำนวณเงินเอง** — ใช้ backend response เท่านั้น
✅ **Fair Use** — แสดง warning, soft block ตาม flag จาก backend
✅ **Add-on** — ซ่อนเมื่อ backend ไม่เปิด
