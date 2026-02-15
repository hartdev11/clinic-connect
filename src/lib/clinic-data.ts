/**
 * Data layer — อ่าน/เขียน Firestore ตาม org_id (E1.4)
 * เน้น performance: limit, orderBy, ไม่ดึงเกินจำเป็น
 */
import { db } from "@/lib/firebase-admin";
import { safeSumBaht, satangToBaht, toSatang } from "@/lib/money";
import type {
  Booking,
  BookingCreate,
  Customer,
  Transaction,
  Promotion,
  PromotionMedia,
  PromotionStatus,
  PromotionTargetGroup,
  ClinicProfile,
  OrgProfile,
  DashboardStats,
  DashboardBookingsByDate,
  ConversationFeedback,
  ConversationFeedbackCreate,
  FeedbackLabel,
  BranchHours,
  DayOfWeek,
  DoctorSchedule,
  BlackoutDate,
} from "@/types/clinic";
import type { User, UserRole, OrgPlan } from "@/types/organization";
import type { Subscription, SubscriptionCreate } from "@/types/subscription";
import type { Timestamp, DocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { recordDashboardLatency } from "@/lib/observability";
import {
  getRevenueFromPaidInvoices,
  getRevenueByDayFromPaidInvoices,
} from "@/lib/financial-data";

const COLLECTIONS = {
  clinics: "clinics",
  organizations: "organizations",
  branches: "branches",
  users: "users",
  bookings: "bookings",
  customers: "customers",
  transactions: "transactions",
  promotions: "promotions",
  conversation_feedback: "conversation_feedback",
  subscriptions: "subscriptions",
  branch_hours: "branch_hours",
  doctor_schedules: "doctor_schedules",
  blackout_dates: "blackout_dates",
} as const;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
/** Enterprise: การจองรองรับ 500+ รายการ */
const BOOKING_MAX_PAGE_SIZE = 500;
const BOOKING_REPORT_MAX = 1000;

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = "toDate" in t && typeof t.toDate === "function" ? t.toDate() : (t as Timestamp).toDate?.();
  return d ? new Date(d).toISOString() : String(t);
}

/**
 * Normalize unknown Firestore date value to a type that toISO() accepts.
 * Production-grade: strict type-safe, no as any.
 */
function normalizeDateInput(
  value: unknown
): string | Date | { toDate: () => Date } | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if ("toDate" in o && typeof o.toDate === "function") {
      return value as { toDate: () => Date };
    }
  }
  return null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ─── E1.4: org_id resolver (session มี clinicId legacy) ────────────────────
export async function getOrgIdFromClinicId(legacyClinicId: string): Promise<string | null> {
  const snap = await db
    .collection(COLLECTIONS.organizations)
    .where("_legacy_clinic_id", "==", legacyClinicId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/** E2.3 — ดึง user โดย id (สำหรับ RBAC: role, branch_ids, branch_roles) */
export async function getUserById(userId: string): Promise<User | null> {
  const doc = await db.collection(COLLECTIONS.users).doc(userId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    org_id: d.org_id ?? "",
    email: d.email ?? "",
    role: (d.role as UserRole) ?? "staff",
    branch_ids: d.branch_ids ?? null,
    branch_roles: d.branch_roles ?? null,
    default_branch_id: d.default_branch_id ?? null,
    createdAt: d.createdAt ? toISO(d.createdAt) : "",
    updatedAt: d.updatedAt ? toISO(d.updatedAt) : "",
  };
}

/** E1.6 — ดึง branch แรกของ org (ใช้เป็น default branch ใน session) */
export async function getDefaultBranchId(orgId: string): Promise<string | null> {
  const snap = await db
    .collection(COLLECTIONS.branches)
    .where("org_id", "==", orgId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/** E2.7 — ดึง branches ของ org (สำหรับ invite/edit user) */
export async function getBranchesByOrgId(orgId: string): Promise<{ id: string; name: string; address?: string }[]> {
  const snap = await db
    .collection(COLLECTIONS.branches)
    .where("org_id", "==", orgId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name ?? "", address: data.address };
  });
}

/** E2.7 — ดึง users ของ org (ไม่มี passwordHash) */
export async function getUsersByOrgId(orgId: string): Promise<User[]> {
  const snap = await db
    .collection(COLLECTIONS.users)
    .where("org_id", "==", orgId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      org_id: data.org_id ?? orgId,
      email: data.email ?? "",
      role: (data.role as UserRole) ?? "staff",
      branch_ids: data.branch_ids ?? null,
      branch_roles: data.branch_roles ?? null,
      default_branch_id: data.default_branch_id ?? null,
      createdAt: data.createdAt ? toISO(data.createdAt) : "",
      updatedAt: data.updatedAt ? toISO(data.updatedAt) : "",
    };
  });
}

/** E2.7 — สร้าง user (invite) */
export async function createUser(data: {
  org_id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  branch_ids?: string[] | null;
  branch_roles?: Record<string, "manager" | "staff"> | null;
  default_branch_id?: string | null;
}): Promise<string> {
  const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
  const now = FieldValue.serverTimestamp();
  const defaultBranch =
    data.default_branch_id ??
    (data.branch_roles ? Object.keys(data.branch_roles)[0] ?? null : null) ??
    data.branch_ids?.[0] ??
    null;
  const ref = await db.collection(COLLECTIONS.users).add({
    org_id: data.org_id,
    email: data.email.trim().toLowerCase(),
    passwordHash: data.passwordHash,
    role: data.role,
    branch_ids: data.branch_ids ?? null,
    branch_roles: data.branch_roles ?? null,
    default_branch_id: defaultBranch,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/** E2.7 — อัปเดต user (role, branch_ids, branch_roles) */
export async function updateUser(
  userId: string,
  data: {
    role?: UserRole;
    branch_ids?: string[] | null;
    branch_roles?: Record<string, "manager" | "staff"> | null;
    default_branch_id?: string | null;
  }
): Promise<void> {
  const FieldValue = (await import("firebase-admin/firestore")).FieldValue;
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (data.role !== undefined) updates.role = data.role;
  if (data.branch_ids !== undefined) updates.branch_ids = data.branch_ids;
  if (data.branch_roles !== undefined) updates.branch_roles = data.branch_roles;
  if (data.default_branch_id !== undefined) updates.default_branch_id = data.default_branch_id;
  await db.collection(COLLECTIONS.users).doc(userId).update(updates);
}

// ─── Org profile (อ่านจาก organizations + branches) ───────────────────────
export async function getOrgProfile(orgId: string): Promise<OrgProfile | null> {
  const orgDoc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();
  if (!orgDoc.exists) return null;
  const o = orgDoc.data()!;
  const branchesSnap = await db
    .collection(COLLECTIONS.branches)
    .where("org_id", "==", orgId)
    .get();
  return {
    id: orgId,
    org_id: orgId,
    clinicName: o.name ?? "",
    plan: o.plan ?? "starter",
    branches: branchesSnap.size || 1,
    phone: o.phone ?? "",
    email: o.email ?? "",
    createdAt: o.createdAt ? toISO(o.createdAt) : "",
  };
}

// ─── Legacy: Clinic profile (deprecated — ใช้ getOrgProfile แทน) ───────────
export async function getClinicProfile(clinicId: string): Promise<ClinicProfile | null> {
  const orgId = await getOrgIdFromClinicId(clinicId);
  if (!orgId) return null;
  const org = await getOrgProfile(orgId);
  if (!org) return null;
  return {
    id: org.id,
    clinicName: org.clinicName,
    branches: org.branches,
    phone: org.phone,
    email: org.email,
    createdAt: org.createdAt,
  };
}

// ─── Bookings: list with pagination ───────────────────────────────────────
const VALID_CHANNELS = ["line", "facebook", "instagram", "tiktok", "web", "web_chat", "walk_in", "phone", "referral", "other"] as const;

export async function getBookings(
  orgId: string,
  opts: { branchId?: string; limit?: number; startAfterId?: string; status?: string; channel?: string } = {}
): Promise<{ items: Booking[]; lastId: string | null }> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, BOOKING_MAX_PAGE_SIZE);
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (opts.branchId) {
    q = q.where("branch_id", "==", opts.branchId) as typeof q;
  }
  if (opts.status) {
    q = q.where("status", "==", opts.status) as typeof q;
  }
  if (opts.channel && VALID_CHANNELS.includes(opts.channel as (typeof VALID_CHANNELS)[number])) {
    q = q.where("channel", "==", opts.channel) as typeof q;
  }

  if (opts.startAfterId) {
    const afterDoc = await db.collection(COLLECTIONS.bookings).doc(opts.startAfterId).get();
    if (afterDoc.exists) q = q.startAfter(afterDoc);
  }

  const snapshot = await q.get();
  const items: Booking[] = snapshot.docs.slice(0, limit).map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? orgId,
      branch_id: d.branch_id,
      customerName: d.customerName ?? "",
      customerId: d.customerId,
      phoneNumber: d.phoneNumber ?? null,
      service: d.service ?? "",
      procedure: d.procedure ?? null,
      amount: typeof d.amount === "number" ? d.amount : null,
      source: typeof d.source === "string" && ["line", "web", "admin", "ai"].includes(d.source) ? (d.source as Booking["source"]) : null,
      channel: typeof d.channel === "string" && VALID_CHANNELS.includes(d.channel as (typeof VALID_CHANNELS)[number]) ? (d.channel as Booking["channel"]) : null,
      doctor: d.doctor ?? null,
      chatUserId: d.chat_user_id ?? null,
      bookingCreationMode: d.booking_creation_mode ?? null,
      requiresCustomerNotification: d.requires_customer_notification ?? undefined,
      notificationStatus: d.notification_status ?? undefined,
      notificationAttemptCount: typeof d.notification_attempt_count === "number" ? d.notification_attempt_count : undefined,
      lastNotificationError: d.last_notification_error ?? undefined,
      branchId: d.branchId,
      branchName: d.branchName,
      scheduledAt: toISO(d.scheduledAt),
      status: (d.status as Booking["status"]) ?? "pending",
      notes: d.notes ?? null,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
    };
  });
  const lastId = snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null;
  return { items, lastId };
}

