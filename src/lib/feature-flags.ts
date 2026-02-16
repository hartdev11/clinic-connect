/**
 * Feature Flags — ตาม spec (GLOBAL GUARDRAILS)
 * ใช้สำหรับเปิด/ปิด features ตาม plan หรือ env
 */
import type { OrgPlan } from "@/types/organization";

/**
 * E5.10 — Knowledge Washing Machine
 * Design only: เปิดได้เฉพาะ plan enterprise
 * ❌ ไม่ implement Phase 1
 */
export function isKnowledgeWashingMachineEnabled(_orgPlan?: OrgPlan): boolean {
  const env = process.env.KNOWLEDGE_WASHING_MACHINE_ENABLED?.trim().toLowerCase();
  if (env !== "true") return false;
  // เมื่อ implement: return orgPlan === "enterprise";
  return false;
}

/**
 * Platform Managed Mode — Unified Knowledge
 * เมื่อเปิด: คลินิกต้องใช้ global template, แก้ไขได้เฉพาะฟิลด์ที่กำหนด (จุดเด่น/ราคา/รายละเอียด)
 * เมื่อปิด: อนุญาต full override (รวม custom_title, เพิ่มบริการโดยไม่ผูกเทมเพลต)
 * ควบคุมตาม plan tier (enterprise = managed)
 */
export function isPlatformManagedMode(orgPlan?: OrgPlan): boolean {
  const env = process.env.PLATFORM_MANAGED_MODE_ENABLED?.trim().toLowerCase();
  if (env === "true") return true;
  if (env === "false") return false;
  return orgPlan === "enterprise";
}

/**
 * ใช้ multi-agent pipeline แทน chat agent เดิม
 */
export function usePipeline(): boolean {
  return process.env.CHAT_USE_PIPELINE?.trim().toLowerCase() === "true";
}

/**
 * ใช้ 7-Agent System (1 Role Manager + 6 Analytics)
 * เมื่อเปิด: ใช้แทน pipeline/chatAgent
 * ต้องมี LINE_ORG_ID เพื่อดึง analytics
 */
export function use7AgentChat(): boolean {
  return process.env.CHAT_USE_7_AGENT?.trim().toLowerCase() === "true";
}
