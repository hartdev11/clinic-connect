/**
 * Enterprise Financial Data — เก็บเงินเป็น integer satang เท่านั้น
 * Revenue = SUM(invoice.grand_total_satang WHERE status='PAID') - SUM(refund.amount_satang)
 */
import { db } from "@/lib/firebase-admin";
import type { Transaction } from "firebase-admin/firestore";
import { recordTransactionRetry } from "@/lib/observability";
import { satangToBaht, sumSatang } from "@/lib/money";
import type {
  Invoice,
  InvoiceCreate,
  InvoiceStatus,
  Payment,
  PaymentCreate,
  Refund,
  RefundCreate,
  FinancialEntityType,
  FinancialAuditAction,
} from "@/types/financial";

const COLLECTIONS = {
  invoices: "invoices",
  payments: "payments",
  refunds: "refunds",
  financial_audit_log: "financial_audit_log",
  treatments: "treatments",
  treatment_pricing_overrides: "treatment_pricing_overrides",
  packages: "packages",
} as const;

const MAX_TRANSACTION_RETRIES = 2;

function isTransactionAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: number }).code;
  const message = String((err as { message?: string }).message ?? "").toLowerCase();
  return code === 10 || message.includes("abort") || message.includes("transaction");
}

async function runTransactionWithRetry<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
    try {
      return await db.runTransaction(fn);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_TRANSACTION_RETRIES && isTransactionAbortError(err)) {
        recordTransactionRetry();
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function toISO(t: { toDate?: () => Date } | Date | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = t && typeof (t as { toDate?: () => Date }).toDate === "function" ? (t as { toDate: () => Date }).toDate() : null;
  return d ? new Date(d).toISOString() : String(t);
}

function readSatang(d: Record<string, unknown>, key: string, fallbackKey?: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (fallbackKey != null && d[fallbackKey] != null) return Math.round(Number(d[fallbackKey]) * 100);
  return 0;
}

// ─── Revenue: PAID invoices minus refunds ───────────────────────────────────

/**
 * Actual Revenue (satang) = SUM(PAID invoice grand_total_satang) - SUM(refund amount_satang)
 * Returns baht for dashboard display.
 * Uses Firestore paid_at range (and branch_id when set); no in-memory date/branch filter.
 */
export async function getRevenueFromPaidInvoices(
  orgId: string,
  options: { branchId?: string | null; from?: Date; to?: Date } = {}
): Promise<number> {
  const Firestore = await import("firebase-admin/firestore");
  let q: ReturnType<ReturnType<typeof db.collection>["where"]> = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID");

  if (options.branchId != null) {
    q = q.where("branch_id", "==", options.branchId);
  }
  if (options.from != null) {
    q = q.where("paid_at", ">=", Firestore.Timestamp.fromDate(options.from));
  }
  if (options.to != null) {
    q = q.where("paid_at", "<=", Firestore.Timestamp.fromDate(options.to));
  }
  if (options.from != null || options.to != null) {
    q = q.orderBy("paid_at", "asc");
  }
  const snap = await q.limit(2000).get();
  const docs = snap.docs;
  const totalPaidSatang = sumSatang(docs.map((d) => readSatang(d.data(), "grand_total_satang", "grand_total")));
  const refundSatang = await getTotalRefundSatang(orgId, { branchId: options.branchId, from: options.from, to: options.to });
  return satangToBaht(Math.max(0, totalPaidSatang - refundSatang));
}

/**
 * Revenue by day (last 7 days) from PAID invoices only, minus refunds by day.
 * Returns array of { day, revenue } with revenue in baht for chart.
 * Uses Firestore paid_at range (last 7 days) and branch_id when set; no in-memory date/branch filter.
 */
export async function getRevenueByDayFromPaidInvoices(
  orgId: string,
  options: { branchId?: string | null } = {}
): Promise<Array<{ day: string; revenue: number }>> {
  const DAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }

  let qInv: ReturnType<ReturnType<typeof db.collection>["where"]> = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID");
  if (options.branchId != null) {
    qInv = qInv.where("branch_id", "==", options.branchId);
  }
  qInv = qInv
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(sevenDaysAgo))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(now))
    .orderBy("paid_at", "asc")
    .limit(2000);
  const snap = await qInv.get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const paidAt = data.paid_at;
    if (!paidAt) continue;
    const t = paidAt.toDate ? paidAt.toDate() : new Date(paidAt);
    const key = t.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const satang = readSatang(data, "grand_total_satang", "grand_total");
      dayMap.set(key, dayMap.get(key)! + satang);
    }
  }

  const refundSnap = await db
    .collection(COLLECTIONS.refunds)
    .where("org_id", "==", orgId)
    .where("created_at", ">=", Firestore.Timestamp.fromDate(sevenDaysAgo))
    .where("created_at", "<=", Firestore.Timestamp.fromDate(now))
    .orderBy("created_at", "asc")
    .limit(2000)
    .get();

  for (const doc of refundSnap.docs) {
    const data = doc.data();
    const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
    const key = createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const satang = readSatang(data, "amount_satang", "amount");
      dayMap.set(key, Math.max(0, dayMap.get(key)! - satang));
    }
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, satang]) => ({
      day: DAY_LABELS[new Date(dateStr).getUTCDay()],
      revenue: satangToBaht(satang),
    }));
}

