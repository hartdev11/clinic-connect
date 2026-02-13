/**
 * Cross-Agent Reasoning — Enterprise
 * Combine logic: Booking + Promotion, Finance → Campaign, Customer churn
 * ไม่ใช่แค่ดึงข้อมูล แต่วิเคราะห์เชิงกลยุทธ์
 */
import type { AggregatedAnalyticsContext } from "./types";

export interface CrossAgentInsight {
  type: "booking_promo" | "finance_campaign" | "churn_risk" | "upsell_opportunity";
  recommendation: string;
  confidence: number;
  keyFindings: string[];
}

/** Booking + Promotion: คิวว่าง + โปรที่เหมาะ → แนะนำจอง */
function reasonBookingPromo(ctx: AggregatedAnalyticsContext): CrossAgentInsight | null {
  const booking = ctx.booking.keyFindings;
  const promo = ctx.promotion.keyFindings;
  const hasAvailability = booking.some((f) =>
    /available|ว่าง|next|คิว/i.test(f)
  );
  const hasPromo = promo.length > 0;

  if (hasAvailability && hasPromo) {
    const promoRec = ctx.promotion.recommendation;
    return {
      type: "booking_promo",
      recommendation: promoRec ?? "มีคิวว่างและโปรพิเศษ — ชวนลูกค้าจอง",
      confidence: 0.85,
      keyFindings: [
        ...booking.filter((f) => f.length < 100).slice(0, 2),
        ...promo.filter((f) => f.length < 100).slice(0, 2),
      ],
    };
  }
  return null;
}

/** Finance trend → recommend campaign (internal only) */
function reasonFinanceCampaign(ctx: AggregatedAnalyticsContext): CrossAgentInsight | null {
  const finance = ctx.finance.keyFindings;
  const hasTrend = finance.some((f) => /trend|แนวโน้ม|ลด|increase/i.test(f));
  if (hasTrend && ctx.finance.recommendation) {
    return {
      type: "finance_campaign",
      recommendation: ctx.finance.recommendation,
      confidence: 0.7,
      keyFindings: finance.slice(0, 3),
    };
  }
  return null;
}

/** Customer churn risk — จาก feedback + customer analytics */
function reasonChurnRisk(ctx: AggregatedAnalyticsContext): CrossAgentInsight | null {
  const feedback = ctx.feedback.riskFlags;
  const customer = ctx.customer.riskFlags;
  const hasRisk = feedback.some((f) => /fail|negative|unsatisfied/i.test(f)) ||
    customer.some((f) => /churn|ไม่กลับมา|หายไป/i.test(f));

  if (hasRisk) {
    return {
      type: "churn_risk",
      recommendation: "ลูกค้ามีความเสี่ยงไม่กลับมา — พิจารณาติดตามหรือเสนอโปรพิเศษ",
      confidence: 0.6,
      keyFindings: [...feedback, ...customer].slice(0, 3),
    };
  }
  return null;
}

/** Upsell — จาก customer interest + knowledge */
function reasonUpsell(ctx: AggregatedAnalyticsContext): CrossAgentInsight | null {
  const customer = ctx.customer.keyFindings;
  const knowledge = ctx.knowledge.keyFindings;
  const hasInterest = customer.some((f) => /สนใจ|interest|อยากลอง/i.test(f));
  const hasService = knowledge.length > 0;

  if (hasInterest && hasService) {
    return {
      type: "upsell_opportunity",
      recommendation: "ลูกค้าแสดงความสนใจ — พิจารณาแนะนำบริการเสริม",
      confidence: 0.75,
      keyFindings: [...customer, ...knowledge].slice(0, 3),
    };
  }
  return null;
}

/** รัน Cross-Agent Reasoning ทั้งหมด */
export function runCrossAgentReasoning(
  ctx: AggregatedAnalyticsContext
): CrossAgentInsight[] {
  const results: CrossAgentInsight[] = [];
  const r1 = reasonBookingPromo(ctx);
  if (r1) results.push(r1);
  const r2 = reasonFinanceCampaign(ctx);
  if (r2) results.push(r2);
  const r3 = reasonChurnRisk(ctx);
  if (r3) results.push(r3);
  const r4 = reasonUpsell(ctx);
  if (r4) results.push(r4);
  return results;
}
