/**
 * Booking Analytics Agent
 * Data/Logic only — NO LLM
 * ดึงข้อมูลจองคิวจาก Firestore → business logic → JSON structured output
 * Enterprise: รวม availability สำหรับ AI ตอบ "หมอคนไหนว่าง"
 * Target: <200ms
 */
import {
  getDashboardStats,
  getDashboardBookingsByDate,
  listDoctorSchedules,
} from "@/lib/clinic-data";
import { getAvailableSlots, getDayTimeline } from "@/lib/slot-engine";
import type { AnalyticsAgentOutput } from "../types";
import type { AnalyticsContext } from "../types";

const AGENT_NAME = "booking-agent";
const TIMEOUT_MS = 350;

export async function runBookingAgent(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<AnalyticsAgentOutput>((_, reject) =>
      setTimeout(() => reject(new Error("Booking agent timeout")), TIMEOUT_MS)
    );

    const result = await Promise.race([
      executeBookingAnalytics(ctx),
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
      riskFlags: ["BOOKING_DATA_UNAVAILABLE"],
    };
  }
}

async function executeBookingAnalytics(
  ctx: AnalyticsContext
): Promise<AnalyticsAgentOutput> {
  const { org_id, branch_id } = ctx;

  const [stats, bookingsByDate] = await Promise.all([
    getDashboardStats(org_id, branch_id ?? undefined),
    getDashboardBookingsByDate(org_id, branch_id ?? undefined),
  ]);

  const keyFindings: string[] = [];
  const riskFlags: string[] = [];
  let recommendation: string | null = null;

  // วันนี้
  keyFindings.push(`bookings_today:${stats.bookingsToday}`);
  keyFindings.push(`bookings_tomorrow:${stats.bookingsTomorrow}`);

  const totalSlots = bookingsByDate.reduce((sum, d) => sum + d.total, 0);
  if (totalSlots > 0) {
    const day0 = bookingsByDate[0];
    if (day0) {
      keyFindings.push(`slots_today:${day0.total}`);
      keyFindings.push(`date_label:${day0.dateLabel}`);
    }
  }

  // Enterprise: Availability สำหรับ AI — หมอคนไหนว่างวันไหน (next 2 days, max 4 doctors)
  const branchIdForAvail = branch_id ?? undefined;
  if (branchIdForAvail) {
    try {
      const doctors = await listDoctorSchedules(org_id);
      const today = new Date().toISOString().slice(0, 10);
      const tasks: Array<Promise<{ dateStr: string; label: string; doc: { doctor_id: string; doctor_name?: string }; slots: number; first: string; last: string }>> = [];
      for (let d = 0; d < 2; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10);
        const label = date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
        for (const doc of doctors.slice(0, 4)) {
          tasks.push(
            getAvailableSlots(org_id, branchIdForAvail, dateStr, { doctorId: doc.doctor_id, durationMinutes: 30 }).then(
              (res) => ({
                dateStr,
                label,
                doc,
                slots: res.slots.length,
                first: res.slots[0]?.start ?? "",
                last: res.slots[res.slots.length - 1]?.start ?? "",
              })
            )
          );
        }
      }
      const results = await Promise.all(tasks);
      const byDate = new Map<string, { label: string; docs: string[] }>();
      for (const r of results) {
        if (r.slots > 0) {
          let entry = byDate.get(r.dateStr);
          if (!entry) {
            entry = { label: r.label, docs: [] };
            byDate.set(r.dateStr, entry);
          }
          entry.docs.push(`${r.doc.doctor_name || r.doc.doctor_id}:${r.slots}slots(${r.first}-${r.last})`);
        }
      }
      for (const [dateStr, { label, docs }] of byDate) {
        if (docs.length > 0) keyFindings.push(`availability_${dateStr}:${label}=${docs.join("|")}`);
      }
      // Enterprise: Timeline summary สำหรับ AI — หมอว่าง/มีคิว/เสร็จ วันนี้
      try {
        const today = new Date().toISOString().slice(0, 10);
        const timelineLines: string[] = [];
        for (const doc of doctors.slice(0, 4)) {
          const tl = await getDayTimeline(org_id, branchIdForAvail, today, {
            doctorId: doc.doctor_id,
            durationMinutes: 30,
          });
          const free = tl.slots.filter((s) => s.status === "free").length;
          const busy = tl.slots.filter((s) => s.status === "busy").length;
          const done = tl.slots.filter((s) => s.status === "completed").length;
          if (free > 0 || busy > 0 || done > 0) {
            timelineLines.push(
              `${doc.doctor_name || doc.doctor_id}:ว่าง${free}มีคิว${busy}เสร็จ${done}`
            );
          }
        }
        if (timelineLines.length > 0) {
          keyFindings.push(`ai_timeline_today:${timelineLines.join("|")}`);
        }
      } catch {
        // ไม่บล็อก
      }
    } catch {
      // ไม่บล็อก — availability เป็นเสริมเท่านั้น
    }
  }

  if (stats.bookingsToday >= 8) {
    riskFlags.push("TODAY_NEARLY_FULL");
  }
  if (stats.bookingsTomorrow === 0 && stats.bookingsToday >= 5) {
    riskFlags.push("TOMORROW_NO_BOOKINGS_YET");
  }

  if (stats.bookingsToday < 3 && stats.bookingsTomorrow < 3) {
    recommendation = "AVAILABLE_TODAY_AND_TOMORROW";
  } else if (stats.bookingsTomorrow < 5) {
    recommendation = "PREFER_TOMORROW";
  }

  return {
    keyFindings,
    recommendation,
    riskFlags,
  };
}
