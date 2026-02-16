/**
 * 🚨 INTERNAL AI EXECUTIVE CONTEXT ONLY — Not customer facing.
 * Generates executive brief from finance metrics. Never expose to customer channel.
 * แยกจาก customer chat: model config, ไม่ใช้ circuit breaker ของแชท, cost tracking แยก (workload_type: executive_brief)
 */
import { getOpenAI } from "@/lib/agents/clients";
import type { ExecutiveFinanceData } from "@/lib/financial-data/executive";

const SYSTEM_PROMPT = `You are an internal financial analyst. Generate a brief executive summary in Thai (4-6 sentences).
Include: (1) Revenue interpretation for the period, (2) Growth vs previous period, (3) Risk warnings if any,
(4) Opportunity identification, (5) One strategic recommendation.
Do NOT include raw transaction lists or sensitive breakdowns. Use only the aggregated metrics provided.
Output plain text only, no bullet points or headers.`;

/** Model config สำหรับ Executive Brief เท่านั้น — ไม่ใช้ getModelConfig(org) หรือ circuit ของ customer chat */
const EXECUTIVE_BRIEF_MODEL =
  (typeof process !== "undefined" && process.env?.EXECUTIVE_BRIEF_MODEL) || "gpt-4o-mini";
const EXECUTIVE_BRIEF_MAX_TOKENS = 400;
const EXECUTIVE_BRIEF_TEMPERATURE = 0.3;

export interface ExecutiveBriefResult {
  brief: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function generateExecutiveFinanceBrief(
  data: ExecutiveFinanceData,
  options?: { orgId?: string }
): Promise<ExecutiveBriefResult> {
  const openai = getOpenAI();
  if (!openai) {
    return { brief: "ไม่สามารถสร้างสรุปได้ในขณะนี้" };
  }
  const payload = {
    period: data.range.label,
    totalRevenue: data.totalRevenue,
    totalRevenuePrevious: data.totalRevenuePrevious,
    growthPercent: data.growthPercent,
    netRevenue: data.netRevenue,
    averageTicketSize: data.averageTicketSize,
    revenuePerCustomer: data.revenuePerCustomer,
    bookingToRevenueConversionPercent: data.bookingToRevenueConversionPercent,
    topPerformingService: data.topPerformingService,
    topPerformingServiceRevenue: data.topPerformingServiceRevenue,
    revenueStabilityScore: data.revenueStabilityScore,
    riskAlert: data.riskAlert,
    refundRatePercent: data.financialHealth.refundRatePercent,
    cancellationRatePercent: data.financialHealth.cancellationRatePercent,
    noShowRatePercent: data.financialHealth.noShowRatePercent,
    revenueConcentrationTopServicePercent: data.financialHealth.revenueConcentrationTopServicePercent,
    revenueConcentrationRiskTriggered: data.financialHealth.revenueConcentrationRiskTriggered,
  };
  const userContent = `สรุปสำหรับผู้บริหาร จากข้อมูลต่อไปนี้ (หน่วยบาท หรือ %):\n${JSON.stringify(payload, null, 0)}`;
  try {
    const completion = await openai.chat.completions.create({
      model: EXECUTIVE_BRIEF_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      max_tokens: EXECUTIVE_BRIEF_MAX_TOKENS,
      temperature: EXECUTIVE_BRIEF_TEMPERATURE,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens ?? 0,
          completion_tokens: completion.usage.completion_tokens ?? 0,
          total_tokens: completion.usage.total_tokens ?? 0,
        }
      : undefined;
    if (options?.orgId && usage) {
      const { recordLLMUsage } = await import("@/lib/llm-metrics");
      recordLLMUsage(options.orgId, usage, { workloadType: "executive_brief" }).catch((e) =>
        console.error("[executive-finance-brief] recordLLMUsage:", e)
      );
    }
    return { brief: text || "ไม่สามารถสร้างสรุปได้ในขณะนี้", usage };
  } catch (err) {
    console.error("[executive-finance-brief]", err);
    return { brief: "ไม่สามารถสร้างสรุปได้ในขณะนี้" };
  }
}
