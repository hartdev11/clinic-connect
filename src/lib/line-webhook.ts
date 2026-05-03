import crypto from "crypto";

/**
 * ตรวจสอบ X-Line-Signature — Channel Secret = key, HMAC-SHA256(**raw body bytes**) → Base64
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#signature-validation
 *
 * **Body must be the exact bytes LINE POSTed** (use `Buffer` from `request.arrayBuffer()`, not
 * re-stringified JSON). Passing a UTF-8 `string` is OK if it matches those bytes exactly.
 */
export function verifyLineSignature(
  body: string | Buffer,
  signature: string,
  channelSecret: string
): boolean {
  const secret = channelSecret.trim();
  const sigHeader = signature.trim();
  if (!secret || !sigHeader) {
    if (process.env.NODE_ENV === "development") {
      console.log("[LINE Signature] Missing:", {
        channelSecret: !!secret,
        signature: !!sigHeader,
      });
    }
    return false;
  }

  try {
    const bodyBuf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    const expectedB64 = crypto.createHmac("sha256", secret).update(bodyBuf).digest("base64");

    // LINE compares Base64 digest strings; use length-safe timing-safe compare on UTF-8 bytes
    if (sigHeader.length !== expectedB64.length) {
      if (process.env.NODE_ENV === "development") {
        console.log("[LINE Signature] Length mismatch:", {
          sigLen: sigHeader.length,
          expectedLen: expectedB64.length,
          bodyBytes: bodyBuf.length,
        });
      }
      return false;
    }

    const match = crypto.timingSafeEqual(
      Buffer.from(sigHeader, "utf8"),
      Buffer.from(expectedB64, "utf8")
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[LINE Signature] Verification:", {
        bodyBytes: bodyBuf.length,
        signatureLength: sigHeader.length,
        expectedLength: expectedB64.length,
        signaturePreview: sigHeader.slice(0, 30) + "...",
        expectedPreview: expectedB64.slice(0, 30) + "...",
        match,
      });
    }

    return match;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[LINE Signature] Verification error:", err);
    }
    return false;
  }
}

export interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string; type?: string };
  message?: { type: string; text?: string };
  timestamp?: number;
}

export interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}

export function parseLineWebhook(body: string): LineWebhookBody {
  try {
    return JSON.parse(body) as LineWebhookBody;
  } catch {
    return { events: [] };
  }
}