// ─── Bookings by date range (dashboard) ───────────────────────────────────
/** opts.doctorId: Enterprise — ใช้ doctor_id (FK) สำหรับ query ตรง index, fallback match doctor string */
export async function getBookingsByDateRange(
  orgId: string,
  from: Date,
  to: Date,
  opts?: { branchId?: string; channel?: string; doctorId?: string }
): Promise<Booking[]> {
  const branchId = opts?.branchId;
  const channel = opts?.channel;
  const doctorId = opts?.doctorId?.trim();
  const Firestore = await import("firebase-admin/firestore");
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(from))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(to))
    .orderBy("scheduledAt", "asc")
    .limit(BOOKING_REPORT_MAX);
  if (branchId) {
    q = q.where("branch_id", "==", branchId) as typeof q;
  }
  if (channel && VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    q = q.where("channel", "==", channel) as typeof q;
  }
  /** Enterprise: ใช้ Firestore index org_id+doctor_id+scheduledAt เมื่อมี doctorId */
  if (doctorId) {
    q = q.where("doctor_id", "==", doctorId) as typeof q;
  }
  const snapshot = await q.get();
  let result = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? orgId,
      branch_id: d.branch_id,
      customerName: d.customerName ?? "",
      customerId: d.customerId,
      phoneNumber: d.phoneNumber ?? null,
      service: d.service ?? "",
      procedure: d.procedure ?? null,
      amount: typeof d.amount === "number" ? d.amount : null,
      source: typeof d.source === "string" && ["line", "web", "admin", "ai"].includes(d.source) ? (d.source as Booking["source"]) : null,
      channel: typeof d.channel === "string" && VALID_CHANNELS.includes(d.channel as (typeof VALID_CHANNELS)[number]) ? (d.channel as Booking["channel"]) : null,
      doctor: d.doctor ?? null,
      doctor_id: d.doctor_id ?? null,
      chatUserId: d.chat_user_id ?? null,
      bookingCreationMode: d.booking_creation_mode ?? null,
      requiresCustomerNotification: d.requires_customer_notification ?? undefined,
      notificationStatus: d.notification_status ?? undefined,
      notificationAttemptCount: typeof d.notification_attempt_count === "number" ? d.notification_attempt_count : undefined,
      lastNotificationError: d.last_notification_error ?? undefined,
      branchId: d.branchId,
      branchName: d.branchName,
      scheduledAt: toISO(d.scheduledAt),
      status: (d.status as Booking["status"]) ?? "pending",
      notes: d.notes ?? null,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
    };
  });
  return result;
}

