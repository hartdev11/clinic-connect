/**
 * Phase 13 — Update customer lead score after EVERY message
 * Saves to customers doc. Creates hot_lead notification when score crosses ≥0.8.
 */
import { db } from "@/lib/firebase-admin";
import { calculateScore, getPriorityFromScore, type LeadScorerHistory } from "./lead-scorer";

/** Compute lead score for current message (does not persist). Used by orchestrator for sales mode. */
export async function getLeadScoreForMessage(
  orgId: string,
  lineUserId: string,
  userMessage: string
): Promise<{ score: number; priority: ReturnType<typeof getPriorityFromScore> }> {
  const historySnap = await db
    .collection("conversation_feedback")
    .where("org_id", "==", orgId)
    .where("user_id", "==", lineUserId)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  const history: LeadScorerHistory[] = historySnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        userMessage: d.userMessage ?? "",
        createdAt: d.createdAt?.toDate?.()?.toISOString?.(),
      };
    })
    .filter((h) => h.userMessage?.trim())
    .reverse();

  const { score, priority } = calculateScore(userMessage, history);
  return { score, priority };
}

const COLLECTION_CUSTOMERS = "customers";
const COLLECTION_FEEDBACK = "conversation_feedback";
const COLLECTION_NOTIFICATIONS = "notifications";

function getCustomerDocId(orgId: string, lineUserId: string): string {
  const safe = lineUserId.replace(/[/\\]/g, "_");
  return `line_${orgId}_${safe}`;
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Update customer lead score after new message.
 * Call from LINE webhook / createConversationFeedback flow.
 */
export async function updateCustomerLeadScore(
  orgId: string,
  lineUserId: string,
  userMessage: string,
  customerName?: string
): Promise<{ score: number; hotLeadTriggered: boolean }> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const docId = getCustomerDocId(orgId, lineUserId);
  const customerRef = db.collection(COLLECTION_CUSTOMERS).doc(docId);

  const customerDoc = await customerRef.get();
  const previousScore = typeof customerDoc.data()?.leadScore === "number" ? customerDoc.data()!.leadScore : null;

  const historySnap = await db
    .collection(COLLECTION_FEEDBACK)
    .where("org_id", "==", orgId)
    .where("user_id", "==", lineUserId)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  const history: LeadScorerHistory[] = historySnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        userMessage: d.userMessage ?? "",
        createdAt: d.createdAt?.toDate?.()?.toISOString?.(),
      };
    })
    .filter((h) => h.userMessage?.trim())
    .reverse();

  const { score, priority } = calculateScore(userMessage, history.slice(0, -1));

  const today = getTodayKey();
  const historyArr = (customerDoc.data()?.leadScoreHistory as Array<{ date: string; score: number }>) ?? [];
  const filtered = historyArr.filter((e) => e.date !== today);
  const newHistory = [...filtered, { date: today, score }].slice(-7);

  await customerRef.set(
    {
      leadScore: score,
      leadPriority: priority,
      leadScoreHistory: newHistory,
      leadScoreUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const { upsertConversionTrackingFromLeadScore } = await import("@/lib/conversion-tracking");
  upsertConversionTrackingFromLeadScore(orgId, lineUserId, {
    score,
    maxLeadScore: score,
    aiAssisted: true,
  }).catch((e) => console.warn("[Conversion] upsert:", (e as Error)?.message?.slice(0, 50)));

  const hotLeadTriggered =
    previousScore !== null && previousScore < 0.8 && score >= 0.8;

  if (hotLeadTriggered) {
    const name = customerName?.trim() || "ลูกค้า LINE";
    const { dispatchPartnerWebhooks } = await import("@/lib/partner-webhook-dispatch");
    dispatchPartnerWebhooks(orgId, "lead.hot", {
      customerId: docId,
      customerName: name,
      leadScore: score,
    }).catch((e) => console.warn("[Lead] partner webhook:", (e as Error)?.message?.slice(0, 50)));
    await db.collection("organizations").doc(orgId).collection(COLLECTION_NOTIFICATIONS).add({
      type: "hot_lead",
      severity: "info",
      message: `🔥 Hot lead! คุณ${name} พร้อมจองแล้ว`,
      customerId: docId,
      customerName: name,
      leadScore: score,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });
  }

  return { score, hotLeadTriggered };
}
