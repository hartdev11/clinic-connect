/**
 * Finance Analytics Agent
 * Data/Logic only — NO LLM
 * INTERNAL ONLY — ห้ามส่งให้ลูกค้าโดยตรง
 * ดึงข้อมูลการเงินจาก Firestore → business logic → JSON structured output
 * Target: <200ms
 */
import { getDashboardStats } from "@/lib/clinic-data";
import { toSatang } from "@/lib/money";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "finance-agent";
const TIMEOUT_MS = 180;

export async function runFinanceAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Finance agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeFinanceAnalytics(ctx),
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
      riskFlags: ["FINANCE_DATA_UNAVAILABLE"],
    };
  }
}

async function executeFinanceAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id } = ctx;

  const stats = await getDashboardStats(org_id, branch_id ?? undefined);

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  // ใช้ categorical ไม่ใช่ตัวเลข — Role Manager ห้ามเอ่ยตัวเลขกับลูกค้า
  keyFindings.push(`revenue_trend:${stats.revenueThisMonth >= stats.revenueLastMonth ? "UP" : "DOWN"}`);
  keyFindings.push(`bookings_today:${stats.bookingsToday}`);

  const thisSatang = toSatang(stats.revenueThisMonth);
  const lastSatang = toSatang(stats.revenueLastMonth);
  if (lastSatang > 0 && thisSatang < (lastSatang * 70) / 100) {
    riskFlags.push("REVENUE_DOWN_MOM");
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
    dataClassification: "INTERNAL_FINANCE_ONLY" as const,
  };
}