/** Enterprise: ค้นหา booking ล่าสุดของ chat user สำหรับ reschedule/cancel */
export async function getLatestReschedulableBooking(
  orgId: string,
  chatUserId: string
): Promise<Booking | null> {
  const snapshot = await db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("chat_user_id", "==", chatUserId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const RESCHEDULABLE = ["pending_admin_confirm", "confirmed", "pending"];
  const doc = snapshot.docs.find((d) => RESCHEDULABLE.includes(d.data().status));
  if (!doc) return null;
  const d = doc.data();
  return {
    id: doc.id,
    org_id: d.org_id ?? orgId,
    branch_id: d.branch_id,
    customerName: d.customerName ?? "",
    customerId: d.customerId,
    phoneNumber: d.phoneNumber ?? null,
    service: d.service ?? "",
    procedure: d.procedure ?? null,
    amount: typeof d.amount === "number" ? d.amount : null,
    source: typeof d.source === "string" && ["line", "web", "admin", "ai"].includes(d.source) ? (d.source as Booking["source"]) : null,
    channel: typeof d.channel === "string" && VALID_CHANNELS.includes(d.channel as (typeof VALID_CHANNELS)[number]) ? (d.channel as Booking["channel"]) : null,
    doctor: d.doctor ?? null,
    chatUserId: d.chat_user_id ?? null,
    bookingCreationMode: d.booking_creation_mode ?? null,
    requiresCustomerNotification: d.requires_customer_notification ?? undefined,
    notificationStatus: d.notification_status ?? undefined,
    notificationAttemptCount: typeof d.notification_attempt_count === "number" ? d.notification_attempt_count : undefined,
    lastNotificationError: d.last_notification_error ?? undefined,
    branchId: d.branchId,
    branchName: d.branchName,
    scheduledAt: toISO(d.scheduledAt),
    status: (d.status as Booking["status"]) ?? "pending",
    notes: d.notes ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

/** Enterprise: คิวการจอง — เรียงตามเวลา มีเลขคิว แยกตามแพทย์ (ถ้ามี) */
export interface BookingWithQueue extends Booking {
  queueNumber: number;
  doctorGroup?: string;
}

export async function getBookingsQueue(
  orgId: string,
  dateStr: string,
  opts?: { branchId?: string; groupByDoctor?: boolean }
): Promise<BookingWithQueue[]> {
  const from = new Date(dateStr + "T00:00:00");
  const to = new Date(dateStr + "T23:59:59");
  const items = await getBookingsByDateRange(orgId, from, to, { branchId: opts?.branchId });
  const IN_QUEUE = ["pending", "confirmed", "pending_admin_confirm", "reschedule_pending_admin", "in_progress"];
  const filtered = items.filter((b) => IN_QUEUE.includes(b.status));
  filtered.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  if (opts?.groupByDoctor) {
    const byDoctor = new Map<string, Booking[]>();
    for (const b of filtered) {
      const key = b.doctor?.trim() || "(ไม่มีแพทย์)";
      if (!byDoctor.has(key)) byDoctor.set(key, []);
      byDoctor.get(key)!.push(b);
    }
    const doctorOrder = Array.from(byDoctor.keys()).sort();
    const result: BookingWithQueue[] = [];
    for (const doctor of doctorOrder) {
      const list = byDoctor.get(doctor)!;
      list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      list.forEach((b, i) => {
        result.push({
          ...b,
          queueNumber: i + 1,
          doctorGroup: doctor,
        });
      });
    }
    return result;
  }

  return filtered.map((b, i) => ({ ...b, queueNumber: i + 1 }));
}

/** Enterprise: Calendar view — วันที่มีการจอง + count ต่อวัน แยก active/completed */
export interface DateCalendarStats {
  active: number;
  completed: number;
}
/** doctorId: กรองตามแพทย์ — ใช้ doctor_id (FK) หรือ doctor string match */
export async function getBookingsForCalendar(
  orgId: string,
  year: number,
  month: number,
  opts?: { branchId?: string; channel?: string; doctorId?: string }
): Promise<{
  datesWithCount: Record<string, number>;
  datesWithStatus: Record<string, DateCalendarStats>;
  items: Booking[];
}> {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  const items = await getBookingsByDateRange(orgId, from, to, opts);
  const datesWithCount: Record<string, number> = {};
  const datesWithStatus: Record<string, DateCalendarStats> = {};
  const ACTIVE = ["pending", "confirmed", "in_progress", "pending_admin_confirm", "reschedule_pending_admin", "cancel_requested"];
  for (const b of items) {
    const d = b.scheduledAt.slice(0, 10);
    datesWithCount[d] = (datesWithCount[d] ?? 0) + 1;
    if (!datesWithStatus[d]) datesWithStatus[d] = { active: 0, completed: 0 };
    if (ACTIVE.includes(b.status)) datesWithStatus[d].active += 1;
    else if (b.status === "completed") datesWithStatus[d].completed += 1;
  }
  return { datesWithCount, datesWithStatus, items };
}

/** Enterprise: resolve doctor string → doctor_id จาก doctor_schedules (FK mapping) */
export async function resolveDoctorId(
  orgId: string,
  doctorInput: string | null | undefined
): Promise<string | null> {
  if (!doctorInput?.trim()) return null;
  const input = doctorInput.trim().toLowerCase();
  const doctors = await listDoctorSchedules(orgId);
  const found = doctors.find(
    (d) =>
      (d.doctor_id?.toLowerCase() === input) ||
      (d.doctor_name?.toLowerCase() === input) ||
      (d.doctor_id?.toLowerCase().includes(input) || input.includes(d.doctor_id?.toLowerCase() ?? "")) ||
      (d.doctor_name?.toLowerCase().includes(input) || input.includes(d.doctor_name?.toLowerCase() ?? ""))
  );
  return found?.doctor_id ?? null;
}

// ─── Create booking ───────────────────────────────────────────────────────
export async function createBooking(orgId: string, data: BookingCreate): Promise<string> {
  const Firestore = await import("firebase-admin/firestore");
  const now = Firestore.Timestamp.now();
  const doctorInput = data.doctor_id ?? data.doctor;
  const doctorIdResolved = doctorInput ? await resolveDoctorId(orgId, doctorInput) : null;
  const ref = await db.collection(COLLECTIONS.bookings).add({
    org_id: orgId,
    branch_id: data.branch_id ?? data.branchId ?? null,
    customerName: data.customerName,
    customerId: data.customerId ?? null,
    phoneNumber: data.phoneNumber ?? null,
    service: data.service,
    procedure: data.procedure ?? null,
    amount: data.amount ?? null,
    source: data.source ?? "admin",
    channel: data.channel ?? null,
    doctor: data.doctor ?? null,
    doctor_id: doctorIdResolved ?? null,
    chat_user_id: data.chatUserId ?? null,
    booking_creation_mode: data.bookingCreationMode ?? null,
    branchId: data.branchId ?? null,
    branchName: data.branchName ?? null,
    scheduledAt: Firestore.Timestamp.fromDate(new Date(data.scheduledAt)),
    status: data.status ?? (data.source === "ai" ? "pending_admin_confirm" : "pending"),
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

/** World-class: Atomic booking — Firestore transaction ป้องกัน race สุดท้าย */
export async function createBookingAtomic(
  orgId: string,
  data: BookingCreate,
  opts?: { durationMinutes?: number }
): Promise<{ id: string } | { error: "SLOT_TAKEN" }> {
  const Firestore = await import("firebase-admin/firestore");
  const { slotOverlapsBooking } = await import("@/lib/slot-engine");
  const durationMinutes = opts?.durationMinutes ?? 30;

  const scheduledDate = new Date(data.scheduledAt);
  const from = new Date(scheduledDate);
  from.setMinutes(from.getMinutes() - durationMinutes);
  const to = new Date(scheduledDate);
  to.setMinutes(to.getMinutes() + durationMinutes * 2);

  const slotStart = data.scheduledAt;
  const slotEndDate = new Date(scheduledDate.getTime() + durationMinutes * 60 * 1000);
  const slotEnd = `${slotEndDate.getFullYear()}-${String(slotEndDate.getMonth() + 1).padStart(2, "0")}-${String(slotEndDate.getDate()).padStart(2, "0")}T${String(slotEndDate.getHours()).padStart(2, "0")}:${String(slotEndDate.getMinutes()).padStart(2, "0")}:${String(slotEndDate.getSeconds()).padStart(2, "0")}`;

  const doctorInput = data.doctor_id ?? data.doctor;
  const doctorIdResolved = doctorInput ? await resolveDoctorId(orgId, doctorInput) : null;

  const result = await db.runTransaction(async (tx) => {
    const q = db
      .collection(COLLECTIONS.bookings)
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(from))
      .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(to))
      .limit(100);
    const branchId = data.branch_id ?? data.branchId;
    const q2 = branchId ? q.where("branch_id", "==", branchId) : q;
    const snap = await tx.get(q2 as FirebaseFirestore.Query);

    const OCCUPIED = ["confirmed", "pending", "in_progress", "pending_admin_confirm", "reschedule_pending_admin"];
    const overlapping = snap.docs.filter((doc) => {
      const d = doc.data();
      if (!OCCUPIED.includes(d.status ?? "")) return false;
      if (branchId && d.branch_id !== branchId) return false;
      const bookAt = "toDate" in d.scheduledAt ? d.scheduledAt.toDate().toISOString() : String(d.scheduledAt);
      return slotOverlapsBooking(slotStart, slotEnd, bookAt, durationMinutes);
    });

    if (overlapping.length > 0) {
      throw new Error("SLOT_TAKEN");
    }

    const now = Firestore.Timestamp.now();
    const newRef = db.collection(COLLECTIONS.bookings).doc();
    tx.set(newRef, {
      org_id: orgId,
      branch_id: data.branch_id ?? data.branchId ?? null,
      customerName: data.customerName,
      customerId: data.customerId ?? null,
      phoneNumber: data.phoneNumber ?? null,
      service: data.service,
      procedure: data.procedure ?? null,
      amount: data.amount ?? null,
      source: data.source ?? "admin",
      channel: data.channel ?? null,
      doctor: data.doctor ?? null,
      doctor_id: doctorIdResolved ?? null,
      chat_user_id: data.chatUserId ?? null,
      booking_creation_mode: data.bookingCreationMode ?? null,
      branchId: data.branchId ?? null,
      branchName: data.branchName ?? null,
      scheduledAt: Firestore.Timestamp.fromDate(new Date(data.scheduledAt)),
      status: data.status ?? (data.source === "ai" ? "pending_admin_confirm" : "pending"),
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return newRef.id;
  }).catch((err) => {
    if (err?.message === "SLOT_TAKEN") return null;
    throw err;
  });

  if (result === null) return { error: "SLOT_TAKEN" };
  return { id: result };
}

// ─── Get booking by id ───────────────────────────────────────────────────
export async function getBookingById(orgId: string, bookingId: string): Promise<Booking | null> {
  const doc = await db.collection(COLLECTIONS.bookings).doc(bookingId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  if (d.org_id !== orgId) return null;
  return {
    id: doc.id,
    org_id: d.org_id ?? orgId,
    branch_id: d.branch_id,
    customerName: d.customerName ?? "",
    customerId: d.customerId,
    phoneNumber: d.phoneNumber ?? null,
    service: d.service ?? "",
    procedure: d.procedure ?? null,
    amount: typeof d.amount === "number" ? d.amount : null,
    source: typeof d.source === "string" && ["line", "web", "admin", "ai"].includes(d.source) ? (d.source as Booking["source"]) : null,
    channel: typeof d.channel === "string" && VALID_CHANNELS.includes(d.channel as (typeof VALID_CHANNELS)[number]) ? (d.channel as Booking["channel"]) : null,
    doctor: d.doctor ?? null,
    doctor_id: d.doctor_id ?? null,
    chatUserId: d.chat_user_id ?? null,
    bookingCreationMode: d.booking_creation_mode ?? null,
    requiresCustomerNotification: d.requires_customer_notification ?? undefined,
    notificationStatus: d.notification_status ?? undefined,
    notificationAttemptCount: typeof d.notification_attempt_count === "number" ? d.notification_attempt_count : undefined,
    lastNotificationError: d.last_notification_error ?? undefined,
    branchId: d.branchId,
    branchName: d.branchName,
    scheduledAt: toISO(d.scheduledAt),
    status: (d.status as Booking["status"]) ?? "pending",
    notes: d.notes ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

// ─── Update booking (PATCH) ─────────────────────────────────────────────
export async function updateBooking(
  orgId: string,
  bookingId: string,
  updates: Partial<
    Pick<
      Booking,
      | "customerName"
      | "phoneNumber"
      | "service"
      | "procedure"
      | "amount"
      | "channel"
      | "doctor"
      | "doctor_id"
      | "scheduledAt"
      | "status"
      | "notes"
      | "requiresCustomerNotification"
      | "notificationStatus"
      | "notificationAttemptCount"
      | "lastNotificationError"
    >
  >
): Promise<boolean> {
  const Firestore = await import("firebase-admin/firestore");
  const ref = db.collection(COLLECTIONS.bookings).doc(bookingId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return false;
  const data: Record<string, unknown> = { updatedAt: Firestore.Timestamp.now() };
  if (updates.customerName !== undefined) data.customerName = updates.customerName;
  if (updates.phoneNumber !== undefined) data.phoneNumber = updates.phoneNumber;
  if (updates.service !== undefined) data.service = updates.service;
  if (updates.doctor !== undefined) {
    data.doctor = updates.doctor;
    const resolved = updates.doctor ? await resolveDoctorId(orgId, updates.doctor) : null;
    data.doctor_id = resolved ?? null;
  }
  if (updates.doctor_id !== undefined) data.doctor_id = updates.doctor_id;
  if (updates.procedure !== undefined) data.procedure = updates.procedure;
  if (updates.amount !== undefined) data.amount = updates.amount;
  if (updates.channel !== undefined) data.channel = updates.channel;
  if (updates.scheduledAt !== undefined) data.scheduledAt = Firestore.Timestamp.fromDate(new Date(updates.scheduledAt));
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.requiresCustomerNotification !== undefined) data.requires_customer_notification = updates.requiresCustomerNotification;
  if (updates.notificationStatus !== undefined) data.notification_status = updates.notificationStatus;
  if (updates.notificationAttemptCount !== undefined) data.notification_attempt_count = updates.notificationAttemptCount;
  if (updates.lastNotificationError !== undefined) data.last_notification_error = updates.lastNotificationError;
  await ref.update(data);
  return true;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────
export async function getDashboardStats(orgId: string, branchId?: string): Promise<DashboardStats> {
  const t0 = Date.now();
  try {
    const Firestore = await import("firebase-admin/firestore");
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const tomorrowStart = startOfDay(new Date(now.getTime() + 86400000));
    const tomorrowEnd = endOfDay(new Date(now.getTime() + 86400000));
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const lastMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const qChatsToday = db
    .collection(COLLECTIONS.conversation_feedback)
    .where("org_id", "==", orgId)
    .where("createdAt", ">=", Firestore.Timestamp.fromDate(todayStart))
    .where("createdAt", "<=", Firestore.Timestamp.fromDate(todayEnd))
    .limit(500);

  const [
    bookingsTodaySnap,
    bookingsTomorrowSnap,
    customersSnap,
    revenueThisMonth,
    revenueLastMonth,
    chatsTodaySnap,
  ] = await Promise.all([
    db
      .collection(COLLECTIONS.bookings)
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(todayStart))
      .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(todayEnd))
      .orderBy("scheduledAt", "asc")
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.bookings)
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(tomorrowStart))
      .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(tomorrowEnd))
      .orderBy("scheduledAt", "asc")
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.customers)
      .where("org_id", "==", orgId)
      .where("createdAt", ">=", Firestore.Timestamp.fromDate(todayStart))
      .orderBy("createdAt", "asc")
      .limit(500)
      .get(),
    getRevenueFromPaidInvoices(orgId, {
      branchId: branchId ?? null,
      from: thisMonthStart,
      to: thisMonthEnd,
    }),
    getRevenueFromPaidInvoices(orgId, {
      branchId: branchId ?? null,
      from: lastMonthStart,
      to: lastMonthEnd,
    }),
    qChatsToday.get(),
  ]);

    return {
      chatsToday: chatsTodaySnap.size,
      newCustomers: customersSnap.size,
      bookingsToday: bookingsTodaySnap.size,
      bookingsTomorrow: bookingsTomorrowSnap.size,
      revenueThisMonth,
      revenueLastMonth,
    };
  } finally {
    recordDashboardLatency(Date.now() - t0);
  }
}

// ─── Dashboard: bookings grouped by date ──────────────────────────────────
export async function getDashboardBookingsByDate(
  orgId: string,
  branchId?: string
): Promise<DashboardBookingsByDate[]> {
  const now = new Date();
  const day0 = startOfDay(now);
  const day0End = endOfDay(now);
  const day1 = startOfDay(new Date(now.getTime() + 86400000));
  const day1End = endOfDay(new Date(now.getTime() + 86400000));
  const day2 = startOfDay(new Date(now.getTime() + 86400000 * 2));
  const day2End = endOfDay(new Date(now.getTime() + 86400000 * 2));

  const Firestore = await import("firebase-admin/firestore");

  const run = async (from: Date, to: Date) => {
    let q = db
      .collection(COLLECTIONS.bookings)
      .where("org_id", "==", orgId)
      .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(from))
      .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(to))
      .orderBy("scheduledAt", "asc")
      .limit(30);
    if (branchId) q = q.where("branch_id", "==", branchId) as typeof q;
    const snapshot = await q.get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      const at = new Date(toISO(d.scheduledAt));
      return {
        id: doc.id,
        customer: d.customerName ?? "",
        service: d.service ?? "",
        time: at.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        status: d.status ?? "pending",
      };
    });
  };

  const [items0, items1, items2] = await Promise.all([
    run(day0, day0End),
    run(day1, day1End),
    run(day2, day2End),
  ]);

  return [
    { dateLabel: "วันนี้", date: "today", total: items0.length, items: items0 },
    { dateLabel: "พรุ่งนี้", date: "tomorrow", total: items1.length, items: items1 },
    { dateLabel: "มะรืน", date: "day-after", total: items2.length, items: items2 },
  ];
}

