/**
 * Enterprise: Get invoice by id
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { getInvoiceById, listPaymentsByInvoiceId } from "@/lib/financial-data";

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

  const payments = await listPaymentsByInvoiceId(invoiceId);
  return NextResponse.json({ invoice, payments });
}
