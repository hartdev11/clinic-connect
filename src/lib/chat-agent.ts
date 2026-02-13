import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `คุณคือพนักงานคลินิกความงามที่ตอบแชทลูกค้าทาง LINE
คุยแบบคนจริง เป็นกันเอง อบอุ่น เหมือนเพื่อนผู้หญิงคนหนึ่ง

บุคลิก:
- พูดภาษาคน ไม่เป็นทางการ ไม่อ่านเหมือนสคริปต์
- ใช้คำลงท้าย เช่น ค่ะ ค่า นะคะ ได้ตามบริบท
- น้ำเสียงสุภาพ เป็นมิตร แต่ไม่ call center
- ตอบสั้น กระชับ ประมาณ 2–4 ประโยค

กติกาสำคัญ (ต้องทำตาม):
- ต้องตอบคำถามล่าสุดของลูกค้าให้ตรงประเด็นทันที
- ห้ามทักทายหรือเปิดบทสนทนาใหม่ ถ้าลูกค้าไม่ได้ทักก่อน
- ห้ามเดาเจตนาลูกค้าเพิ่มจากที่ถาม
- ถ้าถามโปร ราคา หรือบริการ → ตอบข้อมูลนั้นก่อนเสมอ
- ถ้าจะถามต่อหรือชวนคุย ทำได้หลังจากตอบครบแล้วเท่านั้น
- คำตอบต้องเป็นประโยคสมบูรณ์ ห้ามตอบเป็นคำเดียวหรือขาดความหมาย

ข้อห้าม:
- ห้ามตอบอ้อม
- ห้ามตอบเหมือน FAQ หรือโฆษณา
- ห้ามวินิจฉัยโรคหรือให้คำแนะนำแพทย์เชิงลึก
- ถ้าต้องให้แพทย์ดู ให้แนะนำมาคลินิกหรือโทรสอบถามแบบนุ่มนวล

ตัวอย่างที่ไม่ควรทำ:
ลูกค้า: มีโปรอะไรบ้างครับ รีจูรัน
❌ สวัสดีค่าาา สนใจ Rejuran ใช่ไหมคะ ตอนนี้เรามีโปร...

ตัวอย่างที่ควรทำ:
ลูกค้า: มีโปรอะไรบ้างครับ รีจูรัน
✅ ตอนนี้ Rejuran มีโปรอยู่ค่า ราคาเริ่มที่ xxx บาท รายละเอียดเดี๋ยวสรุปให้ได้นะคะ 😊

จำไว้เสมอ:
ถ้าคำตอบไหนดูเหมือน AI หรือดูเป็นสคริปต์
ให้ปรับเป็นภาษาคนทันที`;

let _openai: OpenAI | null = null;
let _gemini: GoogleGenAI | null = null;

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: key.trim() });
  return _openai;
}

function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key?.trim()) return null;
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: key.trim() });
  return _gemini;
}

/** โหมดเลือก AI: openai | gemini | auto (ลอง openai ก่อน ถ้าไม่ได้ลอง gemini) */
function getChatProvider(): "openai" | "gemini" | "auto" {
  const v = process.env.CHAT_PROVIDER?.trim().toLowerCase();
  if (v === "openai" || v === "gemini" || v === "auto") return v;
  return "auto";
}

async function replyWithOpenAI(userMessage: string): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 220,
    temperature: 0.9,
  });
  const content = completion.choices[0]?.message?.content?.trim();
  return content ?? null;
}

async function replyWithGemini(userMessage: string): Promise<string | null> {
  const gemini = getGemini();
  if (!gemini) return null;
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userMessage,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 220,
      temperature: 0.9,
    },
  });
  const text = response?.text?.trim();
  return text ?? null;
}

/**
 * เรียก Chat Agent สร้างคำตอบจากข้อความลูกค้า
 * รองรับ OpenAI (ChatGPT) และ Gemini ตาม CHAT_PROVIDER
 * คืน null ถ้าไม่มี API key หรือทั้งคู่ error
 */
export async function chatAgentReply(userMessage: string): Promise<string | null> {
  const provider = getChatProvider();

  if (provider === "openai") {
    try {
      return await replyWithOpenAI(userMessage);
    } catch (err) {
      console.error("[Chat Agent] OpenAI error:", err);
      return null;
    }
  }

  if (provider === "gemini") {
    try {
      return await replyWithGemini(userMessage);
    } catch (err) {
      console.error("[Chat Agent] Gemini error:", err);
      return null;
    }
  }

  // auto: ลอง OpenAI ก่อน ถ้า error หรือ null ค่อยลอง Gemini
  try {
    const openaiResult = await replyWithOpenAI(userMessage);
    if (openaiResult) return openaiResult;
  } catch (err) {
    console.warn("[Chat Agent] OpenAI failed, trying Gemini:", (err as Error)?.message?.slice(0, 80));
  }

  try {
    return await replyWithGemini(userMessage);
  } catch (err) {
    console.error("[Chat Agent] Gemini error:", err);
    return null;
  }
}
