/**
 * Schedule 24h reminder via BullMQ.
 * Call after booking created/updated.
 */
import { scheduleBookingReminder as enqueueReminder } from "@/lib/booking-reminder-queue";
import { cancelBookingReminder as cancelReminder } from "@/lib/booking-reminder-queue";

export async function scheduleBookingReminder(
  bookingId: string,
  bookingDateTime: Date,
  orgId: string,
  opts?: { lineUserId?: string; customerId?: string; correlationId?: string }
): Promise<string | null> {
  return enqueueReminder(bookingId, bookingDateTime, orgId, opts);
}

export async function cancelBookingReminder(bookingId: string): Promise<void> {
  await cancelReminder(bookingId);
}

/**
 * Enterprise: ระบบแจ้งเตือนการยืนยันนัด — Multi-Channel Ready
 *
 * กฎสำคัญ:
 * - AI/Notification layer ทำหน้าที่ "สร้างข้อความ" เท่านั้น
 * - Backend เป็นผู้ตัดสินใจ requiresCustomerNotification
 * - ห้ามใช้เงื่อนไข chatUserId && channel อย่างเดียว
 * - หาก notificationStatus = "failed" → ต้องไม่ retry เอง รอ backend
 */
import { getLineChannelByOrgId } from "@/lib/line-channel-data";
import { createConversationFeedback, updateBooking } from "@/lib/clinic-data";
import type { Booking } from "@/types/clinic";
import { NOTIFYABLE_CHANNELS } from "@/types/clinic";

// ─── Backend: Decision Logic (System Authority) ───────────────────────────
// การตัดสินใจว่าต้องแจ้งเตือนหรือไม่ เป็นหน้าที่ของ Backend เท่านั้น

export function computeRequiresCustomerNotification(
  booking: Pick<Booking, "bookingCreationMode" | "chatUserId" | "channel">,
  statusChangedToConfirmed: boolean
): boolean {
  if (!statusChangedToConfirmed) return false;
  if (!booking.chatUserId?.trim()) return false;
  const ch = booking.channel;
  if (!ch || !NOTIFYABLE_CHANNELS.includes(ch as (typeof NOTIFYABLE_CHANNELS)[number])) return false;
  if (booking.bookingCreationMode !== "chat") return false;
  return true;
}

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const MAX_TEXT_LENGTH = 5000;

// ─── Message Builder (Channel-Agnostic) ───────────────────────────────────
// AI ทำหน้าที่สร้างข้อความตาม spec; Backend เลือก API ส่งตาม channel

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * สร้างข้อความปฏิเสธการจอง — AI แจ้งลูกค้าผ่านช่องทางที่จองมา
 */
export function buildRejectionMessage(booking: Booking, rejectReason: string): string {
  const lines: string[] = [
    "ขออภัย เราขอปฏิเสธการจองในครั้งนี้",
    "",
    `เหตุผล: ${rejectReason.trim() || "กรุณาติดต่อคลินิกเพื่อสอบถามรายละเอียด"}`,
    "",
    "หากต้องการจองใหม่ กรุณาติดต่อหรือส่งข้อความเข้ามาได้ครับ",
  ];
  const text = lines.join("\n");
  return text.length <= MAX_TEXT_LENGTH ? text : text.slice(0, MAX_TEXT_LENGTH - 3) + "...";
}

/**
 * สร้างข้อความยืนยันนัดตาม spec — ใช้ได้ทุก channel
 * รูปแบบ: หัวข้อ ✅ / รายละเอียด (ชื่อ, หัตถการ, วันที่, เวลา, สาขา, แพทย์) / หมายเหตุ / ปิดท้าย
 */
export function buildConfirmationMessage(booking: Booking): string {
  const lines: string[] = [
    "✅ ยืนยันการนัดหมายเรียบร้อยแล้ว",
    "",
    "📋 รายละเอียด",
    `• ชื่อ: ${booking.customerName}`,
    `• หัตถการ: ${booking.procedure || booking.service}`,
    `• วันที่: ${formatDate(booking.scheduledAt)}`,
    `• เวลา: ${formatTime(booking.scheduledAt)}`,
    `• สาขา: ${booking.branchName || "—"}`,
  ];
  if (booking.doctor) {
    lines.push(`• แพทย์: ${booking.doctor}`);
  }
  lines.push(
    "",
    "📌 หมายเหตุ",
    "• กรุณามาก่อน 10–15 นาที",
    "• หากต้องการเลื่อนหรือยกเลิก กรุณาแจ้งล่วงหน้า 24 ชั่วโมง",
    "",
    "พิมพ์ \"ยืนยัน\" เพื่อยืนยันการเข้ารับบริการ",
    "พิมพ์ \"เลื่อน\" เพื่อเปลี่ยนวันนัด",
    "พิมพ์ \"ยกเลิก\" เพื่อยกเลิกนัด",
  );
  const text = lines.join("\n");
  return text.length <= MAX_TEXT_LENGTH ? text : text.slice(0, MAX_TEXT_LENGTH - 3) + "...";
}

// ─── Sender by Channel ────────────────────────────────────────────────────

/** Send raw text via LINE push (used by reminder worker) */
export async function sendLinePushMessage(
  orgId: string,
  lineUserId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  return sendViaLine(orgId, lineUserId, text);
}

