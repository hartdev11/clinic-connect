/**
 * Enterprise: ยืนยันที่อยู่/โทรศัพท์แยกขั้นตอน (FRANCHISE-MODEL-SPEC)
 * Token เก็บใน Firestore collection verification_tokens (doc id = token), หมดอายุ 24 ชม.
 */
import { randomBytes } from "crypto";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "verification_tokens";
const TYPE_ADDRESS_PHONE = "address_phone";
const TTL_HOURS = 24;

function randomToken(): string {
  try {
    return randomBytes(24).toString("hex");
  } catch {
    // Fallback when crypto unavailable (e.g. edge)
    const arr = new Uint8Array(24);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

/**
 * สร้าง token สำหรับยืนยันที่อยู่/โทร — เก็บใน Firestore, หมดอายุ 24 ชม.
 * คืนค่า token สำหรับใส่ในลิงก์
 */
export async function createAddressPhoneVerificationToken(orgId: string): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  await db.collection(COLLECTION).doc(token).set({
    org_id: orgId,
    type: TYPE_ADDRESS_PHONE,
    expires_at: expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });
  return token;
}

/**
 * หา org_id จาก token; ตรวจสอบ type และหมดอายุ
 * คืนค่า org_id ถ้าถูกต้อง, null ถ้าไม่พบ/หมดอายุ/type ไม่ตรง
 */
export async function getOrgIdByAddressPhoneToken(token: string): Promise<string | null> {
  if (!token?.trim()) return null;
  const doc = await db.collection(COLLECTION).doc(token.trim()).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  if ((d.type as string) !== TYPE_ADDRESS_PHONE) return null;
  const expiresAt = d.expires_at?.toDate?.() ?? d.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) return null;
  return (d.org_id as string) ?? null;
}

/**
 * ลบ token หลังยืนยันสำเร็จ (one-time use)
 */
export async function consumeAddressPhoneToken(token: string): Promise<void> {
  await db.collection(COLLECTION).doc(token.trim()).delete();
}
