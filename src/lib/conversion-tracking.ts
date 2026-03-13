/**
 * Phase 21 — Conversion Attribution
 * Upsert conversion_tracking when lead score updates; mark converted when booking created.
 */
import { db } from "@/lib/firebase-admin";

export type LeadTier = "cold" | "warm" | "hot" | "very_hot";

function toTier(score: number): LeadTier {
  if (score >= 0.8) return "very_hot";
  if (score >= 0.6) return "hot";
  if (score >= 0.3) return "warm";
  return "cold";
}

/** Upsert conversion_tracking when lead score is updated. Call from lead-score-updater. */
export async function upsertConversionTrackingFromLeadScore(
  orgId: string,
  lineUserId: string,
  opts: {
    score: number;
    initialLeadScore?: number;
    maxLeadScore?: number;
    aiAssisted?: boolean;
  }
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const conversationId = `${orgId}_${lineUserId.replace(/[/\\]/g, "_")}`;
  const tier = toTier(opts.score);
  const ref = db.collection("organizations").doc(orgId).collection("conversion_tracking").doc(conversationId);

  const doc = await ref.get();
  const existing = doc.data();
  const prevMax = typeof existing?.maxLeadScore === "number" ? existing.maxLeadScore : opts.score;
  const prevInitial = typeof existing?.initialLeadScore === "number" ? existing.initialLeadScore : opts.score;
  const maxLeadScore = Math.max(opts.maxLeadScore ?? opts.score, prevMax);

  await ref.set(
    {
      conversationId,
      initialLeadScore: existing ? prevInitial : (opts.initialLeadScore ?? opts.score),
      maxLeadScore,
      leadTier: tier,
      converted: existing?.converted ?? false,
      aiAssisted: opts.aiAssisted ?? true,
      createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/** Mark conversion_tracking as converted when booking is created from conversation. */
export async function markConversionTrackingConverted(
  orgId: string,
  lineUserIdOrCustomerId: string,
  opts: { bookingId: string; bookingValue: number }
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  let conversationId: string;
  if (lineUserIdOrCustomerId.startsWith("line_")) {
    const parts = lineUserIdOrCustomerId.split("_");
    const linePart = parts.slice(2).join("_");
    conversationId = `${orgId}_${linePart}`;
  } else {
    conversationId = `${orgId}_${lineUserIdOrCustomerId.replace(/[/\\]/g, "_")}`;
  }
  const ref = db.collection("organizations").doc(orgId).collection("conversion_tracking").doc(conversationId);

  await ref.set(
    {
      converted: true,
      bookingId: opts.bookingId,
      bookingValue: opts.bookingValue,
      convertedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
