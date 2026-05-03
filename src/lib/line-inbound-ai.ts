/**
 * LINE inbound: production path uses {@link runLineClinicReply} (pipeline + Firestore โปร).
 * {@link generateLineAutoReply} = OpenRouter generic fallback (ไม่มี org / โปรจริง) — ใช้เมื่อ pipeline error เท่านั้น.
 */
import { formatExamplesForPrompt, searchDataset } from "@/lib/knowledge-dataset";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen-turbo";

const BASE_SYSTEM_PROMPT =
  "คุณคือแอดมินขายของคลินิกความงาม ตอบภาษาไทยสั้นๆ เป็นธรรมชาติ ตอบตรงคำถาม ไม่เกิน 3 ประโยค";

/** Thai fallback when OpenRouter is unavailable or returns nothing useful. */
export const LINE_AI_FALLBACK_THAI =
  "สวัสดีค่ะ ขอบคุณที่ติดต่อมาค่ะ ทีมงานจะติดต่อกลับหาคุณเร็วๆ นี้นะคะ 😊";

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
  }>;
  error?: { message?: string };
};

let loggedOpenRouterKeyStatus = false;

function logOpenRouterKeyOnce(): void {
  if (loggedOpenRouterKeyStatus) return;
  loggedOpenRouterKeyStatus = true;
  const k = process.env.OPENROUTER_API_KEY?.trim();
  if (!k) {
    console.log("[LINE AI] OPENROUTER_API_KEY: not set (using fallback)");
    return;
  }
  const masked = k.length <= 12 ? `*** (len=${k.length})` : `${k.slice(0, 10)}…${k.slice(-4)} (len=${k.length})`;
  console.log("[LINE AI] OPENROUTER_API_KEY loaded:", masked);
}

export async function generateLineAutoReply(userMessage: string): Promise<string> {
  logOpenRouterKeyOnce();
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[LINE AI] OPENROUTER_API_KEY not set — using fallback reply");
    }
    return LINE_AI_FALLBACK_THAI;
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  const examples = searchDataset(userMessage, null);
  const fewShot = formatExamplesForPrompt(examples);
  const systemPrompt =
    fewShot.length > 0 ? `${BASE_SYSTEM_PROMPT}\n\n${fewShot}` : BASE_SYSTEM_PROMPT;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "Clinic Connect LINE",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.6,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenRouterChatResponse;

    if (!res.ok) {
      console.error(
        "[LINE AI] OpenRouter error:",
        res.status,
        data?.error?.message ?? JSON.stringify(data).slice(0, 300)
      );
      return LINE_AI_FALLBACK_THAI;
    }

    const text = data.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  } catch (err) {
    console.error("[LINE AI] OpenRouter request failed:", err);
  }

  return LINE_AI_FALLBACK_THAI;
}

export type LineClinicReplyResult = { reply: string; media?: string[] };

/**
 * ตอบ LINE จาก pipeline คลินิก (intent, โปรจาก Firestore, รูปโปรเมื่อมี)
 */
export async function runLineClinicReply(opts: {
  orgId: string;
  lineUserId: string;
  text: string;
  branchId?: string | null;
}): Promise<LineClinicReplyResult> {
  const trimmed = opts.text.trim();
  if (!trimmed) {
    return { reply: LINE_AI_FALLBACK_THAI };
  }
  try {
    const { runPipeline } = await import("@/lib/agents/pipeline");
    const result = await runPipeline(trimmed, opts.lineUserId, undefined, {
      org_id: opts.orgId,
      branch_id: opts.branchId ?? undefined,
      channel: "line",
    });
    const reply = (result.reply ?? "").trim();
    const media = result.media?.filter((u): u is string => typeof u === "string" && u.length > 0);

    if (result.blocked) {
      return { reply: reply || "บริการถูกระงับชั่วคราว กรุณาติดต่อผู้ดูแลระบบค่ะ" };
    }

    if (!reply && (!media || media.length === 0)) {
      return { reply: LINE_AI_FALLBACK_THAI };
    }

    if (!reply && media && media.length > 0) {
      return {
        reply: "แนบรูปโปรโมชันให้แล้วนะคะ ถ้าอยากทราบรายละเอียดหรือราคาเพิ่มเติม บอกได้เลยค่ะ 😊",
        media,
      };
    }

    return {
      reply,
      media: media && media.length > 0 ? media : undefined,
    };
  } catch (err) {
    console.error("[LINE clinic] runPipeline failed:", err);
    return { reply: await generateLineAutoReply(trimmed) };
  }
}
