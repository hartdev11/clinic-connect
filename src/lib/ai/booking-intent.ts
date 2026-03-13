/**
 * Enterprise: AI Booking Assistant
 * - Conversational booking with full data extraction
 * - Ask clarification when missing required fields
 * - status = pending_admin_confirm (never confirm until backend confirms)
 * - Reschedule / Cancel handling
 */
import { getOpenAI } from "@/lib/agents/clients";
import { createBookingAtomic, updateBooking, getLatestReschedulableBooking, getBranchesByOrgId } from "@/lib/clinic-data";
import { isSlotAvailable } from "@/lib/slot-engine";
import { sanitizeForLLM } from "@/lib/ai/input-sanitizer";
import type { BookingCreate, BookingChannel } from "@/types/clinic";

function buildExtractionPrompt(referenceDate: string): string {
  return `คุณเป็น AI Booking Assistant สำหรับคลินิกความงาม
สกัดข้อมูลการจองจากข้อความลูกค้าเท่านั้น — ห้ามสมมติหรือเดาค่าใดๆ ที่ไม่มีในข้อความ

วันนี้ (reference): ${referenceDate}

กฎสำคัญสำหรับวันที่:
- ถ้าไม่ระบุเดือน (เช่น "วันที่ 14", "14") → ใช้เดือนของ reference (วันนี้)
- ถ้าวันที่ผ่านไปแล้วในเดือนนี้ → ใช้เดือนถัดไป
- "พรุ่งนี้" = reference + 1 วัน
- "เสาร์หน้า" / "อาทิตย์หน้า" = วันเสาร์/อาทิตย์ถัดไป
- preferred_date ต้องตอบเป็น YYYY-MM-DD เสมอ ห้ามตอบแค่เลขวัน
- preferred_time ต้องเป็น HH:mm (เช่น 09:30, 14:00)

กฎอื่น:
- full_name ต้องเป็นชื่อจริงในข้อความ — ห้ามใช้ "ลูกค้า", "ไม่ทราบ"
- phone_number ต้องเป็นเบอร์ในข้อความ (08XXXXXXXX)
- procedure ต้องเป็นบริการที่ระบุ (โบท็อกซ์, ฟิลเลอร์ ฯลฯ)

รูปแบบตอบ:
- ครบ: {"ok": true, "full_name": "...", "phone_number": "...", "procedure": "...", "preferred_date": "YYYY-MM-DD", "preferred_time": "HH:mm", "branch": "หรือnull", "doctor": "หรือnull", "notes": "หรือnull"}
- ไม่ครบ: {"ok": false, "missing": ["field1","field2"], "question": "คำถามสุภาพเป็นภาษาไทย เพื่อขอข้อมูลที่ขาด"}`;
}

function buildRescheduleExtractionPrompt(referenceDate: string): string {
  return `สกัดข้อมูลการเลื่อนนัดจากข้อความ
วันนี้ (reference): ${referenceDate}
กฎวันที่: ไม่ระบุเดือน → ใช้เดือนของ reference; วันผ่านไปแล้ว → เดือนถัดไป
ตอบเป็น JSON เท่านั้น: {"ok": true, "new_date": "YYYY-MM-DD", "new_time": "HH:mm"}
ถ้าไม่ครบ: {"ok": false, "missing": ["new_date"], "question": "ขอวันที่ที่ต้องการเลื่อนได้ไหมคะ?"}`;
}

export type BookingIntentResult =
  | { action: "created"; message: string; bookingId: string }
  | { action: "ask_clarification"; question: string }
  | { action: "reschedule_requested"; message: string; bookingId: string }
  | { action: "cancel_requested"; message: string; bookingId: string }
  | { action: "reschedule_ask"; question: string }
  | { action: "cancel_confirm_ask"; question: string; bookingId: string }
  | { action: "no_booking"; reason?: string };

