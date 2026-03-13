/**
 * Enterprise: ตรวจสอบเจ้าของสาขาหลัก (FRANCHISE-MODEL-SPEC)
 * ผ่านได้เฉพาะเมื่อตรวจจากแหล่งใดแหล่งหนึ่งจริงเท่านั้น (fail closed)
 * - (1) HSS: ตรวจจากเว็บกรม สบส. จริง
 * - (2) EXTERNAL_MAIN_BRANCH_VERIFY_URL: เรียก API ภายนอก
 * - (3) main_branch_registry: มี doc ที่ admin ยืนยันแล้ว
 * ไม่มี backward compatibility — ถ้าไม่มีวิธีใดตั้งค่า หรือตรวจแล้วไม่ผ่าน คืน false
 */
import { db } from "@/lib/firebase-admin";
import { verifyLicenseWithHssWebsite, isHssVerifyEnabled } from "@/lib/hss-verify";

const REGISTRY_COLLECTION = "main_branch_registry";
const EXTERNAL_URL = process.env.EXTERNAL_MAIN_BRANCH_VERIFY_URL?.trim() ?? "";

/** เลขที่ใบอนุญาตไทย 11 หลัก; อนุโลม 10–20 หลัก */
const LICENSE_DIGITS_MIN = 10;
const LICENSE_DIGITS_MAX = 20;

function normalizeBranchNumber(v: string | null | undefined): string {
  return (v ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Enterprise: ปฏิเสธเลขที่เห็นได้ชัดว่าไม่ใช่เลขใบอนุญาต (รูปแบบ/ความยาว/เลขซ้ำ)
 */
export function isLicenseFormatInvalid(branchNumber: string): boolean {
  const digits = digitsOnly(branchNumber);
  if (digits.length < LICENSE_DIGITS_MIN || digits.length > LICENSE_DIGITS_MAX) return true;
  if (digits.length > 11 && /^(\d)\1+$/.test(digits)) return true;
  return false;
}

/**
 * ตรวจว่าเป็นเจ้าของสาขาหลักที่ยืนยันแล้วหรือไม่
 * ผ่านได้เฉพาะเมื่อ (1) HSS ผ่าน หรือ (2) API ภายนอก ok หรือ (3) มีใน registry ที่ยืนยันแล้ว
 */
export async function verifyMainBranchOwnership(
  branchNumber: string | null | undefined,
  orgName: string
): Promise<boolean> {
  const branch = normalizeBranchNumber(branchNumber);
  if (!branch) return false;
  if (isLicenseFormatInvalid(branchNumber ?? "")) return false;

  if (isHssVerifyEnabled()) {
    const hssOk = await verifyLicenseWithHssWebsite(branchNumber, orgName);
    if (hssOk) return true;
  }

  if (EXTERNAL_URL) {
    try {
      const res = await fetch(EXTERNAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_number: branch,
          org_name: (orgName ?? "").trim(),
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean };
      if (data?.ok === true) return true;
    } catch {
      // fall through to next
    }
  }

  const doc = await db.collection(REGISTRY_COLLECTION).doc(branch).get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  return d.verified_at != null;
}

/**
 * บันทึก/อัปเดต allowlist สาขาหลัก (สำหรับ admin หรือระบบภายนอก)
 * เรียกเมื่อมีการยืนยันเจ้าของสาขาหลักแล้ว
 */
export async function setMainBranchRegistryVerified(
  branchNumber: string,
  source: "manual" | "external" = "manual",
  externalId?: string | null
): Promise<void> {
  const branch = normalizeBranchNumber(branchNumber);
  if (!branch) return;
  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection(REGISTRY_COLLECTION).doc(branch).set(
    {
      branch_number: branch,
      verified_at: new Date().toISOString(),
      source,
      external_id: externalId ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