/**
 * Revenue by day for a custom date range (for Insights).
 * Returns array of { date, dayLabel, revenue } in baht.
 */
export async function getRevenueByDayFromPaidInvoicesRange(
  orgId: string,
  options: { branchId?: string | null; from: Date; to: Date }
): Promise<Array<{ date: string; dayLabel: string; revenue: number }>> {
  const DAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const Firestore = await import("firebase-admin/firestore");
  const from = new Date(options.from);
  const to = new Date(options.to);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  const dayMap = new Map<string, number>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
    const d = new Date(t);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  let qInv = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID")
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(from))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(to))
    .orderBy("paid_at", "asc")
    .limit(2000);
  if (options.branchId != null) {
    qInv = qInv.where("branch_id", "==", options.branchId) as typeof qInv;
  }
  const snap = await qInv.get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const paidAt = data.paid_at;
    if (!paidAt) continue;
    const t = paidAt.toDate ? paidAt.toDate() : new Date(paidAt);
    const key = t.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const satang = readSatang(data, "grand_total_satang", "grand_total");
      dayMap.set(key, dayMap.get(key)! + satang);
    }
  }
  const refundSnap = await db
    .collection(COLLECTIONS.refunds)
    .where("org_id", "==", orgId)
    .where("created_at", ">=", Firestore.Timestamp.fromDate(from))
    .where("created_at", "<=", Firestore.Timestamp.fromDate(to))
    .orderBy("created_at", "asc")
    .limit(2000)
    .get();
  for (const doc of refundSnap.docs) {
    const data = doc.data();
    const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
    const key = createdAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const satang = readSatang(data, "amount_satang", "amount");
      dayMap.set(key, Math.max(0, dayMap.get(key)! - satang));
    }
  }
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, satang]) => ({
      date: dateStr,
      dayLabel: DAY_LABELS[new Date(dateStr).getUTCDay()],
      revenue: satangToBaht(satang),
    }));
}

/**
 * Revenue by service (treatment_name) from PAID invoices in range. For Insights.
 */
