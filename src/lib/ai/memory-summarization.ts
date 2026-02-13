/**
 * Memory Summarization Job — Enterprise
 * ทุก X ข้อความ → สร้าง profile ลด token ป้องกัน context overflow
 * Enterprise: Memory explosion — จำกัด input และ output
 */
import { db } from "@/lib/firebase-admin";
import { getOpenAI } from "@/lib/agents/clients";
import {
  getCustomerMemory,
  upsertCustomerMemory,
  SUMMARIZE_EVERY_MESSAGES,
  MAX_SUMMARY_CHARS,
} from "./customer-memory-store";

const COLLECTION = "conversation_feedback";
/** จำกัดจำนวน conversation ที่ใช้สร้าง summary — ป้องกัน token explosion */
const SUMMARIZATION_INPUT_LIMIT = 25;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

/** รัน summarization สำหรับลูกค้าที่ถึง threshold */
export async function runMemorySummarizationForCustomer(
  orgId: string,
  userId: string
): Promise<{ ok: boolean; summary?: string }> {
  const memory = await getCustomerMemory(orgId, userId);
  if (!memory || memory.message_count < SUMMARIZE_EVERY_MESSAGES) {
    return { ok: false };
  }

  const snap = await db
    .collection(COLLECTION)
    .where("org_id", "==", orgId)
    .where("user_id", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(SUMMARIZATION_INPUT_LIMIT)
    .get();

  const recent = snap.docs.map((d) => {
    const data = d.data();
    return {
      user: data.userMessage ?? "",
      bot: data.botReply ?? "",
      at: toISO(data.createdAt),
    };
  });

  const openai = getOpenAI();
  if (!openai) return { ok: false };

  const prompt = `สรุปการคุยต่อไปนี้เป็น profile สั้น ๆ (max 200 คำ):
- ความสนใจหลัก
- โปร/บริการที่ถาม
- preference ด้านราคา
- sentiment โดยรวม

Conversations:
${recent
  .slice(0, 15)
  .map((c) => `[${c.at}] User: ${c.user}\nBot: ${c.bot}`)
  .join("\n---\n")}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "สรุปเป็น JSON: { summary: string, preferences: string[], sentiment: string }",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let summary = content;
    try {
      const parsed = JSON.parse(content);
      summary = parsed.summary ?? content;
    } catch {
      // ใช้ raw ถ้า parse ไม่ได้
    }
    summary = String(summary).slice(0, MAX_SUMMARY_CHARS);

    await upsertCustomerMemory(orgId, userId, {
      summary,
      summarization_done: true,
    });

    return { ok: true, summary };
  } catch (err) {
    console.warn("[Memory Summarization] Error:", (err as Error)?.message?.slice(0, 80));
    return { ok: false };
  }
}
