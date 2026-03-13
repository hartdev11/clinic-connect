/**
 * Phase 24 — Platform config for learning thresholds
 * Stored in global/platform_config
 */
import { db } from "@/lib/firebase-admin";

const PLATFORM_CONFIG_COLLECTION = "global";
const PLATFORM_CONFIG_DOC = "platform_config";

export interface PlatformConfig {
  modelVersion: string;
  lastTrainingDate: string | null;
  nextTrainingDate: string | null;
  defaultVoiceId: string;
  globalProhibitedClaims: string[];
  minQualityScoreForAutoApprove: number;
  minQualityScoreForQueue: number;
}

const DEFAULTS: PlatformConfig = {
  modelVersion: "gemini-2.0-flash-exp",
  lastTrainingDate: null,
  nextTrainingDate: null,
  defaultVoiceId: "V01",
  globalProhibitedClaims: [
    "รับประกัน",
    "การันตี",
    "100%",
    "รักษาหาย",
    "ไม่มีผลข้างเคียง",
  ],
  minQualityScoreForAutoApprove: 0.9,
  minQualityScoreForQueue: 0.5,
};

function toDateString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    const d = (v as { toDate: () => Date }).toDate?.();
    return d ? d.toISOString() : null;
  }
  if (v instanceof Date) return v.toISOString();
  return null;
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const doc = await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_CONFIG_DOC).get();
  if (!doc.exists) return DEFAULTS;
  const d = doc.data() ?? {};
  return {
    modelVersion: String(d.modelVersion ?? DEFAULTS.modelVersion),
    lastTrainingDate: toDateString(d.lastTrainingDate) ?? DEFAULTS.lastTrainingDate,
    nextTrainingDate: toDateString(d.nextTrainingDate) ?? DEFAULTS.nextTrainingDate,
    defaultVoiceId: d.defaultVoiceId ?? DEFAULTS.defaultVoiceId,
    globalProhibitedClaims: Array.isArray(d.globalProhibitedClaims)
      ? d.globalProhibitedClaims
      : DEFAULTS.globalProhibitedClaims,
    minQualityScoreForAutoApprove:
      typeof d.minQualityScoreForAutoApprove === "number"
        ? d.minQualityScoreForAutoApprove
        : DEFAULTS.minQualityScoreForAutoApprove,
    minQualityScoreForQueue:
      typeof d.minQualityScoreForQueue === "number"
        ? d.minQualityScoreForQueue
        : DEFAULTS.minQualityScoreForQueue,
  };
}

export async function updatePlatformConfig(
  updates: Partial<PlatformConfig>
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_CONFIG_DOC);
  await ref.set(
    {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
