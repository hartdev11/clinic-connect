/**
 * Phase 19 — Multi-channel notification service
 * sendNotification(orgId, type, data, channels) → in_app | email | line
 */
import { db } from "@/lib/firebase-admin";
import { getUsersByOrgId } from "@/lib/clinic-data";
import { sendLinePushMessage } from "@/lib/booking-notification";

export type NotificationChannel = "in_app" | "email" | "line";

export type NotificationType =
  | "quota_warning"
  | "quota_exceeded"
  | "hot_lead"
  | "sla_breach"
  | "handoff_assigned"
  | "payment_success"
  | "payment_failed"
  | "org_suspended";

export type NotificationData = {
  title: string;
  message: string;
  severity?: "urgent" | "warning" | "info";
  actionUrl?: string;
  /** Email-specific */
  toEmail?: string;
  /** Extra context for templates */
  [key: string]: unknown;
};

const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  quota_warning: ["in_app", "email"],
  quota_exceeded: ["in_app", "email", "line"],
  hot_lead: ["in_app"],
  sla_breach: ["in_app", "line"],
  handoff_assigned: ["in_app"],
  payment_success: ["in_app", "email"],
  payment_failed: ["in_app", "email", "line"],
  org_suspended: ["in_app", "email", "line"],
};

export async function sendNotification(
  orgId: string,
  type: NotificationType,
  data: NotificationData,
  channels?: NotificationChannel[]
): Promise<void> {
  const chs = channels ?? DEFAULT_CHANNELS[type];
  const { title, message, severity = "info", actionUrl } = data;

  // in_app — บันทึกใน organizations/{orgId}/notifications/
  if (chs.includes("in_app")) {
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("organizations").doc(orgId).collection("notifications").add({
      type,
      severity,
      title,
      message,
      actionUrl: actionUrl ?? null,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });
  }

  // email — ส่งผ่าน sendNotificationEmail
  if (chs.includes("email")) {
    const users = await getUsersByOrgId(orgId);
    const owners = users.filter((u) => u.role === "owner" && u.email);
    const managers = users.filter((u) => u.role === "manager" && u.email);
    const toEmail = data.toEmail ?? owners[0]?.email ?? managers[0]?.email;
    if (toEmail) {
      const { sendNotificationEmail } = await import("@/lib/email");
      await sendNotificationEmail({
        to: toEmail,
        subject: title,
        type,
        data: { ...data, message },
      }).catch((err) =>
        console.warn("[Notification] Email failed:", (err as Error)?.message?.slice(0, 80))
      );
    }
  }

  // line — ส่ง LINE push ไปหา owner/manager ที่มี line_user_id
  if (chs.includes("line")) {
    const users = await getUsersByOrgId(orgId);
    const targets = users.filter(
      (u) => (u.role === "owner" || u.role === "manager") && u.line_user_id
    );
    const lineText = `[${title}] ${message}`.slice(0, 500);
    for (const u of targets.slice(0, 3)) {
      const lineUserId = u.line_user_id!;
      if (lineUserId) {
        await sendLinePushMessage(orgId, lineUserId, lineText).catch((err) =>
          console.warn("[Notification] LINE push failed:", (err as Error)?.message?.slice(0, 60))
        );
      }
    }
  }
}
