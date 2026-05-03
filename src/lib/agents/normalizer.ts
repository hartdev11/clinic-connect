/**
 * Presentation Layer — Message Normalizer
 * แปลงข้อความจากช่องทาง (LINE / WhatsApp / Web) เป็น format กลาง
 * ชั้นนี้ไม่รู้จัก AI / โมเดล
 */
import type { NormalizedMessage } from "./types";
import { getRecentConversationForAI } from "@/lib/clinic-data";
import { getSessionState } from "./session-storage";

/**
 * แปลงข้อความจาก LINE event เป็น format กลาง
 * รองรับดึง conversation_history จาก session + DB สำหรับบริบทต่อเนื่อง
 */
export async function normalizeLineMessage(
  userText: string,
  opts?: {
    orgId?: string;
    userId?: string;
    channel?: "line" | "web" | "default";
    historyLimit?: number;
  }
): Promise<NormalizedMessage> {
  const message = userText?.trim() ?? "";
  const orgId = opts?.orgId?.trim() ?? "";
  const userId = opts?.userId?.trim() ?? "";
  const channel = opts?.channel ?? "line";
  const historyLimit = Math.min(Math.max(opts?.historyLimit ?? 6, 1), 20);
  const conversation_history: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (orgId && userId) {
    try {
      const sessionState = await getSessionState(orgId, channel, userId);
      const sessionHistory = (sessionState?.recentMessages ?? [])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(-historyLimit)
        .map((content) => ({ role: "user" as const, content }));
      conversation_history.push(...sessionHistory);
    } catch {
      // non-breaking: fallback to DB only
    }

    try {
      const dbHistory = await getRecentConversationForAI(orgId, userId, historyLimit);
      for (const item of dbHistory) {
        if (!item?.content?.trim()) continue;
        if (
          conversation_history.some(
            (existing) => existing.role === item.role && existing.content.trim() === item.content.trim()
          )
        ) {
          continue;
        }
        conversation_history.push({ role: item.role, content: item.content });
      }
    } catch {
      // non-breaking: if DB unavailable keep session history
    }
  }

  return {
    message,
    conversation_history: conversation_history.slice(-historyLimit * 2),
  };
}