const DAY_LABELS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export async function getDashboardChartData(
  orgId: string,
  branchId?: string
): Promise<{
  revenueByDay: Array<{ day: string; revenue: number }>;
  activityByDay: Array<{ day: string; chats: number; bookings: number }>;
}> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  let qBook = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy("scheduledAt", "asc")
    .limit(500);
  const qChats = db
    .collection(COLLECTIONS.conversation_feedback)
    .where("org_id", "==", orgId)
    .where("createdAt", ">=", Firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy("createdAt", "asc")
    .limit(500);
  if (branchId) {
    qBook = qBook.where("branch_id", "==", branchId) as typeof qBook;
  }

  const [revenueByDay, bookingsSnap, chatsSnap] = await Promise.all([
    getRevenueByDayFromPaidInvoices(orgId, { branchId: branchId ?? null }),
    qBook.get(),
    qChats.get(),
  ]);

  const bookingsByDayMap = new Map<string, number>();
  const chatsByDayMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    bookingsByDayMap.set(key, 0);
    chatsByDayMap.set(key, 0);
  }
  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const scheduledAt = toISO(d.scheduledAt).slice(0, 10);
    if (bookingsByDayMap.has(scheduledAt))
      bookingsByDayMap.set(scheduledAt, bookingsByDayMap.get(scheduledAt)! + 1);
  });
  chatsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const createdAt = toISO(d.createdAt).slice(0, 10);
    if (chatsByDayMap.has(createdAt))
      chatsByDayMap.set(createdAt, chatsByDayMap.get(createdAt)! + 1);
  });

  const activityByDay = Array.from(bookingsByDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, bookings]) => ({
      day: DAY_LABELS[new Date(dateStr).getUTCDay()],
      chats: chatsByDayMap.get(dateStr) ?? 0,
      bookings,
    }));

  return { revenueByDay, activityByDay };
}

// ─── Customers ────────────────────────────────────────────────────────────

/** LINE: สร้าง/อัปเดต customer เมื่อมีคนแชท — ดึง displayName + pictureUrl จริงจาก LINE */
export async function upsertLineCustomer(
  orgId: string,
  lineUserId: string,
  opts?: { branchId?: string | null }
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const { getLineUserProfile } = await import("@/lib/line-api");
  const { getLineChannelByOrgId } = await import("@/lib/line-channel-data");

  const safeId = lineUserId.replace(/[/\\]/g, "_");
  const docId = `line_${orgId}_${safeId}`;
  const now = FieldValue.serverTimestamp();
  const docRef = db.collection(COLLECTIONS.customers).doc(docId);
  const doc = await docRef.get();

  let displayName = "ลูกค้า LINE";
  let pictureUrl: string | null = null;
  let accessToken: string | null = null;
  const channel = await getLineChannelByOrgId(orgId);
  if (channel?.channel_access_token) {
    accessToken = channel.channel_access_token;
  } else if (process.env.LINE_ORG_ID === orgId && process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim()) {
    accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN.trim();
  }
  if (accessToken) {
    const profile = await getLineUserProfile(accessToken, lineUserId);
    if (profile?.displayName) displayName = profile.displayName;
    if (profile?.pictureUrl) pictureUrl = profile.pictureUrl;
  }

  const payload = {
    org_id: orgId,
    branch_id: opts?.branchId ?? null,
    name: displayName,
    source: "line",
    externalId: lineUserId,
    pictureUrl: pictureUrl ?? null,
    status: "active",
    lastChatAt: now,
    aiResponded: true,
    updatedAt: now,
  };

  if (doc.exists) {
    await docRef.update(payload);
  } else {
    await docRef.set({
      ...payload,
      createdAt: now,
    });
  }
  return docId;
}

export async function getCustomers(
  orgId: string,
  opts: {
    branchId?: string;
    limit?: number;
    startAfterId?: string;
    includeDeleted?: boolean;
    /** Filter by channel: line, facebook, instagram, tiktok, web. Omit for all. */
    source?: import("@/types/clinic").CustomerSource;
  } = {}
): Promise<{ items: Customer[]; lastId: string | null }> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  let q = db
    .collection(COLLECTIONS.customers)
    .where("org_id", "==", orgId)
    .orderBy("createdAt", "desc")
    .limit((opts.includeDeleted ? 1 : 2) * limit + 5);
  if (opts.branchId) q = q.where("branch_id", "==", opts.branchId) as typeof q;
  if (opts.source) q = q.where("source", "==", opts.source) as typeof q;
  if (opts.startAfterId) {
    const afterDoc = await db.collection(COLLECTIONS.customers).doc(opts.startAfterId).get();
    if (afterDoc.exists) q = q.startAfter(afterDoc);
  }

  const snapshot = await q.get();
  const mapDoc = (doc: { id: string; data: () => Record<string, unknown> }): Customer => {
    const d = doc.data()!;
    return {
      id: doc.id,
      org_id: (typeof d.org_id === "string" ? d.org_id : orgId) as string,
      branch_id: typeof d.branch_id === "string" ? d.branch_id : undefined,
      name: (d.name ?? "") as string,
      source: (d.source ?? "line") as Customer["source"],
      externalId: d.externalId as string | undefined,
      pictureUrl: (typeof d.pictureUrl === "string" ? d.pictureUrl : null) as string | null,
      status: (d.status ?? "active") as Customer["status"],
      lastChatAt: d.lastChatAt ? toISO(d.lastChatAt) : undefined,
      aiResponded: d.aiResponded as boolean | undefined,
      deleted_at: d.deleted_at ? toISO(d.deleted_at) : null,
      createdAt: (() => {
        const norm = normalizeDateInput(d.createdAt);
        return norm ? toISO(norm) : "";
      })(),
      updatedAt: (() => {
        const norm = normalizeDateInput(d.updatedAt);
        return norm ? toISO(norm) : "";
      })(),
    };
  };
  let items = snapshot.docs.map(mapDoc);
  if (!opts.includeDeleted) {
    items = items.filter((c) => !c.deleted_at);
  }
  const sliced = items.slice(0, limit);
  const lastId = items.length > limit ? sliced[limit - 1]?.id ?? null : null;
  return { items: sliced, lastId };
}

