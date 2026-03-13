/**
 * Phase 21 — Admin anomaly detection
 * AI cost spike, usage spike, conversation drop
 */
import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import { getTodayKeyBangkok, getDateKeyBangkokDaysAgo } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export interface AnomalyItem {
  id: string;
  orgId: string;
  orgName: string;
  metric: string;
  severity: "HIGH" | "MEDIUM";
  actualValue: number;
  expectedValue: number;
  deviationPct: number;
  timestamp: string;
}

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const today = getTodayKeyBangkok();
    const yesterday = getDateKeyBangkokDaysAgo(1);
    const dates7d = Array.from({ length: 7 }, (_, i) => getDateKeyBangkokDaysAgo(i));

    const orgsSnap = await db.collection("organizations").limit(200).get();
    const anomalies: AnomalyItem[] = [];

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      const orgName = (orgDoc.data().name as string) ?? orgDoc.data().displayName ?? orgId;

      let costToday = 0;
      let costYesterday = 0;
      const convsByDay: number[] = [];

      for (const date of dates7d) {
        const doc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("ai_usage_daily")
          .doc(date)
          .get();
        if (doc.exists) {
          const d = doc.data()!;
          const cost = (d.totalCost as number) ?? 0;
          const calls = (d.byWorkloadType as Record<string, { calls?: number }>)?.customer_chat?.calls ?? 0;
          convsByDay.push(calls);
          if (date === today) costToday = cost;
          if (date === yesterday) costYesterday = cost;
        } else {
          convsByDay.push(0);
        }
      }

      const convsToday = convsByDay[0] ?? 0;
      const avg7d = convsByDay.length > 0 ? convsByDay.reduce((a, b) => a + b, 0) / convsByDay.length : 0;

      if (costYesterday > 0 && costToday > costYesterday * 3) {
        anomalies.push({
          id: `cost-spike-${orgId}`,
          orgId,
          orgName,
          metric: "AI cost spike",
          severity: "HIGH",
          actualValue: costToday,
          expectedValue: costYesterday,
          deviationPct: Math.round(((costToday - costYesterday) / costYesterday) * 10000) / 100,
          timestamp: new Date().toISOString(),
        });
      }

      if (avg7d > 0 && convsToday > avg7d * 3) {
        anomalies.push({
          id: `usage-spike-${orgId}`,
          orgId,
          orgName,
          metric: "Usage spike",
          severity: "MEDIUM",
          actualValue: convsToday,
          expectedValue: avg7d,
          deviationPct: Math.round(((convsToday - avg7d) / avg7d) * 10000) / 100,
          timestamp: new Date().toISOString(),
        });
      }

      if (avg7d > 0 && convsToday < avg7d * 0.3) {
        anomalies.push({
          id: `conversation-drop-${orgId}`,
          orgId,
          orgName,
          metric: "Conversation drop",
          severity: "HIGH",
          actualValue: convsToday,
          expectedValue: avg7d,
          deviationPct: Math.round(((convsToday - avg7d) / avg7d) * 10000) / 100,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ anomalies });
  } catch (err) {
    console.error("GET /api/admin/anomalies:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
