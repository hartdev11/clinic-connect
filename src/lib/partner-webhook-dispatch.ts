/**
 * Phase 19 — Partner/White-label webhook dispatch
 * เมื่อ event เกิดขึ้น → POST ไปที่ url พร้อม HMAC-SHA256
 * ถ้าล้มเหลว → เพิ่มใน partner-webhook-retry queue
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { postJsonWithRetry } from "@/lib/outbound-http";

export type PartnerWebhookEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "handoff.created"
  | "lead.hot";

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
}

export async function getWebhookConfigs(orgId: string): Promise<WebhookConfig[]> {
  const snap = await db
    .collection("organizations")
    .doc(orgId)
    .collection("webhook_configs")
    .where("isActive", "==", true)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      url: (data.url as string) ?? "",
      events: (data.events as string[]) ?? [],
      secret: (data.secret as string) ?? "",
      isActive: data.isActive !== false,
    };
  });
}

function computeSignature(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchPartnerWebhooks(
  orgId: string,
  event: PartnerWebhookEvent,
  data: Record<string, unknown>,
  opts?: { correlationId?: string }
): Promise<{ targets: number; delivered: number; failed: number }> {
  const configs = await getWebhookConfigs(orgId);
  const targets = configs.filter((c) => c.events.includes(event) && c.url && c.secret);
  if (targets.length === 0) {
    return { targets: 0, delivered: 0, failed: 0 };
  }

  const body = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  let delivered = 0;
  let failed = 0;

  for (const config of targets) {
    const signature = computeSignature(config.secret, body);
    try {
      const res = await postJsonWithRetry(
        config.url,
        body,
        {
          "Content-Type": "application/json",
          "X-Clinic-Signature": signature,
          ...(opts?.correlationId ? { "X-Correlation-Id": opts.correlationId } : {}),
        },
        { timeoutMs: 10_000, maxAttempts: 3, baseDelayMs: 500 }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      delivered += 1;
    } catch (err) {
      failed += 1;
      // Keep retry intent without pulling BullMQ into route compile graph.
      await db
        .collection("partner_webhook_retry_outbox")
        .add({
          orgId,
          configId: config.id,
          event,
          body,
          url: config.url,
          secret: config.secret,
          reason: (err as Error)?.message ?? "dispatch_failed",
          correlation_id: opts?.correlationId ?? null,
          status: "pending",
          retry_count: 0,
          next_attempt_at: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
        .catch((e) =>
          console.warn("[PartnerWebhook] Outbox write failed:", (e as Error)?.message?.slice(0, 60))
        );
    }
  }
  return { targets: targets.length, delivered, failed };
}
