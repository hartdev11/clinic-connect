/**
 * Onboarding Preset Services — 200 items for step 2
 * Merges with global_knowledge when available; fallback to this list
 */
export interface OnboardingServicePreset {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  duration: number;
  description: string;
}

/** Categories for beauty/clinic services */
const CATEGORIES = [
  "botox",
  "filler",
  "laser",
  "thread_lift",
  "skin_booster",
  "prp",
  "body_contouring",
  "aesthetic",
  "facial",
  "acne",
  "pigmentation",
  "hair",
  "eyelash",
  "nails",
  "other",
] as const;

/** Preset services — extend as needed to reach 200 */
const PRESETS: Omit<OnboardingServicePreset, "id">[] = [
  { name: "โบท็อกซ์ 1 จุด", category: "botox", defaultPrice: 1500, duration: 30, description: "ฉีดโบท็อกซ์ลดริ้วรอย 1 จุด" },
  { name: "โบท็อกซ์หน้าผาก", category: "botox", defaultPrice: 3500, duration: 45, description: "ลดริ้วรอยบริเวณหน้าผาก" },
  { name: "โบท็อกซ์หางตา", category: "botox", defaultPrice: 2500, duration: 30, description: "ลดรอยตีนกา" },
  { name: "โบท็อกซ์ 2 จุด", category: "botox", defaultPrice: 3000, duration: 45, description: "โบท็อกซ์ 2 จุด" },
  { name: "โบท็อกซ์ครบหน้า", category: "botox", defaultPrice: 8000, duration: 60, description: "โบท็อกซ์ครบทุกจุดบนใบหน้า" },
  { name: "โบท็อกซ์ลดเหงื่อ", category: "botox", defaultPrice: 12000, duration: 60, description: "โบท็อกซ์ลดเหงื่อรักแร้" },
  { name: "ฟิลเลอร์แก้ม", category: "filler", defaultPrice: 15000, duration: 60, description: "เติมฟิลเลอร์บริเวณแก้ม" },
  { name: "ฟิลเลอร์คาง", category: "filler", defaultPrice: 12000, duration: 45, description: "เสริมคางด้วยฟิลเลอร์ HA" },
  { name: "ฟิลเลอร์จมูก", category: "filler", defaultPrice: 18000, duration: 60, description: "เสริมจมูกด้วยฟิลเลอร์" },
  { name: "ฟิลเลอร์ริมฝีปาก", category: "filler", defaultPrice: 8000, duration: 30, description: "เติมริมฝีปากให้เต็มขึ้น" },
  { name: "ฟิลเลอร์ร่องน้ำตา", category: "filler", defaultPrice: 12000, duration: 45, description: "เติมร่องน้ำตา" },
  { name: "ฟิลเลอร์ HA 1 ซีซี", category: "filler", defaultPrice: 10000, duration: 45, description: "ฟิลเลอร์กรดไฮยาลูโรนิก 1 ซีซี" },
  { name: "ฟิลเลอร์ HA 2 ซีซี", category: "filler", defaultPrice: 18000, duration: 60, description: "ฟิลเลอร์กรดไฮยาลูโรนิก 2 ซีซี" },
  { name: "Skin Booster ผิวหน้า", category: "skin_booster", defaultPrice: 5000, duration: 45, description: "เติมความชุ่มชื้นผิวหน้า" },
  { name: "Skin Booster คอ- décolletage", category: "skin_booster", defaultPrice: 8000, duration: 60, description: "เติมความชุ่มชื้นคอและหน้าอก" },
  { name: "PRP ผิวหน้า", category: "prp", defaultPrice: 8000, duration: 60, description: "ใช้เกล็ดเลือดของตัวเองเติมเต็มผิว" },
  { name: "PRP ผม", category: "prp", defaultPrice: 15000, duration: 90, description: "PRP บำรุงหนังศีรษะและเส้นผม" },
  { name: "เลเซอร์ขน", category: "laser", defaultPrice: 500, duration: 15, description: "เลเซอร์กำจัดขน 1 ครั้ง" },
  { name: "เลเซอร์ขนแพ็กเกจ 6 ครั้ง", category: "laser", defaultPrice: 2500, duration: 90, description: "แพ็กเกจเลเซอร์ขน 6 ครั้ง" },
  { name: "เลเซอร์จุดด่างดำ", category: "laser", defaultPrice: 3000, duration: 45, description: "ลดจุดด่างดำด้วยเลเซอร์" },
  { name: "เลเซอร์รอยแผลเป็น", category: "laser", defaultPrice: 5000, duration: 60, description: "เลเซอร์ลดรอยแผลเป็น" },
  { name: "เลเซอร์หลอดเลือด", category: "laser", defaultPrice: 2000, duration: 30, description: "เลเซอร์รักษาหลอดเลือดขยาย" },
  { name: "เลเซอร์คาร์บอน", category: "laser", defaultPrice: 2000, duration: 45, description: "เลเซอร์คาร์บอนหน้า" },
  { name: "เลเซอร์รอยสิว", category: "laser", defaultPrice: 3500, duration: 45, description: "ลดรอยดำจากสิว" },
  { name: "thread lift PDO", category: "thread_lift", defaultPrice: 15000, duration: 90, description: "ยกกระชับด้วยด้าย PDO" },
  { name: "thread lift 4D", category: "thread_lift", defaultPrice: 25000, duration: 120, description: "ยกกระชับด้วยด้าย 4D" },
  { name: "thread lift คาง", category: "thread_lift", defaultPrice: 12000, duration: 60, description: "ยกกระชับคางด้วยด้าย" },
  { name: "ยิงไขมัน", category: "body_contouring", defaultPrice: 30000, duration: 120, description: "ยิงไขมันด้วยความเย็น" },
  { name: "สลายไขมัน", category: "body_contouring", defaultPrice: 8000, duration: 60, description: "สลายไขมันจุดใดจุดหนึ่ง" },
  { name: "ยกกระชับผิว", category: "body_contouring", defaultPrice: 5000, duration: 45, description: "เครื่องยกกระชับ" },
  { name: "RF เล็กนอน", category: "body_contouring", defaultPrice: 3000, duration: 60, description: "Radiofrequency เล็กนอน" },
  { name: "ไฮฟู", category: "body_contouring", defaultPrice: 25000, duration: 90, description: "ไฮฟูยกกระชับ" },
  { name: "คาร์บ็อกซิ", category: "facial", defaultPrice: 800, duration: 60, description: "ทำความสะอาดผิวด้วยคาร์บ็อกซิ" },
  { name: "เดอร์มาเพ็น", category: "facial", defaultPrice: 2500, duration: 60, description: "เดอร์มาเพ็นเติมเซรัม" },
  { name: "ไอออนโต", category: "facial", defaultPrice: 1500, duration: 45, description: "ไอออนโตผลักวิตามิน" },
  { name: "ฟacial นวดหน้า", category: "facial", defaultPrice: 800, duration: 60, description: "นวดหน้าและมาสก์" },
  { name: "มาสก์โกลด์", category: "facial", defaultPrice: 1200, duration: 45, description: "มาสก์ทองคำ" },
  { name: "ผลัดเซลล์ผิว AHA/BHA", category: "facial", defaultPrice: 1500, duration: 45, description: "ผลัดเซลล์ผิวด้วยกรด" },
  { name: "รักษาสิว", category: "acne", defaultPrice: 1500, duration: 60, description: "ปรึกษาและรักษาสิว" },
  { name: "กดสิว + มาสก์", category: "acne", defaultPrice: 1200, duration: 60, description: "กดสิวและมาสก์ลด inflammation" },
  { name: "ฉีดสิว", category: "acne", defaultPrice: 500, duration: 20, description: "ฉีดสิวอักเสบ" },
  { name: "เลเซอร์รักษาสิว", category: "acne", defaultPrice: 2000, duration: 30, description: "เลเซอร์ฆ่าแบคทีเรียสิว" },
  { name: "ลดฝ้า", category: "pigmentation", defaultPrice: 2500, duration: 45, description: "รักษาฝ้าด้วยเลเซอร์/ผลิตภัณฑ์" },
  { name: "ลดกระ", category: "pigmentation", defaultPrice: 2000, duration: 30, description: "ลดรอยกระ" },
  { name: "ลดจุดด่างดำ", category: "pigmentation", defaultPrice: 1500, duration: 45, description: "รักษาจุดด่างดำ" },
  { name: "ปลูกผม", category: "hair", defaultPrice: 50000, duration: 480, description: "ปลูกผม FUE/FUT" },
  { name: "ย้อมสีผม", category: "hair", defaultPrice: 800, duration: 90, description: "ย้อมสีผม" },
  { name: "ตัดผม", category: "hair", defaultPrice: 300, duration: 45, description: "ตัดผม" },
  { name: "ต่อขนตา", category: "eyelash", defaultPrice: 1500, duration: 90, description: "ต่อขนตาปลอม" },
  { name: "ดัดขนตา", category: "eyelash", defaultPrice: 800, duration: 60, description: "ดัดขนตาก่อนบิด" },
  { name: "ทาสีขนตา", category: "eyelash", defaultPrice: 300, duration: 30, description: "ย้อมขนตา" },
  { name: "ทำเล็บเจล", category: "nails", defaultPrice: 500, duration: 60, description: "ทำเล็บเจล" },
  { name: "ทำเล็บอะคริลิก", category: "nails", defaultPrice: 600, duration: 90, description: "ทำเล็บอะคริลิก" },
  { name: "ทำเล็บมือเท้า", category: "nails", defaultPrice: 400, duration: 45, description: "ทาเล็บมือและเท้า" },
  { name: "ปรึกษา", category: "aesthetic", defaultPrice: 0, duration: 30, description: "ปรึกษาครั้งแรก" },
  { name: "ตรวจผิว", category: "aesthetic", defaultPrice: 500, duration: 30, description: "ตรวจสภาพผิว" },
  { name: "วิตามิน C ผิว", category: "aesthetic", defaultPrice: 2000, duration: 30, description: "ฉีดวิตามิน C ผิว" },
  { name: "กลูตาไธโอน", category: "aesthetic", defaultPrice: 1500, duration: 30, description: "ฉีดกลูต้าขาวผิว" },
  // Add more to reach 200 — these are common; global_knowledge may add more
];