export async function getRevenueByServiceFromPaidInvoices(
  orgId: string,
  options: { branchId?: string | null; from: Date; to: Date }
): Promise<Array<{ serviceName: string; revenue: number; count: number }>> {
  const Firestore = await import("firebase-admin/firestore");
  const from = new Date(options.from);
  const to = new Date(options.to);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  let q = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID")
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(from))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(to))
    .limit(2000);
  if (options.branchId != null) {
    q = q.where("branch_id", "==", options.branchId) as typeof q;
  }
  const snap = await q.get();
  const byService = new Map<string, { revenue: number; count: number }>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const items = Array.isArray(data.line_items) ? data.line_items : [];
    for (const item of items) {
      const name = String(item.treatment_name ?? "อื่นๆ").trim() || "อื่นๆ";
      const satang = readSatang(item, "final_line_total_satang", "final_line_total");
      const qty = Number(item.quantity) || 1;
      if (!byService.has(name)) byService.set(name, { revenue: 0, count: 0 });
      const cur = byService.get(name)!;
      cur.revenue += satangToBaht(satang);
      cur.count += qty;
    }
  }
  return Array.from(byService.entries())
    .map(([serviceName, v]) => ({ serviceName, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
}

async function getTotalRefundSatang(
  orgId: string,
  options: { branchId?: string | null; from?: Date; to?: Date } = {}
): Promise<number> {
  const Firestore = await import("firebase-admin/firestore");
  let q: ReturnType<ReturnType<typeof db.collection>["where"]> = db
    .collection(COLLECTIONS.refunds)
    .where("org_id", "==", orgId);
  if (options.from != null) {
    q = q.where("created_at", ">=", Firestore.Timestamp.fromDate(options.from));
  }
  if (options.to != null) {
    q = q.where("created_at", "<=", Firestore.Timestamp.fromDate(options.to));
  }
  if (options.from != null || options.to != null) {
    q = q.orderBy("created_at", "asc");
  }
  const snap = await q.limit(2000).get();
  let docs = snap.docs;
  if (options.branchId != null) {
    const invoiceIds = new Set(
      (await db.collection(COLLECTIONS.invoices).where("org_id", "==", orgId).where("branch_id", "==", options.branchId).limit(2000).get()).docs.map((d) => d.id)
    );
    docs = docs.filter((d) => invoiceIds.has(d.data().invoice_id));
  }
  return sumSatang(docs.map((d) => readSatang(d.data(), "amount_satang", "amount")));
}

/**
 * Projected Revenue = SUM(PENDING invoice grand_total_satang). Returns baht.
 */
export async function getProjectedRevenueFromPendingInvoices(
  orgId: string,
  options: { branchId?: string | null } = {}
): Promise<number> {
  let q = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PENDING");
  if (options.branchId) q = q.where("branch_id", "==", options.branchId) as typeof q;
  const snap = await q.limit(2000).get();
  const satang = sumSatang(snap.docs.map((d) => readSatang(d.data(), "grand_total_satang", "grand_total")));
  return satangToBaht(satang);
}

// ─── Invoice ───────────────────────────────────────────────────────────────

export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const doc = await db.collection(COLLECTIONS.invoices).doc(invoiceId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  const lineItems = Array.isArray(d.line_items) ? d.line_items : [];
  return {
    id: doc.id,
    org_id: d.org_id ?? "",
    branch_id: d.branch_id ?? null,
    booking_id: d.booking_id ?? null,
    customer_id: d.customer_id ?? null,
    line_items: lineItems.map((item: Record<string, unknown>) => ({
      treatment_id: String(item.treatment_id ?? ""),
      treatment_name: String(item.treatment_name ?? ""),
      quantity: Number(item.quantity) || 0,
      unit_price_satang: readSatang(item, "unit_price_satang", "unit_price"),
      discount_satang: readSatang(item, "discount_satang", "discount"),
      final_line_total_satang: readSatang(item, "final_line_total_satang", "final_line_total"),
    })),
    subtotal_satang: readSatang(d, "subtotal_satang", "subtotal"),
    discount_total_satang: readSatang(d, "discount_total_satang", "discount_total"),
    tax_total_satang: readSatang(d, "tax_total_satang", "tax_total"),
    grand_total_satang: readSatang(d, "grand_total_satang", "grand_total"),
    status: (d.status as InvoiceStatus) ?? "PENDING",
    created_by: d.created_by ?? "",
    created_at: toISO(d.created_at ?? d.createdAt),
    updated_at: toISO(d.updated_at ?? d.updatedAt),
    paid_at: d.paid_at ? toISO(d.paid_at) : null,
    confirmed_by: d.confirmed_by ?? null,
  };
}

function mapPaymentDoc(doc: { id: string; data(): Record<string, unknown> | undefined }): Payment {
  const d = doc.data();
  if (!d) throw new Error("Payment doc missing data");
  const amountSatang = readSatang(d, "amount_satang", "amount");
  const appliedSatang =
    typeof d.applied_satang === "number" && Number.isInteger(d.applied_satang) ? d.applied_satang : amountSatang;
  const overpaymentSatang =
    typeof d.overpayment_satang === "number" && Number.isInteger(d.overpayment_satang) ? d.overpayment_satang : 0;
  const raw = d.created_at ?? d.createdAt;
  const rawUp = d.updated_at ?? d.updatedAt;
  return {
    id: doc.id,
    org_id: (d.org_id as string | undefined) ?? "",
    invoice_id: (d.invoice_id as string | undefined) ?? "",
    amount_satang: amountSatang,
    applied_satang: appliedSatang,
    overpayment_satang: overpaymentSatang,
    method: (d.method as Payment["method"] | undefined) ?? "CASH",
    reference: (d.reference as string | null | undefined) ?? null,
    idempotency_key: (d.idempotency_key as string | undefined) ?? "",
    created_by: (d.created_by as string | undefined) ?? "",
    confirmed_by: (d.confirmed_by as string | null | undefined) ?? null,
    created_at: toISO(raw as Parameters<typeof toISO>[0]),
    updated_at: toISO(rawUp as Parameters<typeof toISO>[0]),
  };
}

export async function listPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
  const snap = await db
    .collection(COLLECTIONS.payments)
    .where("invoice_id", "==", invoiceId)
    .orderBy("created_at", "asc")
    .get();
  return snap.docs.map((doc) => mapPaymentDoc(doc));
}

/** Return existing payment if idempotency_key already used for this invoice. */
export async function getPaymentByInvoiceIdAndIdempotencyKey(
  invoiceId: string,
  idempotencyKey: string
): Promise<Payment | null> {
  const snap = await db
    .collection(COLLECTIONS.payments)
    .where("invoice_id", "==", invoiceId)
    .where("idempotency_key", "==", idempotencyKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return mapPaymentDoc(snap.docs[0]);
}

// ─── Audit Log (Immutable) ─────────────────────────────────────────────────

export async function appendFinancialAuditLog(params: {
  org_id: string;
  entity_type: FinancialEntityType;
  entity_id: string;
  action: FinancialAuditAction;
  user_id: string;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  await db.collection(COLLECTIONS.financial_audit_log).add({
    org_id: params.org_id,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    user_id: params.user_id,
    timestamp: Firestore.Timestamp.fromDate(now),
    payload: params.payload ?? null,
  });
}

// ─── Create Invoice (all _satang) ─────────────────────────────────────────

export async function createInvoice(data: InvoiceCreate): Promise<string> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const ref = await db.collection(COLLECTIONS.invoices).add({
    org_id: data.org_id,
    branch_id: data.branch_id ?? null,
    booking_id: data.booking_id ?? null,
    customer_id: data.customer_id ?? null,
    line_items: data.line_items,
    subtotal_satang: data.subtotal_satang,
    discount_total_satang: data.discount_total_satang,
    tax_total_satang: data.tax_total_satang,
    grand_total_satang: data.grand_total_satang,
    status: "PENDING",
    created_by: data.created_by,
    created_at: Firestore.Timestamp.fromDate(now),
    updated_at: Firestore.Timestamp.fromDate(now),
    paid_at: null,
    confirmed_by: null,
  });
  return ref.id;
}

// ─── Confirm Payment (Firestore Transaction + Idempotency) ─────────────────

/**
 * If idempotency_key already used for this invoice: return 200 with existing payment (no-op).
 * Else: validate, create payment, update invoice PAID, audit — all in one transaction.
 */
export async function confirmPaymentAndCreateRecord(params: {
  invoiceId: string;
  invoice: Invoice;
  payment: PaymentCreate;
  confirmedBy: string;
}): Promise<{ paymentId: string; existing: boolean }> {
  const Firestore = await import("firebase-admin/firestore");
  const existing = await getPaymentByInvoiceIdAndIdempotencyKey(params.invoiceId, params.payment.idempotency_key);
  if (existing) return { paymentId: existing.id, existing: true };

  const result = await runTransactionWithRetry(async (tx) => {
    const invRef = db.collection(COLLECTIONS.invoices).doc(params.invoiceId);
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw new Error("Invoice not found");
    const invData = invSnap.data()!;
    const status = invData.status as string;
    if (status !== "PENDING") throw new Error(`Invoice status is ${status}`);

    const grandTotalSatang = readSatang(invData, "grand_total_satang", "grand_total");
    const paidTotalSatang =
      typeof invData.paid_total_satang === "number" && Number.isInteger(invData.paid_total_satang)
        ? invData.paid_total_satang
        : 0;
    const overpaymentTotalSatang =
      typeof invData.overpayment_total_satang === "number" && Number.isInteger(invData.overpayment_total_satang)
        ? invData.overpayment_total_satang
        : 0;

    const amount = params.payment.amount_satang;
    const remaining = Math.max(0, grandTotalSatang - paidTotalSatang);
    const appliedSatang = Math.min(amount, remaining);
    const overpaymentSatang = Math.max(0, amount - remaining);

    const newPaidTotalSatang = paidTotalSatang + appliedSatang;
    const newOverpaymentTotalSatang = overpaymentTotalSatang + overpaymentSatang;

    const paymentRef = db.collection(COLLECTIONS.payments).doc();
    const now = new Date();
    const ts = Firestore.Timestamp.fromDate(now);

    tx.set(paymentRef, {
      org_id: params.payment.org_id,
      invoice_id: params.payment.invoice_id,
      amount_satang: params.payment.amount_satang,
      applied_satang: appliedSatang,
      overpayment_satang: overpaymentSatang,
      method: params.payment.method,
      reference: params.payment.reference ?? null,
      idempotency_key: params.payment.idempotency_key,
      created_by: params.payment.created_by,
      confirmed_by: params.confirmedBy,
      created_at: ts,
      updated_at: ts,
    });

    tx.update(invRef, {
      status: "PAID",
      paid_at: ts,
      confirmed_by: params.confirmedBy,
      updated_at: ts,
      paid_total_satang: newPaidTotalSatang,
      overpayment_total_satang: newOverpaymentTotalSatang,
    });

    const auditRef = db.collection(COLLECTIONS.financial_audit_log).doc();
    tx.set(auditRef, {
      org_id: params.invoice.org_id,
      entity_type: "invoice",
      entity_id: params.invoiceId,
      action: "confirm_payment",
      user_id: params.confirmedBy,
      timestamp: ts,
      payload: { payment_id: paymentRef.id, amount_satang: params.payment.amount_satang },
    });

    return paymentRef.id;
  });

  return { paymentId: result, existing: false };
}

// ─── Refunds ───────────────────────────────────────────────────────────────

export async function listRefundsByInvoiceId(invoiceId: string): Promise<Refund[]> {
  const snap = await db
    .collection(COLLECTIONS.refunds)
    .where("invoice_id", "==", invoiceId)
    .orderBy("created_at", "asc")
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? "",
      invoice_id: d.invoice_id ?? "",
      payment_id: d.payment_id ?? "",
      amount_satang: readSatang(d, "amount_satang", "amount"),
      reason: d.reason ?? "",
      created_by: d.created_by ?? "",
      created_at: toISO(d.created_at ?? d.createdAt),
    };
  });
}

