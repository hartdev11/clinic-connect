/**
 * Phase 7 — Human Handoff Types
 */
export type HandoffTriggerType =
  | "angry_customer"
  | "explicit_request"
  | "loop_detected"
  | "medical"
  | "consecutive_objections"
  | "complex_medical"
  | "low_ai_confidence";

export type HandoffStatus = "pending" | "accepted" | "active" | "resolved";

export type LearningQuality = "excellent" | "good" | "poor";

export interface HandoffSession {
  id: string;
  conversationId: string;
  customerId: string;
  customerName: string;
  customerLineId: string;
  triggerType: HandoffTriggerType;
  triggerMessage: string;
  status: HandoffStatus;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  learningQuality?: LearningQuality | null;
  markForLearning?: boolean;
}

export interface HandoffSessionCreate {
  conversationId: string;
  customerId: string;
  customerName: string;
  customerLineId: string;
  triggerType: HandoffTriggerType;
  triggerMessage: string;
}
