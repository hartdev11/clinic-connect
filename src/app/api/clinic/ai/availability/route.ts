/**
 * Enterprise: AI Availability API
 * สำหรับ AI/Chatbot เพื่อตอบคำถาม "หมอคนไหนว่าง", "มี slot เมื่อไหร่", "วันนี้หมอทำอะไรบ้าง"
 * GET ?branchId=xxx&from=YYYY-MM-DD&days=7&includeTimeline=1&format=ai (optional)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import {
  getOrgIdFromClinicId,
  listDoctorSchedules,
  getBranchesByOrgId,
} from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { getAvailableSlots, getDayTimeline } from "@/lib/slot-engine";

export const dynamic = "force-dynamic";

const CACHE_MAX_AGE = 60;
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 120;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(orgId: string): boolean {
  const now = Date.now();
  const key = `avail:${orgId}`;
  let entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW * 1000 };
    requestCounts.set(key, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ?? session.branch_id ?? null;
    const fromStr = searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 7, 1), 14);

    if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, branchId)) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }
    if (!checkRateLimit(orgId)) {
      return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });
    }

    const includeTimeline = searchParams.get("includeTimeline") === "1" || searchParams.get("includeTimeline") === "true";
    const formatAi = searchParams.get("format") === "ai";

    const branches = await getBranchesByOrgId(orgId);
    const effectiveBranchId = branchId ?? branches[0]?.id;
    if (!effectiveBranchId) {
      return NextResponse.json({ doctors: [], summary: "ไม่มีสาขา", aiSummary: "ไม่มีสาขาเปิดให้บริการ" });
    }

    const doctors = await listDoctorSchedules(orgId);
    const from = new Date(fromStr);

    type DateEntry = {
      date: string;
      dateLabel: string;
      freeSlots: number;
      firstSlot?: string;
      lastSlot?: string;
      timeline?: Array<{ start: string; status: "free" | "busy" | "completed"; customerName?: string }>;
    };
    const byDoctor: Array<{ doctor_id: string; doctor_name?: string; dates: DateEntry[] }> = [];

    for (const doc of doctors) {
      const dates: DateEntry[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const dateLabel = d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });

        if (includeTimeline && i === 0) {
          const [timelineRes, slotRes] = await Promise.all([
            getDayTimeline(orgId, effectiveBranchId, dateStr, { doctorId: doc.doctor_id, durationMinutes: 30 }),
            getAvailableSlots(orgId, effectiveBranchId, dateStr, { doctorId: doc.doctor_id, durationMinutes: 30 }),
          ]);
          dates.push({
            date: dateStr,
            dateLabel,
            freeSlots: slotRes.slots.length,
            firstSlot: slotRes.slots[0]?.start,
            lastSlot: slotRes.slots.length > 0 ? slotRes.slots[slotRes.slots.length - 1]?.start : undefined,
            timeline: timelineRes.slots.map((s) => ({ start: s.start, status: s.status, customerName: s.customerName })),
          });
        } else {
          const result = await getAvailableSlots(orgId, effectiveBranchId, dateStr, {
            doctorId: doc.doctor_id,
            durationMinutes: 30,
          });
          dates.push({
            date: dateStr,
            dateLabel,
            freeSlots: result.slots.length,
            firstSlot: result.slots[0]?.start,
            lastSlot: result.slots.length > 0 ? result.slots[result.slots.length - 1]?.start : undefined,
          });
        }
      }
      byDoctor.push({ doctor_id: doc.doctor_id, doctor_name: doc.doctor_name, dates });
    }

    const summary = byDoctor
      .map(
        (d) =>
          `${d.doctor_name || d.doctor_id}: ${d.dates.filter((x) => x.freeSlots > 0).length} วันว่างจาก ${days} วัน`
      )
      .join("; ");

    let aiSummary = "";
    if (formatAi) {
      const lines: string[] = [`[ปฏิทิน] สาขา ${effectiveBranchId} ช่วง ${fromStr} ถึง ${days} วัน`];
      for (const doc of byDoctor) {
        const name = doc.doctor_name || doc.doctor_id;
        const avail = doc.dates.filter((x) => x.freeSlots > 0).length;
        lines.push(`- ${name}: ว่าง ${avail} วัน`);
        for (const day of doc.dates.slice(0, 3)) {
          if (day.freeSlots > 0) {
            lines.push(`  ${day.dateLabel}: ${day.freeSlots} slot (${day.firstSlot ?? ""}-${day.lastSlot ?? ""})`);
          } else if (day.timeline) {
            const busy = day.timeline.filter((t) => t.status === "busy").length;
            const done = day.timeline.filter((t) => t.status === "completed").length;
            if (busy > 0 || done > 0) lines.push(`  ${day.dateLabel}: มีคิว ${busy} เสร็จ ${done}`);
          }
        }
      }
      aiSummary = lines.join("\n");
    }

    const headers = new Headers();
    headers.set("Cache-Control", `private, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`);
    const body: Record<string, unknown> = { branchId: effectiveBranchId, from: fromStr, days, doctors: byDoctor, summary };
    if (aiSummary) body.aiSummary = aiSummary;
    return NextResponse.json(body, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    const code = err instanceof Error ? (err.name === "Error" ? "SERVER_ERROR" : err.name) : "SERVER_ERROR";
    console.error("GET /api/clinic/ai/availability:", err);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" ? msg : "Server error", code }, { status: 500 });
  }
}
