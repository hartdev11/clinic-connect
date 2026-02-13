/**
 * LINE Channel — Multi-tenant Data Layer
 * เก็บ credentials ต่อ org ใน Firestore
 */
import { db } from "@/lib/firebase-admin";
import type { LineChannel, LineChannelCreate, LineChannelStatus } from "@/types/line-channel";
import type { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "line_channels";

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = "toDate" in t && typeof t.toDate === "function" ? t.toDate() : (t as Timestamp).toDate?.();
  return d ? new Date(d).toISOString() : String(t);
}

function getBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (v?.startsWith("http")) return v.replace(/\/$/, "");
  return v ? `https://${v}` : "https://your-domain.com";
}

/** ดึง LINE Channel config ของ org */
export async function getLineChannelByOrgId(orgId: string): Promise<LineChannel | null> {
  const doc = await db.collection(COLLECTION).doc(orgId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    org_id: d.org_id ?? orgId,
    channel_id: d.channel_id ?? "",
    channel_secret: d.channel_secret ?? "",
    channel_access_token: d.channel_access_token ?? "",
    bot_user_id: d.bot_user_id ?? "",
    bot_display_name: d.bot_display_name,
    webhook_url: d.webhook_url ?? "",
    created_at: toISO(d.createdAt),
    updated_at: toISO(d.updatedAt),
  };
}

/** สถานะสำหรับแสดงใน UI (ไม่ส่ง secret/token) */
export async function getLineChannelStatus(orgId: string): Promise<LineChannelStatus> {
  const ch = await getLineChannelByOrgId(orgId);
  if (!ch) {
    return {
      connected: false,
      webhook_url: `${getBaseUrl()}/api/webhooks/line/${orgId}`,
    };
  }
  return {
    connected: true,
    bot_display_name: ch.bot_display_name,
    webhook_url: ch.webhook_url,
    bot_user_id: ch.bot_user_id,
  };
}

/** บันทึกหรืออัปเดต LINE Channel */
export async function upsertLineChannel(
  data: LineChannelCreate,
  botUserId: string,
  botDisplayName?: string
): Promise<LineChannel> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const now = FieldValue.serverTimestamp();
  const baseUrl = getBaseUrl();
  const webhookUrl = `${baseUrl}/api/webhooks/line/${data.org_id}`;

  const payload = {
    org_id: data.org_id,
    channel_id: data.channel_id,
    channel_secret: data.channel_secret.trim(),
    channel_access_token: data.channel_access_token.trim(),
    bot_user_id: botUserId,
    bot_display_name: botDisplayName ?? null,
    webhook_url: webhookUrl,
    updatedAt: now,
  };

  const docRef = db.collection(COLLECTION).doc(data.org_id);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update(payload);
  } else {
    await docRef.set({
      ...payload,
      createdAt: now,
    });
  }

  const updated = await getLineChannelByOrgId(data.org_id);
  if (!updated) throw new Error("Failed to read after upsert");
  return updated;
}
