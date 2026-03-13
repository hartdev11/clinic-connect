/**
 * Phase 7 — Handoff Trigger
 * เมื่อ escalation เกิดขึ้น: สร้าง handoff_session, notification, schedule BullMQ
 * Enterprise: assignBestStaff, recordHandoffTriggered (rate limit)
 */
import { db } from "@/lib/firebase-admin";
import { createHandoffSession } from "@/lib/handoff-data";
import { scheduleHandoffReminder } from "@/lib/handoff-queue";
import { dispatchPartnerWebhooks } from "@/lib/partner-webhook-dispatch";
import { getCustomerById } from "@/lib/clinic-data";
import { assignBestStaff } from "@/lib/handoff-assignment";
import { recordHandoffTriggered } from "@/lib/ai/handoff-rate-limit";
import type { HandoffTriggerType } from "@/types/handoff";

function getCustomerDocId(orgId: string, lineUserId: string): string {
  const safeId = lineUserId.replace(/[/\\]/g, "_");
  return `line_${orgId}_${safeId}`;
}

export interface TriggerHandoffInput {
  orgId: string;
  lineUserId: string;
  triggerType: HandoffTriggerType;
  triggerMessage: string;
}

export async function triggerHandoff(input: TriggerHandoffInput): Promise<string | null> {
  const { orgId, lineUserId, triggerType, triggerMessage } = input;
  const customerId = getCustomerDocId(orgId, lineUserId);

  let customerName = "ลูกค้า LINE";
  try {
    const customer = await getCustomerById(orgId, customerId);
    if (customer?.name) customerName = customer.name;
  } catch {
    // use default
  }

  const conversationId = `${orgId}_${lineUserId}`;
  const sessionId = await createHandoffSession(orgId, {
    conversationId,
    customerId,
    customerName,
    customerLineId: lineUserId,
    triggerType,
    triggerMessage,
  });

  await recordHandoffTriggered(lineUserId);
  assignBestStaff(orgId, sessionId).catch((err) =>
    console.warn("[Handoff] assignBestStaff failed:", (err as Error)?.message)
  );

  const { FieldValue } = await import("firebase-admin/firestore");
  await db
    .collection("organizations")
    .doc(orgId)
    .collection("notifications")
    .add({
      type: "handoff_pending",
      handoffSessionId: sessionId,
      customerName,
      triggerType,
      triggerMessage: triggerMessage.slice(0, 100),
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });

  await scheduleHandoffReminder(sessionId, orgId, lineUserId);

  dispatchPartnerWebhooks(orgId, "handoff.created", {
    sessionId,
    customerId,
    customerName,
    triggerType,
    triggerMessage: triggerMessage.slice(0, 100),
  }).catch((e) => console.warn("[Handoff] partner webhook:", (e as Error)?.message?.slice(0, 50)));

  return sessionId;
}
