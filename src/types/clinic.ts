/**
 * E1.5 — Firestore entity types (Multi-tenant)
 * ทุก entity ผูก org_id; branch-scoped มี branch_id?
 */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"   // Enterprise: กำลังรับบริการ (เรียกคิวแล้ว)
  | "completed"
  | "no-show"
  | "cancelled"
  | "pending_admin_confirm"
  | "reschedule_pending_admin"
  | "cancel_requested";

/** Enterprise: โหมดที่ใช้สร้างการจอง */
export type BookingCreationMode = "chat" | "web_form" | "admin_panel";

/** Enterprise: ระบบ/ผู้สร้างการจอง (admin, ai, web, line) */
export type BookingSource = "line" | "web" | "admin" | "ai";

/** Enterprise: ช่องทางที่ลูกค้าจองเข้ามา — LINE, Facebook, IG, TikTok, Walk-in, โทร ฯลฯ */
export type BookingChannel =
  | "line"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "web"
  | "web_chat"
  | "walk_in"
  | "phone"
  | "referral"
  | "other";

/** ช่องทางที่ส่งข้อความแจ้งเตือนได้ (มี chat API) — Backend เลือก API ตาม channel */
export const NOTIFYABLE_CHANNELS: BookingChannel[] = [
  "line",
  "facebook",
  "instagram",
  "tiktok",
  "web",
  "web_chat",
];

export const BOOKING_CHANNELS: BookingChannel[] = [
  "line",
  "facebook",
  "instagram",
  "tiktok",
  "web",
  "web_chat",
  "walk_in",
  "phone",
  "referral",
  "other",
];

