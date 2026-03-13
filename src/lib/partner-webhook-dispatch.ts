/**
 * Phase 19 — Partner/White-label webhook dispatch
 * เมื่อ event เกิดขึ้น → POST ไปที่ url พร้อม HMAC-SHA256
 * ถ้าล้มเหลว → เพิ่มใน partner-webhook-retry queue
 */
import { db } from "@/lib/firebase-admin";
import crypto from "crypto";

export type PartnerWebhookEvent =
  | "booking.created"
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
  data: Record<string, unknown>
): Promise<void> {
  const configs = await getWebhookConfigs(orgId);
  const targets = configs.filter((c) => c.events.includes(event) && c.url && c.secret);

  const body = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const config of targets) {
    const signature = computeSignature(config.secret, body);
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Clinic-Signature": signature,
        },
        body,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      const { enqueuePartnerWebhookRetry } = await import("@/lib/partner-webhook-retry-queue");
      await enqueuePartnerWebhookRetry({
        orgId,
        configId: config.id,
        event,
        body,
        url: config.url,
        secret: config.secret,
      }).catch((e) =>
        console.warn("[PartnerWebhook] Enqueue failed:", (e as Error)?.message?.slice(0, 60))
      );
    }
  }
}
