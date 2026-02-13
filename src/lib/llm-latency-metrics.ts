/**
 * LLM Latency Monitoring — average, p95, error rate
 * เก็บใน Firestore สำหรับ aggregation
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "llm_latency_metrics";

function getHourKey(): string {
  return new Date().toISOString().slice(0, 13);
}

export async function recordLLMLatency(
  orgId: string,
  latencyMs: number,
  success: boolean
): Promise<void> {
  const key = `${orgId}_${getHourKey()}`;
  const docRef = db.collection(COLLECTION).doc(key);
  await docRef.set(
    {
      org_id: orgId,
      hour: getHourKey(),
      total_count: FieldValue.increment(1),
      success_count: FieldValue.increment(success ? 1 : 0),
      latency_sum_ms: FieldValue.increment(latencyMs),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export interface LLMMetricsSummary {
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  totalRequests: number;
  successCount: number;
}

const SAMPLE_LATENCIES_KEY = "llm_latency_samples";
const MAX_SAMPLES = 1000;

export async function recordLatencySample(latencyMs: number): Promise<void> {
  const key = `global_${getHourKey()}`;
  const docRef = db.collection(COLLECTION).doc(key);
  const doc = await docRef.get();
  const data = doc.data() ?? {};
  const samples: number[] = data[SAMPLE_LATENCIES_KEY] ?? [];
  samples.push(latencyMs);
  const trimmed = samples.slice(-MAX_SAMPLES);
  await docRef.set(
    {
      [SAMPLE_LATENCIES_KEY]: trimmed,
      hour: getHourKey(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getLLMMetricsAdvanced(orgId?: string): Promise<{
  byOrg: Record<string, LLMMetricsSummary>;
  global: LLMMetricsSummary | null;
}> {
  const hour = getHourKey();
  const prefix = orgId ? `${orgId}_` : "";
  const snap = await db
    .collection(COLLECTION)
    .where("hour", "==", hour)
    .get();

  const byOrg: Record<string, LLMMetricsSummary> = {};
  let globalSummary: LLMMetricsSummary | null = null;

  for (const doc of snap.docs) {
    const d = doc.data();
    const total = Number(d.total_count ?? 0);
    const success = Number(d.success_count ?? 0);
    const latencySum = Number(d.latency_sum_ms ?? 0);
    const samples: number[] = d[SAMPLE_LATENCIES_KEY] ?? [];
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const avg = total > 0 ? latencySum / total : 0;
    const errorRate = total > 0 ? (total - success) / total : 0;
    const summary: LLMMetricsSummary = {
      avgLatencyMs: Math.round(avg),
      p95LatencyMs: p95,
      errorRate: Math.round(errorRate * 1000) / 1000,
      totalRequests: total,
      successCount: success,
    };
    if (doc.id.startsWith("global_")) {
      globalSummary = summary;
    } else {
      const oid = d.org_id ?? doc.id.split("_")[0];
      if (!orgId || oid === orgId) byOrg[oid] = summary;
    }
  }
  return { byOrg, global: globalSummary };
}
