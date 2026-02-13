/**
 * Enterprise: Slot Management Engine
 * สร้าง slot ว่างจาก branch_hours + doctor_schedules + blackout_dates - bookings
 */
import {
  getBranchHours,
  getDoctorSchedule,
  getBlackoutDates,
  getBookingsByDateRange,
  getDoctorsByProcedure,
} from "@/lib/clinic-data";
import type { DayOfWeek } from "@/types/clinic";

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_KEYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DEFAULT_HOURS: Record<DayOfWeek, { open: string; close: string } | null> = {
  monday: { open: "09:00", close: "18:00" },
  tuesday: { open: "09:00", close: "18:00" },
  wednesday: { open: "09:00", close: "18:00" },
  thursday: { open: "09:00", close: "18:00" },
  friday: { open: "09:00", close: "18:00" },
  saturday: { open: "09:00", close: "14:00" },
  sunday: null,
};

export interface TimeSlot {
  start: string;
  end: string;
  startISO: string;
  endISO: string;
  /** เมื่อ filter ตาม procedure จะมีข้อมูลแพทย์ */
  doctorId?: string;
  doctorName?: string;
}

export interface SlotResult {
  date: string;
  branchId: string;
  slots: TimeSlot[];
  hasBlackout: boolean;
}

/** แปลง "09:30" เป็น minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** สร้าง array ของช่วงเวลา (start, end) ทุก slot_duration นาที */
function generateSlotsInRange(
  openStr: string,
  closeStr: string,
  durationMinutes: number,
  dateStr: string
): TimeSlot[] {
  const openMin = timeToMinutes(openStr);
  const closeMin = timeToMinutes(closeStr);
  const slots: TimeSlot[] = [];
  let cur = openMin;
  while (cur + durationMinutes <= closeMin) {
    const endMin = cur + durationMinutes;
    const startT = minutesToTime(cur);
    const endT = minutesToTime(endMin);
    slots.push({
      start: startT,
      end: endT,
      startISO: `${dateStr}T${startT}:00`,
      endISO: `${dateStr}T${endT}:00`,
    });
    cur += durationMinutes;
  }
  return slots;
}

/** เช็คว่า slot ทับกับ booking หรือไม่ — export สำหรับ atomic booking */
export function slotOverlapsBooking(
  slotStart: string,
  slotEnd: string,
  bookingScheduledAt: string,
  bookingDurationMinutes: number = 30
): boolean {
  const slotStartMs = new Date(slotStart).getTime();
  const slotEndMs = new Date(slotEnd).getTime();
  const bookStart = new Date(bookingScheduledAt).getTime();
  const bookEnd = bookStart + bookingDurationMinutes * 60 * 1000;
  return slotStartMs < bookEnd && slotEndMs > bookStart;
}

/** เช็คว่าเวลาอยู่ในช่วงหรือไม่ (HH:mm format) */
function timeInRange(t: string, open: string, close: string): boolean {
  const m = timeToMinutes(t);
  return m >= timeToMinutes(open) && m < timeToMinutes(close);
}

/** ช่วยตรวจว่า booking 占用 slot ของแพทย์นี้หรือไม่ */
function bookingOccupiesForDoctor(
  b: { scheduledAt: string; status: string; doctor?: string | null; doctor_id?: string | null },
  doctorId: string,
  doctorName?: string,
  confirmedOrPending?: string[]
): boolean {
  const ok = confirmedOrPending ?? ["confirmed", "pending", "in_progress", "pending_admin_confirm", "reschedule_pending_admin"];
  if (!ok.includes(b.status)) return false;
  const bookDoctorId = (b.doctor_id ?? "").trim();
  const bookDoctor = (b.doctor ?? "").trim();
  if (bookDoctorId && bookDoctorId === doctorId) return true;
  if (!bookDoctor && !bookDoctorId) return true; // ไม่ระบุแพทย์ = ใช้ร่วมกันทุกแพทย์
  return bookDoctor === doctorId || bookDoctor === doctorName;
}

/** Enterprise: Timeline slot พร้อมสถานะ — สำหรับแสดงปฏิทิน time-slot */
export interface DayTimelineSlot {
  start: string;
  end: string;
  startISO: string;
  status: "free" | "busy" | "completed";
  bookingId?: string;
  customerName?: string;
  service?: string;
}

