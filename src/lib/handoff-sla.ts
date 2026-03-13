/**
 * Enterprise — Handoff SLA Tracking
 * - Response time: createdAt → acceptedAt (target < 120s)
 * - Resolution time: acceptedAt → resolvedAt (target < 600s)
 * - SLA breach notification when response > 120s
 */
import { db } from "@/lib/firebase-admin";

const HANDOFF_SUB = "handoff_sessions";
const RESPONSE_TARGET_SEC = 120;
const RESOLUTION_TARGET_SEC = 600;

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === "string") return new Date(v);
  if (v instanceof Date) return v;
  const d = (v as { toDate?: () => Date })?.toDate?.();
  return d ?? null;
}

/** Call after accept — record response_time_seconds, create SLA breach notification if > 120s */
export async function trackSLAResponse(
  orgId: string,
  sessionId: string
): Promise<void> {
  const doc = await db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .doc(sessionId)
    .get();
  if (!doc.exists) return;
  const d = doc.data()!;
  const createdAt = toDate(d.createdAt);
  const acceptedAt = toDate(d.acceptedAt);
  if (!createdAt || !acceptedAt) return;
  const responseSeconds = Math.round((acceptedAt.getTime() - createdAt.getTime()) / 1000);

  const { FieldValue } = await import("firebase-admin/firestore");
  await doc.ref.update({
    response_time_seconds: responseSeconds,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (responseSeconds > RESPONSE_TARGET_SEC) {
    await db
      .collection("organizations")
      .doc(orgId)
      .collection("notifications")
      .add({
        type: "sla_breach",
        severity: "warning",
        message: `SLA breach: ใช้เวลา ${responseSeconds}s ในการรับ handoff (เป้า ${RESPONSE_TARGET_SEC}s)`,
        handoffSessionId: sessionId,
        response_time_seconds: responseSeconds,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
      });
  }
}

/** Call after resolve — record resolution_time_seconds */
export async function trackSLAResolution(
  orgId: string,
  sessionId: string
): Promise<void> {
  const doc = await db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .doc(sessionId)
    .get();
  if (!doc.exists) return;
  const d = doc.data()!;
  const acceptedAt = toDate(d.acceptedAt);
  const resolvedAt = toDate(d.resolvedAt);
  if (!acceptedAt || !resolvedAt) return;
  const resolutionSeconds = Math.round(
    (resolvedAt.getTime() - acceptedAt.getTime()) / 1000
  );

  const { FieldValue } = await import("firebase-admin/firestore");
  await doc.ref.update({
    resolution_time_seconds: resolutionSeconds,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
