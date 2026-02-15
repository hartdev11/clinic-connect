# Phase H — Financial Reconciliation Manual Test

## ต้องตรวจ

สุ่ม **100 invoice** (หรือทั้งหมดถ้าน้อยกว่า 100):

1. **Manual คำนวณ payment** — สำหรับแต่ละ invoice: sum(payment.applied_satang), sum(payment.overpayment_satang) จาก collection `payments` ที่ `invoice_id == invoice.id`  
   เปรียบเทียบกับ: `invoice.paid_total_satang`, `invoice.overpayment_total_satang` (จาก Firestore doc)

2. **Manual คำนวณ refund** — สำหรับแต่ละ invoice: sum(refund.amount_satang) จาก collection `refunds` ที่ `invoice_id == invoice.id`  
   เปรียบเทียบกับ: `invoice.refunded_total_satang`

3. **Manual คำนวณ dashboard** — เลือก org (จาก sample หรือ `RECONCILE_ORG_ID`), ช่วง 30 วันล่าสุด:
   - Manual: sum(PAID invoice grand_total_satang ในช่วง) - sum(refund amount_satang ในช่วง) → revenue (baht)
   - API: `getRevenueFromPaidInvoices(orgId, { from, to })` (baht)
   - เปรียบเทียบ manual vs API (ยอม tolerance 0.01 baht)

**ถ้า mismatch แม้ 1 → FAIL**

## Run

```bash
npx tsx scripts/reconcile-financial-phase-h.ts
```

**Env:** `FIREBASE_*` or `FIREBASE_SERVICE_ACCOUNT_PATH`, optional `RECONCILE_ORG_ID` (สำหรับ dashboard; ถ้าไม่ใส่ใช้ org_id จาก invoice แรกใน sample).

**หมายเหตุ:** ต้อง deploy Firestore indexes (Phase D) ก่อน ถ้า dashboard query ยังไม่ได้ index จะ error.

---

Stop after Phase H.
