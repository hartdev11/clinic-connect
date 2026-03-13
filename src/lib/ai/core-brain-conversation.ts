/**
 * Phase 22 — CoreBrain conversation path
 * Uses TenantPromptBuilder + CoreBrain when USE_CORE_BRAIN=true
 */
import { getCoreBrain, planToTier } from "./core-brain";
import { getTenantPromptBuilder } from "./tenant-prompt-builder";
import { getAiConfig } from "@/lib/onboarding";
import { retrieveKnowledgeContext } from "@/lib/knowledge-retrieval";
import { db } from "@/lib/firebase-admin";
import type { AggregatedAnalyticsContext } from "./types";

export interface CoreBrainConversationInput {
  userMessage: string;
  orgId: string;
  branchId?: string | null;
  analyticsContext: AggregatedAnalyticsContext;
  orgPlan: string;
  leadScore?: number;
  chatHistory?: { role: string; content: string }[];
  /** เมื่อมีค่า ใช้แทน system prompt ที่ build จาก tenant builder */
  systemPromptOverride?: string | null;
}

export interface CoreBrainConversationResult {
  reply: string;
  success: boolean;
  totalMs: number;
  modelUsed: string;
  tokensUsed: number;
  costThb: number;
  cached: boolean;
}

async function getOrgPlan(orgId: string): Promise<string> {
  const doc = await db.collection("organizations").doc(orgId).get();
  const plan = doc.exists ? (doc.data()?.plan as string) : undefined;
  return plan ?? "professional";
}

async function getClinicDataForPrompt(orgId: string): Promise<{
  services: Array<{ name: string; priceMin?: number; priceMax?: number }>;
  promotions: Array<{ title?: string; description?: string }>;
}> {
  const [servicesSnap, promoSnap] = await Promise.all([
    db.collection("organizations").doc(orgId).collection("clinic_services").where("status", "==", "active").limit(10).get(),
    db.collection("promotions").where("org_id", "==", orgId).where("status", "==", "active").limit(5).get(),
  ]);
  const services = servicesSnap.docs.map((d) => {
    const x = d.data();
    const name = (x.custom_title ?? x.custom_highlight ?? "").toString() || "บริการ";
    const priceStr = (x.custom_price ?? "").toString();
    const match = priceStr.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/);
    const priceMin = match ? parseInt(match[1].replace(/,/g, ""), 10) : undefined;
    const priceMax = match ? parseInt(match[2].replace(/,/g, ""), 10) : undefined;
    return { name, priceMin, priceMax };
  });
  const promotions = promoSnap.docs.map((d) => {
    const x = d.data();
    return { title: (x.title ?? "").toString(), description: (x.description ?? "").toString() };
  });
  return { services, promotions };
}

export async function runCoreBrainConversation(
  input: CoreBrainConversationInput
): Promise<CoreBrainConversationResult | null> {
  const start = Date.now();
  const coreBrain = getCoreBrain();
  const builder = getTenantPromptBuilder();

  const [tenantConfig, clinicData] = await Promise.all([
    getAiConfig(input.orgId),
    getClinicDataForPrompt(input.orgId),
  ]);

  if (!tenantConfig) {
    return null;
  }

  const tenantAiConfig = {
    ...tenantConfig,
    voice_id: tenantConfig.voice_id ?? "V03",
    sales_strategy: tenantConfig.sales_strategy ?? undefined,
    show_price_range: tenantConfig.show_price_range ?? false,
  };

  const ragResults = await retrieveKnowledgeContext(input.orgId, input.userMessage);
  const ragContext = ragResults.slice(0, 5).map((r) => {
    const content = (r.metadata?.content ?? r.metadata?.text ?? r.metadata?.key_points ?? "").toString();
    return { content, metadata: r.metadata, score: r.finalScore ?? r.score };
  });

  const systemPrompt =
    input.systemPromptOverride?.trim() ||
    builder.build({
      tenantConfig: tenantAiConfig,
      clinicData: { services: clinicData.services, promotions: clinicData.promotions },
      userContext: {
        history: input.chatHistory?.map((m) => m.content).slice(-3),
        leadScore: input.leadScore,
      },
      ragContext,
    });

  const planTier = planToTier(input.orgPlan);
  const result = await coreBrain.generate({
    systemPrompt,
    userMessage: input.userMessage,
    chatHistory: input.chatHistory,
    temperature: 0.85,
    maxTokens: 800,
    useCache: true,
    planTier,
  });

  return {
    reply: result.response,
    success: !!result.response,
    totalMs: Date.now() - start,
    modelUsed: result.modelUsed,
    tokensUsed: result.tokensUsed,
    costThb: result.costThb,
    cached: result.cached,
  };
}

export { getOrgPlan };
