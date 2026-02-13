/**
 * AI Agents — 7 Agents: 1 Role Manager + 6 Analytics
 * - Role Manager: คอยรับฟังลูกค้าและนำผลวิเคราะห์จาก 6 Agents มาใช้ตอบลูกค้า
 * - 6 Analytics: วิเคราะห์ข้อมูลในเว็บทั้งหมด → ส่งสรุปให้ Role Manager
 * ข้อมูลส่งลูกค้า: docs/AI-DATA-SPEC.md § 5.1
 */

export type AgentEngine = "ChatGPT" | "Gemini";
export type AgentRole = "role-manager" | "analytics";

export interface AIAgentSpec {
  id: string;
  name: string;
  purpose: string;
  engine: AgentEngine;
  /** role-manager = ตอบลูกค้าโดยตรง | analytics = วิเคราะห์ข้อมูล ส่งให้ Role Manager */
  role: AgentRole;
  enabled: boolean;
}

/** Role Manager — ตัวเดียว รับลูกค้า และนำผลจาก 6 Analytics มาใช้ตอบ */
export const ROLE_MANAGER_AGENT: AIAgentSpec = {
  id: "agent-role-manager",
  name: "Role Manager Agent",
  purpose: "รับแชทลูกค้า ตอบคำถาม จองคิว เสนอโปรโมชัน — ใช้ผลวิเคราะห์จาก 6 Analytics Agents เป็น context เพื่อตอบลูกค้าได้ตรงและครบถ้วน",
  engine: "ChatGPT",
  role: "role-manager",
  enabled: true,
};

/** 6 Analytics Agents — วิเคราะห์ข้อมูลในเว็บทั้งหมด → ส่งสรุปให้ Role Manager */
export const ANALYTICS_AGENTS_SPEC: AIAgentSpec[] = [
  {
    id: "agent-analytics-booking",
    name: "Booking Analytics",
    purpose: "วิเคราะห์ข้อมูลจองคิว — วันว่าง คิวล้น แนวโน้มการจอง",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
  {
    id: "agent-analytics-promotion",
    name: "Promotion Analytics",
    purpose: "วิเคราะห์โปรโมชัน — โปรขายดี โปรเหมาะกับลูกค้าแต่ละกลุ่ม",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
  {
    id: "agent-analytics-customer",
    name: "Customer Analytics",
    purpose: "วิเคราะห์ลูกค้า — ประวัติแชท พฤติกรรม ความสนใจ",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
  {
    id: "agent-analytics-finance",
    name: "Finance Analytics",
    purpose: "วิเคราะห์การเงิน — ยอดขาย รายได้ แนวโน้ม (ใช้ตอบภายใน ไม่ส่งลูกค้า)",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
  {
    id: "agent-analytics-knowledge",
    name: "Knowledge Analytics",
    purpose: "วิเคราะห์ Knowledge Base — บริการ ราคา คำถามที่พบบ่อย สรุป context ให้ Role Manager",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
  {
    id: "agent-analytics-feedback",
    name: "Feedback Analytics",
    purpose: "วิเคราะห์ Golden Dataset — คุณภาพแชทที่ผ่านมา ปรับปรุงคำตอบให้ดีขึ้น",
    engine: "Gemini",
    role: "analytics",
    enabled: true,
  },
];

/** ทั้ง 7 Agents — Role Manager + 6 Analytics */
export const AI_AGENTS_SPEC: AIAgentSpec[] = [ROLE_MANAGER_AGENT, ...ANALYTICS_AGENTS_SPEC];
