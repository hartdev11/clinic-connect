/**
 * ตรวจสอบเลขที่ใช้ยืนยันสาขาหลัก (ก่อนกดสมัคร)
 *
 * ฝั่งระบบทำอะไร (ที่ไหน / ยังไง / ละเอียดไหม):
 * 1. เรียก verifyMainBranchOwnership(branchNumber, orgName) — ลำดับการตรวจ:
 *    (1) HSS: ถ้าเปิด HSS_VERIFY_ENABLED + HSS_VERIFY_SEARCH_URL → ดึงเว็บกรม สบส. (hosp.hss.moph.go.th ฯลฯ) ตรวจว่าเลขใบอนุญาตมีในหน้ารายการและไม่มีข้อความ "ไม่พบ" และถ้ามีชื่อคลินิกจะเช็กว่าชื่อตรงกับในหน้าด้วย
 *    (2) EXTERNAL: ถ้ามี EXTERNAL_MAIN_BRANCH_VERIFY_URL → POST { branch_number, org_name } ไป API ภายนอก คืน ok: true ถ้าผ่าน
 *    (3) Registry: ดู Firestore main_branch_registry ว่า doc id = เลขที่กรอก มี verified_at หรือไม่ (admin ใส่ให้หลังตรวจเอกสาร)
 * 2. คืน { verified: true } เมื่อผ่านอย่างน้อยหนึ่งขั้น; ไม่ผ่านทุกขั้นคืน { verified: false }
 * ความถูกต้องขึ้นกับว่าตั้งค่า env ไว้แบบไหน (HSS = ตรวจจากเว็บจริง, Registry = ตรวจจากรายการที่ admin ยืนยันแล้ว)
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyMainBranchOwnership, isLicenseFormatInvalid } from "@/lib/main-branch-verification";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const branchNumber = typeof body.branchNumber === "string" ? body.branchNumber.trim() : "";
    const orgName = typeof body.orgName === "string" ? body.orgName.trim() : "";

    if (!branchNumber) {
      return NextResponse.json(
        { verified: false, error: "กรุณากรอกเลขที่ใช้ยืนยันสาขาหลัก" },
        { status: 400 }
      );
    }

    if (isLicenseFormatInvalid(branchNumber)) {
      return NextResponse.json(
        { verified: false, error: "รูปแบบไม่ถูกต้อง — ต้องเป็นตัวเลข 10–20 หลัก และไม่ใช่เลขซ้ำทั้งหมด (เลขที่ใบอนุญาตไทย 11 หลัก)" },
        { status: 400 }
      );
    }

    const verified = await verifyMainBranchOwnership(branchNumber, orgName);
    return NextResponse.json(verified ? { verified: true } : { verified: false, error: "เลขนี้ยังไม่ผ่านการตรวจสอบ — ต้องมีในระบบกรม สบส. หรือรายการที่ admin ยืนยันแล้ว" });
  } catch (err) {
    console.error("verify-main-branch:", err);
    return NextResponse.json(
      { verified: false, error: "ตรวจสอบไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