export interface Booking {
  id: string;
  org_id: string;
  branch_id?: string;
  customerName: string;
  customerId?: string;
  /** Enterprise: เบอร์โทรสำหรับติดต่อ */
  phoneNumber?: string | null;
  service: string;
  /** Enterprise: หัตถการ/บริการที่จอง (รายละเอียด) */
  procedure?: string | null;
  /** Enterprise: จำนวนเงิน (บาท) */
  amount?: number | null;
  /** Enterprise: ระบบที่สร้างจอง */
  source?: BookingSource | null;
  /** Enterprise: ช่องทางที่ลูกค้าจองเข้ามา (LINE, Facebook, IG ฯลฯ) */
  channel?: BookingChannel | null;
  /** Enterprise: แพทย์ (ถ้ามี) — ชื่อหรือ identifier */
  doctor?: string | null;
  /** Enterprise: doctor_id จาก doctor_schedules — ใช้สำหรับ query/index */
  doctor_id?: string | null;
  /** Enterprise: chat_user_id เช่น LINE userId — ใช้สำหรับ reschedule/cancel จากแชท */
  chatUserId?: string | null;
  /** Enterprise: โหมดที่สร้างจอง */
  bookingCreationMode?: BookingCreationMode | null;
  /** Enterprise: Backend กำหนดว่าต้องแจ้งเตือนลูกค้าหรือไม่ — AI ไม่ตัดสินใจเอง */
  requiresCustomerNotification?: boolean;
  /** Enterprise: สถานะการส่งแจ้งเตือน (pending/sent/failed) — ใช้ retry จาก backend เท่านั้น */
  notificationStatus?: "pending" | "sent" | "failed";
  /** Enterprise: จำนวนครั้งที่พยายามส่ง */
  notificationAttemptCount?: number;
  /** Enterprise: ข้อความ error ครั้งล่าสุด (ถ้า failed) */
  lastNotificationError?: string | null;
  branchId?: string;
  branchName?: string;
  scheduledAt: string; // ISO
  status: BookingStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingCreate {
  customerName: string;
  customerId?: string;
  phoneNumber?: string | null;
  service: string;
  procedure?: string | null;
  amount?: number | null;
  source?: BookingSource | null;
  /** Enterprise: ช่องทางที่ลูกค้าจองเข้ามา */
  channel?: BookingChannel | null;
  doctor?: string | null;
  /** Enterprise: doctor_id สำหรับ map กับ doctor_schedules */
  doctor_id?: string | null;
  /** Enterprise: chat_user_id สำหรับจองจากแชท */
  chatUserId?: string | null;
  /** Enterprise: โหมดที่สร้างจอง */
  bookingCreationMode?: BookingCreationMode | null;
  /** Branch-scoped: branch document id */
  branch_id?: string;
  branchId?: string;
  branchName?: string;
  scheduledAt: string;
  status?: BookingStatus;
  notes?: string | null;
}

export type CustomerSource =
  | "line"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "web";

export interface Customer {
  id: string;
  org_id: string;
  branch_id?: string;
  name: string;
  source: CustomerSource;
  externalId?: string;
  /** LINE profile picture URL */
  pictureUrl?: string | null;
  status: "active" | "pending" | "inactive";
  lastChatAt?: string;
  aiResponded?: boolean;
  /** Soft delete — ISO string when deleted, null = active */
  deleted_at?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  org_id: string;
  branch_id?: string;
  amount: number;
  type: "booking" | "product" | "other";
  bookingId?: string;
  serviceName?: string;
  branchId?: string;
  createdAt: string;
}

/** Promotion media item (image or video) — stored in Firebase Storage */
export interface PromotionMedia {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
}

export type PromotionStatus = "draft" | "scheduled" | "active" | "expired" | "archived";
export type PromotionTargetGroup = "new" | "existing" | "all";

/** AI-extracted metadata from promotion image (Vision) */
export interface PromotionExtracted {
  extractedProcedures: string[];
  extractedKeywords: string[];
  extractedBenefits: string[];
  extractedPrice?: number;
  extractedDiscount?: number;
  urgencyScore?: number;
}

export interface Promotion {
  id: string;
  org_id: string;
  /** Multi-branch: list of branch document ids */
  branchIds: string[];
  name: string;
  description?: string;
  targetGroup: PromotionTargetGroup;
  status: PromotionStatus;
  startAt?: string;
  endAt?: string;
  autoArchiveAt?: string;
  media: PromotionMedia[];
  couponCode?: string;
  stackable: boolean;
  maxUsage?: number;
  currentUsage?: number;
  minimumSpend?: number;
  aiSummary?: string;
  aiTags?: string[];
  visibleToAI: boolean;
  /** AI intelligence layer — semantic search */
  promotionEmbedding?: number[];
  /** AI-extracted from image (Vision) */
  extractedProcedures?: string[];
  extractedKeywords?: string[];
  extractedBenefits?: string[];
  extractedPrice?: number;
  extractedDiscount?: number;
  urgencyScore?: number;
  createdAt: string;
  updatedAt: string;
}

/** E5.1–E5.2 — Conversation Feedback (Golden Dataset) */
export type FeedbackLabel = "success" | "fail" | null;

export interface ConversationFeedback {
  id: string;
  org_id: string | null;
  branch_id: string | null;
  /** LINE userId or external */
  user_id: string | null;
  userMessage: string;
  botReply: string;
  intent?: string | null;
  service?: string | null;
  area?: string | null;
  source?: "line" | "web" | "admin";
  /** Admin manual reply: who sent the message */
  adminSentBy?: string | null;
  /** Admin: success / fail */
  adminLabel: FeedbackLabel;
  adminLabeledAt?: string | null;
  adminLabeledBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Phase 2 #20: For feedback loop trace */
  correlation_id?: string | null;
}

export interface ConversationFeedbackCreate {
  org_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
  userMessage: string;
  botReply: string;
  intent?: string | null;
  service?: string | null;
  area?: string | null;
  source?: "line" | "web" | "admin";
  /** Admin manual reply: who sent (user_id or email) */
  adminSentBy?: string | null;
  /** Phase 2 #20: Trace to ai_activity_logs for feedback loop */
  correlation_id?: string | null;
}

/**
 * Legacy — API response shape สำหรับ /api/clinic/me (backward compat)
 * ใช้ getOrgProfile() แล้ว map เป็น shape นี้
 */
export interface ClinicProfile {
  id: string;
  clinicName: string;
  branches: number;
  phone: string;
  email: string;
  createdAt: string;
}

/** Org profile — อ่านจาก organizations + branches */
export interface OrgProfile {
  id: string;
  org_id: string;
  clinicName: string;
  plan: string;
  branches: number;
  phone: string;
  email: string;
  createdAt: string;
}

/** สถิติ Dashboard — aggregate จาก bookings/transactions ไม่เก็บเป็น doc แยก (คำนวณหรือ cache ฝั่ง API) */
export interface DashboardStats {
  chatsToday: number;
  newCustomers: number;
  bookingsToday: number;
  bookingsTomorrow: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
}

export interface DashboardBookingsByDate {
  dateLabel: string;
  date: string;
  total: number;
  items: Array<{
    id: string;
    customer: string;
    service: string;
    time: string;
    status: BookingStatus;
  }>;
}

/** Enterprise: Slot Management — วันเวลาเปิด–ปิดของสาขา */
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export interface DayHours {
  open: string;  // "09:00"
  close: string; // "18:00"
}
export interface BranchHours {
  id: string;
  org_id: string;
  branch_id: string;
  monday?: DayHours | null;
  tuesday?: DayHours | null;
  wednesday?: DayHours | null;
  thursday?: DayHours | null;
  friday?: DayHours | null;
  saturday?: DayHours | null;
  sunday?: DayHours | null;
  slot_duration_minutes?: number;
}

/** Enterprise: ตารางแพทย์ (วันเข้า, ช่วงเวลา, บริการที่ทำได้) */
export interface DoctorSchedule {
  id: string;
  org_id: string;
  doctor_id: string;
  doctor_name?: string;
  work_days: DayOfWeek[];
  work_start: string;
  work_end: string;
  slot_duration_minutes?: number;
  /** Enterprise: บริการ/หัตถการที่แพทย์คนนี้ทำได้ (โบท็อกซ์, ฟิลเลอร์ ฯลฯ) */
  procedures?: string[];
}

/** Enterprise: วันปิด (หยุด, ซ่อม, ฯลฯ) */
export interface BlackoutDate {
  id: string;
  org_id: string;
  branch_id?: string | null; // null = ทั้ง org
  date: string; // YYYY-MM-DD
  reason?: string; // "วันหยุด" | "เครื่องซ่อม" etc
}