export async function processBookingIntent(
  userMessage: string,
  orgId: string,
  opts: {
    branchId?: string | null;
    channel?: BookingChannel;
    userId?: string | null;
    conversationContext?: string;
  }
): Promise<BookingIntentResult | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const trimmed = userMessage.trim();
  if (trimmed.length < 3) return null;

  const isReschedule = /เลื่อน|เปลี่ยนวัน|เปลี่ยนเวลา|ย้ายนัด/i.test(trimmed);
  const isCancel = /ยกเลิก|ไม่มา|cancel/i.test(trimmed);
  const isConfirmCancel = /ยืนยันยกเลิก|ใช่.*ยกเลิก|ตกลง.*ยกเลิก/i.test(trimmed);
  const hasBookingKeyword = /จอง|booking|นัด|สมัคร|ต้องการนัด/i.test(trimmed);
  const hasPhoneAndProcedure =
    /\b0\d{8,9}\b/.test(trimmed.replace(/\s/g, "")) &&
    /โบท็อกซ์|ฟิลเลอร์|เลเซอร์|รีจูรัน|เติม|สัก|Botox|filler|วันที่\s*\d+|วัน\d+|\d+\s*โมง|\d+:\d+/i.test(trimmed);
  const isBooking = hasBookingKeyword || hasPhoneAndProcedure;

  if (isReschedule && opts.userId) {
    return handleRescheduleFlow(trimmed, orgId, opts.userId, openai, isReschedule);
  }
  if ((isCancel || isConfirmCancel) && opts.userId) {
    return handleCancelFlow(trimmed, orgId, opts.userId, openai, isConfirmCancel, opts.conversationContext);
  }
  if (isBooking) {
    return handleCreateFlow(trimmed, orgId, opts, openai);
  }

  return null;
}

