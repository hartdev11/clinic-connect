/**
 * Enterprise Insights — Analytics data layer
 * All queries scoped by org_id and optional branch_id. Date range: from/to.
 */
import { db } from "@/lib/firebase-admin";
import {
  getRevenueFromPaidInvoices,
  getRevenueByDayFromPaidInvoicesRange,
  getRevenueByServiceFromPaidInvoices,
} from "@/lib/financial-data";
import { getConversationFeedbackInRange } from "@/lib/clinic-data";
import { listKnowledgeDocsForOrg } from "@/lib/knowledge-data";

const COLLECTIONS = {
  conversation_feedback: "conversation_feedback",
  bookings: "bookings",
} as const;

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

export function parseAnalyticsRange(
  range: string,
  customFrom?: string,
  customTo?: string
): AnalyticsDateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  let from: Date;
  let preset: DateRangePreset = "7d";
  if (range === "30d") {
    from = new Date(to.getTime() - 30 * 86400000);
    preset = "30d";
  } else if (range === "90d") {
    from = new Date(to.getTime() - 90 * 86400000);
    preset = "90d";
  } else if (range === "custom" && customFrom && customTo) {
    from = new Date(customFrom);
    const toCustom = new Date(customTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(toCustom.getTime())) {
      to.setTime(toCustom.getTime());
      to.setHours(23, 59, 59, 999);
      preset = "custom";
    } else {
      from = new Date(to.getTime() - 7 * 86400000);
    }
  } else {
    from = new Date(to.getTime() - 7 * 86400000);
  }
  from.setHours(0, 0, 0, 0);
  return { from, to, preset };
}

// ─── Overview (KPI snapshot) ───────────────────────────────────────────────

export interface AnalyticsOverview {
  revenue: number;
  conversionRate: number; // chat → booking %
  aiCloseRate: number; // % of labeled that are success
  escalationRate: number; // placeholder if no escalation log
  totalChats: number;
  totalBookings: number;
  labeledFeedbackCount: number;
  successFeedbackCount: number;
}

export async function getAnalyticsOverview(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<AnalyticsOverview> {
  const [revenue, feedbacks, bookingsCount] = await Promise.all([
    getRevenueFromPaidInvoices(orgId, {
      branchId: opts.branchId,
      from: opts.from,
      to: opts.to,
    }),
    getConversationFeedbackInRange(orgId, {
      branchId: opts.branchId,
      from: opts.from,
      to: opts.to,
      limit: 3000,
    }),
    getBookingsCountInRange(orgId, {
      branchId: opts.branchId,
      from: opts.from,
      to: opts.to,
    }),
  ]);
  const totalChats = feedbacks.length;
  const labeled = feedbacks.filter((f) => f.adminLabel === "success" || f.adminLabel === "fail");
  const successFeedbackCount = feedbacks.filter((f) => f.adminLabel === "success").length;
  const conversionRate = totalChats > 0 ? Math.round((bookingsCount / totalChats) * 10000) / 100 : 0;
  const aiCloseRate =
    labeled.length > 0 ? Math.round((successFeedbackCount / labeled.length) * 10000) / 100 : 0;
  return {
    revenue,
    conversionRate,
    aiCloseRate,
    escalationRate: 0,
    totalChats,
    totalBookings: bookingsCount,
    labeledFeedbackCount: labeled.length,
    successFeedbackCount,
  };
}

async function getBookingsCountInRange(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<number> {
  const { trackFirestoreQuery } = await import("@/lib/observability/firestore");
  const t0 = Date.now();
  const Firestore = await import("firebase-admin/firestore");
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(opts.from))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(opts.to));
  if (opts.branchId != null) {
    q = q.where("branch_id", "==", opts.branchId) as typeof q;
  }
  const snap = await q.limit(3000).get();
  trackFirestoreQuery({
    collection: COLLECTIONS.bookings,
    operation: "count",
    orgId,
    durationMs: Date.now() - t0,
    docCount: snap.size,
  });
  return snap.size;
}

// ─── Revenue ──────────────────────────────────────────────────────────────

export interface RevenueTrendPoint {
  date: string;
  dayLabel: string;
  revenue: number;
}

export interface RevenueByServiceItem {
  serviceName: string;
  revenue: number;
  count: number;
}

