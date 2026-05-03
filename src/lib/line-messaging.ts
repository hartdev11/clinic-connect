/**
 * LINE Messaging API — reply (webhook) and push
 */

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_MAX_TEXT_LENGTH = 5000;

export function truncateLineText(text: string): string {
  if (text.length <= LINE_MAX_TEXT_LENGTH) return text;
  return text.slice(0, LINE_MAX_TEXT_LENGTH - 3) + "...";
}

/** Reply using webhook replyToken (preferred for inbound messages). */
export async function replyLineTextMessage(
  channelAccessToken: string,
  replyToken: string,
  text: string
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const safe = truncateLineText(text);
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken.trim()}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: safe }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  return { ok: true };
}

export type LineOutboundMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

const LINE_MAX_MESSAGES = 5;

/** Reply with multiple bubbles (text + images). LINE allows at most 5 messages per reply. */
export async function replyLineMessages(
  channelAccessToken: string,
  replyToken: string,
  messages: LineOutboundMessage[]
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const capped = messages.slice(0, LINE_MAX_MESSAGES);
  if (capped.length === 0) {
    return { ok: false, status: 400, body: "no messages" };
  }
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken.trim()}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: capped.map((m) =>
        m.type === "text"
          ? { type: "text", text: truncateLineText(m.text) }
          : {
              type: "image",
              originalContentUrl: m.originalContentUrl,
              previewImageUrl: m.previewImageUrl,
            }
      ),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  return { ok: true };
}

/** Push multiple bubbles (e.g. text + promotion images). */
export async function pushLineMessages(
  channelAccessToken: string,
  lineUserId: string,
  messages: LineOutboundMessage[]
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const capped = messages.slice(0, LINE_MAX_MESSAGES);
  if (capped.length === 0) {
    return { ok: false, status: 400, body: "no messages" };
  }
  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken.trim()}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: capped.map((m) =>
        m.type === "text"
          ? { type: "text", text: truncateLineText(m.text) }
          : {
              type: "image",
              originalContentUrl: m.originalContentUrl,
              previewImageUrl: m.previewImageUrl,
            }
      ),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  return { ok: true };
}

/** Push message to a user (fallback when reply is not possible). */
export async function pushLineTextMessage(
  channelAccessToken: string,
  lineUserId: string,
  text: string
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const safe = truncateLineText(text);
  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken.trim()}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: safe }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  return { ok: true };
}