/** Hybrid date logic: reference window + past → next month + confirm if > 60 days */
function resolvePreferredDate(
  preferredDateRaw: string,
  referenceDate: string
): { date: string; needsConfirmation?: string } {
  const ref = new Date(referenceDate);
  const match = preferredDateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { date: preferredDateRaw };

  const [, y, m, d] = match;
  let parsed = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  if (isNaN(parsed.getTime())) return { date: preferredDateRaw };

  const refMonth = ref.getMonth();
  const refYear = ref.getFullYear();
  if (parsed < ref) {
    const nextMonth = new Date(refYear, refMonth + 1, parseInt(d, 10));
    parsed = nextMonth;
  }
  const finalStr = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;

  const daysFromRef = Math.round((parsed.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
  if (daysFromRef > 60) {
    const thaiDate = parsed.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    return { date: finalStr, needsConfirmation: `หมายถึงวันที่ ${thaiDate} ใช่ไหมคะ?` };
  }
  return { date: finalStr };
}

async function handleCreateFlow(
  message: string,
  orgId: string,
  opts: { branchId?: string | null; channel?: BookingChannel; userId?: string | null },
  openai: NonNullable<ReturnType<typeof getOpenAI>>
): Promise<BookingIntentResult> {
  const referenceDate = new Date().toISOString().slice(0, 10);
  const safeMessage = sanitizeForLLM(message) || message.slice(0, 500);
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildExtractionPrompt(referenceDate) },
        { role: "user", content: safeMessage },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return { action: "no_booking", reason: "empty" };

    const parsed = parseJSON(content);
    if (!parsed) return { action: "no_booking", reason: "parse" };

    if (!parsed.ok) {
      const q = (parsed as Record<string, unknown>).question;
      const question = typeof q === "string" ? q : "ขอข้อมูลเพิ่มเติมได้ไหมคะ (ชื่อ เบอร์โทร บริการ วันที่ เวลา)";
      return { action: "ask_clarification", question };
    }

    const fullName = String((parsed as Record<string, unknown>).full_name || "").trim();
    const phoneNumber = String((parsed as Record<string, unknown>).phone_number || "").trim();
    const procedure = String((parsed as Record<string, unknown>).procedure || "").trim();
    const preferredDateRaw = String((parsed as Record<string, unknown>).preferred_date || "").trim();
    const preferredTime = String((parsed as Record<string, unknown>).preferred_time || "10:00").trim();

    const { date: preferredDate, needsConfirmation } = resolvePreferredDate(preferredDateRaw, referenceDate);
    if (needsConfirmation) {
      return { action: "ask_clarification", question: needsConfirmation };
    }

    const FAKE_PLACEHOLDERS = /^(ลูกค้า|ไม่ทราบ|xxx|สมมติ|-\s*$|\.\.\.|na|null)$/i;
    const phoneDigits = phoneNumber.replace(/\D/g, "");
    const hasValidPhone = phoneDigits.length >= 9 && phoneDigits.startsWith("0");
    if (
      !fullName ||
      !phoneNumber ||
      !procedure ||
      !preferredDate ||
      FAKE_PLACEHOLDERS.test(fullName) ||
      FAKE_PLACEHOLDERS.test(procedure) ||
      !hasValidPhone
    ) {
      const missing: string[] = [];
      if (!fullName || FAKE_PLACEHOLDERS.test(fullName)) missing.push("ชื่อ-นามสกุล");
      if (!phoneNumber || !hasValidPhone) missing.push("เบอร์โทร");
      if (!procedure || FAKE_PLACEHOLDERS.test(procedure)) missing.push("บริการ/หัตถการ");
      if (!preferredDate) missing.push("วันที่");
      return {
        action: "ask_clarification",
        question: `เพื่อจองนัดให้ค่ะ ขอข้อมูลดังนี้: ${missing.join(", ")} พิมพ์ครบทีเดียวหรือทีละข้อก็ได้นะคะ 😊`,
      };
    }

    const time = preferredTime.includes(":") ? preferredTime : `${preferredTime}:00`;
    const scheduledAt = `${preferredDate}T${time}`;

    const branches = await getBranchesByOrgId(orgId);
    const branchName = (parsed as Record<string, unknown>).branch ? String((parsed as Record<string, unknown>).branch).trim() : null;
    const branch =
      opts.branchId ? branches.find((b) => b.id === opts.branchId) : branchName ? branches.find((b) => b.name.includes(branchName) || branchName.includes(b.name)) : branches[0];

    const effectiveBranchId = opts.branchId ?? branch?.id;
    if (effectiveBranchId) {
      const slotCheck = await isSlotAvailable(orgId, effectiveBranchId, scheduledAt, { durationMinutes: 30 });
      if (!slotCheck.available) {
        const altStr = slotCheck.alternatives?.length
          ? ` มีคิวว่างเวลา ${slotCheck.alternatives.slice(0, 3).map((a) => a.start).join(", ")}`
          : "";
        return {
          action: "ask_clarification",
          question: `ช่วงเวลา ${preferredTime} วันที่ ${preferredDate} ไม่ว่างค่ะ${altStr} — ต้องการเลือกเวลาอื่นได้ไหมคะ?`,
        };
      }
    }

    const data: BookingCreate = {
      customerName: fullName,
      phoneNumber,
      service: procedure,
      procedure,
      source: "ai",
      channel: opts.channel ?? "other",
      doctor: (parsed as Record<string, unknown>).doctor ? String((parsed as Record<string, unknown>).doctor).trim() : undefined,
      chatUserId: opts.userId ? opts.userId : undefined,
      bookingCreationMode: "chat",
      branch_id: opts.branchId ?? branch?.id,
      branchId: opts.branchId ?? branch?.id,
      branchName: branch?.name ?? undefined,
      scheduledAt,
      status: "pending_admin_confirm",
      notes: (parsed as Record<string, unknown>).notes ? String((parsed as Record<string, unknown>).notes).trim() : undefined,
    };

    const result = await createBookingAtomic(orgId, data, { durationMinutes: 30 });
    if (!("error" in result) && result.id) {
      const { dispatchPartnerWebhooks } = await import("@/lib/partner-webhook-dispatch");
      dispatchPartnerWebhooks(orgId, "booking.created", {
        bookingId: result.id,
        customerName: data.customerName,
        service: data.service,
        scheduledAt: data.scheduledAt,
        branchName: data.branchName,
      }).catch((e) => console.warn("[BookingIntent] partner webhook:", (e as Error)?.message?.slice(0, 50)));
    }
    if ("error" in result) {
      const altCheck = effectiveBranchId
        ? await isSlotAvailable(orgId, effectiveBranchId, scheduledAt, { durationMinutes: 30 })
        : { alternatives: [] as Array<{ start: string }> };
      const altStr = altCheck.alternatives?.length
        ? ` มีคิวว่างเวลา ${altCheck.alternatives.slice(0, 3).map((a) => a.start).join(", ")}`
        : "";
      return {
        action: "ask_clarification",
        question: `ช่วงเวลานี้มีคนจองไปก่อนแล้วค่ะ${altStr} — เลือกเวลาอื่นได้ไหมคะ?`,
      };
    }
    return {
      action: "created",
      message: "คำขอจองถูกส่งให้เจ้าหน้าที่ตรวจสอบแล้วค่ะ จะมีการยืนยันกลับมาอีกครั้งนะคะ 😊",
      bookingId: result.id,
    };
  } catch (err) {
    return { action: "no_booking", reason: (err as Error).message };
  }
}

