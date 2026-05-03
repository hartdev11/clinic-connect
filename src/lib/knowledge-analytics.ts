/**
 * P2-3 — Knowledge quality analytics (org-scoped, Firestore-backed).
 */
import { db } from "@/lib/firebase-admin";
import { listKnowledgeTopics } from "@/lib/knowledge-topics-data";
import type { KnowledgeTopicCategory } from "@/types/knowledge";

function timestampToMs(t: unknown): number {
  if (t == null) return 0;
  if (typeof t === "string") return new Date(t).getTime() || 0;
  if (t instanceof Date) return t.getTime();
  const td = t as { toDate?: () => Date; seconds?: number };
  if (typeof td.toDate === "function") return td.toDate().getTime();
  if (typeof td.seconds === "number") return td.seconds * 1000;
  return 0;
}

export interface KnowledgeOrgAnalytics {
  byCategory: Record<KnowledgeTopicCategory, number>;
  indexingSuccessRate7dPct: number;
  avgIndexingTimeMs: number;
  top5RecentTopics: Array<{
    id: string;
    topic: string;
    category: KnowledgeTopicCategory;
    lastUpdated: string;
  }>;
  failedCount7d: number;
  failedTrend: Array<{ date: string; count: number }>;
}

export async function computeKnowledgeOrgAnalytics(orgId: string): Promise<KnowledgeOrgAnalytics> {
  const topics = await listKnowledgeTopics(orgId, { limit: 200 });
  const byCategory: Record<KnowledgeTopicCategory, number> = {
    service: 0,
    price: 0,
    faq: 0,
  };
  for (const t of topics) {
    byCategory[t.category]++;
  }

  const top5RecentTopics = [...topics]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      topic: t.topic,
      category: t.category,
      lastUpdated: t.lastUpdated,
    }));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const failTrend: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    failTrend.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }

  const snap = await db.collection("organizations").doc(orgId).collection("knowledge_versions").get();

  let success7d = 0;
  let fail7d = 0;
  let sumDurationMs = 0;
  let durationSamples = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const idx = d.indexing_status as string | undefined;
    const indexedMs = timestampToMs(d.indexed_at);
    const createdMs = timestampToMs(d.createdAt);

    if (idx === "indexed" && indexedMs >= sevenDaysAgo) {
      success7d++;
      if (createdMs > 0 && indexedMs > createdMs) {
        sumDurationMs += indexedMs - createdMs;
        durationSamples++;
      }
    }

    if (idx === "failed") {
      const failAt = indexedMs || createdMs;
      if (failAt >= sevenDaysAgo) {
        fail7d++;
        const day = new Date(failAt).toISOString().slice(0, 10);
        const slot = failTrend.find((x) => x.date === day);
        if (slot) slot.count++;
      }
    }
  }

  const denom = success7d + fail7d;
  const indexingSuccessRate7dPct =
    denom > 0 ? Math.round((success7d / denom) * 1000) / 10 : topics.length === 0 ? 100 : 100;

  const avgIndexingTimeMs =
    durationSamples > 0 ? Math.round(sumDurationMs / durationSamples) : 0;

  return {
    byCategory,
    indexingSuccessRate7dPct,
    avgIndexingTimeMs,
    top5RecentTopics,
    failedCount7d: fail7d,
    failedTrend: failTrend,
  };
}
