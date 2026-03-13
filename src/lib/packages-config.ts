/**
 * Enterprise: รายการแพ็คเกจสำหรับหน้าเลือกดูแพ็คเกจ
 */
import type { OrgPlan } from "@/types/organization";
import { PLAN_MAX_BRANCHES } from "@/types/subscription";

export interface PackageOption {
  id: OrgPlan;
  name: string;
  description: string;
  priceLabel: string;
  priceBaht: number | null;
  features: string[];
  maxBranches: number;
  /** เลือกได้จากหน้า packages (ฟรี) */
  selectable: boolean;
}

export const PACKAGES: PackageOption[] = [
  {
    id: "starter",
    name: "Starter",
    description: "เหมาะสำหรับคลินิกเดี่ยว เริ่มต้นใช้ระบบ",
    priceLabel: "ฟรี",
    priceBaht: 0,
    maxBranches: PLAN_MAX_BRANCHES.starter,
    selectable: true,
    features: [
      "1 สาขา",
      "แชท LINE + AI ตอบอัตโนมัติ",
      "การจองและคิว",
      "โปรโมชันและความรู้ที่ AI ใช้",
      "รายงานพื้นฐาน",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "ขยายได้หลายสาขา",
    priceLabel: "เริ่มต้น ฿/เดือน",
    priceBaht: null,
    maxBranches: PLAN_MAX_BRANCHES.professional,
    selectable: false,
    features: [
      "สูงสุด 3 สาขา",
      "ทุกฟีเจอร์ Starter",
      "อัพเกรดได้จากหน้า Login หลังสมัคร",
    ],
  },
  {
    id: "multi_branch",
    name: "Multi Branch",
    description: "สำหรับเครือคลินิก",
    priceLabel: "เริ่มต้น ฿/เดือน",
    priceBaht: null,
    maxBranches: PLAN_MAX_BRANCHES.multi_branch,
    selectable: false,
    features: [
      "สูงสุด 10 สาขา",
      "ทุกฟีเจอร์ Professional",
      "อัพเกรดได้จากหน้า Login",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "ไม่จำกัดสาขา",
    priceLabel: "ติดต่อฝ่ายขาย",
    priceBaht: null,
    maxBranches: PLAN_MAX_BRANCHES.enterprise,
    selectable: false,
    features: [
      "สาขาไม่จำกัด",
      "ฟีเจอร์ครบตามแผน Enterprise",
      "อัพเกรดได้จากหน้า Login",
    ],
  },
];
