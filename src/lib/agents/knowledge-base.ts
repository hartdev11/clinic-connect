/**
 * Knowledge Structure — ข้อมูลแน่น แต่ไม่ผูกสาขา
 * เปลี่ยนสาขา = เปลี่ยน data ไม่ต้องแก้ agent / prompt
 */
import type { ServiceCategory, Area } from "./types";

/**
 * โครงสร้างข้อมูลบริการ — ทุกบริการต้องมีโครงเดียวกัน
 * ใช้สำหรับให้ AI ตอบได้ถูกต้องและไม่มั่ว
 */
export interface ServiceKnowledge {
  // ข้อมูลพื้นฐาน
  description: string;
  areas: Area[];
  
  // ราคา & โปรโมชัน (แยกกันชัดเจน)
  priceRange: string; // ช่วงราคาเริ่มต้น
  priceNote?: string; // ราคาขึ้นกับอะไรบ้าง
  promotion?: string; // โปรโมชัน (ถ้ามี)
  promotionCondition?: string; // เงื่อนไขโปร
  
  // ข้อมูลเพิ่มเติม
  suitableFor?: string; // เหมาะกับใคร
  notSuitableFor?: string; // ไม่เหมาะกับใคร
  procedure?: string; // วิธีทำ (คร่าวๆ)
  techniques?: string[]; // เทคนิคที่ใช้ (สำหรับศัลยกรรม)
  materials?: string[]; // วัสดุที่ใช้ (สำหรับศัลยกรรม)
  duration?: string; // ระยะเวลา
  recovery?: string; // การพักฟื้น
  risks?: string; // ความเสี่ยง
  faq?: string[]; // คำถามที่ลูกค้าถามบ่อย
  
  // หมายเหตุทั่วไป
  note?: string;
}

