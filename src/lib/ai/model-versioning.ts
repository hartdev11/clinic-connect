/**
 * Phase 3 #13 — Model Versioning Strategy
 * Store model config, canary deployment, rollback
 */
import { db } from "@/lib/firebase-admin";

const COL = "ai_model_config";
const DEFAULT_KEY = "role_manager_default";

export interface ModelConfig {
  model_name: string;
  model_version: string;
  temperature: number;
  max_tokens: number;
  safety_mode?: string;
  org_id?: string | null; // null = global default
}

const DEFAULT_CONFIG: ModelConfig = {
  model_name: "gpt-4o-mini",
  model_version: "2024-07-18",
  temperature: 0.85,
  max_tokens: 220,
  safety_mode: "default",
};

export async function getModelConfig(orgId?: string | null): Promise<ModelConfig> {
  if (orgId) {
    const orgDoc = await db.collection(COL).doc(`org_${orgId}`).get();
    if (orgDoc.exists) {
      const d = orgDoc.data()!;
      return {
        model_name: d.model_name ?? DEFAULT_CONFIG.model_name,
        model_version: d.model_version ?? DEFAULT_CONFIG.model_version,
        temperature: Number(d.temperature ?? DEFAULT_CONFIG.temperature),
        max_tokens: Number(d.max_tokens ?? DEFAULT_CONFIG.max_tokens),
        safety_mode: d.safety_mode ?? DEFAULT_CONFIG.safety_mode,
        org_id: orgId,
      };
    }
  }
  const defaultDoc = await db.collection(COL).doc(DEFAULT_KEY).get();
  if (defaultDoc.exists) {
    const d = defaultDoc.data()!;
    return {
      model_name: d.model_name ?? DEFAULT_CONFIG.model_name,
      model_version: d.model_version ?? DEFAULT_CONFIG.model_version,
      temperature: Number(d.temperature ?? DEFAULT_CONFIG.temperature),
      max_tokens: Number(d.max_tokens ?? DEFAULT_CONFIG.max_tokens),
      safety_mode: d.safety_mode ?? DEFAULT_CONFIG.safety_mode,
    };
  }
  return { ...DEFAULT_CONFIG };
}
