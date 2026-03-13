/**
 * Phase 15 — Safety & Compliance System
 * Phase 22: + tone/voice compliance (forbidden words, emoji count, prohibited claims)
 * Hybrid 3-layer safety + content rewriter + requiresDoctor detection + audit log
 * Runs on AI response BEFORE sending to customer
 */
import { getOpenAI } from "@/lib/agents/clients";
import { db } from "@/lib/firebase-admin";
import { VOICE_DEFINITIONS, type VoiceId } from "./tenant-prompt-builder";
import type { MedicalPolicyLevel } from "@/types/ai-config";

/** Prohibited claims — Phase 22 */
const PROHIBITED_CLAIMS = /การันตี|100%|รับประกัน|รักษาหาย|แน่นอน|ปลอดภัยแน่นอน/gi;

/** High-risk claims (+0.3 each) */
const HIGH_RISK_KEYWORDS = [
  "รักษาหาย",
  "100%",
  "การันตี",
  "แน่นอน",
  "ไม่มีผลข้างเคียง",
];

/** Medical + disease combo (+0.4): (รักษา|แก้|บำบัด) AND (มะเร็ง|เบาหวาน|โรค) */
const TREATMENT_PATTERN = /รักษา|แก้|บำบัด/i;
const DISEASE_PATTERN = /มะเร็ง|เบาหวาน|โรค|ความดัน/i;

/** Layer 1: Keyword-based risk (fast, catches ~80%) */
export function computeKeywordRisk(text: string): number {
  if (!text?.trim()) return 0;
  const t = text.toLowerCase();
  let risk = 0;
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (t.includes(kw.toLowerCase())) risk += 0.3;
  }
  if (TREATMENT_PATTERN.test(t) && DISEASE_PATTERN.test(t)) {
    risk += 0.4;
  }
  return Math.min(1, risk);
}