async function handleRescheduleFlow(
  message: string,
  orgId: string,
  userId: string,
  openai: NonNullable<ReturnType<typeof getOpenAI>>,
  isReschedule: boolean
): Promise<BookingIntentResult> {
  const booking = await getLatestReschedulableBooking(orgId, userId);
  if (!booking) {
    return {
      action: "no_booking",
      reason: "ไม่มีนัดที่สามารถเลื่อนได้",
    };
  }

  const hasDateTime = /\d{4}-\d{2}-\d{2}|วัน|พรุ่งนี้|เสาร์|อาทิตย์|\d{1,2}\s*(?:น\.|โมง|:|\.)/.test(message);
  if (!hasDateTime) {
    return {
      action: "reschedule_ask",
      question: `ต้องการเลื่อนนัดวันที่ ${formatDateThai(booking.scheduledAt)} ไปเป็นวันใดคะ? กรุณาระบุวันที่และเวลาที่ต้องการค่ะ`,
    };
  }

  const referenceDate = new Date().toISOString().slice(0, 10);
  try {
    const safeMessage = sanitizeForLLM(message) || message.slice(0, 300);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildRescheduleExtractionPrompt(referenceDate) },
        { role: "user", content: safeMessage },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    const parsed = content ? parseJSON(content) : null;

    if (parsed?.ok && (parsed as Record<string, unknown>).new_date) {
      const nt = String((parsed as Record<string, unknown>).new_time || "10:00");
      const time = nt.includes(":") ? nt : `${nt}:00`;
      const scheduledAt = `${(parsed as Record<string, unknown>).new_date}T${time}`;

      const branchId = booking.branch_id ?? (await getBranchesByOrgId(orgId))[0]?.id;
      if (branchId) {
        const slotCheck = await isSlotAvailable(orgId, branchId, scheduledAt, {
          durationMinutes: 30,
          excludeBookingId: booking.id,
        });
        if (!slotCheck.available) {
          const altStr = slotCheck.alternatives?.length
            ? ` มีคิวว่างเวลา ${slotCheck.alternatives.slice(0, 3).map((a) => a.start).join(", ")}`
            : "";
          return {
            action: "reschedule_ask",
            question: `ช่วงเวลานั้นไม่ว่างค่ะ${altStr} — เลือกเวลาอื่นได้ไหมคะ?`,
          };
        }
      }

      await updateBooking(orgId, booking.id, {
        scheduledAt,
        status: "reschedule_pending_admin",
      });
      return {
        action: "reschedule_requested",
        message: "คำขอเลื่อนนัดถูกส่งให้เจ้าหน้าที่ตรวจสอบแล้วค่ะ จะยืนยันกลับมาอีกครั้งนะคะ 😊",
        bookingId: booking.id,
      };
    }

    const question = (parsed as Record<string, unknown>)?.question as string || "ขอวันที่และเวลาที่ต้องการเลื่อนได้ไหมคะ?";
    return { action: "reschedule_ask", question };
  } catch {
    return {
      action: "reschedule_ask",
      question: `ขอวันที่และเวลาที่ต้องการเลื่อนนัดได้ไหมคะ?`,
    };
  }
}

async function handleCancelFlow(
  message: string,
  orgId: string,
  userId: string,
  openai: NonNullable<ReturnType<typeof getOpenAI>>,
  isConfirmCancel: boolean,
  context?: string
): Promise<BookingIntentResult> {
  const booking = await getLatestReschedulableBooking(orgId, userId);
  if (!booking) {
    return {
      action: "no_booking",
      reason: "ไม่มีนัดที่สามารถยกเลิกได้",
    };
  }

  if (!isConfirmCancel) {
    return {
      action: "cancel_confirm_ask",
      question: `ต้องการยกเลิกนัดวันที่ ${formatDateThai(booking.scheduledAt)} ใช่หรือไม่คะ? พิมพ์ "ยืนยันยกเลิก" เพื่อยืนยันค่ะ`,
      bookingId: booking.id,
    };
  }

  await updateBooking(orgId, booking.id, { status: "cancel_requested" });
  return {
    action: "cancel_requested",
    message: "คำขอยกเลิกนัดได้รับการบันทึกแล้วค่ะ หากต้องการนัดใหม่ ส่งข้อความมาได้เลยนะคะ 😊",
    bookingId: booking.id,
  };
}

function parseJSON(str: string): Record<string, unknown> | null {
  try {
    const cleaned = str.replace(/```json?\s*|\s*```/g, "").trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDateThai(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