export async function getCustomerById(
  orgId: string,
  customerId: string,
  opts?: { includeDeleted?: boolean }
): Promise<Customer | null> {
  const doc = await db.collection(COLLECTIONS.customers).doc(customerId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  if (d.org_id !== orgId) return null;
  const deletedAt = d.deleted_at ? toISO(d.deleted_at) : null;
  if (deletedAt && !opts?.includeDeleted) return null;
  return {
    id: doc.id,
    org_id: d.org_id ?? orgId,
    branch_id: d.branch_id,
    name: d.name ?? "",
    source: (d.source as Customer["source"]) ?? "line",
    externalId: d.externalId,
    pictureUrl: d.pictureUrl ?? null,
    status: (d.status as Customer["status"]) ?? "active",
    lastChatAt: d.lastChatAt ? toISO(d.lastChatAt) : undefined,
    aiResponded: d.aiResponded,
    deleted_at: deletedAt,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

/** Enterprise: Soft delete Customer — เก็บไว้สำหรับ recovery */
export async function softDeleteCustomer(orgId: string, customerId: string): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const docRef = db.collection(COLLECTIONS.customers).doc(customerId);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  if (d.org_id !== orgId) return false;
  await docRef.update({
    deleted_at: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

/** Enterprise: Restore soft-deleted Customer */
export async function restoreCustomer(orgId: string, customerId: string): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const docRef = db.collection(COLLECTIONS.customers).doc(customerId);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  if (d.org_id !== orgId) return false;
  await docRef.update({
    deleted_at: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

// ─── Transactions ─────────────────────────────────────────────────────────
export async function getTransactions(
  orgId: string,
  opts: { branchId?: string; limit?: number; startAfterId?: string } = {}
): Promise<{ items: Transaction[]; lastId: string | null }> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  let q = db
    .collection(COLLECTIONS.transactions)
    .where("org_id", "==", orgId)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);
  if (opts.branchId) q = q.where("branch_id", "==", opts.branchId) as typeof q;
  if (opts.startAfterId) {
    const afterDoc = await db.collection(COLLECTIONS.transactions).doc(opts.startAfterId).get();
    if (afterDoc.exists) q = q.startAfter(afterDoc);
  }

  const snapshot = await q.get();
  const items: Transaction[] = snapshot.docs.slice(0, limit).map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? orgId,
      branch_id: d.branch_id,
      amount: satangToBaht(toSatang(d.amount)),
      type: d.type ?? "booking",
      bookingId: d.bookingId,
      serviceName: d.serviceName,
      branchId: d.branchId,
      createdAt: toISO(d.createdAt),
    };
  });
  const lastId = snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null;
  return { items, lastId };
}

// ─── Dashboard extras (promotions, pending, feedback, WoW) ─────────────────
export async function getActivePromotionsCount(orgId: string, branchId?: string): Promise<number> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  let q = db
    .collection(COLLECTIONS.promotions)
    .where("org_id", "==", orgId)
    .where("status", "==", "active")
    .limit(200);
  const snapshot = await q.get();
  const nowMs = now.getTime();
  return snapshot.docs.filter((doc) => {
    const d = doc.data();
    const branchIds = (d.branchIds ?? (d.branch_id ? [d.branch_id] : [])) as string[];
    if (branchId && branchIds.length > 0 && !branchIds.includes(branchId)) return false;
    const startAt = d.startAt?.toDate?.() ?? (d.startAt ? new Date(toISO(d.startAt)) : null);
    const endAt = d.endAt?.toDate?.() ?? (d.endAt ? new Date(toISO(d.endAt)) : null);
    if (startAt && startAt.getTime() > nowMs) return false;
    if (endAt && endAt.getTime() < nowMs) return false;
    return true;
  }).length;
}

export async function getPendingBookingsCount(orgId: string, branchId?: string): Promise<number> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const day0 = startOfDay(now);
  const day2End = endOfDay(new Date(now.getTime() + 86400000 * 2));
  let q = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("status", "==", "pending")
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(day0))
    .where("scheduledAt", "<=", Firestore.Timestamp.fromDate(day2End))
    .limit(100);
  if (branchId) q = q.where("branch_id", "==", branchId) as typeof q;
  const snapshot = await q.get();
  return snapshot.size;
}

export async function getUnlabeledFeedbackCount(orgId: string): Promise<number> {
  const q = db
    .collection(COLLECTIONS.conversation_feedback)
    .where("org_id", "==", orgId)
    .where("adminLabel", "==", null)
    .limit(500);
  const snapshot = await q.get();
  return snapshot.size;
}

export async function getChatsWoW(orgId: string): Promise<{ thisWeek: number; lastWeek: number }> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  const lastWeekStart = new Date(now.getTime() - 14 * 86400000);
  lastWeekStart.setUTCHours(0, 0, 0, 0);
  const [thisSnap, lastSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.conversation_feedback)
      .where("org_id", "==", orgId)
      .where("createdAt", ">=", Firestore.Timestamp.fromDate(thisWeekStart))
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.conversation_feedback)
      .where("org_id", "==", orgId)
      .where("createdAt", ">=", Firestore.Timestamp.fromDate(lastWeekStart))
      .where("createdAt", "<", Firestore.Timestamp.fromDate(thisWeekStart))
      .limit(500)
      .get(),
  ]);
  return { thisWeek: thisSnap.size, lastWeek: lastSnap.size };
}

export async function getBookingsWoW(
  orgId: string,
  branchId?: string
): Promise<{ thisWeek: number; lastWeek: number }> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000);
  thisWeekStart.setUTCHours(0, 0, 0, 0);
  const lastWeekStart = new Date(now.getTime() - 14 * 86400000);
  lastWeekStart.setUTCHours(0, 0, 0, 0);
  let qThis = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(thisWeekStart))
    .limit(500);
  let qLast = db
    .collection(COLLECTIONS.bookings)
    .where("org_id", "==", orgId)
    .where("scheduledAt", ">=", Firestore.Timestamp.fromDate(lastWeekStart))
    .where("scheduledAt", "<", Firestore.Timestamp.fromDate(thisWeekStart))
    .limit(500);
  if (branchId) {
    qThis = qThis.where("branch_id", "==", branchId) as typeof qThis;
    qLast = qLast.where("branch_id", "==", branchId) as typeof qLast;
  }
  const [thisSnap, lastSnap] = await Promise.all([qThis.get(), qLast.get()]);
  return { thisWeek: thisSnap.size, lastWeek: lastSnap.size };
}

/** Map Firestore doc to Promotion (supports legacy branch_id and new branchIds) */
function mapPromotionDoc(doc: DocumentSnapshot<DocumentData>, orgId: string): Promotion {
  const d = doc.data() ?? {};
  const branchIds = Array.isArray(d.branchIds)
    ? d.branchIds
    : d.branch_id
      ? [d.branch_id]
      : [];
  const media = (Array.isArray(d.media) ? d.media : []).map((m: { type?: string; url?: string; thumbnail?: string }) => ({
    type: (m.type === "video" ? "video" : "image") as "image" | "video",
    url: m.url ?? "",
    thumbnail: m.thumbnail,
  }));
  return {
    id: doc.id,
    org_id: (d.org_id as string) ?? orgId,
    branchIds,
    name: (d.name as string) ?? "",
    description: d.description as string | undefined,
    targetGroup: (d.targetGroup as PromotionTargetGroup) ?? "all",
    status: (d.status as PromotionStatus) ?? "draft",
    startAt: d.startAt ? toISO(d.startAt) : undefined,
    endAt: d.endAt ? toISO(d.endAt) : undefined,
    autoArchiveAt: d.autoArchiveAt ? toISO(d.autoArchiveAt) : undefined,
    media,
    couponCode: d.couponCode as string | undefined,
    stackable: Boolean(d.stackable),
    maxUsage: typeof d.maxUsage === "number" ? d.maxUsage : undefined,
    currentUsage: typeof d.currentUsage === "number" ? d.currentUsage : undefined,
    minimumSpend: typeof d.minimumSpend === "number" ? d.minimumSpend : undefined,
    aiSummary: d.aiSummary as string | undefined,
    aiTags: Array.isArray(d.aiTags) ? d.aiTags : undefined,
    visibleToAI: d.visibleToAI !== false,
    promotionEmbedding: Array.isArray(d.promotionEmbedding) ? d.promotionEmbedding : undefined,
    extractedProcedures: Array.isArray(d.extractedProcedures) ? d.extractedProcedures : undefined,
    extractedKeywords: Array.isArray(d.extractedKeywords) ? d.extractedKeywords : undefined,
    extractedBenefits: Array.isArray(d.extractedBenefits) ? d.extractedBenefits : undefined,
    extractedPrice: typeof d.extractedPrice === "number" ? d.extractedPrice : undefined,
    extractedDiscount: typeof d.extractedDiscount === "number" ? d.extractedDiscount : undefined,
    urgencyScore: typeof d.urgencyScore === "number" ? d.urgencyScore : undefined,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

export async function getPromotionsExpiringSoon(
  orgId: string,
  branchId: string | undefined,
  withinDays: number = 7
): Promise<Promotion[]> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const deadline = new Date(now.getTime() + withinDays * 86400000);
  let q = db
    .collection(COLLECTIONS.promotions)
    .where("org_id", "==", orgId)
    .where("status", "==", "active")
    .where("endAt", ">=", Firestore.Timestamp.fromDate(now))
    .where("endAt", "<=", Firestore.Timestamp.fromDate(deadline))
    .orderBy("endAt", "asc")
    .limit(20);
  const snapshot = await q.get();
  return snapshot.docs
    .map((doc) => mapPromotionDoc(doc, orgId))
    .filter((p) => !branchId || p.branchIds.length === 0 || p.branchIds.includes(branchId));
}

/** Promotion intelligence overview: active, expiring soon (<3d), scheduled, expired */
export async function getPromotionStats(
  orgId: string,
  branchId?: string
): Promise<{ active: number; expiringSoon: number; scheduled: number; expired: number }> {
  const Firestore = await import("firebase-admin/firestore");
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 86400000);

  const [activeSnap, scheduledSnap, expiredSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.promotions)
      .where("org_id", "==", orgId)
      .where("status", "==", "active")
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.promotions)
      .where("org_id", "==", orgId)
      .where("status", "==", "scheduled")
      .limit(500)
      .get(),
    db
      .collection(COLLECTIONS.promotions)
      .where("org_id", "==", orgId)
      .where("status", "==", "expired")
      .limit(500)
      .get(),
  ]);

  const filterBranch = (d: DocumentData) => {
    if (!branchId) return true;
    const ids = (d.branchIds ?? (d.branch_id ? [d.branch_id] : [])) as string[];
    return ids.length === 0 || ids.includes(branchId);
  };

  let active = 0;
  let expiringSoon = 0;
  activeSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (!filterBranch(d)) return;
    const endAt = d.endAt?.toDate?.() ?? (d.endAt ? new Date(toISO(d.endAt)) : null);
    const startAt = d.startAt?.toDate?.() ?? (d.startAt ? new Date(toISO(d.startAt)) : null);
    if (startAt && startAt.getTime() > now.getTime()) return;
    if (endAt && endAt.getTime() < now.getTime()) return;
    active++;
    if (endAt && endAt.getTime() <= in3Days.getTime()) expiringSoon++;
  });

  const scheduled = branchId
    ? scheduledSnap.docs.filter((doc) => filterBranch(doc.data())).length
    : scheduledSnap.size;
  const expired = branchId
    ? expiredSnap.docs.filter((doc) => filterBranch(doc.data())).length
    : expiredSnap.size;

  return { active, expiringSoon, scheduled, expired };
}

