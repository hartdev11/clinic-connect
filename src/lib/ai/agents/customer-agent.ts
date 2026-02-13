/**
 * Customer Analytics Agent
 * Data/Logic only — NO LLM
 * ดึงข้อมูลลูกค้าจาก Firestore → business logic → JSON structured output
 * Target: <200ms
 */
import { getCustomers, getDashboardStats } from "@/lib/clinic-data";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "customer-agent";
const TIMEOUT_MS = 180;

export async function runCustomerAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Customer agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeCustomerAnalytics(ctx),
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
      riskFlags: ["CUSTOMER_DATA_UNAVAILABLE"],
    };
  }
}

async function executeCustomerAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id, userId } = ctx;

  const [customersResult, stats] = await Promise.all([
    getCustomers(org_id, { branchId: branch_id ?? undefined, limit: 20 }),
    getDashboardStats(org_id, branch_id ?? undefined),
  ]);

  const { items: customers } = customersResult;
  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  keyFindings.push(`new_customers_today:${stats.newCustomers}`);

  // ลูกค้าปัจจุบัน (ถ้ามี userId)
  if (userId) {
    const current = customers.find((c) => c.id === userId || c.externalId === userId);
    if (current) {
      keyFindings.push(`current_customer:${current.name || "anon"}`);
      keyFindings.push(`customer_source:${current.source}`);
    }
  }

  const sources = [...new Set(customers.map((c) => c.source))];
  if (sources.length > 0) {
    keyFindings.push(`sources:${sources.join(",")}`);
  }

  if (stats.newCustomers === 0 && customers.length > 0) {
    riskFlags.push("NO_NEW_CUSTOMERS_TODAY");
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
  };
}
