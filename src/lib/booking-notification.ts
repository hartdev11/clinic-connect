/**
 * Schedule 24h reminder via BullMQ.
 * Call after booking created/updated.
 */
import { scheduleBookingReminder as enqueueReminder } from "@/lib/booking-reminder-queue";

export async function scheduleBookingReminder(
  bookingId: string,
  bookingDateTime: Date,
  orgId: string,
  opts?: { lineUserId?: string; customerId?: string }
): Promise<string | null> {
  return enqueueReminder(bookingId, bookingDateTime, orgId, opts);
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
import { updateBooking } from "@/lib/clinic-data";
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
  } else if (process.env.LINE_ORG_ID === orgId && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()) {
    accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN.trim();
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

async function sendViaChannel(
  orgId: string,
  channel: string,
  chatUserId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  switch (channel) {
    case "line":
      return sendViaLine(orgId, chatUserId, text);
    case "facebook":
    case "instagram":
    case "tiktok":
    case "web":
    case "web_chat":
      // TODO: เชื่อมต่อ API ของแต่ละช่องทางเมื่อพร้อม
      console.warn(`[BookingNotification] Channel "${channel}" not implemented yet`);
      return { ok: false, error: `Channel ${channel} not implemented` };
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

  if (!booking.chatUserId || !booking.channel) {
    return { ok: false, error: "chatUserId or channel missing" };
  }

  if (!NOTIFYABLE_CHANNELS.includes(booking.channel as (typeof NOTIFYABLE_CHANNELS)[number])) {
    return { ok: false, error: `Channel ${booking.channel} is not notifyable` };
  }

  const attemptCount = (booking.notificationAttemptCount ?? 0) + 1;
  const text = buildConfirmationMessage(booking);
  const result = await sendViaChannel(orgId, booking.channel, booking.chatUserId, text);

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
  const result = await sendViaChannel(orgId, booking.channel, booking.chatUserId, text);
  return result;
}