export const ClinicKnowledge: Record<ServiceCategory, ServiceKnowledge> = {
  filler: {
    description: "ช่วยปรับรูปหน้า เติมเต็มร่องลึก",
    areas: ["lip", "chin", "jaw", "cheek", "under_eye"],
    priceRange: "เริ่มต้น 8,000 – 20,000 บาท",
    priceNote: "ขึ้นกับยี่ห้อและปริมาณที่ใช้",
    suitableFor: "คนที่อยากปรับรูปหน้า เติมเต็มร่องลึก ปรับปาก คาง กราม",
    notSuitableFor: "คนที่มีอาการแพ้สารเติมเต็ม, มีการติดเชื้อบริเวณที่จะฉีด",
    procedure: "ฉีดสารเติมเต็ม (Hyaluronic Acid) เข้าใต้ผิวหนัง",
    duration: "ประมาณ 15-30 นาที",
    recovery: "อาจบวมแดงเล็กน้อย 1-2 วัน, ใช้ชีวิตปกติได้",
    risks: "บวม แดง ช้ำ, อาจมีอาการแพ้ (พบได้น้อย)",
    faq: ["เจ็บไหม", "อยู่ได้นานแค่ไหน", "แก้ได้ไหม"],
  },
  botox: {
    description: "ลดริ้วรอยและปรับรูปหน้า",
    areas: ["forehead", "brow", "jaw"],
    priceRange: "เริ่มต้น 3,000 บาท",
    priceNote: "ขึ้นกับจำนวนยูนิตที่ใช้",
    suitableFor: "คนที่อยากลดริ้วรอย ปรับรูปหน้า ลดกราม",
    notSuitableFor: "คนที่ตั้งครรภ์, มีโรคกล้ามเนื้ออ่อนแรง",
    procedure: "ฉีด Botulinum Toxin เข้าไปในกล้ามเนื้อ",
    duration: "ประมาณ 10-15 นาที",
    recovery: "อาจมีรอยเข็มเล็กน้อย ใช้ชีวิตปกติได้ทันที",
    risks: "อาจมีอาการอ่อนแรงชั่วคราว (หายเอง)",
    faq: ["เจ็บไหม", "อยู่ได้นานแค่ไหน", "ทำบ่อยได้ไหม"],
  },
  rejuran: {
    description: "ฟื้นฟูผิวให้แข็งแรง ฉ่ำ ใส",
    areas: ["face", "under_eye"],
    priceRange: "เริ่มต้น 12,000 บาท",
    priceNote: "แนะนำทำเป็นคอร์ส 3-5 ครั้ง",
    suitableFor: "คนที่อยากฟื้นฟูผิว หน้าใส กระชับ",
    notSuitableFor: "คนที่มีการติดเชื้อที่ผิว, แผลเปิด",
    procedure: "ฉีดสาร PDRN เข้าใต้ผิวหนัง",
    duration: "ประมาณ 20-30 นาที",
    recovery: "อาจบวมแดงเล็กน้อย 1-2 วัน",
    risks: "บวม แดง ช้ำ (พบได้น้อย)",
    faq: ["ต้องทำกี่ครั้ง", "เห็นผลเมื่อไหร่", "เจ็บไหม"],
    note: "แนะนำทำเป็นคอร์ส",
  },
  laser: {
    description: "ปรับสีผิว ลดรอย",
    areas: ["face", "body"],
    priceRange: "เริ่มต้น 1,500 บาท",
    priceNote: "ขึ้นกับขนาดพื้นที่และเทคนิค",
    suitableFor: "คนที่อยากปรับสีผิว ลดรอย กระ",
    notSuitableFor: "คนที่ผิวแพ้ง่าย, มีแผลเปิด, ตั้งครรภ์",
    procedure: "ยิงเลเซอร์ไปที่ผิวเพื่อปรับสีและลดรอย",
    duration: "ประมาณ 15-30 นาที",
    recovery: "อาจแดงเล็กน้อย 1-2 วัน, ต้องทาครีมกันแดด",
    risks: "แดง แสบร้อน (ชั่วคราว)",
    faq: ["เจ็บไหม", "ต้องทำกี่ครั้ง", "เห็นผลเมื่อไหร่"],
  },
  skin: {
    description: "ทรีตเมนต์ผิวหน้า",
    areas: ["face"],
    priceRange: "เริ่มต้น 2,000 บาท",
    priceNote: "ขึ้นกับประเภททรีตเมนต์",
    suitableFor: "คนที่อยากดูแลผิวหน้าโดยรวม",
    notSuitableFor: "คนที่ผิวแพ้ง่ายมาก",
    procedure: "ทำความสะอาดและบำรุงผิวหน้า",
    duration: "ประมาณ 30-60 นาที",
    recovery: "ใช้ชีวิตปกติได้ทันที",
    risks: "พบได้น้อยมาก",
    faq: ["ทำบ่อยได้ไหม", "เหมาะกับใคร"],
  },
  lifting: {
    description: "ยกกระชับหน้า",
    areas: ["face"],
    priceRange: "เริ่มต้น 15,000 บาท",
    priceNote: "ขึ้นกับเทคนิคและเครื่องมือ",
    suitableFor: "คนที่อยากยกกระชับหน้า",
    notSuitableFor: "คนที่ผิวบางมาก, มีการติดเชื้อ",
    procedure: "ใช้คลื่นความถี่สูง (HIFU/Ulthera) ยกกระชับ",
    duration: "ประมาณ 30-60 นาที",
    recovery: "อาจแดงเล็กน้อย ใช้ชีวิตปกติได้",
    risks: "แดง แสบร้อน (ชั่วคราว)",
    faq: ["เจ็บไหม", "เห็นผลเมื่อไหร่", "อยู่ได้นานแค่ไหน"],
  },
  fat: {
    description: "ดูดไขมัน",
    areas: ["body"],
    priceRange: "เริ่มต้น 20,000 บาท",
    priceNote: "ขึ้นกับขนาดพื้นที่และเทคนิค",
    suitableFor: "คนที่อยากลดไขมันส่วนเกิน",
    notSuitableFor: "คนที่มีโรคประจำตัวรุนแรง, น้ำหนักเกินมาก",
    procedure: "ดูดไขมันออกจากร่างกาย",
    duration: "ประมาณ 1-2 ชั่วโมง",
    recovery: "ต้องพักฟื้น 3-7 วัน, ใส่ชุดกด 1-3 เดือน",
    risks: "บวม ช้ำ, อาจมีอาการแทรกซ้อน (พบได้น้อย)",
    faq: ["เจ็บไหม", "พักฟื้นนานไหม", "เห็นผลเมื่อไหร่"],
  },
  hair: {
    description: "ปลูกผม",
    areas: ["hair"],
    priceRange: "เริ่มต้น 30,000 บาท",
    priceNote: "ขึ้นกับจำนวนกราฟต์",
    suitableFor: "คนที่ผมบาง หัวล้าน",
    notSuitableFor: "คนที่ไม่มีเส้นผมบริเวณท้ายทอย",
    procedure: "ย้ายเส้นผมจากท้ายทอยไปปลูกที่บริเวณที่ต้องการ",
    duration: "ประมาณ 4-8 ชั่วโมง",
    recovery: "พักฟื้น 3-5 วัน, รอผมงอก 3-6 เดือน",
    risks: "บวม ช้ำ, อาจมีแผลติดเชื้อ (พบได้น้อย)",
    faq: ["เจ็บไหม", "ผมจะร่วงไหม", "เห็นผลเมื่อไหร่"],
  },
  surgery: {
    description: "ศัลยกรรม (เสริมจมูก, ตาสองชั้น, คาง, กราม, ดูดไขมัน, เสริมหน้าอก ฯลฯ)",
    areas: ["face", "body", "nose"],
    priceRange: "ประเมินจากเคสเป็นหลัก",
    priceNote: "ขึ้นกับเทคนิค แพทย์ และวัสดุที่ใช้ แนะนำให้ประเมินกับแพทย์เพื่อราคาที่เหมาะสม",
    suitableFor: "คนที่อยากปรับรูปหน้า/รูปร่างอย่างถาวร",
    notSuitableFor: "คนที่มีโรคประจำตัวรุนแรง, ไม่พร้อมผ่าตัด",
    procedure: "ขึ้นกับประเภทศัลยกรรม (ต้องปรึกษาแพทย์)",
    duration: "ขึ้นกับประเภท (1-4 ชั่วโมง)",
    recovery: "ขึ้นกับประเภท (3 วัน - 2 สัปดาห์)",
    risks: "ขึ้นกับประเภท (ต้องปรึกษาแพทย์)",
    faq: ["เจ็บไหม", "พักฟื้นนานไหม", "แก้ได้ไหม", "ใช้ได้นานแค่ไหน"],
    note: "ต้องปรึกษาแพทย์ก่อนเสมอ",
  },
  tattoo: {
    description: "สักคิ้ว",
    areas: ["brow"],
    priceRange: "เริ่มต้น 5,000 บาท",
    priceNote: "ขึ้นกับเทคนิคและรูปแบบ",
    suitableFor: "คนที่อยากมีคิ้วที่ชัดเจนถาวร",
    notSuitableFor: "คนที่แพ้สีย้อม, มีแผลที่คิ้ว",
    procedure: "สักสีเข้าไปที่ผิวหนังบริเวณคิ้ว",
    duration: "ประมาณ 1-2 ชั่วโมง",
    recovery: "คิ้วจะเข้ม 1-2 สัปดาห์ แล้วค่อยจางลง, ต้องทาครีมบำรุง",
    risks: "อาจมีอาการแพ้ (พบได้น้อย)",
    faq: ["เจ็บไหม", "อยู่ได้นานแค่ไหน", "แก้ได้ไหม"],
  },
  consultation: {
    description: "ปรึกษาแพทย์",
    areas: ["unknown"],
    priceRange: "ฟรี",
    suitableFor: "ทุกคนที่อยากปรึกษา",
    procedure: "ปรึกษาแพทย์เพื่อประเมินและแนะนำ",
    duration: "ประมาณ 15-30 นาที",
    faq: ["ต้องนัดล่วงหน้าไหม", "ฟรีจริงไหม"],
  },
  other: {
    description: "บริการอื่นๆ",
    areas: ["unknown"],
    priceRange: "สอบถามรายละเอียด",
    note: "กรุณาสอบถามเพิ่มเติม",
  },
};

