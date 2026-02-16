/**
 * Alert & Risk Detection Engine — threshold-based alerts from comparison + metrics
 */
import { getAnalyticsComparison } from "@/lib/analytics-comparison";
import { getAnalyticsKnowledge } from "@/lib/analytics-data";

export type AlertSeverity = "high" | "medium";

export type AlertType =
  | "revenue_drop"
  | "conversion_drop"
  | "ai_accuracy_risk"
  | "escalation_spike"
  | "knowledge_gap";

export interface AnalyticsAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
}

const REVENUE_DROP_THRESHOLD = 10;
const CONVERSION_DROP_THRESHOLD = 5;
const AI_ACCURACY_MIN = 80;
const ESCALATION_INCREASE_THRESHOLD = 15;
const KNOWLEDGE_COVERAGE_MIN_DOCS = 1;

/**
 * Generate alerts from current metrics and comparison with previous period.
 */
export async function getAnalyticsAlerts(
  orgId: string,
  opts: { branchId?: string | null; from: Date; to: Date }
): Promise<AnalyticsAlert[]> {
  const alerts: AnalyticsAlert[] = [];
  const [comparison, knowledge] = await Promise.all([
    getAnalyticsComparison(orgId, opts),
    getAnalyticsKnowledge(orgId, { branchId: opts.branchId ?? undefined }),
  ]);

  if (comparison.revenue.direction === "down" && comparison.revenue.percentChange <= -REVENUE_DROP_THRESHOLD) {
    alerts.push({
      type: "revenue_drop",
      severity: comparison.revenue.percentChange <= -20 ? "high" : "medium",
      message: `รายได้ลดลง ${Math.abs(comparison.revenue.percentChange).toFixed(1)}% เทียบกับช่วงก่อน`,
      recommendation: "ตรวจสอบการจองและ conversion rate — พิจารณาโปรโมชันหรือปรับข้อความแชท",
    });
  }

  if (
    comparison.conversionRate.direction === "down" &&
    comparison.conversionRate.percentChange <= -CONVERSION_DROP_THRESHOLD
  ) {
    alerts.push({
      type: "conversion_drop",
      severity: "medium",
      message: `Conversion (แชท→จอง) ลดลง ${Math.abs(comparison.conversionRate.percentChange).toFixed(1)}%`,
      recommendation: "ปรับข้อความแชทให้ชวนจอง หรือเช็กความพร้อมของระบบจองคิว",
    });
  }

  if (comparison.accuracy.current < AI_ACCURACY_MIN && comparison.accuracy.current > 0) {
    alerts.push({
      type: "ai_accuracy_risk",
      severity: comparison.accuracy.current < 60 ? "high" : "medium",
      message: `ความแม่นยำ AI ต่ำกว่า ${AI_ACCURACY_MIN}% (ปัจจุบัน ${comparison.accuracy.current.toFixed(1)}%)`,
      recommendation: "ไปที่ Golden Dataset ติดป้าย feedback และเพิ่ม Knowledge ที่เกี่ยวข้อง",
    });
  }

  if (
    comparison.escalationRate.direction === "up" &&
    comparison.escalationRate.percentChange >= ESCALATION_INCREASE_THRESHOLD &&
    comparison.escalationRate.previous > 0
  ) {
    alerts.push({
      type: "escalation_spike",
      severity: "medium",
      message: `Escalation เพิ่มขึ้น ${comparison.escalationRate.percentChange.toFixed(1)}% เทียบกับช่วงก่อน`,
      recommendation: "ตรวจสอบคำถามที่ลูกค้าถามบ่อยและเพิ่ม Knowledge หรือปรับ AI",
    });
  }

  if (knowledge.activeDocuments < KNOWLEDGE_COVERAGE_MIN_DOCS) {
    alerts.push({
      type: "knowledge_gap",
      severity: "medium",
      message: "ยังไม่มี Knowledge เปิดใช้งาน — AI จะตอบจากข้อมูลทั่วไปเท่านั้น",
      recommendation: "ไปที่ Knowledge Input เพิ่มเนื้อหาคลินิก (บริการ ราคา โปรโมชัน)",
    });
  }

  return alerts;
}
