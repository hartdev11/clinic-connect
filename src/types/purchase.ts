/**
 * Enterprise: Purchase / Package selection & device-based flow
 * บันทึกการซื้อแพ็คเกจต่อ device + email verification
 */
import type { OrgPlan } from "./organization";

export const PURCHASE_COLLECTION = "purchase_records";

export interface PurchaseRecord {
  id: string;
  /** เครื่องที่ซื้อ (cookie device_id) */
  device_id: string;
  /** อีเมลที่ใช้ซื้อ — ต้องตรงกับที่ใช้ Login/Register */
  email: string;
  /** แพ็คเกจที่เลือก */
  plan: OrgPlan;
  /** ยืนยันอีเมลแล้วหรือยัง */
  email_verified: boolean;
  /** Token สำหรับลิงก์ยืนยันอีเมล (ใช้ครั้งเดียว) */
  verification_token: string | null;
  /** เวลาที่ยืนยันอีเมลสำเร็จ */
  verified_at: string | null;
  /** License Key ส่งให้ลูกค้าในอีเมล — ใช้ตอน Register/Login */
  license_key: string;
  /** Stripe Checkout Session ID (ถ้าซื้อแบบเสียเงิน) */
  stripe_session_id: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRecordCreate {
  device_id: string;
  email: string;
  plan: OrgPlan;
  stripe_session_id?: string | null;
}
