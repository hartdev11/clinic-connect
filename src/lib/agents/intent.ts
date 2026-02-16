/**
 * Agent A — Intent & Context Analyzer
 * หน้าที่: วิเคราะห์ว่าลูกค้าต้องการอะไร (คิด ไม่พูด)
 * โมเดล: Gemini (เปลี่ยนได้ใน clients)
 */
import { getOpenAI } from "./clients";
import type { IntentResult, IntentType, ServiceType, ServiceCategory, Area } from "./types";
import type { NormalizedMessage } from "./types";
import { hasFixedArea } from "./types";
import { detectSurgeryFromKeyword } from "./knowledge-base";

const SYSTEM_PROMPT = `คุณคือ Intent & Context Analyzer
หน้าที่ของคุณคือวิเคราะห์เจตนาของลูกค้าจากข้อความล่าสุด

กติกา (สำคัญมาก):
- ตอบเป็น JSON เท่านั้น
- ห้ามมีข้อความอื่นใดนอก JSON
- ห้ามใช้ markdown
- ห้ามใส่ \`\`\`json
- ถ้าไม่แน่ใจ ให้ใช้ intent = "other"
- ต้องมี key intent เสมอ

intent ที่อนุญาต: greeting | promotion_inquiry | price_inquiry | service_information | comparison_inquiry | hesitation | booking_request | availability_check | medical_question | aftercare_question | conversation_memory_check | complaint | general_chat | other

service ที่อนุญาต: filler | botox | rejuran | laser | skin | lifting | fat | hair | surgery | tattoo | consultation | other

area ที่อนุญาต: face | lip | chin | nose | jaw | cheek | under_eye | forehead | brow | eye | skin | body | hair | unknown

ตัวอย่าง Output:
{"intent": "promotion_inquiry", "service": "filler", "area": "lip", "confidence": 0.8}

ห้ามเด็ดขาด: คำอธิบาย, ข้อความภาษาไทย, markdown`;

const VALID_INTENTS: IntentType[] = [
  "greeting", "promotion_inquiry", "price_inquiry", "service_information",
  "comparison_inquiry", "hesitation", // 🔧 เพิ่ม intent ใหม่
  "booking_request", "availability_check", "medical_question", "aftercare_question",
  "conversation_memory_check", "complaint", "general_chat", "other",
];

function parseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = blockMatch ? blockMatch[1].trim() : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

function toValidIntent(s: string): IntentType {
  const lower = String(s).toLowerCase().trim();
  if (VALID_INTENTS.includes(lower as IntentType)) return lower as IntentType;
  // 🔧 เพิ่ม: comparison_inquiry — เปรียบเทียบบริการ
  if (/ต่างกัน|เปรียบเทียบ|อันไหนดี|ดีกว่า|กับ|vs|versus/.test(lower)) return "comparison_inquiry";
  // 🔧 เพิ่ม: hesitation — ความลังเล/กลัว
  if (/กลัว|ลังเล|ไม่กล้า|กังวล|เคยเห็น|เคสหลุด|พัง|เสีย/.test(lower)) return "hesitation";
  if (/โปร|promotion/.test(lower)) return "promotion_inquiry";
  if (/ราคา|price/.test(lower)) return "price_inquiry";
  if (/ทำอะไรได้|แบบไหนดี|ข้อมูล|service_information/.test(lower)) return "service_information";
  if (/จอง|booking/.test(lower)) return "booking_request";
  if (/คิว|ว่าง|availability/.test(lower)) return "availability_check";
  if (/แพทย์|medical|อักเสบ|บวม|แพ้/.test(lower)) return "medical_question";
  if (/หลัง|ดูแล|aftercare/.test(lower)) return "aftercare_question";
  if (/จำได้ไหม|คุยอะไรไว้|เมื่อกี้พูดถึง|conversation_memory/.test(lower)) return "conversation_memory_check";
  if (/ทัก|สวัสดี|hello/.test(lower)) return "greeting";
  if (/ไม่พอใจ|complaint/.test(lower)) return "complaint";
  return "other";
}

function toValidService(s: string | undefined): ServiceType | ServiceCategory | undefined {
  if (!s || typeof s !== "string") return undefined;
  const lower = String(s).toLowerCase().trim();
  // Direct match
  if (["chin_filler", "rejuran", "botox", "filler", "laser", "skin", "lifting", "fat", "hair", "surgery", "tattoo", "consultation", "other"].includes(lower)) {
    return lower as ServiceType | ServiceCategory;
  }
  // Pattern matching
  // ✅ FIX 1: เพิ่ม "จมูก" → surgery (สำคัญที่สุด)
  if (/จมูก|เสริมจมูก|ทำจมูก|แก้จมูก/.test(lower)) return "surgery";
  if (/ปาก|lip|ฝอ|filler|ฟิลเลอร์/.test(lower)) return "filler";
  if (/คาง|chin/.test(lower)) return "chin_filler";
  if (/rejuran|รีจูรัน/.test(lower)) return "rejuran";
  if (/botox|โบท็อกซ์/.test(lower)) return "botox";
  if (/laser|เลเซอร์/.test(lower)) return "laser";
  if (/ทรีตเมนต์|facial|ผิว/.test(lower)) return "skin";
  if (/ยก|hifu|ultra/.test(lower)) return "lifting";
  if (/ดูดไขมัน/.test(lower)) return "fat";
  if (/ปลูกผม|ผม/.test(lower)) return "hair";
  if (/ศัลยกรรม/.test(lower)) return "surgery";
  if (/สัก|tattoo/.test(lower)) return "tattoo";
  if (/ปรึกษา|consult/.test(lower)) return "consultation";
  return undefined;
}