export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const doc = await db.collection(COLLECTIONS.payments).doc(paymentId).get();
  if (!doc.exists) return null;
  return mapPaymentDoc(doc);
}

/**
 * Create refund inside a Firestore transaction: read invoice, validate, write refund,
 * update invoice.refunded_total_satang, write financial_audit_log. Atomic; backward
 * compatible with missing refunded_total_satang (treated as 0).
 */
export async function createRefundWithAudit(data: RefundCreate): Promise<string> {
  const Firestore = await import("firebase-admin/firestore");
  const invoiceId = data.invoice_id;
  const invRef = db.collection(COLLECTIONS.invoices).doc(invoiceId);

  const refundId = await runTransactionWithRetry(async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists) throw new Error("Invoice not found");
    const invData = invSnap.data()!;

    const status = (invData.status as string) ?? "";
    if (status !== "PAID") throw new Error(`Refund only allowed for PAID invoice; current status: ${status}`);

    const grandTotalSatang = readSatang(invData, "grand_total_satang", "grand_total");
    const refundedTotalSatang = typeof invData.refunded_total_satang === "number" && Number.isInteger(invData.refunded_total_satang)
      ? invData.refunded_total_satang
      : 0;
    const afterRefund = refundedTotalSatang + data.amount_satang;
    if (afterRefund > grandTotalSatang) {
      throw new Error(
        `Refund would exceed invoice total: refunded ${refundedTotalSatang} + ${data.amount_satang} > ${grandTotalSatang} satang`
      );
    }

    const now = new Date();
    const ts = Firestore.Timestamp.fromDate(now);
    const refundRef = db.collection(COLLECTIONS.refunds).doc();

    tx.set(refundRef, {
      org_id: data.org_id,
      invoice_id: data.invoice_id,
      payment_id: data.payment_id,
      amount_satang: data.amount_satang,
      reason: data.reason,
      created_by: data.created_by,
      created_at: ts,
    });

    tx.update(invRef, {
      refunded_total_satang: afterRefund,
      updated_at: ts,
    });

    const auditRef = db.collection(COLLECTIONS.financial_audit_log).doc();
    tx.set(auditRef, {
      org_id: data.org_id,
      entity_type: "refund" as FinancialEntityType,
      entity_id: refundRef.id,
      action: "create" as FinancialAuditAction,
      user_id: data.created_by,
      timestamp: ts,
      payload: {
        invoice_id: data.invoice_id,
        payment_id: data.payment_id,
        amount_satang: data.amount_satang,
      },
    });

    return refundRef.id;
  });

  return refundId;
}
