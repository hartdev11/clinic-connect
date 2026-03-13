/**
 * Phase 21 — Dashboard & Analytics data layer
 * Revenue impact, branch comparison, metrics from Firestore
 */
import { db } from "@/lib/firebase-admin";
import { getRevenueByDayFromPaidInvoicesRange } from "@/lib/financial-data";
import { getBranchesByOrgId } from "@/lib/clinic-data";

const COLLECTIONS = {
  conversation_feedback: "conversation_feedback",
  bookings: "bookings",
  customers: "customers",
} as const;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : new Date().toISOString();
}

export interface RevenueImpactPoint {
  date: string;
  bookings: number;
  revenue: number;
}

/** Revenue Impact: last N days — bookings + revenue per day */
export async function getRevenueImpactData(
  orgId: string,
  opts: { branchId?: string | null; days?: number }
): Promise<RevenueImpactPoint[]> {
  const days = opts.days ?? 30;
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 86400000);
  startDate.setHours(0, 0, 0, 0);

  const metricsCol = db.collection("organizations").doc(orgId).collection("metrics");
  const dateKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
    dateKeys.push(d.toISOString().slice(0, 10));
  }

  const points: RevenueImpactPoint[] = dateKeys.map((date) => ({ date, bookings: 0, revenue: 0 }));

  const metricsSnap = await metricsCol.get();
  for (const doc of metricsSnap.docs) {
    const key = doc.id;
    if (dateKeys.includes(key)) {
      const d = doc.data();
      const idx = dateKeys.indexOf(key);
      points[idx].bookings = typeof d.bookings === "number" ? d.bookings : 0;
      points[idx].revenue = typeof d.estimatedRevenue === "number" ? d.estimatedRevenue : 0;
    }
  }

  const hasAny = points.some((p) => p.bookings > 0 || p.revenue > 0);
  if (!hasAny) {
    const [revenueByDay, bookingsSnap] = await Promise.all([
      getRevenueByDayFromPaidInvoicesRange(orgId, {
        from: startDate,
        to: now,
        branchId: opts.branchId,
      }),
      (() => {
        let q = db
          .collection(COLLECTIONS.bookings)
          .where("org_id", "==", orgId)
          .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(startDate))
          .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(now))
          .limit(2000);
        if (opts.branchId) {
          q = q.where("branch_id", "==", opts.branchId) as typeof q;
        }
        return q.get();
      })(),
    ]);

    const revenueMap = new Map<string, number>();
    for (const r of revenueByDay) revenueMap.set(r.date, r.revenue);
    const bookingsMap = new Map<string, number>();
    bookingsSnap.docs.forEach((doc) => {
      const d = doc.data();
      const scheduledAt = toISO(d.scheduledAt).slice(0, 10);
      bookingsMap.set(scheduledAt, (bookingsMap.get(scheduledAt) ?? 0) + 1);
    });

    for (let i = 0; i < dateKeys.length; i++) {
      const key = dateKeys[i];
      points[i].revenue = revenueMap.get(key) ?? 0;
      points[i].bookings = bookingsMap.get(key) ?? 0;
    }
  }

  return points;
}

export interface BranchComparisonRow {
  branch_id: string;
  branch_name: string;
  conversations: number;
  hot_leads: number;
  bookings: number;
}

/** Branch comparison: per-branch metrics (conversations, hot_leads, bookings) */
export async function getBranchComparisonData(
  orgId: string
): Promise<BranchComparisonRow[]> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 86400000);
  startDate.setHours(0, 0, 0, 0);

  const branches = await getBranchesByOrgId(orgId);
  if (branches.length === 0) return [];

  const rows: BranchComparisonRow[] = branches.map((b) => ({
    branch_id: b.id,
    branch_name: b.name,
    conversations: 0,
    hot_leads: 0,
    bookings: 0,
  }));

  const [chatSnap, customerSnap, bookingSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.conversation_feedback)
      .where("org_id", "==", orgId)
      .where("createdAt", ">=", Firestore.Timestamp.fromDate(startDate))
      .limit(3000)
      .get(),
    db
      .collection(COLLECTIONS.customers)
      .where("org_id", "==", orgId)
      .where("leadScore", ">=", 0.6)
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.bookings)
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(startDate))
      .limit(2000)
      .get(),
  ]);

  const convByBranch = new Map<string, number>();
  const hotByBranch = new Map<string, number>();
  const bookByBranch = new Map<string, number>();

  chatSnap.docs.forEach((doc) => {
    const d = doc.data();
    const bid = (d.branch_id as string) ?? (d.branchId as string) ?? "__unassigned__";
    convByBranch.set(bid, (convByBranch.get(bid) ?? 0) + 1);
  });

  customerSnap.docs.forEach((doc) => {
    const d = doc.data();
    const bid = (d.branch_id as string) ?? (d.branchId as string) ?? "__unassigned__";
    hotByBranch.set(bid, (hotByBranch.get(bid) ?? 0) + 1);
  });

  bookingSnap.docs.forEach((doc) => {
    const d = doc.data();
    const bid = (d.branch_id as string) ?? "unknown";
    bookByBranch.set(bid, (bookByBranch.get(bid) ?? 0) + 1);
  });

  for (let i = 0; i < rows.length; i++) {
    rows[i].conversations = convByBranch.get(rows[i].branch_id) ?? 0;
    rows[i].hot_leads = hotByBranch.get(rows[i].branch_id) ?? 0;
    rows[i].bookings = bookByBranch.get(rows[i].branch_id) ?? 0;
  }

  return rows;
}

