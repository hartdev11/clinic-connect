import crypto from "crypto";

/**
 * ตรวจสอบ X-Line-Signature — ใช้ Channel Secret เป็น key, HMAC-SHA256(body) แล้ว encode base64
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#signature-validation
 */
/**
 * ตรวจสอบ X-Line-Signature
 * LINE ส่ง signature มาเป็น base64-encoded HMAC-SHA256 hash
 * 
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#signature-validation
 */
export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  if (!channelSecret || !signature) {
    if (process.env.NODE_ENV === "development") {
      console.log("[LINE Signature] Missing:", { 
        channelSecret: !!channelSecret, 
        signature: !!signature 
      });
    }
    return false;
  }
  
  try {
    // คำนวณ HMAC-SHA256 hash จาก raw body
    const expected = crypto
      .createHmac("sha256", channelSecret)
      .update(body, "utf8")
      .digest("base64");
    
    // LINE ส่ง signature มาเป็น base64 string โดยตรง
    // เปรียบเทียบแบบ case-sensitive (LINE spec)
    const sigNormalized = signature.trim();
    const expNormalized = expected.trim();
    
    if (process.env.NODE_ENV === "development") {
      console.log("[LINE Signature] Verification:", {
        signatureLength: sigNormalized.length,
        expectedLength: expNormalized.length,
        signaturePreview: sigNormalized.slice(0, 30) + "...",
        expectedPreview: expNormalized.slice(0, 30) + "...",
        match: sigNormalized === expNormalized,
      });
    }
    
    // ใช้ timingSafeEqual เพื่อป้องกัน timing attack
    // แต่ต้อง decode base64 ก่อน
    let sigBuf: Buffer;
    let expBuf: Buffer;
    
    try {
      sigBuf = Buffer.from(sigNormalized, "base64");
    } catch {
      // ถ้า decode ไม่ได้ → ลองใช้ string comparison แทน
      if (process.env.NODE_ENV === "development") {
        console.log("[LINE Signature] Signature is not valid base64, using string comparison");
      }
      return sigNormalized === expNormalized;
    }
    
    expBuf = Buffer.from(expNormalized, "base64");
    
    if (sigBuf.length !== expBuf.length) {
      if (process.env.NODE_ENV === "development") {
        console.log("[LINE Signature] Length mismatch:", {
          sigLength: sigBuf.length,
          expLength: expBuf.length,
        });
      }
      return false;
    }
    
    return crypto.timingSafeEqual(sigBuf, expBuf);
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