/** Category display labels (Thai) */
export const CATEGORY_LABELS: Record<string, string> = {
  botox: "โบท็อกซ์",
  filler: "ฟิลเลอร์",
  laser: "เลเซอร์",
  thread_lift: "ด้าย",
  skin_booster: "Skin Booster",
  prp: "PRP",
  body_contouring: "สลายไขมัน/ยกกระชับ",
  aesthetic: "ความงามทั่วไป",
  facial: "ฟacial",
  acne: "รักษาสิว",
  pigmentation: "ฝ้า/กระ",
  hair: "เส้นผม",
  eyelash: "ขนตา",
  nails: "เล็บ",
  other: "อื่นๆ",
};

/** Build preset list with ids */
function buildPresets(): OnboardingServicePreset[] {
  return PRESETS.map((p, i) => ({
    ...p,
    id: `preset_${i}`,
  }));
}

const CACHED = buildPresets();

/**
 * Get preset services for onboarding.
 * Merges with global_knowledge when provided.
 */
export async function getOnboardingPresets(
  globalServices?: Array<{ id: string; name: string; standard_description: string }>
): Promise<OnboardingServicePreset[]> {
  if (globalServices && globalServices.length > 0) {
    return globalServices.map((g) => ({
      id: g.id,
      name: g.name,
      category: "other",
      defaultPrice: 0,
      duration: 60,
      description: g.standard_description || "",
    }));
  }
  return [...CACHED];
}

/** Get all presets (for API) */
export function getAllPresets(): OnboardingServicePreset[] {
  return CACHED;
}