/**
 * ดึงข้อมูล service
 * รองรับ surgery_nose โดยการ map เป็น surgery + area = nose
 */
export function getServiceKnowledge(service?: ServiceCategory | string, area?: Area): ServiceKnowledge | null {
  if (!service) return null;
  const key = String(service).toLowerCase() as ServiceCategory;
  const baseKnowledge = ClinicKnowledge[key] || null;
  
  // ถ้าเป็น surgery + nose → ใช้ knowledge เฉพาะสำหรับเสริมจมูก
  if (key === "surgery" && area === "nose" && baseKnowledge) {
    return {
      ...baseKnowledge,
      ...getSurgeryNoseKnowledge(), // Override ด้วยข้อมูลเฉพาะเสริมจมูก
    };
  }
  
  return baseKnowledge;
}

/**
 * Knowledge เฉพาะสำหรับเสริมจมูก (surgery_nose)
 * Phase 1: ใส่ข้อมูลละเอียดสำหรับเสริมจมูก
 */
function getSurgeryNoseKnowledge(): Partial<ServiceKnowledge> {
  return {
    description: "การเสริมจมูกเป็นการปรับรูปจมูกให้ได้ทรงที่ต้องการ โดยใช้เทคนิคและวัสดุที่เหมาะสมกับโครงสร้างจมูกเดิม",
    suitableFor: "คนที่อยากปรับรูปจมูกให้ได้ทรงที่ต้องการ เช่น โด่งขึ้น คมขึ้น ปลายพุ่ง หรือปรับสันจมูก",
    notSuitableFor: "คนที่มีโรคประจำตัวรุนแรง, มีการติดเชื้อที่จมูก, มีปัญหาโครงสร้างจมูกที่ซับซ้อน, ไม่พร้อมผ่าตัด",
    procedure: "การเสริมจมูกทำได้หลายเทคนิค เช่น Open Rhinoplasty (เปิด) หรือ Closed Rhinoplasty (ปิด) ขึ้นอยู่กับโครงสร้างจมูกเดิมและเป้าหมายที่ต้องการ",
    techniques: [
      "Open Rhinoplasty (เปิด) - เห็นโครงสร้างชัดเจน แก้ไขได้ละเอียด",
      "Closed Rhinoplasty (ปิด) - แผลเล็ก ฟื้นตัวเร็ว",
      "Hybrid Technique - ผสมผสานเทคนิคตามความเหมาะสม"
    ],
    materials: [
      "ซิลิโคน (Silicone) - ราคาไม่แพง ใช้ได้นาน แต่ต้องเลือกคุณภาพ",
      "กระดูกอ่อน (Cartilage) - จากร่างกายเอง ปลอดภัย ไม่แพ้",
      "Gore-Tex - นุ่ม ดูเป็นธรรมชาติ",
      "Porous Polyethylene (Medpor) - แข็งแรง ใช้ได้นาน"
    ],
    duration: "ประมาณ 1-3 ชั่วโมง (ขึ้นอยู่กับเทคนิคและความซับซ้อน)",
    recovery: "พักฟื้น 3-7 วัน, บวมช้ำ 1-2 สัปดาห์, รอผลลัพธ์สุดท้าย 3-6 เดือน",
    risks: "บวม ช้ำ, อาจมีอาการแทรกซ้อน (พบได้น้อย), อาจต้องแก้ไข (กรณีผลลัพธ์ไม่เป็นไปตามที่ต้องการ)",
    faq: [
      "เจ็บไหม - ใช้ยาสลบ/ยาชา ไม่เจ็บระหว่างทำ",
      "พักฟื้นนานไหม - ประมาณ 3-7 วัน",
      "แก้ได้ไหม - แก้ได้ แต่ต้องรอให้แผลหายดีก่อน",
      "ใช้ได้นานแค่ไหน - ถาวร (ขึ้นอยู่กับวัสดุที่ใช้)",
      "ราคาเท่าไหร่ - ขึ้นอยู่กับเทคนิค แพทย์ และวัสดุที่ใช้",
      "ต้องนัดปรึกษาก่อนไหม - แนะนำให้ปรึกษาคุณหมอก่อนเสมอ"
    ],
    note: "ต้องปรึกษาแพทย์ก่อนเสมอ เพื่อประเมินโครงสร้างจมูกและเลือกเทคนิคที่เหมาะสม",
  };
}

