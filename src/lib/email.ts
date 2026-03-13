/**
 * Enterprise: ส่งอีเมลจริงผ่าน Resend (ไม่ mock)
 * ใช้สำหรับยืนยันการซื้อและลิงก์ยืนยันอีเมล
 */
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";
/** ผู้ส่ง: ใช้ onboarding@resend.dev (ไม่ต้องมีโดเมน) — ใส่ RESEND_API_KEY แล้วส่งได้ทันที */
const FROM_EMAIL =
  process.env.EMAIL_FROM?.trim() || "Clinic Connect <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

export async function sendPurchaseConfirmation(params: {
  to: string;
  plan: string;
  licenseKey: string;
  verificationLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  const planLabel: Record<string, string> = {
    starter: "Starter",
    professional: "Professional",
    multi_branch: "Multi Branch",
    enterprise: "Enterprise",
  };
  const planName = planLabel[params.plan] ?? params.plan;
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `ยืนยันการซื้อแพ็คเกจ ${planName} — Clinic Connect`,
      html: `
        <h2>ยืนยันการซื้อแพ็คเกจ</h2>
        <p>คุณได้เลือกแพ็คเกจ <strong>${planName}</strong> แล้ว</p>
        <p><strong>License Key ของคุณ:</strong> <code>${params.licenseKey}</code></p>
        <p>เก็บคีย์นี้ไว้ใช้ตอนสมัครและเข้าสู่ระบบ</p>
        <p>กรุณายืนยันอีเมลโดยคลิกลิงก์ด้านล่าง:</p>
        <p><a href="${params.verificationLink}" style="display:inline-block;padding:12px 24px;background:#e05c76;color:#fff;text-decoration:none;border-radius:8px;">ยืนยันอีเมล</a></p>
        <p>หรือคัดลอกลิงก์: ${params.verificationLink}</p>
        <p>ลิงก์หมดอายุใน 24 ชั่วโมง</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — ระบบหลังบ้านคลินิก</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function sendVerificationEmail(params: {
  to: string;
  verificationLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: "ยืนยันอีเมล — Clinic Connect",
      html: `
        <h2>ยืนยันอีเมล</h2>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลและเข้าสู่ระบบได้</p>
        <p><a href="${params.verificationLink}" style="display:inline-block;padding:12px 24px;background:#e05c76;color:#fff;text-decoration:none;border-radius:8px;">ยืนยันอีเมล</a></p>
        <p>หรือคัดลอก: ${params.verificationLink}</p>
        <p>ลิงก์หมดอายุใน 24 ชั่วโมง</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export function buildVerificationLink(token: string): string {
  const base = APP_URL.replace(/\/$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Phase 10 — Magic link for staff invite */
export async function sendStaffInviteEmail(params: {
  to: string;
  inviteLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: "เชิญเข้าร่วม Clinic Connect",
      html: `
        <h2>คุณได้รับคำเชิญ</h2>
        <p>คุณได้รับคำเชิญให้เข้าร่วมระบบ Clinic Connect</p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านและเข้าสู่ระบบ</p>
        <p><a href="${params.inviteLink}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">ยอมรับคำเชิญ</a></p>
        <p>หรือคัดลอกลิงก์: ${params.inviteLink}</p>
        <p>ลิงก์หมดอายุใน 48 ชั่วโมง</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — ระบบหลังบ้านคลินิก</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Franchise: แจ้งสาขาหลักว่ามีสาขาย่อยซื้อแพ็คเกจและส่งคำขอเข้าร่วม */
export async function sendFranchiseSubPurchaseNotifyMain(params: {
  to: string;
  subName: string;
  subEmail: string;
  subPlan: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  const appUrl = APP_URL.replace(/\/$/, "");
  const requestsUrl = `${appUrl}/login`;
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: "มีสาขาย่อยขอเข้าร่วมแฟรนไชส์ (ซื้อแพ็คเกจแล้ว) — Clinic Connect",
      html: `
        <h2>คำขอเข้าร่วมแฟรนไชส์</h2>
        <p>สาขา <strong>${params.subName}</strong> (${params.subEmail}) ได้ซื้อแพ็คเกจ <strong>${params.subPlan}</strong> และส่งคำขอเข้าร่วมแล้ว</p>
        <p>กรุณาเข้าสู่ระบบแล้วไปที่เมนู <strong>แฟรนไชส์ → คำขอเข้าร่วม</strong> เพื่ออนุมัติหรือปฏิเสธ</p>
        <p><a href="${requestsUrl}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">เข้าสู่ระบบ</a></p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — ระบบหลังบ้านคลินิก</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Enterprise: ส่งอีเมลยืนยันที่อยู่/โทรศัพท์ (FRANCHISE-MODEL-SPEC) */
export async function sendAddressPhoneVerificationEmail(params: {
  to: string;
  orgName: string;
  address?: string | null;
  phone?: string | null;
  verificationLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  const addressLine = params.address ? `<p><strong>ที่อยู่:</strong> ${params.address}</p>` : "";
  const phoneLine = params.phone ? `<p><strong>เบอร์โทร:</strong> ${params.phone}</p>` : "";
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: "ยืนยันที่อยู่และเบอร์โทรศัพท์ — Clinic Connect",
      html: `
        <h2>ยืนยันข้อมูลที่อยู่และเบอร์โทร</h2>
        <p>คลินิก <strong>${params.orgName}</strong></p>
        ${addressLine}
        ${phoneLine}
        <p>กรุณาตรวจสอบข้อมูลด้านบนว่าถูกต้อง แล้วคลิกลิงก์ด้านล่างเพื่อยืนยัน</p>
        <p><a href="${params.verificationLink}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">ยืนยันที่อยู่และเบอร์โทร</a></p>
        <p>หรือคัดลอกลิงก์: ${params.verificationLink}</p>
        <p>ลิงก์หมดอายุใน 24 ชั่วโมง</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — ระบบหลังบ้านคลินิก</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Franchise: ส่งอีเมลแจ้งสาขาย่อยเมื่อสาขาหลักอนุมัติคำขอ — พร้อม License Key (และรหัสชั่วคราวถ้ามี) */
export async function sendFranchiseSubApprovedEmail(params: {
  to: string;
  subName: string;
  licenseKey: string;
  temporaryPassword?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  const loginUrl = `${APP_URL.replace(/\/$/, "")}/login`;
  const passwordBlock = params.temporaryPassword
    ? `<p><strong>รหัสผ่านชั่วคราว:</strong> <code>${params.temporaryPassword}</code></p><p>กรุณาเข้าสู่ระบบแล้วเปลี่ยนรหัสผ่าน</p>`
    : "<p>เก็บคีย์นี้ไว้ใช้เข้าสู่ระบบ</p>";
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: "คำขอเข้าร่วมแฟรนไชส์ได้รับการอนุมัติ — Clinic Connect",
      html: `
        <h2>อนุมัติคำขอเข้าร่วมแล้ว</h2>
        <p>สาขา <strong>${params.subName}</strong> ได้รับการอนุมัติจากสาขาหลักแล้ว</p>
        <p><strong>License Key ของคุณ:</strong> <code>${params.licenseKey}</code></p>
        ${passwordBlock}
        <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">เข้าสู่ระบบ</a></p>
        <p>หรือไปที่: ${loginUrl}</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — ระบบหลังบ้านคลินิก</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Phase 6: แจ้ง super_admin เมื่อพร้อม Retrain */
export async function sendRetrainNotificationEmail(params: {
  highQualityCount: number;
  totalCount: number;
}): Promise<{ success: boolean; error?: string }> {
  const to = process.env.RETRAIN_NOTIFY_EMAIL?.trim();
  if (!to) {
    return { success: false, error: "RETRAIN_NOTIFY_EMAIL not configured" };
  }
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "พร้อม Retrain — Clinic Connect AI Pipeline",
      html: `
        <h2>AI Retrain พร้อมดำเนินการ</h2>
        <p>ระบบตรวจสอบแล้วพบว่ามีข้อมูลเพียงพอสำหรับ Retrain:</p>
        <ul>
          <li>Conversations คุณภาพสูง (30 วันล่าสุด): <strong>${params.highQualityCount}</strong></li>
          <li>Total conversations ตั้งแต่ retrain ล่าสุด: <strong>${params.totalCount}</strong></li>
        </ul>
        <p>กรุณาเข้าสู่ระบบหรือติดต่อทีมพัฒนาเพื่อดำเนินการ Retrain โมเดล</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — Retrain Monitor (Phase 6)</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Phase 18: แจ้งเตือนการชำระเงินจะครบกำหนด */
export async function sendBillingReminderEmail(params: {
  to: string;
  orgName: string;
  daysUntilDue: number;
  periodEndDate: string;
  billingUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `แจ้งเตือน: การชำระเงินจะครบกำหนดใน ${params.daysUntilDue} วัน — Clinic Connect`,
      html: `
        <h2>แจ้งเตือนการชำระเงิน</h2>
        <p>สวัสดีค่ะ คลินิก <strong>${params.orgName}</strong></p>
        <p>การชำระเงินจะครบกำหนดใน <strong>${params.daysUntilDue} วัน</strong> (${params.periodEndDate})</p>
        <p>กรุณาตรวจสอบข้อมูลการชำระเงินและอัปเดตบัตรเครดิตถ้าจำเป็น</p>
        <p><a href="${params.billingUrl}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">จัดการการชำระเงิน</a></p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — Billing Reminder (Phase 18)</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Phase 18: แจ้ง super_admin เมื่อ webhook retry หมดแล้ว (Dead Letter) */
export async function sendWebhookDeadLetterEmail(params: {
  source: string;
  eventId: string;
  eventType?: string;
  attempts: number;
}): Promise<{ success: boolean; error?: string }> {
  const to = process.env.SUPER_ADMIN_EMAIL?.trim() || process.env.RETRAIN_NOTIFY_EMAIL?.trim();
  if (!to) return { success: false, error: "SUPER_ADMIN_EMAIL not configured" };
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `[URGENT] Webhook Dead Letter: ${params.source} event ${params.eventId}`,
      html: `
        <h2>Webhook Retry ล้มเหลวทั้งหมด</h2>
        <p>Source: <strong>${params.source}</strong></p>
        <p>Event ID: <strong>${params.eventId}</strong></p>
        <p>Event Type: ${params.eventType ?? "—"}</p>
        <p>Attempts: ${params.attempts}</p>
        <p>กรุณาตรวจสอบ logs และดำเนินการแก้ไข</p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — Webhook Retry (Phase 18)</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/** Phase 19: แจ้งเตือนทั่วไป (multi-channel) — subject + body ตาม type */
export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  type: string;
  data: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY not configured" };
  const body = typeof params.data.message === "string" ? params.data.message : params.subject;
  const actionUrl = typeof params.data.actionUrl === "string" ? params.data.actionUrl : null;
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${params.subject} — Clinic Connect`,
      html: `
        <h2>${params.subject}</h2>
        <p>${body}</p>
        ${actionUrl ? `<p><a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#0c7a6f;color:#fff;text-decoration:none;border-radius:8px;">ดูรายละเอียด</a></p>` : ""}
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — Notification (Phase 19)</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Phase 7: แจ้ง staff เมื่อ handoff รอเกิน 2min/5min */
export async function sendHandoffReminderEmail(params: {
  to: string;
  customerName: string;
  triggerType: string;
  waitMinutes: number;
  handoffUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `⚠️ Handoff รอ ${params.waitMinutes} นาที — ${params.customerName}`,
      html: `
        <h2>มีลูกค้ารอรับสาย</h2>
        <p>ลูกค้า <strong>${params.customerName}</strong> ส่งต่อมาเมื่อ ${params.waitMinutes} นาทีที่แล้ว (${params.triggerType})</p>
        <p>กรุณาเข้าสู่ระบบ Handoff เพื่อรับสาย</p>
        <p><a href="${params.handoffUrl}" style="display:inline-block;padding:12px 24px;background:#e05c76;color:#fff;text-decoration:none;border-radius:8px;">เปิด Handoff</a></p>
        <hr>
        <p style="color:#666;font-size:12px;">Clinic Connect — Human Handoff (Phase 7)</p>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
