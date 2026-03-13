/**
 * Enterprise: ตรวจสอบเลขที่ใบอนุญาตสถานพยาบาลจากเว็บกรม สบส. จริง
 * ใช้เมื่อ HSS_VERIFY_ENABLED=true และ HSS_VERIFY_SEARCH_URL ชี้ไปยังหน้าค้นหา/ผลลัพธ์ที่แสดงเลขใบอนุญาต
 *
 * คลินิกความงามในไทย: เลขที่ใบอนุญาต 11 หลัก ตรวจได้ที่ hosp.hss.moph.go.th / privatehospital.hss.moph.go.th
 * ตั้งค่า URL จากการตรวจสอบหน้าค้นหาของเว็บจริง (อาจเป็น GET ?no= หรือ path ที่แสดงผลตามเลขที่ค้น)
 */

const HSS_VERIFY_ENABLED = process.env.HSS_VERIFY_ENABLED?.trim().toLowerCase() === "true";
const HSS_VERIFY_SEARCH_URL = process.env.HSS_VERIFY_SEARCH_URL?.trim() ?? "";
const HSS_VERIFY_TIMEOUT_MS = 15_000;

function normalizeLicense(v: string | null | undefined): string {
  return (v ?? "").toString().replace(/\D/g, "").trim();
}

/**
 * ตรวจว่าเลขที่ใบอนุญาตมีในผลลัพธ์จากเว็บที่กำหนดหรือไม่
 * - ดึง HTML จาก URL (แทนที่ {license} ใน URL ถ้ามี)
 * - ถ้าในเนื้อหามีเลขที่ใบอนุญาตและไม่มีข้อความ "ไม่พบ" ถือว่าผ่าน
 */
/** เลขใบอนุญาตไทย 11 หลัก; อนุโลม 10–20 หลัก */
const LICENSE_DIGITS_MAX = 20;

export async function verifyLicenseWithHssWebsite(
  licenseNumber: string | null | undefined,
  orgName?: string | null
): Promise<boolean> {
  const license = normalizeLicense(licenseNumber);
  if (!license || license.length < 10 || license.length > LICENSE_DIGITS_MAX) return false;
  if (!HSS_VERIFY_ENABLED || !HSS_VERIFY_SEARCH_URL) return false;

  const url = HSS_VERIFY_SEARCH_URL.includes("{license}")
    ? HSS_VERIFY_SEARCH_URL.replace("{license}", encodeURIComponent(license))
    : `${HSS_VERIFY_SEARCH_URL}${HSS_VERIFY_SEARCH_URL.includes("?") ? "&" : "?"}no=${encodeURIComponent(license)}`;

  let body: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HSS_VERIFY_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClinicConnect/1.0; +https://clinic-connect.th)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    body = await res.text();
  } catch {
    return false;
  }

  const noResultPatterns = [
    /ไม่พบข้อมูล/i,
    /ไม่พบรายการ/i,
    /no result/i,
    /ไม่มีข้อมูล/i,
    /ไม่มีรายการ/i,
  ];
  const hasNoResult = noResultPatterns.some((p) => p.test(body));
  if (hasNoResult) return false;

  const hasLicense = body.includes(license);
  if (!hasLicense) return false;

  if (orgName && orgName.trim().length > 0) {
    const nameParts = orgName.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
    const nameFound = nameParts.length === 0 || nameParts.some((part) => part.length >= 2 && body.includes(part));
    if (!nameFound) return false;
  }

  return true;
}

export function isHssVerifyEnabled(): boolean {
  return HSS_VERIFY_ENABLED && HSS_VERIFY_SEARCH_URL.length > 0;
}
