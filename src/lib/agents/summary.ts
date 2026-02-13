/**
 * Agent F — Memory / CRM / Analytics
 * หน้าที่: สรุปบทสนทนา เก็บ context ระยะยาว Tag ลูกค้า
 * โมเดล: Gemini
 */
import { getGemini } from "./clients";
import type { MemoryResult } from "./types";

const SYSTEM_PROMPT = `คุณคือ Conversation Summary Agent
หน้าที่คือสรุปข้อมูลเชิงธุรกิจจากบทสนทนา

กติกา:
- ตอบเป็น JSON เท่านั้น
- ถ้าไม่พบข้อมูล ให้ใช้ null
- ห้ามใส่คำอธิบาย
- ห้ามเดา

Output:
{"interest": ["filler"], "customer_stage": "considering | booking | done | unknown", "sentiment": "positive | neutral | negative", "follow_up_needed": true | false}`;

function parseJson<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : trimmed;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export async function summarizeForCRM(
  userMessage: string,
  replyText: string
): Promise<MemoryResult | null> {
  const gemini = getGemini();
  if (!gemini) return null;
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `ลูกค้า: ${userMessage}\n\nพนักงาน: ${replyText}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 128,
        temperature: 0.2,
      },
    });
    const text = response?.text?.trim();
    if (!text) return null;
    return parseJson<MemoryResult>(text);
  } catch (err) {
    // log เงียบ ๆ — quota/error ไม่ส่งถึงลูกค้า
    if (process.env.NODE_ENV === "development") {
      console.warn("[Agent F Memory] Skipped:", (err as Error)?.message?.slice(0, 80) ?? "error");
    }
    return null;
  }
}