export async function getAnalyticsRevenue(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<{
  trend: RevenueTrendPoint[];
  byService: RevenueByServiceItem[];
  total: number;
}> {
  const [trend, byService, total] = await Promise.all([
    getRevenueByDayFromPaidInvoicesRange(orgId, opts),
    getRevenueByServiceFromPaidInvoices(orgId, opts),
    getRevenueFromPaidInvoices(orgId, opts),
  ]);
  return { trend, byService, total };
}

// ─── Conversation ─────────────────────────────────────────────────────────

export interface IntentDistributionItem {
  intent: string;
  count: number;
}

export interface TopQuestionItem {
  text: string;
  count: number;
}

export async function getAnalyticsConversation(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<{
  intentDistribution: IntentDistributionItem[];
  topQuestions: TopQuestionItem[];
  totalConversations: number;
  avgPerDay: number;
}> {
  const feedbacks = await getConversationFeedbackInRange(orgId, {
    branchId: opts.branchId,
    from: opts.from,
    to: opts.to,
    limit: 3000,
  });
  const intentMap = new Map<string, number>();
  const questionMap = new Map<string, number>();
  for (const f of feedbacks) {
    const intent = f.intent?.trim() || "other";
    intentMap.set(intent, (intentMap.get(intent) ?? 0) + 1);
    const q = (f.userMessage || "").trim().slice(0, 120);
    if (q) {
      questionMap.set(q, (questionMap.get(q) ?? 0) + 1);
    }
  }
  const intentDistribution = Array.from(intentMap.entries())
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const topQuestions = Array.from(questionMap.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const days = Math.max(1, Math.ceil((opts.to.getTime() - opts.from.getTime()) / 86400000));
  return {
    intentDistribution,
    topQuestions,
    totalConversations: feedbacks.length,
    avgPerDay: Math.round((feedbacks.length / days) * 100) / 100,
  };
}

// ─── AI Performance ───────────────────────────────────────────────────────

export interface AIPerformanceMetrics {
  accuracyScore: number; // % approved (success / labeled)
  humanOverrideRate: number; // % fail or unlabeled that were later overridden — simplified: fail count / total
  totalLabeled: number;
  successCount: number;
  failCount: number;
  totalConversations: number;
  topFailedQueries: Array<{ userMessage: string; count: number }>;
}

export async function getAnalyticsAIPerformance(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<AIPerformanceMetrics> {
  const feedbacks = await getConversationFeedbackInRange(orgId, {
    branchId: opts.branchId,
    from: opts.from,
    to: opts.to,
    limit: 3000,
  });
  const labeled = feedbacks.filter((f) => f.adminLabel === "success" || f.adminLabel === "fail");
  const successCount = feedbacks.filter((f) => f.adminLabel === "success").length;
  const failCount = feedbacks.filter((f) => f.adminLabel === "fail").length;
  const failedQueries = feedbacks.filter((f) => f.adminLabel === "fail");
  const failMsgMap = new Map<string, number>();
  for (const f of failedQueries) {
    const q = (f.userMessage || "").trim().slice(0, 100);
    if (q) failMsgMap.set(q, (failMsgMap.get(q) ?? 0) + 1);
  }
  const topFailedQueries = Array.from(failMsgMap.entries())
    .map(([userMessage, count]) => ({ userMessage, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const accuracyScore =
    labeled.length > 0 ? Math.round((successCount / labeled.length) * 10000) / 100 : 0;
  const humanOverrideRate =
    feedbacks.length > 0 ? Math.round((failCount / feedbacks.length) * 10000) / 100 : 0;
  return {
    accuracyScore,
    humanOverrideRate,
    totalLabeled: labeled.length,
    successCount,
    failCount,
    totalConversations: feedbacks.length,
    topFailedQueries,
  };
}

// ─── Operational (Peak heatmap) ─────────────────────────────────────────────

export interface PeakHeatmapCell {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export async function getAnalyticsOperational(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<{
  chatPeakHeatmap: PeakHeatmapCell[];
  bookingPeakByHour: Array<{ hour: number; count: number }>;
  totalChats: number;
  totalBookings: number;
}> {
  const [feedbacks, bookingsSnap] = await Promise.all([
    getConversationFeedbackInRange(orgId, {
      branchId: opts.branchId,
      from: opts.from,
      to: opts.to,
      limit: 3000,
    }),
    getBookingsSnapInRange(orgId, opts),
  ]);
  const heatmap = new Map<string, number>();
  const bookingByHour = new Map<number, number>();
  for (let h = 0; h < 24; h++) bookingByHour.set(h, 0);
  for (const f of feedbacks) {
    const d = new Date(f.createdAt);
    const hour = d.getHours();
    const dayOfWeek = d.getDay();
    const key = `${hour}-${dayOfWeek}`;
    heatmap.set(key, (heatmap.get(key) ?? 0) + 1);
  }
  function toISO(t: unknown): string {
    if (typeof t === "string") return t;
    if (t instanceof Date) return t.toISOString();
    const o = t as { toDate?: () => Date };
    if (o?.toDate) return o.toDate().toISOString();
    return String(t);
  }
  for (const doc of bookingsSnap.docs) {
    const d = doc.data();
    const scheduledAt = toISO(d.scheduledAt);
    const hour = new Date(scheduledAt).getHours();
    bookingByHour.set(hour, (bookingByHour.get(hour) ?? 0) + 1);
  }
  const chatPeakHeatmap = Array.from(heatmap.entries()).map(([key, count]) => {
    const [hour, dayOfWeek] = key.split("-").map(Number);
    return { hour, dayOfWeek, count };
  });
  const bookingPeakByHour = Array.from(bookingByHour.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);
  const bookingHeatmap = new Map<string, number>();
  for (const doc of bookingsSnap.docs) {
    const d = doc.data();
    const scheduledAt = toISO(d.scheduledAt);
    const dt = new Date(scheduledAt);
    const hour = dt.getHours();
    const dayOfWeek = dt.getDay();
    const key = `${hour}-${dayOfWeek}`;
    bookingHeatmap.set(key, (bookingHeatmap.get(key) ?? 0) + 1);
  }
  const bookingHeatmapCells = Array.from(bookingHeatmap.entries()).map(([key, count]) => {
    const [hour, dayOfWeek] = key.split("-").map(Number);
    return { hour, dayOfWeek, count };
  });
  return {
    chatPeakHeatmap,
    bookingPeakByHour,
    bookingHeatmap: bookingHeatmapCells,
    escalationHeatmap: [] as PeakHeatmapCell[],
    totalChats: feedbacks.length,
    totalBookings: bookingsSnap.size,
  };
}

async function getBookingsSnapInRange(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<{ docs: { data: () => Record<string, unknown> }[] }> {
  const Firestore = await import("firebase-admin/firestore");
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(opts.from))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(opts.to));
  if (opts.branchId != null) {
    q = q.where("branch_id", "==", opts.branchId) as typeof q;
  }
  const snap = await q.limit(3000).get();
  return { docs: snap.docs };
}

// ─── Knowledge ────────────────────────────────────────────────────────────

export interface KnowledgeMetrics {
  totalDocuments: number;
  activeDocuments: number;
  coverageNote: string;
  unansweredCount?: number;
  topMissingTopics?: Array<{ text: string; count: number }>;
  coveragePercent?: number;
}

export async function getAnalyticsKnowledge(
  orgId: string,
  opts: { branchId?: string | null; from?: Date; to?: Date } = {}
): Promise<KnowledgeMetrics> {
  const docs = await listKnowledgeDocsForOrg(orgId, { limit: 500 });
  const active = docs.filter((d) => d.is_active).length;
  const coveragePercent = docs.length > 0 ? Math.round((active / docs.length) * 100) : 0;
  let unansweredCount = 0;
  let topMissingTopics: Array<{ text: string; count: number }> = [];
  if (opts.from && opts.to) {
    const feedbacks = await getConversationFeedbackInRange(orgId, {
      branchId: opts.branchId,
      from: opts.from,
      to: opts.to,
      limit: 2000,
    });
    const otherOrNull = feedbacks.filter((f) => !f.intent || f.intent === "other");
    unansweredCount = otherOrNull.length;
    const msgMap = new Map<string, number>();
    for (const f of otherOrNull) {
      const q = (f.userMessage || "").trim().slice(0, 80);
      if (q) msgMap.set(q, (msgMap.get(q) ?? 0) + 1);
    }
    topMissingTopics = Array.from(msgMap.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  return {
    totalDocuments: docs.length,
    activeDocuments: active,
    coverageNote:
      active === 0
        ? "ยังไม่มี Knowledge — เพิ่มเนื้อหาใน Knowledge Input เพื่อให้ AI ตอบตรงกับคลินิก"
        : `มี ${active} เอกสารที่เปิดใช้งาน`,
    unansweredCount,
    topMissingTopics,
    coveragePercent,
  };
}