/** Layer 2: LLM classification (only if keyword_risk > 0.3) */
export async function computeLLMRisk(text: string): Promise<number> {
  const openai = getOpenAI();
  if (!openai) return 0.5;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "คุณเป็นผู้เชี่ยวชาญกฎหมาย อย. ประเมินข้อความจากคลินิกความงาม ว่ามีการใช้คำเกินจริงหรือการันตีผลหรือไม่ ตอบ JSON เท่านั้น: {\"has_medical_claim\":bool,\"has_guarantee\":bool,\"risk_score\":0.0-1.0}",
        },
        {
          role: "user",
          content: `ประเมินข้อความ: "${text.slice(0, 1500)}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });
    const content = res.choices[0]?.message?.content ?? "";
    const json = extractJSON(content);
    if (json && typeof json.risk_score === "number") {
      return Math.max(0, Math.min(1, json.risk_score));
    }
  } catch (err) {
    console.warn("[SafetyCompliance] LLM risk failed:", (err as Error)?.message?.slice(0, 80));
  }
  return 0.5;
}

function extractJSON(s: string): { risk_score?: number; has_medical_claim?: boolean; has_guarantee?: boolean } | null {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as { risk_score?: number };
  } catch {
    // ignore
  }
  return null;
}

export type SafetyLevel = "SAFE" | "MEDIUM" | "UNSAFE";

/** Layer 3: Combined risk */
export function getSafetyLevel(keywordRisk: number, llmRisk: number): SafetyLevel {
  const finalRisk = keywordRisk * 0.4 + llmRisk * 0.6;
  if (finalRisk > 0.7) return "UNSAFE";
  if (finalRisk > 0.5) return "MEDIUM";
  return "SAFE";
}

/** Step 1: Word replacements */
const WORD_REPLACEMENTS: [RegExp | string, string][] = [
  ["รักษา", "ดูแล"],
  ["แก้", "ช่วยลด"],
  ["หาย", "ดีขึ้น"],
  ["ถาวร", "นานขึ้น"],
  ["การันตี", "คาดว่า"],
  ["100%", "ส่วนใหญ่"],
];

export function applyWordReplacements(text: string): string {
  let out = text;
  for (const [from, to] of WORD_REPLACEMENTS) {
    const re = typeof from === "string" ? new RegExp(escapeRe(from), "gi") : from;
    out = out.replace(re, to);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F1E0}-\u{1F1FF}]|[\u{FE00}-\u{FE0F}]/gu;

/** Phase 22: Count emoji */
function countEmoji(text: string): number {
  const m = text.match(EMOJI_REGEX);
  return m?.length ?? 0;
}

/** Phase 22: Trim emoji to max count */
export function enforceEmojiLimit(text: string, maxEmoji: number): string {
  if (maxEmoji >= 99 || maxEmoji < 0) return text;
  let seen = 0;
  return text.replace(EMOJI_REGEX, (match) => {
    seen++;
    return seen <= maxEmoji ? match : "";
  });
}

/** Phase 22: Check voice forbidden words */
export function checkVoiceForbidden(text: string, voiceId?: VoiceId | null): string[] {
  if (!voiceId || !VOICE_DEFINITIONS[voiceId]) return [];
  const voice = VOICE_DEFINITIONS[voiceId];
  const found: string[] = [];
  const lower = text;
  for (const w of voice.forbidden) {
    if (w.includes("emoji")) continue;
    const keyTerms = w.replace(/^(ใช้|คำว่า|emoji.*)/, "").trim().split(/[\s,、]+/);
    for (const term of keyTerms) {
      if (term.length >= 2 && lower.includes(term)) {
        found.push(w);
        break;
      }
    }
  }
  const maxEmoji = voice.max_emoji ?? 3;
  if (countEmoji(text) > maxEmoji) found.push(`emoji เกิน ${maxEmoji}`);
  return found;
}

/** Phase 22: Check prohibited claims */
export function hasProhibitedClaims(text: string): boolean {
  return PROHIBITED_CLAIMS.test(text);
}

/** Step 2: LLM rewrite if still unsafe */
const REWRITE_PROMPT = `เขียนข้อความนี้ใหม่ให้ถูกกฎ อย.:
- ใช้ 'ดูแล' แทน 'รักษา'
- ไม่การันตีผล ใช้ 'อาจช่วย' หรือ 'คาดว่า'
- เพิ่ม 'ผลลัพธ์ขึ้นอยู่กับแต่ละคน'
ข้อความเดิม: `;

export async function rewriteForCompliance(text: string): Promise<string> {
  const openai = getOpenAI();
  if (!openai) return text;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "คุณเป็นผู้เชี่ยวชาญกฎหมาย อย. เขียนข้อความใหม่ให้ถูกต้อง ไม่มีคำเกินจริง ไม่การันตีผล ตอบเฉพาะข้อความที่เขียนใหม่เท่านั้น ไม่มีคำนำอื่น",
        },
        { role: "user", content: REWRITE_PROMPT + text.slice(0, 1200) },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });
    const out = res.choices[0]?.message?.content?.trim();
    if (out && out.length > 10) return out;
  } catch (err) {
    console.warn("[SafetyCompliance] Rewrite failed:", (err as Error)?.message?.slice(0, 80));
  }
  return text;
}

const DISCLAIMER = "\n\n** ข้อมูลนี้เป็นข้อมูลทั่วไป ควรปรึกษาแพทย์ก่อนตัดสินใจ **";

/** Full safety check + rewrite pipeline */
export interface SafetyCheckResult {
  safe: boolean;
  rewritten: string;
  actionTaken: "pass" | "rewritten" | "escalated" | "blocked";
  riskScore: number;
  safetyLevel: SafetyLevel;
}

export async function checkAndRewriteAiResponse(
  aiResponse: string,
  orgId: string,
  medicalPolicy: MedicalPolicyLevel,
  opts?: {
    conversationId?: string;
    skipLLM?: boolean;
    /** Phase 22: voice compliance */
    voiceId?: VoiceId | null;
    maxEmojiPerMessage?: number;
  }
): Promise<SafetyCheckResult> {
  if (!aiResponse?.trim()) {
    return { safe: true, rewritten: aiResponse, actionTaken: "pass", riskScore: 0, safetyLevel: "SAFE" };
  }

  let text = aiResponse;

  // Phase 22: Prohibited claims → word replacements first
  if (hasProhibitedClaims(text)) {
    text = applyWordReplacements(text);
  }

  // Phase 22: Enforce emoji limit
  const maxEmoji = opts?.maxEmojiPerMessage ?? 99;
  if (maxEmoji < 99) {
    text = enforceEmojiLimit(text, maxEmoji);
  }

  // Phase 22: Voice forbidden check → apply replacements
  const voiceViolations = opts?.voiceId ? checkVoiceForbidden(text, opts.voiceId) : [];
  if (voiceViolations.length > 0) {
    text = applyWordReplacements(text);
  }

  const keywordRisk = computeKeywordRisk(text);
  let llmRisk = 0.5;
  if (keywordRisk > 0.3 && !opts?.skipLLM) {
    llmRisk = await computeLLMRisk(text);
  }
  const finalRisk = keywordRisk * 0.4 + llmRisk * 0.6;
  const safetyLevel = getSafetyLevel(keywordRisk, llmRisk);

  let rewritten = text;
  let actionTaken: SafetyCheckResult["actionTaken"] = "pass";

  if (safetyLevel === "UNSAFE") {
    rewritten = applyWordReplacements(rewritten);
    const afterReplaceRisk = computeKeywordRisk(rewritten);
    if (afterReplaceRisk > 0.5) {
      rewritten = await rewriteForCompliance(rewritten);
    }
    actionTaken = "rewritten";
  } else if (safetyLevel === "MEDIUM") {
    rewritten = applyWordReplacements(rewritten);
    if (medicalPolicy === "moderate" || medicalPolicy === "strict") {
      rewritten = rewritten + DISCLAIMER;
    }
    actionTaken = "rewritten";
  }

  return {
    safe: safetyLevel === "SAFE",
    rewritten,
    actionTaken,
    riskScore: finalRisk,
    safetyLevel,
  };
}

/** Phase 15: Requires doctor — sensitive topic + question → escalate */
const SENSITIVE_TOPICS = /ตั้งครรภ์|แพ้ยา|โรค|กินยา|เบาหวาน|ความดัน|แพ้/i;
const QUESTION_PATTERNS = /ได้ไหม|ทำได้|ปลอดภัย|ทำได้ไหม|ใช้ได้ไหม|เหมาะสมไหม/i;

export function requiresDoctor(message: string): boolean {
  if (!message?.trim()) return false;
  const t = message.trim();
  return SENSITIVE_TOPICS.test(t) && QUESTION_PATTERNS.test(t);
}

export const REQUIRES_DOCTOR_MESSAGE =
  "คำถามนี้ควรปรึกษาแพทย์โดยตรงค่ะ ให้พนักงานช่วยนัดหมายได้เลยนะคะ 😊";

/** Phase 15: Safety audit log */
export interface SafetyAuditEntry {
  conversationId?: string;
  content: string;
  violationType: string;
  riskScore: number;
  actionTaken: "rewritten" | "escalated" | "blocked";
  originalText: string;
  rewrittenText?: string;
  createdAt: string;
}

export async function logSafetyAudit(
  orgId: string,
  entry: Omit<SafetyAuditEntry, "createdAt">
): Promise<void> {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const col = db.collection("organizations").doc(orgId).collection("safety_audit");
    await col.add({
      ...entry,
      createdAt: now.toISOString(),
      date: dateKey,
    });
  } catch (err) {
    console.warn("[logSafetyAudit] error:", (err as Error)?.message?.slice(0, 80));
  }
}
