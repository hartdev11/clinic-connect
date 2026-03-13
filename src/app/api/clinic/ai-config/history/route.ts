/**
 * GET /api/clinic/ai-config/history
 * Phase 23: Last 5 config changes for timeline
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  voice_id: "Voice",
  medicalPolicy: "Medical Policy",
  sales_strategy: "Sales Strategy",
  show_price_range: "แสดงช่วงราคา",
  show_exact_price: "แสดงราคาแน่นอน",
  negotiation_allowed: "ต่อรองราคา",
  promotion_display: "การแสดงโปรโมชั่น",
  clinic_style: "สไตล์คลินิก",
  greeting_message: "ข้อความทักทาย",
  fallback_message: "ข้อความ Fallback",
  handoff_message: "ข้อความ Handoff",
};

function formatChange(field: string, from: unknown, to: unknown): string {
  const label = FIELD_LABELS[field] ?? field;
  const fromStr = from === null || from === undefined ? "(ไม่ระบุ)" : String(from);
  const toStr = to === null || to === undefined ? "(ไม่ระบุ)" : String(to);
  return `เปลี่ยน ${label} จาก ${fromStr} → ${toStr}`;
}

function formatTimeAgo(ts: { toMillis?: () => number } | Date): string {
  const ms = typeof ts === "object" && ts !== null && "toMillis" in ts && typeof (ts as { toMillis: () => number }).toMillis === "function"
    ? (ts as { toMillis: () => number }).toMillis()
    : new Date(ts as Date).getTime();
  const diff = Date.now() - ms;
  if (diff < 60000) return "เมื่อสักครู่";
  if (diff < 3600000) return `เมื่อ ${Math.floor(diff / 60000)} นาทีที่แล้ว`;
  if (diff < 86400000) return `เมื่อ ${Math.floor(diff / 3600000)} ชั่วโมงที่แล้ว`;
  if (diff < 604800000) return `เมื่อ ${Math.floor(diff / 86400000)} วันที่แล้ว`;
  return `เมื่อ ${Math.floor(diff / 604800000)} สัปดาห์ที่แล้ว`;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("ai_config_history")
    .orderBy("timestamp", "desc")
    .limit(5)
    .get();

  const items = snap.docs.map((doc) => {
    const d = doc.data();
    const changes = (d.changes as Record<string, { from: unknown; to: unknown }>) ?? {};
    const lines = Object.entries(changes).map(([k, v]) => formatChange(k, v.from, v.to));
    return {
      id: doc.id,
      changedBy: d.changedBy ?? "unknown",
      changes: lines,
      summary: lines[0] ?? "มีการเปลี่ยนแปลง",
      timeAgo: d.timestamp ? formatTimeAgo(d.timestamp) : "",
      timestamp: d.timestamp?.toMillis?.() ?? null,
    };
  });

  return NextResponse.json({ history: items });
}