export async function getPromotionById(orgId: string, promotionId: string): Promise<Promotion | null> {
  const ref = db.collection(COLLECTIONS.promotions).doc(promotionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return null;
  return mapPromotionDoc(doc, orgId);
}

// ─── Promotions ───────────────────────────────────────────────────────────
export async function getPromotions(
  orgId: string,
  opts: { branchId?: string; status?: PromotionStatus | "all"; targetGroup?: PromotionTargetGroup | "all"; limit?: number } = {}
): Promise<Promotion[]> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  let q = db
    .collection(COLLECTIONS.promotions)
    .where("org_id", "==", orgId)
    .orderBy("status", "asc")
    .orderBy("endAt", "asc")
    .limit(limit * 3);
  const snapshot = await q.get();

  let list = snapshot.docs.map((doc) => mapPromotionDoc(doc, orgId));
  if (opts.branchId) list = list.filter((p) => p.branchIds.length === 0 || p.branchIds.includes(opts.branchId!));
  if (opts.status && opts.status !== "all") list = list.filter((p) => p.status === opts.status);
  if (opts.targetGroup && opts.targetGroup !== "all") list = list.filter((p) => p.targetGroup === opts.targetGroup);
  return list.slice(0, limit);
}

/** Enterprise: active promotions for AI — status=active, visibleToAI, filter by branch + targetGroup. No manual agent. */
export async function getActivePromotionsForAI(
  orgId: string,
  opts: { branchId?: string | null; isNewCustomer?: boolean; limit?: number } = {}
): Promise<Promotion[]> {
  const limit = Math.min(opts.limit ?? 15, 30);
  const snapshot = await db
    .collection(COLLECTIONS.promotions)
    .where("org_id", "==", orgId)
    .where("status", "==", "active")
    .limit(limit * 2)
    .get();

  const now = Date.now();
  let list = snapshot.docs.map((doc) => mapPromotionDoc(doc, orgId));
  list = list.filter((p) => p.visibleToAI !== false);
  if (opts.branchId) list = list.filter((p) => p.branchIds.length === 0 || p.branchIds.includes(opts.branchId!));
  if (opts.isNewCustomer === true) list = list.filter((p) => p.targetGroup === "new" || p.targetGroup === "all");
  else if (opts.isNewCustomer === false) list = list.filter((p) => p.targetGroup === "existing" || p.targetGroup === "all");
  list = list.filter((p) => {
    if (p.startAt && new Date(p.startAt).getTime() > now) return false;
    if (p.endAt && new Date(p.endAt).getTime() < now) return false;
    return true;
  });
  return list.slice(0, limit);
}

/** Enterprise: สร้างโปรโมชัน — full schema, invalidate AI cache */
export async function createPromotion(
  orgId: string,
  data: {
    name: string;
    description?: string;
    targetGroup?: PromotionTargetGroup;
    branchIds?: string[];
    status?: PromotionStatus;
    startAt?: string;
    endAt?: string;
    autoArchiveAt?: string;
    media?: PromotionMedia[];
    couponCode?: string;
    stackable?: boolean;
    maxUsage?: number;
    minimumSpend?: number;
    aiSummary?: string;
    aiTags?: string[];
    visibleToAI?: boolean;
    promotionEmbedding?: number[];
    extractedProcedures?: string[];
    extractedKeywords?: string[];
    extractedBenefits?: string[];
    extractedPrice?: number;
    extractedDiscount?: number;
    urgencyScore?: number;
  }
): Promise<string> {
  const Firestore = await import("firebase-admin/firestore");
  const now = Firestore.Timestamp.now();
  const status = data.status ?? "draft";
  const ref = await db.collection(COLLECTIONS.promotions).add({
    org_id: orgId,
    branchIds: data.branchIds ?? [],
    name: data.name,
    description: data.description ?? null,
    targetGroup: data.targetGroup ?? "all",
    status,
    startAt: data.startAt ? Firestore.Timestamp.fromDate(new Date(data.startAt)) : null,
    endAt: data.endAt ? Firestore.Timestamp.fromDate(new Date(data.endAt)) : null,
    autoArchiveAt: data.autoArchiveAt ? Firestore.Timestamp.fromDate(new Date(data.autoArchiveAt)) : null,
    media: data.media ?? [],
    couponCode: data.couponCode ?? null,
    stackable: data.stackable ?? false,
    maxUsage: data.maxUsage ?? null,
    currentUsage: 0,
    minimumSpend: data.minimumSpend ?? null,
    aiSummary: data.aiSummary ?? null,
    aiTags: data.aiTags ?? null,
    visibleToAI: data.visibleToAI !== false,
    promotionEmbedding: data.promotionEmbedding ?? null,
    extractedProcedures: data.extractedProcedures ?? null,
    extractedKeywords: data.extractedKeywords ?? null,
    extractedBenefits: data.extractedBenefits ?? null,
    extractedPrice: data.extractedPrice ?? null,
    extractedDiscount: data.extractedDiscount ?? null,
    urgencyScore: data.urgencyScore ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const { invalidateAICache } = await import("@/lib/ai/ai-feedback-loop");
  void invalidateAICache({ org_id: orgId, scope: "promo" });
  return ref.id;
}

/** Enterprise: อัปเดตโปรโมชัน — full partial, invalidate AI cache */
export async function updatePromotion(
  orgId: string,
  promotionId: string,
  updates: Partial<{
    name: string;
    description: string;
    targetGroup: PromotionTargetGroup;
    status: PromotionStatus;
    startAt: string;
    endAt: string;
    autoArchiveAt: string;
    media: PromotionMedia[];
    couponCode: string;
    stackable: boolean;
    maxUsage: number;
    minimumSpend: number;
    aiSummary: string;
    aiTags: string[];
    visibleToAI: boolean;
    promotionEmbedding: number[];
    extractedProcedures: string[];
    extractedKeywords: string[];
    extractedBenefits: string[];
    extractedPrice: number;
    extractedDiscount: number;
    urgencyScore: number;
  }>
): Promise<boolean> {
  const Firestore = await import("firebase-admin/firestore");
  const ref = db.collection(COLLECTIONS.promotions).doc(promotionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return false;
  const data: Record<string, unknown> = { updatedAt: Firestore.Timestamp.now() };
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.targetGroup !== undefined) data.targetGroup = updates.targetGroup;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.startAt !== undefined) data.startAt = updates.startAt ? Firestore.Timestamp.fromDate(new Date(updates.startAt)) : null;
  if (updates.endAt !== undefined) data.endAt = updates.endAt ? Firestore.Timestamp.fromDate(new Date(updates.endAt)) : null;
  if (updates.autoArchiveAt !== undefined) data.autoArchiveAt = updates.autoArchiveAt ? Firestore.Timestamp.fromDate(new Date(updates.autoArchiveAt)) : null;
  if (updates.media !== undefined) data.media = updates.media;
  if (updates.couponCode !== undefined) data.couponCode = updates.couponCode;
  if (updates.stackable !== undefined) data.stackable = updates.stackable;
  if (updates.maxUsage !== undefined) data.maxUsage = updates.maxUsage;
  if (updates.minimumSpend !== undefined) data.minimumSpend = updates.minimumSpend;
  if (updates.aiSummary !== undefined) data.aiSummary = updates.aiSummary;
  if (updates.aiTags !== undefined) data.aiTags = updates.aiTags;
  if (updates.visibleToAI !== undefined) data.visibleToAI = updates.visibleToAI;
  if (updates.promotionEmbedding !== undefined) data.promotionEmbedding = updates.promotionEmbedding;
  if (updates.extractedProcedures !== undefined) data.extractedProcedures = updates.extractedProcedures;
  if (updates.extractedKeywords !== undefined) data.extractedKeywords = updates.extractedKeywords;
  if (updates.extractedBenefits !== undefined) data.extractedBenefits = updates.extractedBenefits;
  if (updates.extractedPrice !== undefined) data.extractedPrice = updates.extractedPrice;
  if (updates.extractedDiscount !== undefined) data.extractedDiscount = updates.extractedDiscount;
  if (updates.urgencyScore !== undefined) data.urgencyScore = updates.urgencyScore;
  await ref.update(data);
  const { invalidateAICache } = await import("@/lib/ai/ai-feedback-loop");
  void invalidateAICache({ org_id: orgId, scope: "promo" });
  return true;
}

export async function archivePromotion(orgId: string, promotionId: string): Promise<boolean> {
  return updatePromotion(orgId, promotionId, { status: "archived" });
}

/** Enterprise: ลบโปรโมชัน — invalidate AI cache ทันที */
export async function deletePromotion(orgId: string, promotionId: string): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.promotions).doc(promotionId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return false;
  await ref.delete();
  const { invalidateAICache } = await import("@/lib/ai/ai-feedback-loop");
  void invalidateAICache({ org_id: orgId, scope: "promo" });
  return true;
}