function toValidArea(s: string | undefined): Area | undefined {
  if (!s || typeof s !== "string") return undefined;
  const lower = String(s).toLowerCase().trim();
  const validAreas: Area[] = ["face", "lip", "chin", "nose", "jaw", "cheek", "under_eye", "forehead", "brow", "eye", "skin", "body", "hair", "unknown"];
  if (validAreas.includes(lower as Area)) return lower as Area;
  if (/ปาก|lip/.test(lower)) return "lip";
  if (/คาง/.test(lower)) return "chin";
  if (/จมูก/.test(lower)) return "nose";
  if (/กราม|หน้าเรียว/.test(lower)) return "jaw";
  if (/แก้ม/.test(lower)) return "cheek";
  if (/ใต้ตา/.test(lower)) return "under_eye";
  if (/หน้าผาก/.test(lower)) return "forehead";
  if (/คิ้ว|หางตา/.test(lower)) return "brow";
  if (/ตา|ตาสองชั้น/.test(lower)) return "eye";
  if (/ผิว|หน้าใส/.test(lower)) return "skin";
  if (/ผม|หัวล้าน/.test(lower)) return "hair";
  return undefined;
}

export async function analyzeIntent(
  input: NormalizedMessage
): Promise<IntentResult> {
  const openai = getOpenAI();
  if (!openai) {
    // ไม่มี OpenAI → fallback ทันที
    return fallbackIntentFromKeywords(input.message) ?? {
      intent: "general_chat",
      confidence: 0.3,
    };
  }

  const hasHistory = (input.conversation_history?.length ?? 0) > 0;
  const historyStr = hasHistory
    ? `บริบทก่อนหน้า:\n${input.conversation_history
        ?.map((h) => `${h.role}: ${h.content}`)
        .join("\n")}\n\n`
    : "";
  const content = `${historyStr}ข้อความล่าสุดของลูกค้า: "${input.message}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 128,
      temperature: 0.1,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      console.warn("[Agent A Intent] Empty response from ChatGPT");
      return fallbackIntentFromKeywords(input.message) ?? {
        intent: "general_chat",
        confidence: 0.3,
      };
    }
    const parsed = parseJson<{ intent?: string; service?: string; area?: string; confidence?: number }>(text);
    if (!parsed || !parsed.intent?.trim()) {
      console.warn("[Agent A Intent] Parse failed, using fallback");
      return fallbackIntentFromKeywords(input.message) ?? {
        intent: "general_chat",
        confidence: 0.3,
      };
    }
    const intentStr = parsed.intent.trim();
    const detectedService = toValidService(parsed.service);
    let area = parsed.area ? toValidArea(parsed.area) : undefined;
    
    // 🧩 FIX 1: FIXED AREA SERVICE — ถ้า service มี FIXED AREA → set area อัตโนมัติ
    if (detectedService && !area) {
      const fixedArea = hasFixedArea(detectedService);
      if (fixedArea) {
        area = fixedArea;
      }
    }
    
    return {
      intent: toValidIntent(intentStr),
      service: detectedService,
      area,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
    };
  } catch (err) {
    // Intent พัง = fallback เสมอ (ห้าม return null)
    const status = (err as Error & { status?: number })?.status;
    console.warn("[Agent A Intent] AI failed, fallback used:", status ?? (err as Error)?.message?.slice(0, 60));
    return fallbackIntentFromKeywords(input.message) ?? {
      intent: "general_chat",
      confidence: 0.3,
    };
  }
}

/**
 * Fallback เมื่อ Gemini ไม่ตอบหรือ parse ไม่ได้ — ใช้คำหลักจากข้อความ
 * Keyword ครอบคลุมทั้งคลินิก
 */
export function fallbackIntentFromKeywords(message: string): IntentResult | null {
  const lower = message.toLowerCase().trim();
  
  let intent: IntentType = "general_chat";
  let service: ServiceCategory | ServiceType | undefined;
  let area: Area = "unknown";

  // Area Mapping
  // ⚠️ กติกา: Area keyword ห้าม set service เด็ดขาด
  if (/ปาก|lip/.test(lower)) area = "lip";
  else if (/คาง/.test(lower)) area = "chin";
  else if (/จมูก/.test(lower)) area = "nose"; // "จมูก" = area อย่างเดียว
  else if (/กราม|หน้าเรียว/.test(lower)) area = "jaw";
  else if (/แก้ม|แก้มตอบ/.test(lower)) area = "cheek";
  else if (/ใต้ตา/.test(lower)) area = "under_eye";
  else if (/หน้าผาก/.test(lower)) area = "forehead";
  else if (/คิ้ว|หางตา/.test(lower)) area = "brow";
  else if (/ตา|ตาสองชั้น/.test(lower)) area = "eye";
  else if (/หน้า/.test(lower)) area = "face"; // "หน้า" = area อย่างเดียว (ห้ามเดา service)
  else if (/ผิว|หน้าใส/.test(lower)) area = "skin";
  else if (/ผม|หัวล้าน/.test(lower)) area = "hair";

  // Service Mapping
  // ⚠️ Service ต้องมาจากคำที่ชัดเจนเท่านั้น (ห้ามเดาจาก area)
  // ✅ ใช้ Surgery Master Taxonomy สำหรับ detect ศัลยกรรมทั้งหมด
  const surgeryMatch = detectSurgeryFromKeyword(message);
  if (surgeryMatch) {
    service = surgeryMatch.service;
    area = surgeryMatch.area;
  } else if (/ศัลยกรรม/.test(lower)) {
    service = "surgery";
    // ไม่ set area เพราะยังไม่รู้ว่าศัลยกรรมอะไร
  } else if (/ฟิลเลอร์|filler/.test(lower)) service = "filler";
  else if (/โบท็อกซ์|botox/.test(lower)) service = "botox";
  else if (/รีจูรัน|rejuran/.test(lower)) service = "rejuran";
  else if (/เลเซอร์|laser/.test(lower)) service = "laser";
  else if (/ทรีตเมนต์|facial/.test(lower)) service = "skin";
  else if (/ยก|hifu|ultra/.test(lower)) service = "lifting";
  else if (/ดูดไขมัน/.test(lower)) service = "fat";
  else if (/ปลูกผม/.test(lower)) service = "hair";
  else if (/สัก|tattoo/.test(lower)) service = "tattoo";
  else if (/ปรึกษา|consult/.test(lower)) service = "consultation";

  // Intent Mapping
  if (/สวัสดี|hello|hi|อยู่ไหม|แอด/.test(lower)) intent = "greeting";
  else if (/จำได้ไหม|คุยอะไรไว้|เมื่อกี้พูดถึงอะไร|ที่คุยไป|ก่อนหน้านี้/.test(lower)) intent = "conversation_memory_check";
  // 🔧 เพิ่ม: comparison_inquiry — เปรียบเทียบบริการ
  else if (/ต่างกัน|เปรียบเทียบ|อันไหนดี|ดีกว่า|กับ|vs|versus/.test(lower)) intent = "comparison_inquiry";
  // 🔧 เพิ่ม: hesitation — ความลังเล/กลัว
  else if (/กลัว|ลังเล|ไม่กล้า|กังวล|เคยเห็น|เคสหลุด|พัง|เสีย/.test(lower)) intent = "hesitation";
  else if (/อยากทำ|สนใจ|อยากลอง|เล็งไว้/.test(lower)) intent = "promotion_inquiry";
  else if (/มีโปร|โปรอะไร|โปรโมชั่น|โปรจมูก|โปรฟิลเลอร์|โปรเลเซอร์|โปรตอนนี้/.test(lower)) intent = "promotion_inquiry";
  else if (/ราคา|เท่าไหร่|กี่บาท|โปร|ลด/.test(lower)) intent = "price_inquiry";
  else if (/ทำอะไรได้บ้าง|เหมาะไหม|แบบไหนดี/.test(lower)) intent = "service_information";
  else if (/จอง|นัด|เข้าไปทำ/.test(lower)) intent = "booking_request";
  else if (/คิว|ว่างไหม|วันนี้ได้ไหม/.test(lower)) intent = "availability_check";
  else if (/บวม|อักเสบ|แพ้|เจ็บ|เป็นหนอง|แดงผิดปกติ|อาการ|ผลข้างเคียง/.test(lower)) intent = "medical_question";
  else if (/หลังฉีด|หลังทำ|ดูแลยังไง|ห้ามอะไร/.test(lower)) intent = "aftercare_question";
  else if (/ไม่พอใจ|แย่มาก|มีปัญหา|ไม่โอเค/.test(lower)) intent = "complaint";
  else if (/คุย|จำได้|อะไรกัน|พูดถึง/.test(lower)) intent = "general_chat";

  // Fallback: ถ้ามี service แต่ intent ยังเป็น general_chat และมีคำว่า "ทำ/อยาก/สนใจ" → promotion_inquiry
  if (service && intent === "general_chat" && /ทำ|อยาก|สนใจ/.test(lower)) {
    intent = "promotion_inquiry";
  }

  // ❌ ห้ามใช้ other ถ้ายังพอถามต่อได้
  // ถ้า intent ยังเป็น general_chat และไม่มี service → ใช้ general_chat (ไม่เปลี่ยนเป็น other)
  // general_chat = ยังคุยได้, other = จบแล้ว

  return { intent, service, area, confidence: 0.6 };
}
