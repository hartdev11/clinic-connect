/**
 * Phase 21 — Daily metrics aggregation
 * Writes to organizations/{orgId}/metrics/{YYYY-MM-DD}
 * and global/platform_metrics/{YYYY-MM}
 */
import { db } from "@/lib/firebase-admin";
import { getDateKeyBangkokDaysAgo } from "@/lib/timezone";
import { getRevenueFromPaidInvoices } from "@/lib/financial-data";
import { getAIUsageDaily } from "@/lib/ai-usage-daily";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

/** Aggregate metrics for one org for yesterday */
export async function aggregateOrgMetricsForDate(
  orgId: string,
  dateKey: string
): Promise<{
  totalConversations: number;
  aiHandled: number;
  handoffs: number;
  hotLeads: number;
  warmLeads: number;
  bookings: number;
  estimatedRevenue: number;
  aiCost: number;
  totalTokens: number;
  cacheHitRate: number;
  avgConfidence: number;
}> {
  const Firestore = await import("firebase-admin/firestore");
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);

  const [chatSnap, bookingSnap, hotSnap, warmSnap, aiUsage, revenue] = await Promise.all([
    db
      .collection("conversation_feedback")
      .where("org_id", "==", orgId)
      .where("createdAt", ">=", Firestore.Timestamp.fromDate(start))
      .where("createdAt", "<=", Firestore.Timestamp.fromDate(end))
      .limit(5000)
      .get(),
    db
      .collection("bookings")
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(start))
      .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(end))
      .limit(1000)
      .get(),
    db
      .collection("customers")
      .where("org_id", "==", orgId)
      .where("leadScore", ">=", 0.6)
      .limit(500)
      .get(),
    db
      .collection("customers")
      .where("org_id", "==", orgId)
      .where("leadScore", ">=", 0.3)
      .where("leadScore", "<", 0.6)
      .limit(500)
      .get(),
    getAIUsageDaily(orgId, dateKey),
    getRevenueFromPaidInvoices(orgId, { from: start, to: end }),
  ]);

  let estimatedRevenue = 0;
  bookingSnap.docs.forEach((doc) => {
    const amt = doc.data().amount as number | undefined;
    if (typeof amt === "number") estimatedRevenue += amt;
  });
  if (estimatedRevenue === 0) estimatedRevenue = revenue;

  const handoffsSnap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("handoff_sessions")
    .where("createdAt", ">=", Firestore.Timestamp.fromDate(start))
    .where("createdAt", "<=", Firestore.Timestamp.fromDate(end))
    .limit(500)
    .get();

  return {
    totalConversations: chatSnap.size,
    aiHandled: chatSnap.docs.filter((doc) => doc.data().aiPaused !== true).length,
    handoffs: handoffsSnap.size,
    hotLeads: hotSnap.size,
    warmLeads: warmSnap.size,
    bookings: bookingSnap.size,
    estimatedRevenue,
    aiCost: aiUsage?.totalCost ?? 0,
    totalTokens: 0,
    cacheHitRate: 0,
    avgConfidence: 0,
  };
}

/** Run aggregation for all active orgs for yesterday */
export async function runDailyMetricsAggregation(): Promise<{
  orgsProcessed: number;
  dateKey: string;
  totalConversations: number;
  totalRevenue: number;
  totalAiCost: number;
}> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const dateKey = getDateKeyBangkokDaysAgo(1);

  const orgsSnap = await db
    .collection("organizations")
    .limit(500)
    .get();

  let totalConversations = 0;
  let totalRevenue = 0;
  let totalAiCost = 0;

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    try {
      const metrics = await aggregateOrgMetricsForDate(orgId, dateKey);
      const ref = db.collection("organizations").doc(orgId).collection("metrics").doc(dateKey);
      await ref.set(
        {
          date: dateKey,
          totalConversations: metrics.totalConversations,
          aiHandled: metrics.aiHandled,
          handoffs: metrics.handoffs,
          hotLeads: metrics.hotLeads,
          warmLeads: metrics.warmLeads,
          bookings: metrics.bookings,
          estimatedRevenue: metrics.estimatedRevenue,
          aiCost: metrics.aiCost,
          totalTokens: metrics.totalTokens,
          cacheHitRate: metrics.cacheHitRate,
          avgConfidence: metrics.avgConfidence,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      totalConversations += metrics.totalConversations;
      totalRevenue += metrics.estimatedRevenue;
      totalAiCost += metrics.aiCost;
    } catch (err) {
      console.warn("[aggregate] org", orgId, (err as Error)?.message?.slice(0, 80));
    }
  }

  const monthKey = dateKey.slice(0, 7);
  const platformRef = db.collection("global").doc("platform_metrics").collection(monthKey).doc(dateKey);
  await platformRef.set(
    {
      date: dateKey,
      totalOrgs: orgsSnap.size,
      totalConversations,
      totalRevenue,
      totalAiCost,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    orgsProcessed: orgsSnap.size,
    dateKey,
    totalConversations,
    totalRevenue,
    totalAiCost,
  };
}
