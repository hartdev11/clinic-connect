/**
 * Enterprise Executive Finance — INTERNAL_FINANCE_ONLY
 * Single aggregation layer for Finance Control Center. Minimize reads; use caching.
 * 🚨 DO NOT EXPOSE FINANCE DATA TO CUSTOMER CHAT
 */
import { db } from "@/lib/firebase-admin";
import { getRevenueFromPaidInvoices } from "@/lib/financial-data";
import { satangToBaht } from "@/lib/money";
import type { Timestamp } from "firebase-admin/firestore";

const COLLECTIONS = {
  invoices: "invoices",
  refunds: "refunds",
  bookings: "bookings",
  branches: "branches",
} as const;

export type DatePeriod = "month" | "quarter" | "year";

export interface DateRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  label: string;
}

function startOfMonth(y: number, m: number): Date {
  const d = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  return d;
}

function endOfMonth(y: number, m: number): Date {
  const d = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return d;
}

/**
 * Resolve period + value to concrete date range and previous period for comparison.
 * value: "YYYY-MM" for month, "YYYY-Qn" for quarter, "YYYY" for year.
 */
export function getDateRangeFromPeriod(
  period: DatePeriod,
  value: string
): DateRange {
  const now = new Date();
  let from: Date;
  let to: Date;
  let previousFrom: Date;
  let previousTo: Date;
  let label: string;

  if (period === "month") {
    const [y, m] = value.split("-").map(Number);
    const year = y || now.getUTCFullYear();
    const month = m || now.getUTCMonth() + 1;
    from = startOfMonth(year, month);
    to = endOfMonth(year, month);
    const prev = new Date(from.getTime());
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    previousFrom = startOfMonth(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
    previousTo = endOfMonth(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
    label = `${year}-${String(month).padStart(2, "0")}`;
  } else if (period === "quarter") {
    const [y, qPart] = value.split("-");
    const year = Number(y) || now.getUTCFullYear();
    const q = qPart ? parseInt(qPart.replace("Q", ""), 10) : Math.floor(now.getUTCMonth() / 3) + 1;
    const startMonth = (q - 1) * 3 + 1;
    from = startOfMonth(year, startMonth);
    to = endOfMonth(year, startMonth + 2);
    const prev = new Date(from.getTime());
    prev.setUTCMonth(prev.getUTCMonth() - 3);
    previousFrom = startOfMonth(prev.getUTCFullYear(), prev.getUTCMonth() + 1);
    previousTo = endOfMonth(prev.getUTCFullYear(), prev.getUTCMonth() + 3);
    label = `${year}-Q${q}`;
  } else {
    const year = Number(value) || now.getUTCFullYear();
    from = startOfMonth(year, 1);
    to = endOfMonth(year, 12);
    previousFrom = startOfMonth(year - 1, 1);
    previousTo = endOfMonth(year - 1, 12);
    label = String(year);
  }

  return { from, to, previousFrom, previousTo, label };
}

function readSatang(d: Record<string, unknown>, key: string, fallbackKey?: string): number {
  const v = d[key];
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (fallbackKey != null && d[fallbackKey] != null) return Math.round(Number(d[fallbackKey]) * 100);
  return 0;
}

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = t && typeof (t as { toDate?: () => Date }).toDate === "function" ? (t as { toDate: () => Date }).toDate() : null;
  return d ? d.toISOString() : String(t);
}

/**
 * 12-month revenue trend (monthly totals). Uses one query per month or batched.
 * Returns last 12 months ending at range end.
 */
export async function getRevenueTrends(
  orgId: string,
  branchId: string | null | undefined
): Promise<Array<{ month: string; revenue: number; yearMonth: string }>> {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setUTCMonth(start.getUTCMonth() - 11);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const result: Array<{ month: string; revenue: number; yearMonth: string }> = [];
  const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getTime());
    d.setUTCMonth(d.getUTCMonth() + i);
    const from = new Date(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0);
    const to = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    const rev = await getRevenueFromPaidInvoices(orgId, { branchId, from, to });
    const y = from.getFullYear();
    const m = from.getMonth() + 1;
    result.push({
      month: `${MONTH_LABELS[from.getMonth()]} ${y}`,
      revenue: rev,
      yearMonth: `${y}-${String(m).padStart(2, "0")}`,
    });
  }
  return result;
}

export interface RevenueByService {
  serviceName: string;
  revenue: number;
  count: number;
}

