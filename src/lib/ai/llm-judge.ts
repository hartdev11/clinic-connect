/**
 * World-class: LLM-as-Judge — ตรวจ hallucination ด้วย LLM
 * รองรับกรณีที่ rule-based พลาด (semantic, ภาษาพูด ฯลฯ)
 */
import { getOpenAI } from "@/lib/agents/clients";
import { log } from "@/lib/logger";

const JUDGE_MODEL = "gpt-4o-mini";
const JUDGE_TIMEOUT_MS = 3000;

const JUDGE_SYSTEM = `You are a fact-checker. Given a REPLY and CONTEXT, answer ONLY one word:
- SAFE: reply contains NO facts/numbers/claims that are NOT supported by context
- UNSAFE: reply invents numbers, prices, medical claims, or facts not in context`;

export type JudgeResult = "SAFE" | "UNSAFE" | "SKIP";

export async function llmJudgeReply(
  reply: string,
  contextSummary: string,
  opts?: { correlationId?: string; org_id?: string }
): Promise<JudgeResult> {
  if (!reply?.trim() || !contextSummary?.trim()) return "SKIP";
  const openai = getOpenAI();
  if (!openai) return "SKIP";

  const contextTrimmed = contextSummary.slice(0, 1500);
  const replyTrimmed = reply.slice(0, 500);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

    const completion = await openai.chat.completions.create(
      {
        model: JUDGE_MODEL,
        messages: [
          { role: "system", content: JUDGE_SYSTEM },
          {
            role: "user",
            content: `CONTEXT:\n${contextTrimmed}\n\nREPLY:\n${replyTrimmed}\n\nAnswer (SAFE or UNSAFE only):`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    const ans = completion.choices[0]?.message?.content?.trim().toUpperCase();
    if (ans?.includes("UNSAFE")) return "UNSAFE";
    return "SAFE";
  } catch (err) {
    log.warn("LLM Judge error", {
      correlationId: opts?.correlationId,
      org_id: opts?.org_id,
      error: (err as Error)?.message?.slice(0, 50),
    });
    return "SKIP"; // on error, don't reject — rule-based already passed
  }
}
