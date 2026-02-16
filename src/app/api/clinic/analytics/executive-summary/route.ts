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

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `ข้อมูลเมตริก:\n\n${metricsText}`,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 512,
        temperature: 0.3,
      },
    });
    const summary = response?.text?.trim() ?? null;

    return {
      response: NextResponse.json({
        summary,
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
