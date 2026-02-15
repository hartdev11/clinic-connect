/**
 * Enterprise: Confirm payment — Idempotency + Firestore transaction
 * Request: amount_satang, idempotency_key (required). Duplicate key → 200 with existing payment.
 * AI ห้ามเรียก endpoint นี้
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getEffectiveUser, requireRole, requireBranchAccess } from "@/lib/rbac";
import {
  getInvoiceById,
  listPaymentsByInvoiceId,
  getPaymentByInvoiceIdAndIdempotencyKey,
  getPaymentById,
  confirmPaymentAndCreateRecord,
} from "@/lib/financial-data";
import { validatePaymentConfirm } from "@/lib/payment-validation";
import { recordPaymentSuccess, recordPaymentFail } from "@/lib/observability";
import type { PaymentCreate } from "@/types/financial";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: invoiceId } = await params;
  if (!invoiceId) {
    return NextResponse.json({ error: "invoice id required" }, { status: 400 });
  }

  const user = await getEffectiveUser(session);
  const canConfirm = requireRole(user.role, ["owner", "manager", "staff"]);
  if (!canConfirm) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ยืนยันการรับเงิน" },
      { status: 403 }
    );
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "ไม่พบใบแจ้งหนี้" }, { status: 404 });
  }

  if (invoice.org_id !== session.org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, invoice.branch_id ?? null)) {
    return NextResponse.json(
      { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงสาขานี้" },
      { status: 403 }
    );
  }

  let body: {
    amount_satang: number;
    method?: PaymentCreate["method"];
    reference?: string | null;
    idempotency_key: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amountSatang = body.amount_satang != null ? Number(body.amount_satang) : NaN;
  if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
    return NextResponse.json(
      { error: "amount_satang must be a positive integer (satang)" },
      { status: 400 }
    );
  }

  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "idempotency_key is required" },
      { status: 400 }
    );
  }

  const method = body.method ?? "CASH";
  const validMethods: PaymentCreate["method"][] = ["CASH", "TRANSFER", "CARD", "OTHER"];
  if (!validMethods.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  const existingByKey = await getPaymentByInvoiceIdAndIdempotencyKey(invoiceId, idempotencyKey);
  if (existingByKey) {
    recordPaymentSuccess();
    return NextResponse.json({
      ok: true,
      paymentId: existingByKey.id,
      payment: existingByKey,
      idempotency: true,
    });
  }

  const existingPayments = await listPaymentsByInvoiceId(invoiceId);
  const paymentCreate: PaymentCreate = {
    org_id: invoice.org_id,
    invoice_id: invoiceId,
    amount_satang: amountSatang,
    method,
    reference: body.reference ?? null,
    idempotency_key: idempotencyKey,
    created_by: session.user_id ?? "system",
  };

  const validation = validatePaymentConfirm(invoice, paymentCreate, existingPayments, {
    hasPermission: true,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.message, code: validation.code },
      { status: 400 }
    );
  }

  try {
    const { paymentId, existing } = await confirmPaymentAndCreateRecord({
      invoiceId,
      invoice,
      payment: paymentCreate,
      confirmedBy: session.user_id ?? "system",
    });
    recordPaymentSuccess();
    const payment = await getPaymentById(paymentId);
    return NextResponse.json({
      ok: true,
      paymentId,
      payment: payment ?? undefined,
      idempotency: existing,
    });
  } catch (err) {
    console.error("confirm-payment error:", err);
    recordPaymentFail();
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