/** Enterprise: ปฏิทินแบบ time-slot — ทุกช่วงเวลาว่าง/ไม่ว่างของวัน */
export async function getDayTimeline(
  orgId: string,
  branchId: string,
  dateStr: string,
  opts?: { doctorId?: string; durationMinutes?: number }
): Promise<{ date: string; branchId: string; slots: DayTimelineSlot[]; doctorName?: string }> {
  const durationMinutes = opts?.durationMinutes ?? 30;
  const doctorId = opts?.doctorId;

  const d = new Date(dateStr);
  const dayOfWeek = DAY_KEYS[d.getDay()] as DayOfWeek;

  const branchHours = await getBranchHours(orgId, branchId);
  const dayHours = branchHours?.[dayOfWeek] ?? DEFAULT_HOURS[dayOfWeek];

  const blackouts = await getBlackoutDates(orgId, branchId, dateStr, dateStr);
  const hasBlackout = blackouts.some((b) => !b.branch_id || b.branch_id === branchId);

  const from = new Date(dateStr + "T00:00:00");
  const to = new Date(dateStr + "T23:59:59");
  const bookings = await getBookingsByDateRange(orgId, from, to, { branchId, doctorId });
  const ACTIVE = ["pending", "confirmed", "in_progress", "pending_admin_confirm", "reschedule_pending_admin", "cancel_requested"];

  if (hasBlackout || !dayHours) {
    return { date: dateStr, branchId, slots: [] };
  }

  let openStr = dayHours.open;
  let closeStr = dayHours.close;
  let doctorName: string | undefined;

  if (doctorId) {
    const ds = await getDoctorSchedule(orgId, doctorId);
    if (!ds || !ds.work_days.includes(dayOfWeek)) {
      return { date: dateStr, branchId, slots: [], doctorName: undefined };
    }
    openStr = ds.work_start;
    closeStr = ds.work_end;
    doctorName = ds.doctor_name;
  }

  const allSlots = generateSlotsInRange(openStr, closeStr, durationMinutes, dateStr);
  const slots: DayTimelineSlot[] = [];

  for (const slot of allSlots) {
    const occForDoctor = doctorId
      ? bookings.filter((b) => bookingOccupiesForDoctor(b, doctorId, doctorName, ACTIVE))
      : bookings.filter((b) => ACTIVE.includes(b.status));
    const completedForDoctor = doctorId
      ? bookings.filter(
          (b) =>
            b.status === "completed" &&
            ((b.doctor_id ?? "").trim() === doctorId || (b.doctor ?? "").trim() === doctorId || (b.doctor ?? "").trim() === doctorName)
        )
      : bookings.filter((b) => b.status === "completed");

    const activeBooking = occForDoctor.find((b) =>
      slotOverlapsBooking(slot.startISO, slot.endISO, b.scheduledAt, durationMinutes)
    );
    const completedBooking = completedForDoctor.find((b) =>
      slotOverlapsBooking(slot.startISO, slot.endISO, b.scheduledAt, durationMinutes)
    );

    if (activeBooking) {
      slots.push({
        start: slot.start,
        end: slot.end,
        startISO: slot.startISO,
        status: "busy",
        bookingId: activeBooking.id,
        customerName: activeBooking.customerName,
        service: activeBooking.service,
      });
    } else if (completedBooking) {
      slots.push({
        start: slot.start,
        end: slot.end,
        startISO: slot.startISO,
        status: "completed",
        bookingId: completedBooking.id,
        customerName: completedBooking.customerName,
        service: completedBooking.service,
      });
    } else {
      slots.push({
        start: slot.start,
        end: slot.end,
        startISO: slot.startISO,
        status: "free",
      });
    }
  }

  return { date: dateStr, branchId, slots, doctorName };
}

/**
 * ดึง slot ว่างของสาขา สำหรับวันหนึ่ง
 * - procedure: กรองเฉพาะแพทย์ที่ทำบริการนี้ได้
 * - doctorId: slot ของแพทย์คนนี้เท่านั้น
 */
