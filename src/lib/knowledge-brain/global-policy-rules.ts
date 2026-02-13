/**
 * Enterprise Knowledge Brain — Central Compliance Enforcement
 * Phase 2 #17: global_policy_rules, policy check ก่อน approve, Emergency Global Revoke
 */
import { db } from "@/lib/firebase-admin";
import type { GlobalPolicyRule } from "@/types/knowledge-brain";

const COL = "global_policy_rules";
const RULE_ID = "default";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

const DEFAULT_RULES = {
  prohibited_phrases: [
    "รับประกัน 100%",
    "รับประกันแน่นอน",
    "ปลอดภัยแน่นอน",
    "วินิจฉัยว่า",
    "วินิจฉัยได้ว่า",
    "เป็นโรคแน่นอน",
    "100% ปลอดภัย",
    "รับประกันผล",
  ],
  risky_claim_patterns: [
    "/รับประกัน\\s*(?:ผล|100%|แน่นอน)/i",
    "/ปลอดภัย\\s*100%|ปลอดภัยแน่นอน/i",
    "/วินิจฉัยว่า|วินิจฉัยได้ว่า|วินิจฉัยโรค/i",
    "/\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?\\s*บาท\\s*รับประกัน/i",
  ],
  medical_claim_rules: [
    "/วินิจฉัยว่า|diagnos.*as\\s+โรค/i",
    "/เป็นโรค\\s+แน่นอน|certainly\\s+has\\s+disease/i",
  ],
  mandatory_disclaimer: "ผลลัพธ์อาจแตกต่างกันไปในแต่ละบุคคล กรุณาปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนตัดสินใจ",
  disabled_services: [],
  updated_at: new Date().toISOString(),
};

export interface PolicyCheckResult {
  passed: boolean;
  violations: string[];
  disabledServiceIds: string[];
}

/**
 * โหลด global policy rules — fallback เป็น default ถ้าไม่มี
 */
export async function getGlobalPolicyRules(): Promise<GlobalPolicyRule> {
  const doc = await db.collection(COL).doc(RULE_ID).get();
  if (!doc.exists) {
    const toRegExp = (s: string) => {
      try {
        const m = s.match(/^\/(.*)\/([gim]*)$/);
        if (m) return new RegExp(m[1]!, m[2]);
        return new RegExp(s, "i");
      } catch {
        return new RegExp(s, "i");
      }
    };
    return {
      id: RULE_ID,
      ...DEFAULT_RULES,
      prohibited_phrases: [...DEFAULT_RULES.prohibited_phrases],
      risky_claim_patterns: DEFAULT_RULES.risky_claim_patterns.map(toRegExp) as (string | RegExp)[],
      medical_claim_rules: DEFAULT_RULES.medical_claim_rules.map(toRegExp) as (string | RegExp)[],
      mandatory_disclaimer: DEFAULT_RULES.mandatory_disclaimer,
      disabled_services: [],
      updated_at: DEFAULT_RULES.updated_at,
    };
  }
  const d = doc.data()!;
  return {
    id: doc.id,
    prohibited_phrases: toArray(d.prohibited_phrases),
    risky_claim_patterns: (toArray(d.risky_claim_patterns) || []).map((s) => {
      try {
        const m = String(s).match(/^\/(.*)\/([gim]*)$/);
        if (m) return new RegExp(m[1]!, m[2]);
        return new RegExp(String(s), "i");
      } catch {
        return new RegExp(String(s), "i");
      }
    }),
    medical_claim_rules: (toArray(d.medical_claim_rules) || []).map((s) => {
      try {
        const m = String(s).match(/^\/(.*)\/([gim]*)$/);
        if (m) return new RegExp(m[1]!, m[2]);
        return new RegExp(String(s), "i");
      } catch {
        return new RegExp(String(s), "i");
      }
    }),
    mandatory_disclaimer: d.mandatory_disclaimer ?? DEFAULT_RULES.mandatory_disclaimer,
    disabled_services: toArray(d.disabled_services),
    updated_at: toISO(d.updated_at),
  };
}

/**
 * ตรวจ policy ก่อน approve — ฝ่าฝืน → reject
 */
export async function checkPolicyCompliance(
  content: string,
  baseServiceId: string
): Promise<PolicyCheckResult> {
  const rules = await getGlobalPolicyRules();
  const violations: string[] = [];
  const disabledServiceIds = rules.disabled_services ?? [];

  if (disabledServiceIds.includes(baseServiceId)) {
    violations.push("บริการนี้ถูกระงับชั่วคราวจากนโยบายกลาง (Emergency Global Revoke)");
  }

  for (const phrase of rules.prohibited_phrases) {
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`ห้ามใช้คำว่า: "${phrase}"`);
    }
  }

  for (const p of rules.risky_claim_patterns) {
    const re = typeof p === "string" ? new RegExp(p, "i") : p;
    if (re.test(content)) {
      violations.push("ตรวจพบรูปแบบคำกล่าวอ้างที่เสี่ยง");
    }
  }

  for (const p of rules.medical_claim_rules) {
    const re = typeof p === "string" ? new RegExp(p, "i") : p;
    if (re.test(content)) {
      violations.push("ตรวจพบคำกล่าวอ้างทางการแพทย์ที่ไม่ได้รับอนุญาต");
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    disabledServiceIds,
  };
}

/**
 * Emergency Global Revoke — disable service ทั้งระบบ
 */
export async function emergencyGlobalRevoke(serviceIds: string[]): Promise<void> {
  const docRef = db.collection(COL).doc(RULE_ID);
  const doc = await docRef.get();
  const existing = doc.exists ? (doc.data()?.disabled_services ?? []) : [];
  const merged = [...new Set([...existing, ...serviceIds])];
  await docRef.set(
    {
      disabled_services: merged,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Restore revoked service
 */
export async function restoreRevokedService(serviceId: string): Promise<void> {
  const docRef = db.collection(COL).doc(RULE_ID);
  const doc = await docRef.get();
  const existing = (doc.data()?.disabled_services ?? []) as string[];
  const filtered = existing.filter((s) => s !== serviceId);
  await docRef.set(
    {
      disabled_services: filtered,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}
