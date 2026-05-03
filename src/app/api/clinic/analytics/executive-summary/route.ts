import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsContext } from "../shared";
import {
  getAnalyticsOverview,
  getAnalyticsConversation,
  getAnalyticsAIPerformance,
} from "@/lib/analytics-data";
import { getGemini } from "@/lib/agents/clients";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const AI_MAX_ATTEMPTS = 3;
const AI_BASE_BACKOFF_MS = 350;

function isProviderUnavailableError(error: unknown): boolean {
  const message = String(error ?? "");
  return message.includes("UNAVAILABLE") || message.includes('"code":503') || message.includes("status: 503");
}

function buildDeterministicSummary(input: {
  revenue: number;
  totalChats: number;
  totalBookings: number;
  conversionRate: number;
  aiCloseRate: number;
  accuracyScore: number;
}) {
  const {
    revenue,
    totalChats,
    totalBookings,
    conversionRate,
    aiCloseRate,
    accuracyScore,
  } = input;
  return `ช่วงเวลานี้คลินิกมีรายได้รวมประมาณ ฿${revenue.toLocaleString("th-TH")} จากการสนทนา ${totalChats.toLocaleString("th-TH")} ครั้งและการจอง ${totalBookings.toLocaleString("th-TH")} ครั้ง โดยอัตราแปลงผลอยู่ที่ ${conversionRate}% และอัตรา AI close อยู่ที่ ${aiCloseRate}% พร้อมความแม่นยำจาก feedback ที่ ${accuracyScore}%; ควรเร่งติดตามบทสนทนาที่มีเจตนาจองสูงทันทีและปรับข้อความตอบในจุดที่ยังปิดการจองไม่สำเร็จเพื่อเพิ่ม conversion ระยะสั้น.`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  return runWithObservability("/api/clinic/analytics/executive-summary", request, async () => {
    const result = await getAnalyticsContext(request);
    if ("response" in result) return result.response;
    const { context } = result;
    try {
      const [overview, conversation, aiPerf] = await Promise.all([
      getAnalyticsOverview(context.orgId, {
        branchId: context.branchId,
        from: context.range.from,
        to: context.range.to,
      }),
      getAnalyticsConversation(context.orgId, {
        branchId: context.branchId,
        from: context.range.from,
        to: context.range.to,
      }),
      getAnalyticsAIPerformance(context.orgId, {
        branchId: context.branchId,
        from: context.range.from,
        to: context.range.to,
      }),
    ]);

    /** Deterministic snapshot for audit — same query → same numbers; AI only generates prose from this. */
    const metricsSnapshot = {
      from: context.range.from.toISOString(),
      to: context.range.to.toISOString(),
      revenue: overview.revenue,
      totalChats: overview.totalChats,
      totalBookings: overview.totalBookings,
      conversionRate: overview.conversionRate,
      aiCloseRate: overview.aiCloseRate,
      avgPerDay: conversation.avgPerDay,
      accuracyScore: aiPerf.accuracyScore,
      failCount: aiPerf.failCount,
      totalLabeled: aiPerf.totalLabeled,
    };

    const metricsText = `
ช่วงเวลา: ${context.range.from.toISOString().slice(0, 10)} ถึง ${context.range.to.toISOString().slice(0, 10)}

รายได้รวม: ฿${overview.revenue.toLocaleString("th-TH")}
จำนวนแชท: ${overview.totalChats}
จำนวนการจอง: ${overview.totalBookings}
อัตรา Conversion (แชท→จอง): ${overview.conversionRate}%
อัตรา AI Close (คำตอบที่อนุมัติ): ${overview.aiCloseRate}%
แชทเฉลี่ย/วัน: ${conversation.avgPerDay}
ความแม่นยำ AI (จาก feedback): ${aiPerf.accuracyScore}%
คำตอบที่ fail: ${aiPerf.failCount} จาก ${aiPerf.totalLabeled} ที่ติดป้าย
`.trim();

    const gemini = getGemini();
    if (!gemini) {
      return {
        response: NextResponse.json({
          summary: null,
          metricsSnapshot,
          message: "ตั้งค่า GEMINI_API_KEY เพื่อสร้างสรุปจาก AI",
          from: context.range.from.toISOString(),
          to: context.range.to.toISOString(),
          preset: context.range.preset,
        }),
        orgId: context.orgId,
        branchId: context.branchId,
      };
    }

    const systemPrompt = `คุณคือที่ปรึกษาธุรกิจสำหรับคลินิกความงาม
หน้าที่: สรุปข้อมูลด้านล่างเป็น Executive Summary สั้นๆ เป็นภาษาไทย (1 ย่อหน้า)
- สรุปภาพรวมธุรกิจ
- จุดแข็งหรือโอกาส (ถ้ามีตัวเลขดี)
- ความเสี่ยงหรือสิ่งที่ควรปรับ (ถ้ามี)
- แนะนำ action 1–2 ข้อที่ทำได้ทันที
ห้ามใช้ bullet ยาว; เขียนเป็น paragraph อ่านง่าย`;

    let summary: string | null = null;
    let generatedBy: "ai" | "fallback" = "ai";
    let providerStatus: "ok" | "unavailable" = "ok";
    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `ข้อมูลเมตริก:\n\n${metricsText}`,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 512,
            temperature: 0.3,
          },
        });
        summary = response?.text?.trim() ?? null;
        break;
      } catch (modelError) {
        if (!isProviderUnavailableError(modelError)) {
          throw modelError;
        }

        const hasRemainingAttempts = attempt < AI_MAX_ATTEMPTS;
        if (!hasRemainingAttempts) {
          providerStatus = "unavailable";
          generatedBy = "fallback";
          summary = buildDeterministicSummary({
            revenue: overview.revenue,
            totalChats: overview.totalChats,
            totalBookings: overview.totalBookings,
            conversionRate: overview.conversionRate,
            aiCloseRate: overview.aiCloseRate,
            accuracyScore: aiPerf.accuracyScore,
          });
          break;
        }

        const backoffMs = AI_BASE_BACKOFF_MS * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }
    }

    return {
      response: NextResponse.json({
        summary,
        generatedBy,
        providerStatus,
        metricsSnapshot,
        from: context.range.from.toISOString(),
        to: context.range.to.toISOString(),
        preset: context.range.preset,
      }),
      orgId: context.orgId,
      branchId: context.branchId,
    };
  } catch (err) {
    console.error("GET /api/clinic/analytics/executive-summary:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
