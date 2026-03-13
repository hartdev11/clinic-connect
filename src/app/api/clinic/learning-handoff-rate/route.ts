/**
 * Phase 24 — Handoff rate by week for knowledge-health chart
 * GET: weekly_handoff_rate = handoffs / total_conversations per week
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { getDateKeyBangkokDaysAgo } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const y = monday.getFullYear();
  const w = Math.ceil((monday.getDate() + 6 - monday.getDay()) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  try {
    const weeks: Array<{ week: string; handoffs: number; conversations: number; handoffRate: number }> = [];

    for (let i = 0; i < 8; i++) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (i + 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const weekKey = getWeekKey(startDate);

      const handoffSnap = await db
        .collection("organizations")
        .doc(orgId)
        .collection("handoff_sessions")
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .get();

      let conversations = 0;
      for (let d = 0; d < 7; d++) {
        const dateKey = getDateKeyBangkokDaysAgo(i * 7 + d);
        const metricsDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("metrics")
          .doc(dateKey)
          .get();
        if (metricsDoc.exists) {
          const data = metricsDoc.data();
          conversations += (data?.cache_requests ?? 0) + (data?.template_responses ?? 0);
          if (conversations === 0 && (data?.cache_hits ?? 0) > 0) {
            conversations = (data?.cache_requests ?? 0) || 1;
          }
        }
      }

      const handoffs = handoffSnap.size;
      const rate = conversations > 0 ? Math.round((handoffs / conversations) * 10000) / 100 : 0;

      weeks.unshift({
        week: weekKey,
        handoffs,
        conversations,
        handoffRate: rate,
      });
    }

    const current = weeks[weeks.length - 1];
    const previous = weeks[weeks.length - 2];
    const improvement =
      current && previous && previous.handoffRate > 0
        ? Math.round(((previous.handoffRate - current.handoffRate) / previous.handoffRate) * 100)
        : null;

    return NextResponse.json({
      weeks,
      currentHandoffRate: current?.handoffRate ?? 0,
      targetRate: 15,
      improvement,
    });
  } catch (err) {
    console.error("GET /api/clinic/learning-handoff-rate:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