// ─── E5.1–E5.2 Conversation Feedback (Golden Dataset) ───────────────────────
export async function createConversationFeedback(data: ConversationFeedbackCreate): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const col = db.collection(COLLECTIONS.conversation_feedback);
  const now = FieldValue.serverTimestamp();
  const doc = await col.add({
    org_id: data.org_id ?? null,
    branch_id: data.branch_id ?? null,
    user_id: data.user_id ?? null,
    userMessage: data.userMessage,
    botReply: data.botReply,
    intent: data.intent ?? null,
    service: data.service ?? null,
    area: data.area ?? null,
    source: data.source ?? "line",
    adminSentBy: data.adminSentBy ?? null,
    correlation_id: data.correlation_id ?? null,
    adminLabel: null,
    createdAt: now,
    updatedAt: now,
  });
  return doc.id;
}

export async function listConversationFeedback(
  orgId: string,
  opts: {
    branchId?: string;
    adminLabel?: FeedbackLabel;
    limit?: number;
    startAfterId?: string;
    unlabeledOnly?: boolean;
  } = {}
): Promise<{ items: ConversationFeedback[]; lastId: string | null }> {
  const limit = Math.min(opts.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  let q = db.collection(COLLECTIONS.conversation_feedback).where("org_id", "==", orgId);

  if (opts.unlabeledOnly) {
    q = q.where("adminLabel", "==", null) as typeof q;
  }
  q = q.orderBy("createdAt", "desc").limit(limit + 1) as typeof q;

  if (opts.startAfterId) {
    const afterDoc = await db.collection(COLLECTIONS.conversation_feedback).doc(opts.startAfterId).get();
    if (afterDoc.exists) q = q.startAfter(afterDoc) as typeof q;
  }

  const snapshot = await q.get();
  const items: ConversationFeedback[] = snapshot.docs.slice(0, limit).map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? null,
      branch_id: d.branch_id ?? null,
      user_id: d.user_id ?? null,
      userMessage: d.userMessage ?? "",
      botReply: d.botReply ?? "",
      intent: d.intent ?? null,
      service: d.service ?? null,
      area: d.area ?? null,
      source: d.source ?? "line",
      adminSentBy: d.adminSentBy ?? null,
      adminLabel: d.adminLabel ?? null,
      adminLabeledAt: d.adminLabeledAt ? toISO(d.adminLabeledAt) : null,
      adminLabeledBy: d.adminLabeledBy ?? null,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
      correlation_id: d.correlation_id ?? null,
    };
  });
  const lastId = snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null;
  return { items, lastId };
}

/** แชทของลูกค้าตาม user_id (LINE userId) — เรียงจากเก่าไปใหม่ */
export async function listConversationFeedbackByUserId(
  orgId: string,
  lineUserId: string,
  opts?: { limit?: number; startAfterId?: string }
): Promise<{ items: ConversationFeedback[]; lastId: string | null }> {
  const limit = Math.min(opts?.limit ?? 50, 100);
  let q = db
    .collection(COLLECTIONS.conversation_feedback)
    .where("org_id", "==", orgId)
    .where("user_id", "==", lineUserId)
    .orderBy("createdAt", "asc")
    .limit(limit + 1);

  if (opts?.startAfterId) {
    const afterDoc = await db.collection(COLLECTIONS.conversation_feedback).doc(opts.startAfterId).get();
    if (afterDoc.exists) q = q.startAfter(afterDoc) as typeof q;
  }

  const snapshot = await q.get();
  const items: ConversationFeedback[] = snapshot.docs.slice(0, limit).map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? null,
      branch_id: d.branch_id ?? null,
      user_id: d.user_id ?? null,
      userMessage: d.userMessage ?? "",
      botReply: d.botReply ?? "",
      intent: d.intent ?? null,
      service: d.service ?? null,
      area: d.area ?? null,
      source: d.source ?? "line",
      adminSentBy: d.adminSentBy ?? null,
      adminLabel: d.adminLabel ?? null,
      adminLabeledAt: d.adminLabeledAt ? toISO(d.adminLabeledAt) : null,
      adminLabeledBy: d.adminLabeledBy ?? null,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
    };
  });
  const lastId = snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null;
  return { items, lastId };
}

