/**
 * Manager Agent (Orchestrator) — Phase 6
 * Routes intents to correct agent for Role Manager prioritization
 * Does NOT run pipeline — provides routing hints to Role Manager
 */
import { fallbackIntentFromKeywords } from "@/lib/agents/intent";
import type { AggregatedAnalyticsContext } from "../types";
import type { IntentType } from "@/lib/agents/types";

export type ManagerRoute =
  | "sales"
  | "booking"
  | "question"
  | "objection"
  | "referral"
  | "followup"
  | "default";

export interface ManagerRoutingOutput {
  primaryAgent: ManagerRoute;
  intent: IntentType;
  routingNote?: string;
}

/** Map intent to manager route */
function intentToRoute(intent: IntentType): ManagerRoute {
  switch (intent) {
    case "promotion_inquiry":
    case "price_inquiry":
      return "sales";
    case "booking_request":
    case "availability_check":
      return "booking";
    case "service_information":
    case "comparison_inquiry":
    case "general_chat":
      return "question";
    case "hesitation":
      return "objection";
    case "medical_question":
    case "complaint":
      return "referral";
    case "greeting":
    case "other":
    default:
      return "default";
  }
}

/** Check for follow_up from userMessage (not in intent yet) */
function detectFollowUp(userMessage: string | null | undefined): boolean {
  if (!userMessage) return false;
  return /ติดตาม|รออยู่|คิดยัง|ตัดสินใจยัง|ยังไง.*แล้วจะบอก|จะแจ้งให้ทราบ/i.test(userMessage);
}

/** Check for objection from userMessage */
function detectObjection(userMessage: string | null | undefined): boolean {
  if (!userMessage) return false;
  return /แพง|ราคาแพง|คุ้มไหม|กลัว|ปวด|เจ็บ|ของแท้|ของปลอม|ไม่แน่ใจ|ลังเล/i.test(userMessage);
}

/**
 * Run manager routing — sync, no I/O
 * Uses keyword-based intent + analytics context for routing hints
 */
export function runManagerRouting(
  userMessage: string,
  _analyticsContext: AggregatedAnalyticsContext
): ManagerRoutingOutput {
  const intentResult = fallbackIntentFromKeywords(userMessage);
  const intent = intentResult?.intent ?? "general_chat";

  if (detectFollowUp(userMessage)) {
    return {
      primaryAgent: "followup",
      intent: "general_chat",
      routingNote: "follow_up_detected",
    };
  }
  if (detectObjection(userMessage) && intent !== "medical_question") {
    return {
      primaryAgent: "objection",
      intent: "hesitation",
      routingNote: "objection_detected",
    };
  }

  const primaryAgent = intentToRoute(intent);
  return {
    primaryAgent,
    intent,
  };
}