export interface DashboardRevenueKpis {
  bookings_today: number;
  bookings_this_month: number;
  estimated_revenue_month: number;
  ai_assisted_revenue: number;
  booking_conversion_rate: number;
}

/** Extended dashboard KPIs for Phase 21 */
export async function getDashboardRevenueKpis(
  orgId: string,
  branchId?: string | null
): Promise<DashboardRevenueKpis> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  let qBook = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(monthStart))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(now))
    .limit(1000);
  if (branchId) qBook = qBook.where("branch_id", "==", branchId) as typeof qBook;

  const bookingsSnap = await qBook.get();
  let bookingsToday = 0;
  const bookingsThisMonth = bookingsSnap.size;
  let estimatedRevenueMonth = 0;
  let aiAssistedRevenue = 0;

  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const scheduledAt = toISO(d.scheduledAt).slice(0, 10);
    if (scheduledAt === now.toISOString().slice(0, 10)) bookingsToday++;
    const amount = typeof d.amount === "number" ? d.amount : 0;
    estimatedRevenueMonth += amount;
    const source = d.source as string | undefined;
    const mode = d.bookingCreationMode as string | undefined;
    if (source === "line" || mode === "chat") aiAssistedRevenue += amount;
  });

  const hotLeadsSnap = await db
    .collection(COLLECTIONS.customers)
    .where("org_id", "==", orgId)
    .where("leadScore", ">=", 0.6)
    .limit(500)
    .get();
  const totalHotLeads = hotLeadsSnap.size;

  const hotLeadDocIds = new Set(hotLeadsSnap.docs.map((d) => d.id));
  const hotLeadExternalIds = new Set(
    hotLeadsSnap.docs.map((d) => (d.data().externalId as string) ?? "").filter(Boolean)
  );
  let hotLeadsBooked = 0;
  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const cid = (d.customerId as string | undefined) ?? (d.customer_id as string | undefined);
    const chatUserId = (d.chatUserId as string | undefined) ?? (d.chat_user_id as string | undefined);
    if (cid && hotLeadDocIds.has(cid)) hotLeadsBooked++;
    else if (chatUserId && hotLeadExternalIds.has(chatUserId)) hotLeadsBooked++;
  });

  const bookingConversionRate =
    totalHotLeads > 0 ? Math.round((hotLeadsBooked / totalHotLeads) * 10000) / 100 : 0;

  return {
    bookings_today: bookingsToday,
    bookings_this_month: bookingsThisMonth,
    estimated_revenue_month: estimatedRevenueMonth,
    ai_assisted_revenue: aiAssistedRevenue,
    booking_conversion_rate: bookingConversionRate,
  };
}

// ─── Conversion Attribution (Phase 21 UPGRADE 2) ───────────────────────────

export type LeadTier = "cold" | "warm" | "hot" | "very_hot";

export interface ConversionTierStats {
  total: number;
  converted: number;
  rate: number;
  avg_value: number;
}

export interface ConversionAttributionResponse {
  cold: ConversionTierStats;
  warm: ConversionTierStats;
  hot: ConversionTierStats;
  very_hot: ConversionTierStats;
}

/** Conversion rate by lead tier (last 30 days) from conversion_tracking */
export async function getConversionAttribution(
  orgId: string,
  branchId?: string | null
): Promise<ConversionAttributionResponse> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 86400000);
  startDate.setHours(0, 0, 0, 0);

  const q = db
    .collection("organizations")
    .doc(orgId)
    .collection("conversion_tracking")
    .where("createdAt", ">=", Firestore.Timestamp.fromDate(startDate))
    .limit(2000);
  const snap = await q.get();

  const tierMap: Record<LeadTier, { total: number; converted: number; sumValue: number }> = {
    cold: { total: 0, converted: 0, sumValue: 0 },
    warm: { total: 0, converted: 0, sumValue: 0 },
    hot: { total: 0, converted: 0, sumValue: 0 },
    very_hot: { total: 0, converted: 0, sumValue: 0 },
  };

  snap.docs.forEach((doc) => {
    const d = doc.data();
    const tier = (d.leadTier as LeadTier) ?? "cold";
    if (!(tier in tierMap)) return;
    tierMap[tier as LeadTier].total++;
    if (d.converted === true) {
      tierMap[tier as LeadTier].converted++;
      tierMap[tier as LeadTier].sumValue += typeof d.bookingValue === "number" ? d.bookingValue : 0;
    }
  });

  const build = (t: LeadTier): ConversionTierStats => {
    const m = tierMap[t];
    const rate = m.total > 0 ? Math.round((m.converted / m.total) * 10000) / 100 : 0;
    const avg_value = m.converted > 0 ? Math.round((m.sumValue / m.converted) * 100) / 100 : 0;
    return { total: m.total, converted: m.converted, rate, avg_value };
  };

  return {
    cold: build("cold"),
    warm: build("warm"),
    hot: build("hot"),
    very_hot: build("very_hot"),
  };
}