export async function getAvailableSlots(
  orgId: string,
  branchId: string,
  dateStr: string,
  opts?: { doctorId?: string; procedure?: string; durationMinutes?: number; excludeBookingId?: string }
): Promise<SlotResult> {
  const durationMinutes = opts?.durationMinutes ?? 30;
  const procedure = opts?.procedure?.trim();
  let doctorId = opts?.doctorId;

  const d = new Date(dateStr);
  const dayOfWeek = DAY_KEYS[d.getDay()] as DayOfWeek;

  const branchHours = await getBranchHours(orgId, branchId);
  const dayHours = branchHours?.[dayOfWeek] ?? DEFAULT_HOURS[dayOfWeek];

  const blackouts = await getBlackoutDates(orgId, branchId, dateStr, dateStr);
  const hasBlackout = blackouts.some((b) => !b.branch_id || b.branch_id === branchId);

  if (hasBlackout || !dayHours) {
    return { date: dateStr, branchId, slots: [], hasBlackout };
  }

  let doctorsToUse: Array<{ doctor_id: string; doctor_name?: string }> = [];
  if (procedure) {
    doctorsToUse = await getDoctorsByProcedure(orgId, procedure);
    if (doctorId && !doctorsToUse.some((x) => x.doctor_id === doctorId)) {
      return { date: dateStr, branchId, slots: [], hasBlackout: false };
    }
    if (doctorId) doctorsToUse = doctorsToUse.filter((x) => x.doctor_id === doctorId);
    if (doctorsToUse.length === 0) return { date: dateStr, branchId, slots: [], hasBlackout: false };
  } else if (doctorId) {
    const ds = await getDoctorSchedule(orgId, doctorId);
    if (ds) doctorsToUse = [{ doctor_id: ds.doctor_id, doctor_name: ds.doctor_name }];
  }

  const from = new Date(dateStr + "T00:00:00");
  const to = new Date(dateStr + "T23:59:59");
  const bookings = await getBookingsByDateRange(orgId, from, to, { branchId });
  const confirmedOrPending = ["confirmed", "pending", "in_progress", "pending_admin_confirm", "reschedule_pending_admin"];
  let occupiedBookings = bookings.filter((b) => confirmedOrPending.includes(b.status));
  if (opts?.excludeBookingId) {
    occupiedBookings = occupiedBookings.filter((b) => b.id !== opts.excludeBookingId);
  }

  const allSlots: TimeSlot[] = [];

  async function addSlotsForDoctor(docId: string, docName?: string) {
    const doctorSchedule = await getDoctorSchedule(orgId, docId);
    if (!doctorSchedule || !doctorSchedule.work_days.includes(dayOfWeek)) return;

    const openStr = doctorSchedule.work_start;
    const closeStr = doctorSchedule.work_end;
    const slotDuration = doctorSchedule.slot_duration_minutes ?? branchHours?.slot_duration_minutes ?? durationMinutes;

    const slots = generateSlotsInRange(openStr, closeStr, slotDuration, dateStr);
    const occForDoctor = occupiedBookings.filter((b) =>
      bookingOccupiesForDoctor(b, docId, docName, confirmedOrPending)
    );

    for (const slot of slots) {
      const overlaps = occForDoctor.some((b) =>
        slotOverlapsBooking(slot.startISO, slot.endISO, b.scheduledAt, slotDuration)
      );
      if (!overlaps) {
        allSlots.push({
          ...slot,
          doctorId: docId,
          doctorName: docName ?? docId,
        });
      }
    }
  }

  if (doctorsToUse.length > 0) {
    for (const doc of doctorsToUse) {
      await addSlotsForDoctor(doc.doctor_id, doc.doctor_name);
    }
    allSlots.sort((a, b) => a.startISO.localeCompare(b.startISO));
  } else {
    let openStr = dayHours.open;
    let closeStr = dayHours.close;
    const slotDuration = branchHours?.slot_duration_minutes ?? durationMinutes;
    const slots = generateSlotsInRange(openStr, closeStr, slotDuration, dateStr);
    for (const slot of slots) {
      const overlaps = occupiedBookings.some((b) =>
        slotOverlapsBooking(slot.startISO, slot.endISO, b.scheduledAt, slotDuration)
      );
      if (!overlaps) allSlots.push(slot);
    }
  }

  return { date: dateStr, branchId, slots: allSlots, hasBlackout: false };
}

/**
 * เช็คว่า slot ว่างหรือไม่ ก่อนสร้าง booking
 */
export async function isSlotAvailable(
  orgId: string,
  branchId: string,
  scheduledAtISO: string,
  opts?: { excludeBookingId?: string; durationMinutes?: number }
): Promise<{ available: boolean; alternatives?: TimeSlot[] }> {
  const d = new Date(scheduledAtISO);
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const duration = opts?.durationMinutes ?? 30;
  const reqTimeStr = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
  const reqMin = timeToMinutes(reqTimeStr);

  const result = await getAvailableSlots(orgId, branchId, dateStr, {
    durationMinutes: duration,
    excludeBookingId: opts?.excludeBookingId,
  });

  const available = result.slots.some((s) => {
    const sStart = timeToMinutes(s.start);
    const sEnd = timeToMinutes(s.end);
    return reqMin >= sStart && reqMin + duration <= sEnd;
  });

  if (available) return { available: true };
  return { available: false, alternatives: result.slots.slice(0, 6) };
}
