/**
 * GET/PATCH /api/clinic/ai-config/settings
 * Phase 6: อ่าน/แก้ไข ai_config.settings รวม clinic_style สำหรับ Customer Persona
 * Merge กับ ai_config เดิม (ไม่ลบ message_templates)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import { getAiConfig } from "@/lib/onboarding";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const VALID_CLINIC_STYLES = ["luxury", "budget", "friendly"] as const;
const VALID_VOICE_IDS = ["V01", "V02", "V03", "V04", "V05", "V06"] as const;
const VALID_SALES_STRATEGIES = ["consultative", "direct", "education_first"] as const;
const VALID_PROMOTION_DISPLAY = ["always", "by_promotion_only", "never"] as const;

/** GET — ดึง ai_config settings */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const settings = await getAiConfig(orgId);
  if (!settings) {
    return NextResponse.json({
      clinic_style: "friendly",
      ai_tone: "casual",
      usp: "",
      competitors: [],
      greeting_message: "",
      fallback_message: "",
      handoff_message: "",
      medicalPolicy: "moderate",
      voice_id: null,
      sales_strategy: undefined,
      show_price_range: true,
      show_exact_price: false,
      negotiation_allowed: false,
      promotion_display: "by_promotion_only",
      max_emoji_per_message: undefined,
    });
  }
  return NextResponse.json(settings);
}

/** PATCH — อัปเดต ai_config settings (merge กับของเดิม) */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const user = await getEffectiveUser(session);
  if (!requireRole(user.role, ["owner", "manager"])) {
    return NextResponse.json(
      { error: "จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager แก้ไขได้" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const existing = await getAiConfig(orgId);

  const clinic_style =
    body.clinic_style != null && VALID_CLINIC_STYLES.includes(body.clinic_style)
      ? body.clinic_style
      : existing?.clinic_style ?? "friendly";
  const ai_tone = body.ai_tone ?? existing?.ai_tone ?? "casual";
  const usp = body.usp ?? existing?.usp ?? "";
  const competitors = Array.isArray(body.competitors)
    ? body.competitors
    : existing?.competitors ?? [];
  const greeting_message = body.greeting_message ?? existing?.greeting_message ?? "";
  const fallback_message = body.fallback_message ?? existing?.fallback_message ?? "";
  const handoff_message = body.handoff_message ?? existing?.handoff_message ?? "";
  const medicalPolicy =
    body.medicalPolicy === "strict" || body.medicalPolicy === "moderate" || body.medicalPolicy === "permissive"
      ? body.medicalPolicy
      : existing?.medicalPolicy ?? "moderate";
  const voice_id =
    body.voice_id != null && VALID_VOICE_IDS.includes(body.voice_id as (typeof VALID_VOICE_IDS)[number])
      ? (body.voice_id as (typeof VALID_VOICE_IDS)[number])
      : existing?.voice_id ?? null;
  const sales_strategy =
    body.sales_strategy != null && VALID_SALES_STRATEGIES.includes(body.sales_strategy as (typeof VALID_SALES_STRATEGIES)[number])
      ? (body.sales_strategy as (typeof VALID_SALES_STRATEGIES)[number])
      : existing?.sales_strategy;
  const show_price_range = typeof body.show_price_range === "boolean" ? body.show_price_range : existing?.show_price_range ?? true;
  const show_exact_price = typeof body.show_exact_price === "boolean" ? body.show_exact_price : existing?.show_exact_price ?? false;
  const negotiation_allowed = typeof body.negotiation_allowed === "boolean" ? body.negotiation_allowed : existing?.negotiation_allowed ?? false;
  const promotion_display =
    body.promotion_display != null && VALID_PROMOTION_DISPLAY.includes(body.promotion_display)
      ? body.promotion_display
      : existing?.promotion_display ?? "by_promotion_only";
  const max_emoji_per_message =
    typeof body.max_emoji_per_message === "number" && body.max_emoji_per_message >= 0 && body.max_emoji_per_message <= 20
      ? body.max_emoji_per_message
      : existing?.max_emoji_per_message;

  const newSettings = {
    clinic_style,
    ai_tone,
    usp,
    competitors,
    greeting_message,
    fallback_message,
    handoff_message,
    medicalPolicy,
    voice_id: voice_id ?? null,
    sales_strategy: sales_strategy ?? null,
    show_price_range,
    show_exact_price,
    negotiation_allowed,
    promotion_display,
    max_emoji_per_message: max_emoji_per_message ?? null,
  };

  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection("organizations").doc(orgId);
  const snap = await ref.get();
  const existingData = snap.exists ? snap.data() ?? {} : {};
  const aiConfig = (existingData?.ai_config && typeof existingData.ai_config === "object")
    ? existingData.ai_config
    : {};
  const oldSettings = aiConfig.settings ?? {};

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(newSettings)) {
    const oldV = oldSettings[k as keyof typeof oldSettings];
    if (JSON.stringify(oldV) !== JSON.stringify(v)) {
      changes[k] = { from: oldV ?? null, to: v };
    }
  }

  await ref.update({
    ai_config: {
      ...aiConfig,
      settings: newSettings,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (Object.keys(changes).length > 0) {
    const historyRef = db.collection("organizations").doc(orgId).collection("ai_config_history");
    const staffId = session.user_id ?? session.clinicId ?? "unknown";
    await historyRef.add({
      changedBy: staffId,
      changes,
      timestamp: FieldValue.serverTimestamp(),
    });
  }

  const { invalidateOrgCache } = await import("@/lib/ai/prompt-cache-manager");
  const { invalidateAICache } = await import("@/lib/ai/ai-feedback-loop");
  void invalidateOrgCache(orgId);
  void invalidateAICache({ org_id: orgId, scope: "org" });

  return NextResponse.json({
    success: true,
    clinic_style,
    ai_tone,
    usp,
    competitors,
    greeting_message,
    fallback_message,
    handoff_message,
    medicalPolicy,
    voice_id,
    sales_strategy,
    show_price_range,
    show_exact_price,
    negotiation_allowed,
    promotion_display,
    max_emoji_per_message,
  });
}
