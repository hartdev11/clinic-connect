/**
 * Referral Analytics Agent — Phase 6
 * Role: ส่งต่อหมอ/เจ้าหน้าที่
 * Trigger: medical_advice_needed OR complex_case
 * Output: suggest booking consultation
 */
import { getDashboardStats } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "referral-agent";
const TIMEOUT_MS = 150;

export async function runReferralAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Referral agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeReferralAnalytics(ctx),
      timeoutPromise,
    ]);

    const elapsed = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log(`[${AGENT_NAME}] completed in ${elapsed}ms`);
    }
    return result;
  } catch (err) {
    const msg = (err as Error)?.message ?? "Unknown error";
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${AGENT_NAME}] error:`, msg.slice(0, 80));
    }
    return {
      keyFindings: [],
      recommendation: null,
      riskFlags: ["REFERRAL_DATA_UNAVAILABLE"],
    };
  }
}

async function executeReferralAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userMessage } = ctx;

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  const isMedicalAdvice =
    userMessage &&
    /แพทย์|ปรึกษา|วินิจฉัย|อักเสบ|บวม|แพ้|เจ็บผิดปกติ|เป็นหนอง|แดงผิดปกติ|อาการรุนแรง/i.test(userMessage);
  const isComplexCase =
    userMessage &&
    (/ไม่พอใจ|complaint|ยุ่งยาก|ซับซ้อน|หลายอย่าง|หลายจุด/i.test(userMessage) ||
      (userMessage.split(/\s+/).length > 30));

  if (!isMedicalAdvice && !isComplexCase) {
    return {
      keyFindings: ["referral_intent:no"],
      recommendation: null,
      riskFlags: [],
    };
  }

  keyFindings.push(
    isMedicalAdvice ? "referral_reason:medical_advice_needed" : "referral_reason:complex_case"
  );
  recommendation = "REFERRAL_SUGGEST_CONSULTATION";
  keyFindings.push("referral_cta:จองปรึกษาหมอ|โทรนัดหมาย|แวะคลินิก");

  try {
    const stats = await getDashboardStats(org_id, branch_id ?? undefined);
    if (stats.bookingsToday < 8) {
      keyFindings.push("referral_availability:มีคิวว่างวันนี้");
    }
  } catch {
    // optional
  }

  return {
    keyFindings: keyFindings.slice(0, 10),
    recommendation,
    riskFlags,
  };
}
