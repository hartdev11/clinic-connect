/**
 * Message templates for manual send panel
 * Stored in organizations/{orgId} → ai_config.message_templates (array)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";

const DEFAULT_TEMPLATES = [
  "สวัสดีค่ะ คุณ{name} 😊 มีอะไรให้ช่วยไหมคะ?",
  "ขอบคุณที่ใช้บริการนะคะ หวังว่าจะพบกันใหม่เร็วๆ นี้ 💕",
  "มีโปรโมชั่นพิเศษสำหรับคุณค่ะ! [ใส่รายละเอียด]",
  "ขอเตือนนัดหมายพรุ่งนี้ค่ะ 📅 [ใส่วันเวลา]",
];

export const dynamic = "force-dynamic";

/** GET — fetch message templates (return defaults if none) */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const doc = await db.collection("organizations").doc(orgId).get();
    const raw = doc.exists ? doc.data()?.ai_config?.message_templates : undefined;
    const templates = Array.isArray(raw) && raw.length > 0
      ? raw.filter((t): t is string => typeof t === "string")
      : [...DEFAULT_TEMPLATES];

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("GET /api/clinic/ai-config/message-templates:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH — save message templates */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await request.json();
    const raw = body.templates;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "templates must be an array" }, { status: 400 });
    }
    const templates = raw
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.trim())
      .filter(Boolean);

    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = db.collection("organizations").doc(orgId);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() ?? {} : {};
    const aiConfig = (existing?.ai_config && typeof existing.ai_config === "object")
      ? existing.ai_config
      : {};
    await ref.update({
      ai_config: { ...aiConfig, message_templates: templates },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, templates });
  } catch (err) {
    console.error("PATCH /api/clinic/ai-config/message-templates:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