/**
 * ดึงรายการ service ที่ทำได้ใน area นั้น
 */
export function getServicesForArea(area: Area): ServiceCategory[] {
  const services: ServiceCategory[] = [];
  for (const [service, knowledge] of Object.entries(ClinicKnowledge)) {
    if (knowledge.areas.includes(area)) {
      services.push(service as ServiceCategory);
    }
  }
  return services;
}

/**
 * Surgery Master Taxonomy (ครบทุกส่วนจริง)
 * ใช้สำหรับ detect service จาก keyword
 */
export const SURGERY_TAXONOMY: Record<string, { service: "surgery"; area: Area }> = {
  // ใบหน้า / ศีรษะ
  "จมูก": { service: "surgery", area: "nose" },
  "เสริมจมูก": { service: "surgery", area: "nose" },
  "แก้จมูก": { service: "surgery", area: "nose" },
  "ตา": { service: "surgery", area: "eye" },
  "ตาสองชั้น": { service: "surgery", area: "eye" },
  "เปิดหัวตา": { service: "surgery", area: "eye" },
  "หางตา": { service: "surgery", area: "eye" },
  "คิ้ว": { service: "surgery", area: "brow" },
  "ยกคิ้ว": { service: "surgery", area: "brow" },
  "หน้าผาก": { service: "surgery", area: "forehead" },
  "ยกหน้าผาก": { service: "surgery", area: "forehead" },
  "ดึงหน้า": { service: "surgery", area: "face" },
  "คาง": { service: "surgery", area: "chin" },
  "เสริมคาง": { service: "surgery", area: "chin" },
  "กราม": { service: "surgery", area: "jaw" },
  "เหลากราม": { service: "surgery", area: "jaw" },
  "โหนกแก้ม": { service: "surgery", area: "cheek" },
  "ปรับรูปหน้า": { service: "surgery", area: "face" },
  "เสริมหน้าผาก": { service: "surgery", area: "forehead" },
  "ลดแก้ม": { service: "surgery", area: "cheek" },
  "คางสองชั้น": { service: "surgery", area: "chin" },
  "คอ": { service: "surgery", area: "body" },
  "เหนียง": { service: "surgery", area: "body" },
  
  // ปาก / ริมฝีปาก
  "ปาก": { service: "surgery", area: "lip" },
  "ปากกระจับ": { service: "surgery", area: "lip" },
  "ปากบาง": { service: "surgery", area: "lip" },
  "ยกมุมปาก": { service: "surgery", area: "lip" },
  "ริมฝีปาก": { service: "surgery", area: "lip" },
  "ตัดเหงือก": { service: "surgery", area: "lip" },
  
  // หู
  "หู": { service: "surgery", area: "body" },
  "หูแฉก": { service: "surgery", area: "body" },
  "ปรับรูปหู": { service: "surgery", area: "body" },
  "เย็บหู": { service: "surgery", area: "body" },
  
  // หน้าอก
  "หน้าอก": { service: "surgery", area: "body" },
  "เสริมหน้าอก": { service: "surgery", area: "body" },
  "แก้หน้าอก": { service: "surgery", area: "body" },
  "ยกกระชับหน้าอก": { service: "surgery", area: "body" },
  "ลดขนาดหน้าอก": { service: "surgery", area: "body" },
  "หัวนม": { service: "surgery", area: "body" },
  "ปานนม": { service: "surgery", area: "body" },
  
  // ลำตัว
  "ดูดไขมัน": { service: "surgery", area: "body" },
  "แขน": { service: "surgery", area: "body" },
  "ขา": { service: "surgery", area: "body" },
  "หน้าท้อง": { service: "surgery", area: "body" },
  "หลัง": { service: "surgery", area: "body" },
  "เอว": { service: "surgery", area: "body" },
  "กระชับสัดส่วน": { service: "surgery", area: "body" },
  "ตัดหนังหน้าท้อง": { service: "surgery", area: "body" },
  "แก้ผิวหย่อน": { service: "surgery", area: "body" },
  
  // จุดซ่อนเร้น
  "จุดซ่อนเร้น": { service: "surgery", area: "body" },
  "ช่องคลอด": { service: "surgery", area: "body" },
  "กระชับช่องคลอด": { service: "surgery", area: "body" },
  "แคม": { service: "surgery", area: "body" },
  "เพศชาย": { service: "surgery", area: "body" },
};

/**
 * Detect surgery service + area จาก keyword
 */
export function detectSurgeryFromKeyword(keyword: string): { service: "surgery"; area: Area } | null {
  const lower = keyword.toLowerCase();
  for (const [key, value] of Object.entries(SURGERY_TAXONOMY)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return null;
}