async function sendViaLine(orgId: string, chatUserId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  let accessToken: string | null = null;
  const channel = await getLineChannelByOrgId(orgId);
  if (channel?.channel_access_token) {
    accessToken = channel.channel_access_token;
  }
  if (!accessToken) {
    return { ok: false, error: "LINE Channel not configured" };
  }
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: chatUserId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText.slice(0, 200) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

type NotifyMode = "confirmation" | "rejection";

async function sendViaPartnerChannel(
  orgId: string,
  channel: "facebook" | "instagram" | "tiktok" | "web" | "web_chat",
  chatUserId: string,
  text: string,
  mode: NotifyMode,
  booking?: Booking,
  bookingId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { dispatchPartnerWebhooks } = await import("@/lib/partner-webhook-dispatch");
    const event = mode === "confirmation" ? "booking.confirmed" : "booking.rejected";
    const summary = await dispatchPartnerWebhooks(orgId, event, {
      channel,
      chatUserId,
      message: text,
      bookingId: bookingId ?? booking?.id ?? null,
      booking: booking
        ? {
            id: booking.id,
            customerName: booking.customerName,
            service: booking.service,
            procedure: booking.procedure ?? null,
            scheduledAt: booking.scheduledAt,
            branchName: booking.branchName ?? null,
            doctor: booking.doctor ?? null,
          }
        : null,
    }, { correlationId: bookingId ? `booking_notify_${bookingId}_${mode}` : undefined });
    if (summary.delivered > 0) return { ok: true };
    return {
      ok: false,
      error: `No active partner webhook target for ${event} (${channel}). Configure /api/clinic/webhooks with this event.`,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function sendViaWebConversation(
  orgId: string,
  chatUserId: string,
  text: string,
  booking?: Booking
): Promise<{ ok: boolean; error?: string }> {
  try {
    await createConversationFeedback({
      org_id: orgId,
      branch_id: booking?.branch_id ?? null,
      user_id: chatUserId,
      userMessage: "",
      botReply: text,
      source: "web",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function sendViaChannel(
  orgId: string,
  channel: string,
  chatUserId: string,
  text: string,
  opts?: { mode?: NotifyMode; booking?: Booking; bookingId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const mode = opts?.mode ?? "confirmation";
  switch (channel) {
    case "line":
      return sendViaLine(orgId, chatUserId, text);
    case "web":
    case "web_chat": {
      const relay = await sendViaPartnerChannel(orgId, channel, chatUserId, text, mode, opts?.booking, opts?.bookingId);
      if (relay.ok) return relay;
      // Fallback: เก็บข้อความเข้า conversation log สำหรับช่องทางเว็บ
      const web = await sendViaWebConversation(orgId, chatUserId, text, opts?.booking);
      if (web.ok) return web;
      return { ok: false, error: relay.error ?? web.error };
    }
    case "facebook":
    case "instagram":
    case "tiktok":
      return sendViaPartnerChannel(orgId, channel, chatUserId, text, mode, opts?.booking, opts?.bookingId);
    default:
      return { ok: false, error: `Unsupported channel: ${channel}` };
  }
}

// ─── Main Send Flow ───────────────────────────────────────────────────────

export interface SendConfirmationInput {
  orgId: string;
  bookingId: string;
  booking: Booking;
}

/**
 * ส่งข้อความยืนยันนัด — เรียกจาก Backend เท่านั้น
 *
 * เงื่อนไข (Backend ต้องตรวจก่อน):
 * - requiresCustomerNotification === true
 * - notificationStatus !== "failed" (ถ้า failed ให้ backend retry/resend เอง)
 *
 * ผลลัพธ์: อัปเดต notificationStatus, notificationAttemptCount, lastNotificationError บน booking
 */
export async function sendBookingConfirmation(input: SendConfirmationInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { orgId, bookingId, booking } = input;

  if (!booking.requiresCustomerNotification) {
    return { ok: true };
  }

  if (booking.notificationStatus === "failed") {
    return { ok: false, error: "notification_status is failed — backend must handle retry" };
  }
  if (booking.notificationStatus === "sent") {
    // Idempotent guard: avoid duplicate customer notifications.
    return { ok: true };
  }

  if (!booking.chatUserId || !booking.channel) {
    return { ok: false, error: "chatUserId or channel missing" };
  }

  if (!NOTIFYABLE_CHANNELS.includes(booking.channel as (typeof NOTIFYABLE_CHANNELS)[number])) {
    return { ok: false, error: `Channel ${booking.channel} is not notifyable` };
  }

  const attemptCount = (booking.notificationAttemptCount ?? 0) + 1;
  const text = buildConfirmationMessage(booking);
  const result = await sendViaChannel(orgId, booking.channel, booking.chatUserId, text, {
    mode: "confirmation",
    booking,
    bookingId,
  });

  const updates: Parameters<typeof updateBooking>[2] = {
    notificationAttemptCount: attemptCount,
    notificationStatus: result.ok ? "sent" : "failed",
    lastNotificationError: result.ok ? null : result.error ?? "Unknown error",
  };

  await updateBooking(orgId, bookingId, updates);

  return result;
}

// ─── Rejection Flow ────────────────────────────────────────────────────────

export interface SendRejectionInput {
  orgId: string;
  bookingId: string;
  booking: Booking;
  rejectReason: string;
}

/**
 * ส่งข้อความปฏิเสธการจองให้ลูกค้าผ่านช่องทางที่จองมา
 * เรียกเมื่อ admin กดปฏิเสธ + กรอกเหตุผล
 */
export async function sendBookingRejection(input: SendRejectionInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { orgId, bookingId, booking, rejectReason } = input;

  if (!booking.chatUserId || !booking.channel) {
    return { ok: false, error: "chatUserId or channel missing" };
  }

  if (!NOTIFYABLE_CHANNELS.includes(booking.channel as (typeof NOTIFYABLE_CHANNELS)[number])) {
    return { ok: false, error: `Channel ${booking.channel} is not notifyable` };
  }

  const text = buildRejectionMessage(booking, rejectReason);
  const result = await sendViaChannel(orgId, booking.channel, booking.chatUserId, text, {
    mode: "rejection",
    booking,
    bookingId,
  });
  return result;
}
