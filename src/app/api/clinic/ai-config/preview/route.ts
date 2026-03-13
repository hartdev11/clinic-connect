/**
 * POST /api/clinic/ai-config/preview
 * Phase 23: Generate 3 sample chat responses based on current config
 * Uses Gemini with tenant prompt
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getAiConfig } from "@/lib/onboarding";
import { getTenantPromptBuilder } from "@/lib/ai/tenant-prompt-builder";
import { getCoreBrain } from "@/lib/ai/core-brain";
import { planToTier } from "@/lib/ai/core-brain";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const SCENARIOS = [
  { label: "ทักทาย", customerMessage: "สวัสดีค่ะ อยากสอบถามเรื่องโบท็อกซ์", systemHint: "ตอบทักทายแบบตาม voice ที่เลือก กระชับ 1-2 ประโยค" },
  { label: "สอบถามราคา", customerMessage: "โบท็อกซ์ราคาเท่าไหร่คะ", systemHint: "ตอบเรื่องราคาตาม show_price_range และ show_exact_price" },
  { label: "จัดการข้อโต้แย้ง", customerMessage: "กลัวเจ็บ ไม่แน่ใจว่าจะเหมาะไหม", systemHint: "ตอบคลายความกังวลตาม sales_strategy ที่เลือก" },
];

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  let configOverride: Record<string, unknown> = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") configOverride = body;
  } catch {
    /* use server config */
  }

  const tenantConfig = await getAiConfig(orgId);
  if (!tenantConfig) {
    return NextResponse.json({ error: "AI config not found" }, { status: 404 });
  }

  const override: Record<string, unknown> = {};
  if (configOverride.voice_id) override.voice_id = configOverride.voice_id;
  if (configOverride.medicalPolicy) override.medicalPolicy = configOverride.medicalPolicy;
  if (configOverride.sales_strategy) override.sales_strategy = configOverride.sales_strategy;
  if (typeof configOverride.show_price_range === "boolean") override.show_price_range = configOverride.show_price_range;
  if (typeof configOverride.show_exact_price === "boolean") override.show_exact_price = configOverride.show_exact_price;
  const mergedConfig = { ...tenantConfig, ...override };

  const orgDoc = await db.collection("organizations").doc(orgId).get();
  const plan = orgDoc.exists ? (orgDoc.data()?.plan as string) : "professional";
  const planTier = planToTier(plan ?? "professional");

  const servicesSnap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("clinic_services")
    .where("status", "==", "active")
    .limit(5)
    .get();
  const services = servicesSnap.docs.map((d) => {
    const x = d.data();
    const name = (x.custom_title ?? x.custom_highlight ?? "").toString() || "โบท็อกซ์";
    return { name, priceMin: 5000, priceMax: 15000 };
  });
  if (services.length === 0) services.push({ name: "โบท็อกซ์", priceMin: 5000, priceMax: 15000 });

  const builder = getTenantPromptBuilder();
  const coreBrain = getCoreBrain();

  const results: { label: string; customerMessage: string; aiResponse: string }[] = [];

  for (const scenario of SCENARIOS) {
    const systemPrompt = builder.build({
      tenantConfig: mergedConfig as Parameters<typeof builder.build>[0]["tenantConfig"],
      clinicData: { services, promotions: [] },
      ragContext: [],
    }) + `\n\n## Preview Task\nลูกค้า: ${scenario.customerMessage}\n${scenario.systemHint}\nตอบสั้นๆ 1-3 ประโยคเท่านั้น ไม่ใส่ markdown`;

    const result = await coreBrain.generate({
      systemPrompt,
      userMessage: scenario.customerMessage,
      temperature: 0.7,
      maxTokens: 150,
      useCache: false,
      planTier,
    });

    results.push({
      label: scenario.label,
      customerMessage: scenario.customerMessage,
      aiResponse: result.response || "(ไม่สามารถสร้างตัวอย่างได้)",
    });
  }

  return NextResponse.json({ previews: results });
}