export async function updateFeedbackLabel(
  id: string,
  orgId: string,
  label: FeedbackLabel,
  adminUserId: string
): Promise<{ ok: boolean; userMessage?: string; botReply?: string; correlation_id?: string }> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const docRef = db.collection(COLLECTIONS.conversation_feedback).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return { ok: false };
  const d = doc.data()!;
  if (d.org_id !== orgId) return { ok: false };

  await docRef.update({
    adminLabel: label,
    adminLabeledAt: FieldValue.serverTimestamp(),
    adminLabeledBy: adminUserId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {
    ok: true,
    userMessage: d.userMessage,
    botReply: d.botReply,
    correlation_id: d.correlation_id ?? undefined,
  };
}

/** ดึง feedback เดียวตาม id — สำหรับ AI feedback loop */
export async function getConversationFeedbackById(
  id: string,
  orgId: string
): Promise<ConversationFeedback | null> {
  const doc = await db.collection(COLLECTIONS.conversation_feedback).doc(id).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  if (d.org_id !== orgId) return null;
  return {
    id: doc.id,
    org_id: d.org_id ?? null,
    branch_id: d.branch_id ?? null,
    user_id: d.user_id ?? null,
    userMessage: d.userMessage ?? "",
    botReply: d.botReply ?? "",
    intent: d.intent ?? null,
    service: d.service ?? null,
    area: d.area ?? null,
    source: d.source ?? "line",
    adminSentBy: d.adminSentBy ?? null,
    adminLabel: d.adminLabel ?? null,
    adminLabeledAt: d.adminLabeledAt ? toISO(d.adminLabeledAt) : null,
    adminLabeledBy: d.adminLabeledBy ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

// ─── E6.1–E6.4 Subscriptions & Branches ─────────────────────────────────────
export async function createSubscription(data: SubscriptionCreate): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const { PLAN_MAX_BRANCHES } = await import("@/types/subscription");
  const now = FieldValue.serverTimestamp();
  const maxBranches = data.max_branches ?? PLAN_MAX_BRANCHES[data.plan];
  const doc = await db.collection(COLLECTIONS.subscriptions).add({
    org_id: data.org_id,
    plan: data.plan,
    status: data.status ?? "active",
    max_branches: maxBranches,
    current_period_start: data.current_period_start,
    current_period_end: data.current_period_end,
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return doc.id;
}

export async function getSubscriptionByOrgId(orgId: string): Promise<Subscription | null> {
  const snap = await db
    .collection(COLLECTIONS.subscriptions)
    .where("org_id", "==", orgId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    org_id: d.org_id ?? orgId,
    plan: (d.plan as OrgPlan) ?? "starter",
    status: d.status ?? "active",
    max_branches: d.max_branches ?? 1,
    current_period_start: toISO(d.current_period_start),
    current_period_end: toISO(d.current_period_end),
    stripe_subscription_id: d.stripe_subscription_id ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

/** E7 — หา subscription จาก stripe_subscription_id (สำหรับ webhook) */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const snap = await db
    .collection(COLLECTIONS.subscriptions)
    .where("stripe_subscription_id", "==", stripeSubscriptionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const d = doc.data();
  return {
    id: doc.id,
    org_id: d.org_id ?? "",
    plan: (d.plan as OrgPlan) ?? "starter",
    status: d.status ?? "active",
    max_branches: d.max_branches ?? 1,
    current_period_start: toISO(d.current_period_start),
    current_period_end: toISO(d.current_period_end),
    stripe_subscription_id: d.stripe_subscription_id ?? null,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  };
}

/** E7 — อัปเดต subscription จาก Stripe webhook (subscription.updated/deleted) */
export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  data: {
    status?: string;
    plan?: OrgPlan;
    max_branches?: number;
    current_period_start?: string;
    current_period_end?: string;
  }
): Promise<{ orgId: string; previousPlan?: OrgPlan } | false> {
  const snap = await db
    .collection(COLLECTIONS.subscriptions)
    .where("stripe_subscription_id", "==", stripeSubscriptionId)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const { FieldValue } = await import("firebase-admin/firestore");
  const doc = snap.docs[0];
  const prev = doc.data()?.plan as OrgPlan | undefined;
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.status != null) updates.status = data.status;
  if (data.plan != null) updates.plan = data.plan;
  if (data.max_branches != null) updates.max_branches = data.max_branches;
  if (data.current_period_start != null) updates.current_period_start = data.current_period_start;
  if (data.current_period_end != null) updates.current_period_end = data.current_period_end;
  await doc.ref.update(updates);
  const orgId = doc.data()?.org_id;
  return orgId ? { orgId, previousPlan: prev } : false;
}

export async function createBranch(data: {
  org_id: string;
  name: string;
  address?: string;
}): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const now = FieldValue.serverTimestamp();
  const doc = await db.collection(COLLECTIONS.branches).add({
    org_id: data.org_id,
    name: data.name.trim(),
    address: data.address?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  });
  await upsertBranchHours(data.org_id, doc.id, {});
  return doc.id;
}

/** Enterprise: สร้าง branch_hours สำหรับทุกสาขาที่ยังไม่มี (idempotent) */
export async function ensureBranchHoursForOrg(orgId: string): Promise<number> {
  const branches = await getBranchesByOrgId(orgId);
  let created = 0;
  for (const b of branches) {
    const existing = await getBranchHours(orgId, b.id);
    if (!existing) {
      await upsertBranchHours(orgId, b.id, {});
      created++;
    }
  }
  return created;
}

// ─── Slot Management: branch_hours, doctor_schedules, blackout_dates ───────────

const DEFAULT_BRANCH_HOURS: Record<DayOfWeek, { open: string; close: string } | null> = {
  monday: { open: "09:00", close: "18:00" },
  tuesday: { open: "09:00", close: "18:00" },
  wednesday: { open: "09:00", close: "18:00" },
  thursday: { open: "09:00", close: "18:00" },
  friday: { open: "09:00", close: "18:00" },
  saturday: { open: "09:00", close: "14:00" },
  sunday: null,
};

export async function getBranchHours(orgId: string, branchId: string): Promise<BranchHours | null> {
  const snap = await db
    .collection(COLLECTIONS.branch_hours)
    .where("org_id", "==", orgId)
    .where("branch_id", "==", branchId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    org_id: d.org_id ?? orgId,
    branch_id: d.branch_id ?? branchId,
    monday: d.monday ?? null,
    tuesday: d.tuesday ?? null,
    wednesday: d.wednesday ?? null,
    thursday: d.thursday ?? null,
    friday: d.friday ?? null,
    saturday: d.saturday ?? null,
    sunday: d.sunday ?? null,
    slot_duration_minutes: typeof d.slot_duration_minutes === "number" ? d.slot_duration_minutes : 30,
  };
}

export async function upsertBranchHours(
  orgId: string,
  branchId: string,
  data: Partial<Omit<BranchHours, "id" | "org_id" | "branch_id">>
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const existing = await getBranchHours(orgId, branchId);
  const payload: Record<string, unknown> = {
    org_id: orgId,
    branch_id: branchId,
    monday: data.monday ?? existing?.monday ?? DEFAULT_BRANCH_HOURS.monday,
    tuesday: data.tuesday ?? existing?.tuesday ?? DEFAULT_BRANCH_HOURS.tuesday,
    wednesday: data.wednesday ?? existing?.wednesday ?? DEFAULT_BRANCH_HOURS.wednesday,
    thursday: data.thursday ?? existing?.thursday ?? DEFAULT_BRANCH_HOURS.thursday,
    friday: data.friday ?? existing?.friday ?? DEFAULT_BRANCH_HOURS.friday,
    saturday: data.saturday ?? existing?.saturday ?? DEFAULT_BRANCH_HOURS.saturday,
    sunday: data.sunday ?? existing?.sunday ?? DEFAULT_BRANCH_HOURS.sunday,
    slot_duration_minutes: data.slot_duration_minutes ?? existing?.slot_duration_minutes ?? 30,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing) {
    await db.collection(COLLECTIONS.branch_hours).doc(existing.id).update(payload);
    return existing.id;
  }
  const ref = await db.collection(COLLECTIONS.branch_hours).add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getDoctorSchedule(orgId: string, doctorId: string): Promise<DoctorSchedule | null> {
  const snap = await db
    .collection(COLLECTIONS.doctor_schedules)
    .where("org_id", "==", orgId)
    .where("doctor_id", "==", doctorId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    id: snap.docs[0].id,
    org_id: d.org_id ?? orgId,
    doctor_id: d.doctor_id ?? doctorId,
    doctor_name: d.doctor_name ?? undefined,
    work_days: Array.isArray(d.work_days) ? d.work_days : ["monday", "tuesday", "wednesday", "thursday", "friday"],
    work_start: typeof d.work_start === "string" ? d.work_start : "09:00",
    work_end: typeof d.work_end === "string" ? d.work_end : "17:00",
    slot_duration_minutes: typeof d.slot_duration_minutes === "number" ? d.slot_duration_minutes : 30,
    procedures: Array.isArray(d.procedures) ? d.procedures.filter((x: unknown) => typeof x === "string") : [],
  };
}

export async function getDoctorScheduleByDocId(orgId: string, docId: string): Promise<DoctorSchedule | null> {
  const doc = await db.collection(COLLECTIONS.doctor_schedules).doc(docId).get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    org_id: d.org_id ?? orgId,
    doctor_id: d.doctor_id ?? "",
    doctor_name: d.doctor_name ?? undefined,
    work_days: Array.isArray(d.work_days) ? d.work_days : ["monday", "tuesday", "wednesday", "thursday", "friday"],
    work_start: typeof d.work_start === "string" ? d.work_start : "09:00",
    work_end: typeof d.work_end === "string" ? d.work_end : "17:00",
    slot_duration_minutes: typeof d.slot_duration_minutes === "number" ? d.slot_duration_minutes : 30,
    procedures: Array.isArray(d.procedures) ? d.procedures.filter((x: unknown) => typeof x === "string") : [],
  };
}

/** Enterprise: แพทย์ที่ทำบริการนี้ได้ (fuzzy match) */
export async function getDoctorsByProcedure(orgId: string, procedureName: string): Promise<DoctorSchedule[]> {
  const all = await listDoctorSchedules(orgId);
  const normalized = procedureName.trim().toLowerCase();
  if (!normalized) return all;
  return all.filter((doc) => {
    const procs = doc.procedures ?? [];
    return procs.some((p) => p.trim().toLowerCase().includes(normalized) || normalized.includes(p.trim().toLowerCase()));
  });
}

export async function getBlackoutDates(
  orgId: string,
  branchId: string | null,
  fromDate: string,
  toDate: string
): Promise<BlackoutDate[]> {
  const snap = await db
    .collection(COLLECTIONS.blackout_dates)
    .where("org_id", "==", orgId)
    .limit(200)
    .get();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      const docDate = d.date ?? "";
      if (docDate < fromDate || docDate > toDate) return null;
      const bId = d.branch_id ?? null;
      if (bId !== null && branchId !== null && bId !== branchId) return null;
      return {
        id: doc.id,
        org_id: d.org_id ?? orgId,
        branch_id: bId,
        date: docDate,
        reason: d.reason ?? undefined,
      } as BlackoutDate;
    })
    .filter((b): b is BlackoutDate => b !== null);
}

export async function upsertDoctorSchedule(
  orgId: string,
  doctorId: string,
  data: {
    doctor_name?: string;
    work_days: DayOfWeek[];
    work_start: string;
    work_end: string;
    slot_duration_minutes?: number;
    procedures?: string[];
  }
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const existing = await getDoctorSchedule(orgId, doctorId);
  const payload = {
    org_id: orgId,
    doctor_id: doctorId,
    doctor_name: data.doctor_name ?? existing?.doctor_name ?? null,
    work_days: data.work_days,
    work_start: data.work_start,
    work_end: data.work_end,
    slot_duration_minutes: data.slot_duration_minutes ?? 30,
    procedures: Array.isArray(data.procedures) ? data.procedures.filter((x) => typeof x === "string" && x.trim()) : (existing?.procedures ?? []),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existing) {
    await db.collection(COLLECTIONS.doctor_schedules).doc(existing.id).update(payload);
    return existing.id;
  }
  const ref = await db.collection(COLLECTIONS.doctor_schedules).add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function createBlackoutDate(
  orgId: string,
  data: { branch_id?: string | null; date: string; reason?: string }
): Promise<string> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = await db.collection(COLLECTIONS.blackout_dates).add({
    org_id: orgId,
    branch_id: data.branch_id ?? null,
    date: data.date,
    reason: data.reason ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function deleteBlackoutDate(orgId: string, id: string): Promise<boolean> {
  const doc = await db.collection(COLLECTIONS.blackout_dates).doc(id).get();
  if (!doc.exists || doc.data()?.org_id !== orgId) return false;
  await db.collection(COLLECTIONS.blackout_dates).doc(id).delete();
  return true;
}

export async function listDoctorSchedules(orgId: string): Promise<DoctorSchedule[]> {
  const snap = await db
    .collection(COLLECTIONS.doctor_schedules)
    .where("org_id", "==", orgId)
    .limit(50)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      org_id: d.org_id ?? orgId,
      doctor_id: d.doctor_id ?? "",
      doctor_name: d.doctor_name ?? undefined,
      work_days: Array.isArray(d.work_days) ? d.work_days : ["monday", "tuesday", "wednesday", "thursday", "friday"],
      work_start: typeof d.work_start === "string" ? d.work_start : "09:00",
      work_end: typeof d.work_end === "string" ? d.work_end : "17:00",
      slot_duration_minutes: typeof d.slot_duration_minutes === "number" ? d.slot_duration_minutes : 30,
      procedures: Array.isArray(d.procedures) ? d.procedures.filter((x: unknown) => typeof x === "string") : [],
    } as DoctorSchedule;
  });
}

export async function listBlackoutDates(
  orgId: string,
  opts?: { branchId?: string | null; from?: string; to?: string }
): Promise<BlackoutDate[]> {
  const from = opts?.from ?? new Date().toISOString().slice(0, 10);
  const to = opts?.to ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  return getBlackoutDates(orgId, opts?.branchId ?? null, from, to);
}