export interface RevenueByDoctor {
  doctorName: string;
  revenue: number;
  count: number;
}

export interface RevenueByBranch {
  branchId: string;
  branchName: string;
  revenue: number;
  count: number;
}

export interface RevenueByChannel {
  channel: string;
  revenue: number;
  count: number;
}

/**
 * Revenue breakdown: by service (from line_items), by doctor/branch/channel (from invoice->booking).
 * Single pass: fetch PAID invoices in range, then batch fetch bookings for booking_id.
 */
export async function getRevenueBreakdown(
  orgId: string,
  branchId: string | null | undefined,
  range: DateRange
): Promise<{
  byService: RevenueByService[];
  byDoctor: RevenueByDoctor[];
  byBranch: RevenueByBranch[];
  byChannel: RevenueByChannel[];
}> {
  const Firestore = await import("firebase-admin/firestore");
  let qInv = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID")
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(range.from))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(range.to))
    .limit(2000);
  if (branchId != null) qInv = qInv.where("branch_id", "==", branchId) as typeof qInv;
  const invSnap = await qInv.get();

  const byServiceMap = new Map<string, { revenue: number; count: number }>();
  const byDoctorMap = new Map<string, { revenue: number; count: number }>();
  const byBranchMap = new Map<string, { revenue: number; count: number; name: string }>();
  const byChannelMap = new Map<string, { revenue: number; count: number }>();

  const bookingIds = new Set<string>();
  const invoiceList: { data: Record<string, unknown> }[] = [];
  for (const doc of invSnap.docs) {
    const data = doc.data();
    invoiceList.push({ data });
    const bid = data.booking_id as string | undefined;
    if (bid) bookingIds.add(bid);
    const branchIdVal = (data.branch_id as string) || "(ไม่มีสาขา)";
    if (!byBranchMap.has(branchIdVal)) byBranchMap.set(branchIdVal, { revenue: 0, count: 0, name: branchIdVal });
    const grandSatang = readSatang(data, "grand_total_satang", "grand_total");
    const grandBaht = satangToBaht(grandSatang);
    const curBranch = byBranchMap.get(branchIdVal)!;
    curBranch.revenue += grandBaht;
    curBranch.count += 1;
    const items = Array.isArray(data.line_items) ? data.line_items : [];
    for (const item of items) {
      const name = String((item as Record<string, unknown>).treatment_name ?? "อื่นๆ").trim() || "อื่นๆ";
      const satang = readSatang(item as Record<string, unknown>, "final_line_total_satang", "final_line_total");
      const qty = Number((item as Record<string, unknown>).quantity) || 1;
      if (!byServiceMap.has(name)) byServiceMap.set(name, { revenue: 0, count: 0 });
      const cur = byServiceMap.get(name)!;
      cur.revenue += satangToBaht(satang);
      cur.count += qty;
    }
  }

  let bookingMap = new Map<string, { doctor?: string; channel?: string }>();
  if (bookingIds.size > 0) {
    const batchSize = 100;
    const ids = Array.from(bookingIds);
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const refs = chunk.map((id) => db.collection(COLLECTIONS.bookings).doc(id));
      const snap = await db.getAll(...refs);
      for (const doc of snap) {
        if (!doc.exists) continue;
        const d = doc.data()!;
        const doctor = (d.doctor as string)?.trim() || d.doctor_id || "(ไม่มีแพทย์)";
        const channel = (d.channel as string) || (d.source as string) || "other";
        bookingMap.set(doc.id, { doctor, channel });
      }
    }
  }

  for (const { data } of invoiceList) {
    const grandSatang = readSatang(data, "grand_total_satang", "grand_total");
    const grandBaht = satangToBaht(grandSatang);
    const bid = data.booking_id as string | undefined;
    const booking = bid ? bookingMap.get(bid) : null;
    const doctorName = booking?.doctor ?? "(ไม่มีแพทย์)";
    const channel = booking?.channel ?? "other";
    if (!byDoctorMap.has(doctorName)) byDoctorMap.set(doctorName, { revenue: 0, count: 0 });
    byDoctorMap.get(doctorName)!.revenue += grandBaht;
    byDoctorMap.get(doctorName)!.count += 1;
    if (!byChannelMap.has(channel)) byChannelMap.set(channel, { revenue: 0, count: 0 });
    byChannelMap.get(channel)!.revenue += grandBaht;
    byChannelMap.get(channel)!.count += 1;
  }

  const branchIds = Array.from(byBranchMap.keys()).filter((k) => k !== "(ไม่มีสาขา)");
  let branchNames: Record<string, string> = {};
  if (branchIds.length > 0) {
    const branchSnap = await db.collection(COLLECTIONS.branches).get();
    for (const doc of branchSnap.docs) {
      if (branchIds.includes(doc.id)) branchNames[doc.id] = (doc.data().name as string) || doc.id;
    }
  }
  for (const [bid, v] of byBranchMap) {
    if (bid !== "(ไม่มีสาขา)") v.name = branchNames[bid] ?? bid;
  }

  const byService = Array.from(byServiceMap.entries())
    .map(([serviceName, v]) => ({ serviceName, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
  const byDoctor = Array.from(byDoctorMap.entries())
    .map(([doctorName, v]) => ({ doctorName, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
  const byBranch = Array.from(byBranchMap.entries())
    .map(([branchId, v]) => ({ branchId, branchName: v.name, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue);
  const byChannel = Array.from(byChannelMap.entries())
    .map(([channel, v]) => ({ channel, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue);

  return { byService, byDoctor, byBranch, byChannel };
}

/**
 * Revenue Stability Score 0–100 (normalized for Owner trust).
 *
 * Normalization:
 * - Linear weighted components, each capped to avoid single factor dominance.
 * - Base 50 (neutral). Growth adds up to +20 or subtracts up to -20. Refund/cancel/volatility subtract.
 * - Final output clamped to [0, 100].
 *
 * Weights (max impact per factor):
 * - Growth vs previous period: ±20 (linear in growth rate, cap ±20).
 * - Refund rate: −(refundRate% × 2), cap −15.
 * - Cancellation rate: −(cancelRate% × 0.5), cap −15.
 * - Revenue volatility (CV of last 6 months): −(CV × 100), cap −20.
 *
 * Formula: score = 50 + growthComponent − refundPenalty − cancelPenalty − volatilityPenalty, then clamp(0, 100).
 */
export function calculateRevenueStabilityScore(params: {
  revenueCurrent: number;
  revenuePrevious: number;
  refundRatePercent: number;
  cancellationRatePercent: number;
  last6MonthsRevenue?: number[];
}): number {
  let score = 50;
  const { revenueCurrent, revenuePrevious, refundRatePercent, cancellationRatePercent, last6MonthsRevenue } = params;
  if (revenuePrevious > 0) {
    const growth = (revenueCurrent - revenuePrevious) / revenuePrevious;
    if (growth >= 0) score += Math.min(20, growth * 100);
    else score += Math.max(-20, growth * 100);
  }
  score -= Math.min(15, refundRatePercent * 2);
  score -= Math.min(15, cancellationRatePercent * 0.5);
  if (last6MonthsRevenue && last6MonthsRevenue.length >= 2) {
    const mean = last6MonthsRevenue.reduce((a, b) => a + b, 0) / last6MonthsRevenue.length;
    const variance = last6MonthsRevenue.reduce((s, x) => s + (x - mean) ** 2, 0) / last6MonthsRevenue.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? std / mean : 0;
    score -= Math.min(20, cv * 100);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Revenue Volatility Index: standard deviation of last 6 months revenue (baht).
 */
export function calculateRevenueVolatilityIndex(last6MonthsRevenue: number[]): number {
  if (last6MonthsRevenue.length < 2) return 0;
  const mean = last6MonthsRevenue.reduce((a, b) => a + b, 0) / last6MonthsRevenue.length;
  const variance = last6MonthsRevenue.reduce((s, x) => s + (x - mean) ** 2, 0) / last6MonthsRevenue.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * Revenue Concentration Risk: if top service > 40% of total, return that percentage and flag.
 */
export function calculateRevenueConcentrationRisk(
  byService: Array<{ serviceName: string; revenue: number }>
): { topServiceName: string; topServicePercent: number; riskTriggered: boolean } {
  const total = byService.reduce((s, x) => s + x.revenue, 0);
  if (total <= 0) return { topServiceName: "", topServicePercent: 0, riskTriggered: false };
  const top = byService[0];
  if (!top) return { topServiceName: "", topServicePercent: 0, riskTriggered: false };
  const pct = (top.revenue / total) * 100;
  return {
    topServiceName: top.serviceName,
    topServicePercent: Math.round(pct * 100) / 100,
    riskTriggered: pct > 40,
  };
}

export interface FinancialHealthMetrics {
  refundRatePercent: number;
  cancellationRatePercent: number;
  noShowRatePercent: number;
  revenueVolatilityIndex: number;
  repeatCustomerRevenuePercent: number;
  customerLifetimeValueBaht: number;
  revenueConcentrationTopServicePercent: number;
  revenueConcentrationRiskTriggered: boolean;
}

/**
 * Financial health: refund rate, cancellation, no-show, volatility, repeat %, CLV, concentration.
 */
export async function getFinancialHealthMetrics(
  orgId: string,
  branchId: string | null | undefined,
  range: DateRange,
  options: {
    byService: Array<{ serviceName: string; revenue: number }>;
    totalRevenue: number;
    totalRefundSatangInPeriod: number;
    totalPaidSatangInPeriod: number;
    bookingsTotal: number;
    bookingsCancelled: number;
    bookingsNoShow: number;
    uniqueCustomersWithRevenue: number;
    repeatRevenueSatang: number;
  }
): Promise<FinancialHealthMetrics> {
  const {
    byService,
    totalRevenue,
    totalRefundSatangInPeriod,
    totalPaidSatangInPeriod,
    bookingsTotal,
    bookingsCancelled,
    bookingsNoShow,
    uniqueCustomersWithRevenue,
    repeatRevenueSatang,
  } = options;

  const refundRatePercent =
    totalPaidSatangInPeriod > 0
      ? Math.round((totalRefundSatangInPeriod / totalPaidSatangInPeriod) * 10000) / 100
      : 0;
  const cancellationRatePercent =
    bookingsTotal > 0 ? Math.round((bookingsCancelled / bookingsTotal) * 10000) / 100 : 0;
  const noShowRatePercent =
    bookingsTotal > 0 ? Math.round((bookingsNoShow / bookingsTotal) * 10000) / 100 : 0;

  const last6 = await getLast6MonthsRevenue(orgId, branchId);
  const revenueVolatilityIndex = calculateRevenueVolatilityIndex(last6);

  const repeatCustomerRevenuePercent =
    totalPaidSatangInPeriod > 0
      ? Math.round((repeatRevenueSatang / totalPaidSatangInPeriod) * 10000) / 100
      : 0;
  const customerLifetimeValueBaht =
    uniqueCustomersWithRevenue > 0 && totalRevenue > 0
      ? Math.round((totalRevenue / uniqueCustomersWithRevenue) * 100) / 100
      : 0;

  const concentration = calculateRevenueConcentrationRisk(byService);

  return {
    refundRatePercent,
    cancellationRatePercent,
    noShowRatePercent,
    revenueVolatilityIndex,
    repeatCustomerRevenuePercent,
    customerLifetimeValueBaht,
    revenueConcentrationTopServicePercent: concentration.topServicePercent,
    revenueConcentrationRiskTriggered: concentration.riskTriggered,
  };
}

async function getLast6MonthsRevenue(
  orgId: string,
  branchId: string | null | undefined
): Promise<number[]> {
  const end = new Date();
  const result: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1, 0, 0, 0, 0);
    const from = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const rev = await getRevenueFromPaidInvoices(orgId, { branchId, from, to });
    result.push(rev);
  }
  return result;
}

export interface ExecutiveFinanceData {
  dataClassification: "INTERNAL_FINANCE_ONLY";
  range: DateRange;
  totalRevenue: number;
  totalRevenuePrevious: number;
  growthPercent: number;
  netRevenue: number;
  averageTicketSize: number;
  revenuePerCustomer: number;
  bookingToRevenueConversionPercent: number;
  topPerformingService: string;
  topPerformingServiceRevenue: number;
  revenueStabilityScore: number;
  riskAlert: string | null;
  revenueTrends12Months: Array<{ month: string; revenue: number; yearMonth: string }>;
  byService: RevenueByService[];
  byDoctor: RevenueByDoctor[];
  byBranch: RevenueByBranch[];
  byChannel: RevenueByChannel[];
  financialHealth: FinancialHealthMetrics;
}

/**
 * Single entry: get all executive finance data. Minimize Firestore reads; one aggregation flow.
 */
export async function getExecutiveFinanceData(
  orgId: string,
  branchId: string | null | undefined,
  period: DatePeriod,
  periodValue: string
): Promise<ExecutiveFinanceData> {
  const range = getDateRangeFromPeriod(period, periodValue);

  const [
    totalRevenue,
    totalRevenuePrevious,
    revenueTrends12Months,
    breakdown,
    bookingsInRange,
    refundsInRange,
    invoicesInRange,
  ] = await Promise.all([
    getRevenueFromPaidInvoices(orgId, { branchId, from: range.from, to: range.to }),
    getRevenueFromPaidInvoices(orgId, { branchId, from: range.previousFrom, to: range.previousTo }),
    getRevenueTrends(orgId, branchId),
    getRevenueBreakdown(orgId, branchId, range),
    getBookingsCountsInRange(orgId, branchId, range),
    getRefundsAndPaidTotalsInRange(orgId, branchId, range),
    getInvoicesForHealth(orgId, branchId, range),
  ]);

  const { totalRefundSatang, totalPaidSatang, uniqueCustomersWithRevenue, repeatRevenueSatang } = refundsInRange;
  const { bookingsTotal, bookingsCancelled, bookingsNoShow } = bookingsInRange;

  const totalPaidSatangNum = totalPaidSatang;
  const netRevenue = totalRevenue - satangToBaht(totalRefundSatang);
  const transactionCount = breakdown.byService.reduce((s, x) => s + x.count, 0) || 1;
  const averageTicketSize = totalRevenue > 0 ? Math.round((totalRevenue / transactionCount) * 100) / 100 : 0;
  const revenuePerCustomer =
    uniqueCustomersWithRevenue > 0 ? Math.round((totalRevenue / uniqueCustomersWithRevenue) * 100) / 100 : 0;
  const totalBookingsInPeriod = bookingsTotal;
  const completedOrPaidCount = invoicesInRange.paidCount;
  const bookingToRevenueConversionPercent =
    totalBookingsInPeriod > 0
      ? Math.round((completedOrPaidCount / totalBookingsInPeriod) * 10000) / 100
      : 0;

  const topService = breakdown.byService[0];
  const topPerformingService = topService?.serviceName ?? "—";
  const topPerformingServiceRevenue = topService?.revenue ?? 0;

  const last6 = await getLast6MonthsRevenue(orgId, branchId);
  const financialHealth = await getFinancialHealthMetrics(orgId, branchId, range, {
    byService: breakdown.byService,
    totalRevenue,
    totalRefundSatangInPeriod: totalRefundSatang,
    totalPaidSatangInPeriod: totalPaidSatangNum,
    bookingsTotal: totalBookingsInPeriod,
    bookingsCancelled: bookingsCancelled,
    bookingsNoShow: bookingsNoShow,
    uniqueCustomersWithRevenue,
    repeatRevenueSatang,
  });

  const revenueStabilityScore = calculateRevenueStabilityScore({
    revenueCurrent: totalRevenue,
    revenuePrevious: totalRevenuePrevious,
    refundRatePercent: financialHealth.refundRatePercent,
    cancellationRatePercent: financialHealth.cancellationRatePercent,
    last6MonthsRevenue: last6,
  });

  const growthPercent =
    totalRevenuePrevious !== 0
      ? Math.round(((totalRevenue - totalRevenuePrevious) / totalRevenuePrevious) * 10000) / 100
      : (totalRevenue > 0 ? 100 : 0);

  let riskAlert: string | null = null;
  if (financialHealth.revenueConcentrationRiskTriggered)
    riskAlert = `ความเสี่ยงการกระจุกตัว: ${financialHealth.revenueConcentrationTopServicePercent}% มาจากบริการเดียว`;
  if (financialHealth.refundRatePercent > 10)
    riskAlert = (riskAlert ? riskAlert + ". " : "") + `อัตราคืนเงินสูง (${financialHealth.refundRatePercent}%)`;
  if (revenueStabilityScore < 40)
    riskAlert = (riskAlert ? riskAlert + ". " : "") + "ความมั่นคงของรายได้ต่ำ";

  return {
    dataClassification: "INTERNAL_FINANCE_ONLY",
    range,
    totalRevenue,
    totalRevenuePrevious,
    growthPercent,
    netRevenue,
    averageTicketSize,
    revenuePerCustomer,
    bookingToRevenueConversionPercent,
    topPerformingService,
    topPerformingServiceRevenue,
    revenueStabilityScore,
    riskAlert,
    revenueTrends12Months: revenueTrends12Months,
    byService: breakdown.byService,
    byDoctor: breakdown.byDoctor,
    byBranch: breakdown.byBranch,
    byChannel: breakdown.byChannel,
    financialHealth,
  };
}

async function getBookingsCountsInRange(
  orgId: string,
  branchId: string | null | undefined,
  range: DateRange
): Promise<{ bookingsTotal: number; bookingsCancelled: number; bookingsNoShow: number }> {
  const Firestore = await import("firebase-admin/firestore");
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(range.from))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(range.to))
    .limit(2000);
  if (branchId != null) q = q.where("branch_id", "==", branchId) as typeof q;
  const snap = await q.get();
  let cancelled = 0;
  let noShow = 0;
  for (const doc of snap.docs) {
    const status = (doc.data().status as string) ?? "";
    if (status === "cancelled") cancelled++;
    if (status === "no-show") noShow++;
  }
  return {
    bookingsTotal: snap.size,
    bookingsCancelled: cancelled,
    bookingsNoShow: noShow,
  };
}

async function getRefundsAndPaidTotalsInRange(
  orgId: string,
  branchId: string | null | undefined,
  range: DateRange
): Promise<{
  totalRefundSatang: number;
  totalPaidSatang: number;
  uniqueCustomersWithRevenue: number;
  repeatRevenueSatang: number;
}> {
  const Firestore = await import("firebase-admin/firestore");
  const refQ = db
    .collection(COLLECTIONS.refunds)
    .where("org_id", "==", orgId)
    .where("created_at", ">=", Firestore.Timestamp.fromDate(range.from))
    .where("created_at", "<=", Firestore.Timestamp.fromDate(range.to))
    .limit(2000);
  const refSnap = await refQ.get();
  let refundDocs = refSnap.docs;
  if (branchId != null) {
    const invoiceIds = new Set(
      (
        await db
          .collection(COLLECTIONS.invoices)
          .where("org_id", "==", orgId)
          .where("branch_id", "==", branchId)
          .limit(2000)
          .get()
      ).docs.map((d) => d.id)
    );
    refundDocs = refundDocs.filter((d) => invoiceIds.has((d.data().invoice_id as string) ?? ""));
  }
  let totalRefundSatang = 0;
  for (const doc of refundDocs) {
    const d = doc.data();
    totalRefundSatang += readSatang(d, "amount_satang", "amount");
  }
  let qInv = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID")
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(range.from))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(range.to))
    .limit(2000);
  if (branchId != null) qInv = qInv.where("branch_id", "==", branchId) as typeof qInv;
  const invSnap = await qInv.get();
  let totalPaidSatang = 0;
  const customerIds = new Set<string>();
  const customerRevenueSatang = new Map<string, number>();
  for (const doc of invSnap.docs) {
    const d = doc.data();
    const satang = readSatang(d, "grand_total_satang", "grand_total");
    totalPaidSatang += satang;
    const cid = (d.customer_id as string) || "";
    if (cid) {
      customerIds.add(cid);
      customerRevenueSatang.set(cid, (customerRevenueSatang.get(cid) || 0) + satang);
    }
  }
  const byCustomerSatang = new Map<string, number>();
  const byCustomerInvCount = new Map<string, number>();
  for (const doc of invSnap.docs) {
    const cid = (doc.data().customer_id as string) || "";
    if (!cid) continue;
    const s = readSatang(doc.data(), "grand_total_satang", "grand_total");
    byCustomerSatang.set(cid, (byCustomerSatang.get(cid) || 0) + s);
    byCustomerInvCount.set(cid, (byCustomerInvCount.get(cid) || 0) + 1);
  }
  let repeatRevenueSatang = 0;
  for (const [cid, satang] of byCustomerSatang) {
    if ((byCustomerInvCount.get(cid) || 0) > 1) repeatRevenueSatang += satang;
  }
  const uniqueCustomersWithRevenue = customerIds.size || 1;
  return {
    totalRefundSatang,
    totalPaidSatang,
    uniqueCustomersWithRevenue,
    repeatRevenueSatang,
  };
}

async function getInvoicesForHealth(
  orgId: string,
  branchId: string | null | undefined,
  range: DateRange
): Promise<{ paidCount: number }> {
  const Firestore = await import("firebase-admin/firestore");
  let q = db
    .collection(COLLECTIONS.invoices)
    .where("org_id", "==", orgId)
    .where("status", "==", "PAID")
    .where("paid_at", ">=", Firestore.Timestamp.fromDate(range.from))
    .where("paid_at", "<=", Firestore.Timestamp.fromDate(range.to))
    .limit(2000);
  if (branchId != null) q = q.where("branch_id", "==", branchId) as typeof q;
  const snap = await q.get();
  return { paidCount: snap.size };
}
