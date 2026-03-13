/**
 * System Prompt Builder — สร้าง enriched system prompt จาก P1-P4 + clinic config
 */
import {
  ALL_PRODUCTS,
  VOICE_PERSONAS,
  detectSegment,
  detectIntent,
} from "./clinic-knowledge-base";

export function buildEnrichedSystemPrompt(config: {
  clinicName: string;
  voiceId?: keyof typeof VOICE_PERSONAS;
  leadScore: number;
  userMessage: string;
}): string {
  const voice = VOICE_PERSONAS[config.voiceId ?? "V03"];

  // Detect segment จาก userMessage
  const detectedSegment = detectSegment(config.userMessage);

  // Detect intent จาก userMessage
  const detectedIntent = detectIntent(config.userMessage);

  // Build product list (ทั้ง 182)
  const productList = ALL_PRODUCTS.map(
    (p) =>
      `- ${p.brand} (${p.category}) | ${p.country} | ${p.desc} | ราคา ${p.price} บาท | อยู่ได้ ${p.duration}`
  ).join("\n");

  const leadHint =
    config.leadScore >= 0.8
      ? "→ ลูกค้าพร้อมจองมาก! แนะนำนัดหมายได้เลย"
      : config.leadScore >= 0.6
        ? "→ ลูกค้าสนใจมาก กระตุ้นเพิ่มเติม"
        : config.leadScore >= 0.3
          ? "→ ลูกค้าสนใจปานกลาง ให้ข้อมูลเพิ่ม"
          : "→ ลูกค้าแค่ดูข้อมูล ไม่กดดัน";

  return `
คุณคือ AI Assistant ของ ${config.clinicName}

== บุคลิก (${voice.name}) ==
Tone: ${voice.tone} | Formality: ${voice.formality}
เรียกลูกค้าว่า: ${voice.pronouns_customer.join(", ")}
เรียกตัวเองว่า: ${voice.pronouns_self.join(", ")}
Keywords ที่ควรใช้: ${voice.keywords.join(", ")}
ห้ามใช้: ${voice.forbidden.join(", ")}
Emoji สูงสุด: ${voice.emoji_max} ตัวต่อข้อความ

== บริการทั้งหมด (182 รายการ) ==
${productList}

== ลูกค้าที่กำลังคุย ==
Segment: ${detectedSegment.name} | อายุ ${detectedSegment.age} | งบ ${detectedSegment.budget}
จุดที่ต้องระวัง: ${detectedSegment.pain_points.join(", ")}
คำที่กระตุ้นได้: ${detectedSegment.triggers.join(", ")}

== สถานการณ์การสนทนา ==
Intent: ${detectedIntent.name} (${detectedIntent.category})
แนวทางตอบ: ${detectedIntent.guidance}

Lead Score: ${config.leadScore.toFixed(2)}
${leadHint}

== กฎที่ห้ามละเมิด ==
1. ห้ามใช้คำ: รับประกัน การันตี 100% รักษาหาย ไม่มีผลข้างเคียง
2. ราคาต้องอยู่ในช่วงที่กำหนดในรายการบริการเท่านั้น ห้าม generate ราคาเอง
3. ถ้าไม่รู้ให้บอกว่าจะสอบถามเพิ่มเติม อย่าเดา
4. ทุกการนัดหมายต้องผ่าน booking system
5. ห้ามใส่ร้ายคู่แข่ง
`.trim();
}
