/**
 * Enterprise: Refunds — Invoice must be PAID, refund <= payment, permission finance:refund
 * No hard delete; refunds are immutable records.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getEffectiveUser, requireRole, requireBranchAccess } from "@/lib/rbac";
import {
  getInvoiceById,
  getPaymentById,
  listRefundsByInvoiceId,
  createRefundWithAudit,
} from "@/lib/financial-data";
import { recordRefundSuccess, recordRefundFail } from "@/lib/observability";

/** finance:refund — ใช้ owner/manager จนกว่าจะมี RBAC แยก permission */
const REFUND_ROLES: import("@/types/organization").UserRole[] = ["owner", "manager"];

export async function GET(
  _request: NextRequest,
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
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "ไม่พบใบแจ้งหนี้" }, { status: 404 });
  }
  if (invoice.org_id !== session.org_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await getEffectiveUser(session);
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, invoice.branch_id ?? null)) {
    return NextResponse.json(
      { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึงสาขานี้" },
      { status: 403 }
    );
  }
  const refunds = await listRefundsByInvoiceId(invoiceId);
  return NextResponse.json({ refunds });
}

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
  const canRefund = requireRole(user.role, REFUND_ROLES);
  if (!canRefund) {
    return NextResponse.json(
      { error: "ไม่มีสิทธิ์ทำรายการคืนเงิน (finance:refund)" },
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

  if (invoice.status !== "PAID") {
    return NextResponse.json(
      { error: "สามารถคืนเงินได้เฉพาะใบแจ้งหนี้ที่ชำระแล้ว (PAID) เท่านั้น" },
      { status: 400 }
    );
  }

  let body: { payment_id: string; amount_satang: number; reason: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id.trim() : "";
  const amountSatang = body.amount_satang != null ? Number(body.amount_satang) : NaN;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!paymentId) {
    return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
  }
  if (!Number.isInteger(amountSatang) || amountSatang <= 0) {
    return NextResponse.json(
      { error: "amount_satang must be a positive integer (satang)" },
      { status: 400 }
    );
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const payment = await getPaymentById(paymentId);
  if (!payment || payment.invoice_id !== invoiceId) {
    return NextResponse.json({ error: "ไม่พบ payment ที่เชื่อมกับใบแจ้งหนี้นี้" }, { status: 404 });
  }

  const refundsForPayment = await listRefundsByInvoiceId(invoiceId).then((list) =>
    list.filter((r) => r.payment_id === paymentId)
  );
  const alreadyRefundedSatang = refundsForPayment.reduce((s, r) => s + r.amount_satang, 0);
  const maxRefundSatang = payment.amount_satang - alreadyRefundedSatang;
  if (amountSatang > maxRefundSatang) {
    return NextResponse.json(
      {
        error: `ยอดคืนเงินเกินยอดที่ชำระ (ชำระ ${payment.amount_satang} สตางค์, คืนไปแล้ว ${alreadyRefundedSatang} สตางค์, คืนได้สูงสุด ${maxRefundSatang} สตางค์)`,
      },
      { status: 400 }
    );
  }

  try {
    const refundId = await createRefundWithAudit({
      org_id: invoice.org_id,
      invoice_id: invoiceId,
      payment_id: paymentId,
      amount_satang: amountSatang,
      reason,
      created_by: session.user_id ?? "system",
    });
    recordRefundSuccess();
    return NextResponse.json({ ok: true, refundId, invoiceId });
  } catch (err) {
    console.error("refund create error:", err);
    recordRefundFail();
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
