/**
 * Franchise Model — การจัดการสาขาหลัก/สาขาย่อย และการจำกัดการเข้าถึงข้อมูล
 * อ้างอิง: docs/FRANCHISE-MODEL-SPEC.md, ENTERPRISE-FRANCHISE-LICENSE-ARCHITECTURE.md
 */

import { db } from "@/lib/firebase-admin";
import type { SessionPayload } from "@/lib/auth-session";
import type { FranchiseRole } from "@/types/organization";

const COLLECTIONS = {
  organizations: "organizations",
  franchise_join_requests: "franchise_join_requests",
} as const;

function toISO(t: FirebaseFirestore.Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d =
    t && typeof (t as { toDate?: () => Date }).toDate === "function"
      ? (t as { toDate: () => Date }).toDate()
      : null;
  return d ? new Date(d).toISOString() : String(t);
}

export interface OrgFranchiseInfo {
  org_id: string;
  clinic_type: "single" | "franchise" | null;
  franchise_role: FranchiseRole;
  franchise_main_org_id: string | null;
  franchise_group_id: string | null;
}

/**
 * ดึงข้อมูล franchise ของ org (clinic_type, franchise_role, main_org_id, group_id)
 */
export async function getOrgFranchiseInfo(orgId: string): Promise<OrgFranchiseInfo | null> {
  const doc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    org_id: doc.id,
    clinic_type: (d.clinic_type as "single" | "franchise") ?? null,
    franchise_role: (d.franchise_role as FranchiseRole) ?? null,
    franchise_main_org_id: d.franchise_main_org_id ?? null,
    franchise_group_id: d.franchise_group_id ?? null,
  };
}

/**
 * รายการ org_id ของสาขาย่อยที่เชื่อมกับสาขาหลัก (สำหรับ main ดูข้อมูลรวม)
 */
export async function getFranchiseSubOrgIds(mainOrgId: string): Promise<string[]> {
  const snap = await db
    .collection(COLLECTIONS.organizations)
    .where("franchise_main_org_id", "==", mainOrgId)
    .get();
  return snap.docs.map((doc) => doc.id);
}

/**
 * ตรวจว่า org นี้เป็นสาขาหลักของแฟรนไชส์หรือไม่
 */
export async function isFranchiseMain(orgId: string): Promise<boolean> {
  const info = await getOrgFranchiseInfo(orgId);
  return info?.franchise_role === "main";
}

/**
 * ตรวจว่า org นี้เป็นสาขาย่อยหรือไม่
 */
export async function isFranchiseSub(orgId: string): Promise<boolean> {
  const info = await getOrgFranchiseInfo(orgId);
  return info?.franchise_role === "sub";
}

/**
 * รายการ org_id ที่ session นี้มีสิทธิ์เข้าถึง (สำหรับ query ข้อมูลรวม)
 * - สาขาหลัก (main): [main_org_id, ...sub_org_ids]
 * - สาขาย่อย (sub) หรือ single: [session_org_id] เท่านั้น
 */
export async function getOrgIdsForSession(session: SessionPayload | null): Promise<string[]> {
  if (!session?.org_id) return [];
  const info = await getOrgFranchiseInfo(session.org_id);
  if (!info) return [session.org_id];
  if (info.franchise_role === "main") {
    const subIds = await getFranchiseSubOrgIds(session.org_id);
    return [session.org_id, ...subIds];
  }
  return [session.org_id];
}

/**
 * ใช้เมื่อ franchise main ดูข้อมูลรวม: ถ้า single/sub คืน [orgId];
 * ถ้า main คืน [main, ...subs] สำหรับ aggregate
 */
export async function getOrgIdsForAggregate(session: SessionPayload | null): Promise<string[]> {
  return getOrgIdsForSession(session);
}

/**
 * ตรวจว่า session มีสิทธิ์เข้าถึง resource ของ org นี้หรือไม่
 * - สาขาย่อย: เฉพาะ org_id ของตัวเอง
 * - สาขาหลัก: ตัวเอง + ทุกสาขาย่อยในกลุ่ม
 */
export async function canSessionAccessOrg(
  session: SessionPayload | null,
  resourceOrgId: string
): Promise<boolean> {
  if (!session?.org_id) return false;
  if (session.org_id === resourceOrgId) return true;
  const info = await getOrgFranchiseInfo(session.org_id);
  if (!info) return false;
  if (info.franchise_role === "main") {
    const subIds = await getFranchiseSubOrgIds(session.org_id);
    return subIds.includes(resourceOrgId);
  }
  return false;
}

/**
 * สร้างรหัสเชิญ (invite_code) สำหรับสาขาหลัก — ไม่ซ้ำ
 */
export function generateInviteCode(): string {
  const segment = () =>
    Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 6);
  return `INV-${segment()}-${segment()}`.toUpperCase();
}

/** สร้าง license key รูปแบบ CC-xxxxx-xxxxx (สำหรับสาขาย่อยหลังอนุมัติ) */
function generateSubLicenseKey(): string {
  const segment = () =>
    Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `CC-${segment()}-${segment()}`.toUpperCase();
}

/**
 * สร้าง license key ที่ยังไม่มีใน organizations หรือ purchase_records
 */
export async function generateUniqueLicenseKey(): Promise<string> {
  const { db } = await import("@/lib/firebase-admin");
  const { PURCHASE_COLLECTION } = await import("@/types/purchase");
  for (let i = 0; i < 20; i++) {
    const key = generateSubLicenseKey();
    const [orgSnap, purchaseSnap] = await Promise.all([
      db.collection(COLLECTIONS.organizations).where("licenseKey", "==", key).limit(1).get(),
      db.collection(PURCHASE_COLLECTION).where("license_key", "==", key).limit(1).get(),
    ]);
    if (orgSnap.empty && purchaseSnap.empty) return key;
  }
  throw new Error("Could not generate unique license key");
}

/**
 * หา main org จาก invite_code (สำหรับสาขาย่อยลงทะเบียน)
 */
export async function getMainOrgIdByInviteCode(inviteCode: string): Promise<string | null> {
  const code = inviteCode.trim().toUpperCase();
  const snap = await db
    .collection(COLLECTIONS.organizations)
    .where("invite_code", "==", code)
    .where("franchise_role", "==", "main")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * ดึงคำขอเข้าร่วมแฟรนไชส์ (pending) ของสาขาหลัก
 */
export async function getPendingFranchiseJoinRequests(
  mainOrgId: string
): Promise<Array<FranchiseJoinRequestDoc>> {
  const snap = await db
    .collection(COLLECTIONS.franchise_join_requests)
    .where("main_org_id", "==", mainOrgId)
    .where("status", "==", "pending")
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toISO(doc.data().createdAt),
    updatedAt: toISO(doc.data().updatedAt),
  })) as FranchiseJoinRequestDoc[];
}

export interface FranchiseJoinRequestDoc {
  id: string;
  main_org_id: string;
  sub_name: string;
  sub_address?: string | null;
  sub_phone?: string | null;
  sub_email: string;
  sub_org_id?: string | null;
  sub_license_key?: string | null;
  status: "pending" | "approved" | "rejected";
  purchase_record_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  createdAt: string;
  updatedAt: string;
}
