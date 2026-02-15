/**
 * Enterprise Payment Validation — ใช้ satang (integer) เท่านั้น
 * AI ห้ามเรียก logic นี้เพื่อ mark paid เอง
 */
import type { Invoice, Payment, PaymentCreate } from "@/types/financial";

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

const CODES = {
  INVOICE_NOT_PENDING: "INVOICE_NOT_PENDING",
  INVOICE_CANCELLED: "INVOICE_CANCELLED",
  INSUFFICIENT_AMOUNT: "INSUFFICIENT_AMOUNT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
} as const;

/**
 * Validate before setting invoice to PAID.
 * All amounts in satang (integer).
 */
export function validatePaymentConfirm(
  invoice: Invoice,
  newPayment: PaymentCreate,
  existingPayments: Payment[],
  options: { hasPermission: boolean }
): PaymentValidationResult {
  if (invoice.status !== "PENDING") {
    return {
      ok: false,
      code: invoice.status === "CANCELLED" ? CODES.INVOICE_CANCELLED : CODES.INVOICE_NOT_PENDING,
      message:
        invoice.status === "CANCELLED"
          ? "ใบแจ้งหนี้ถูกยกเลิกแล้ว"
          : "สามารถยืนยันการชำระได้เฉพาะใบแจ้งหนี้สถานะ PENDING เท่านั้น",
    };
  }

  if (!options.hasPermission) {
    return {
      ok: false,
      code: CODES.PERMISSION_DENIED,
      message: "ไม่มีสิทธิ์ยืนยันการรับเงิน",
    };
  }

  const totalPaidSatang = existingPayments.reduce((sum, p) => sum + p.amount_satang, 0);
  const afterSatang = totalPaidSatang + newPayment.amount_satang;
  if (afterSatang < invoice.grand_total_satang) {
    return {
      ok: false,
      code: CODES.INSUFFICIENT_AMOUNT,
      message: `ยอดชำระยังไม่ครบ (ต้องการ ${invoice.grand_total_satang} สตางค์ รวมแล้ว ${afterSatang} สตางค์)`,
    };
  }

  return { ok: true };
}
