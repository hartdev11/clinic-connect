/**
 * ดักข้อความที่ถาม "รายการโปร" แบบชัดเจน — บังคับใช้ข้อมูลโปรจากระบบ
 * และไม่ให้ duplicate-intent guard ตัดทิ้งเป็นแค่ "ได้เลยค่ะ"
 */
import type { Promotion } from "@/types/clinic";

export function isExplicitPromotionListingAsk(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (!t) return false;
  if (
    /รายการโปร|โปรทั้งหมด|ขอดูโปร|โปรมีอะไรบ้าง|มีโปรอะไรบ้าง|โปรอะไรบ้าง|มีโปรแบบไหน|โปรแบบไหน|โปรหมด|ทุกโปร/.test(t)
  ) {
    return true;
  }
  if (/มีโปร[^]{0,28}(แบบไหน|อะไร)/.test(t) && /บ้าง|ครับ|ค่ะ|มั้ย|ไหม|\?|ราคา/.test(t)) {
    return true;
  }
  if (/ราคา|เท่าไหร่|กี่บาท/.test(t) && /มีโปร|โปรแบบ|โปรอะไร|โปรบ้าง|โปรมั้ย|โปรไหม|โปรโมชั่น/.test(t)) {
    return true;
  }
  return false;
}

/**
 * ถามว่ามีโปรอื่นอีกไหม / มีแค่รายการเดียวหรือเปล่า — ต้องตอบจากรายการทั้งหมด ไม่ใช้ semantic ที่ชี้โปรเดิมซ้ำ
 */
export function isAskingForOtherPromotionsCount(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (!t) return false;
  if (
    /แค่อันเดียว|อันเดียว|หนึ่งรายการ|มีกี่โปร|กี่โปร|กี่รายการ|หมดยัง|เหลืออีก|นอกจากนี้|โปรอื่น|รายการอื่น|ยังมีโปร|มีอีกไหม|มีอีกมั้ย|มีอีกมาย|มีอีกบ้าง|มีแค่นี้|มีเท่านี้|มีแค่โปร|เหลือแค่/.test(
      t
    )
  ) {
    if (/โปร|โปรโมชั่น|รายการ/.test(t)) return true;
    if (/แค่อันเดียว|อันเดียว|มีอีกไหม|มีอีกมั้ย|กี่โปร|กี่รายการ/.test(t)) return true;
  }
  if (/หรือมีแค่|แล้วมีโปร|มีโปร[^]{0,20}อื่น|โปร[^]{0,16}อื่น[^]{0,12}ไหม|โปรโมชั่นอื่น/.test(t)) {
    return true;
  }
  return false;
}

/** บรรทัดเดียวสำหรับแชท — ตัดคำอธิบายที่ซ้ำกับชื่อโปร */
export function formatPromotionBulletText(p: {
  name?: string;
  description?: string;
  aiSummary?: string;
  extractedPrice?: number | null;
  extractedDiscount?: number | null;
}): string {
  const name = (p.name || "โปรโมชัน").trim();
  let line = `• ${name}`;
  if (p.extractedPrice != null && !Number.isNaN(Number(p.extractedPrice))) {
    line += ` — ฿${Number(p.extractedPrice).toLocaleString("th-TH")}`;
  } else if (p.extractedDiscount != null && !Number.isNaN(Number(p.extractedDiscount))) {
    line += ` — ลด ${p.extractedDiscount}%`;
  }
  let desc = (p.description ?? p.aiSummary ?? "").trim();
  if (desc && name) {
    const nl = name.toLowerCase();
    const dl = desc.toLowerCase();
    if (dl === nl) {
      desc = "";
    } else if (dl.startsWith(nl)) {
      desc = desc.slice(name.length).replace(/^[\s:—\-,]+/, "").trim();
    } else if (nl.length >= 14 && dl.startsWith(nl.slice(0, 14))) {
      desc = desc.slice(Math.min(desc.length, nl.length)).replace(/^[\s:—\-,]+/, "").trim();
    }
  }
  if (desc.length < 10) desc = "";
  if (desc) line += `\n  ${desc.slice(0, 120)}${desc.length > 120 ? "…" : ""}`;
  return line;
}

/** ถามความเห็น/ความคุ้มค่า — ไม่ใช่ถามรายการรวมอะไร (ห้ามไปใช้ buildPromotionDetailChatReply) */
export function isPromotionOpinionOrSuitabilityAsk(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (!t) return false;
  if (!/โปร|รายการ|แพ็ก|package/i.test(t)) return false;
  return /ดีไหม|ดีมั้ย|คุ้มไหม|คุ้มมั้ย|น่าทำไหม|น่าสนใจไหม|ควรทำไหม|แนะนำไหม|เหมาะไหม|เหมาะมั้ย|โอเคไหม|okไหม|ไปทำไหม|ทำเลยไหม|ไม่ดีหรอ|แย่ไหม|ไม่น่า|เสี่ยงไหม|ปลอดภัยไหม/.test(t);
}

/**
 * ถามรายการ/เงื่อนไขโปร (มีอะไรบ้าง ฯลฯ) — ห้ามจับแค่คำว่า "โปรนี้" เพราะจะชนกับ "โปรนี้ดีไหม"
 */
export function isPromotionDetailScopeAsk(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (isPromotionOpinionOrSuitabilityAsk(t)) return false;
  return (
    /โปรนี้มี|โปรนั้นมี|โปรนี้รวม|โปรนั้นรวม|โปรนี้ครอบคลุม|โปรนั้นครอบคลุม|ในโปร(นี้|นั้น)มี|รายละเอียด(ของ)?โปร|เงื่อนไข(ของ)?โปร/.test(t) ||
    /โปรนี้คืออะไร|โปรนั้นคืออะไร/.test(t) ||
    ((/โปรนี้|โปรนั้น|รายการนี้/).test(t) &&
      /มีอะไรบ้าง|รวมอะไรบ้าง|ได้อะไรบ้าง|รายละเอียด|เงื่อนไข|หมดอายุ|ถึงเมื่อไหร่|ราคา|กี่บาท/.test(t))
  );
}

/**
 * ดึง "ชื่อโปร" ที่ผู้ใช้พิมพ์มา — บรรทัดแรกของข้อความหลายบรรทัด หรือข้อความ user ก่อนหน้าใน session
 */
export function extractPromotionTitleHint(message: string, priorUserLines: string[]): string | null {
  const t = message.trim();
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const looksLikeQuestionOnly = (s: string) =>
    /^โปรนี้|โปรนั้น|มีอะไรบ้าง|รายละเอียด|ครับ|ค่ะ|\?|หรอ|มั้ย|ไหม/.test(s) && s.length < 40;

  if (lines.length >= 2) {
    const first = lines[0];
    if (first.length >= 10 && !looksLikeQuestionOnly(first)) return first;
  }
  const qIdx = t.search(/โปรนี้|โปรนั้น|มีอะไรบ้าง|รายละเอียด(ของ)?โปร/);
  if (qIdx >= 12) {
    const head = t.slice(0, qIdx).trim();
    if (head.length >= 10) return head.replace(/[\s:—\-]+$/g, "");
  }
  for (let i = priorUserLines.length - 1; i >= 0; i--) {
    const s = priorUserLines[i]?.trim() ?? "";
    if (s.length < 12) continue;
    if (looksLikeQuestionOnly(s)) continue;
    if (/โปร|บาท|ลด|ฉีด|แพ็ก|package|hifu|botox|filler|โบท็อกซ์|ฟิลเลอร์/i.test(s)) return s;
  }
  return null;
}

export function pickPromotionMatchingHint(hint: string | null, promos: Promotion[]): Promotion | null {
  if (!hint || hint.trim().length < 8) return null;
  const h = hint.replace(/\s+/g, " ").trim().toLowerCase();
  let best: Promotion | null = null;
  let bestScore = 0;
  for (const p of promos) {
    const n = (p.name || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!n) continue;
    let score = 0;
    if (n.includes(h) || h.includes(n)) score = Math.min(Math.max(h.length, n.length), 120);
    else {
      for (let len = Math.min(45, h.length, n.length); len >= 10; len--) {
        if (n.includes(h.slice(0, len)) || h.includes(n.slice(0, len))) {
          score = len;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 10 ? best : null;
}

/** ตอบรายละเอียดโปรหนึ่งรายการจากข้อมูลระบบ (ไม่ใช้ LLM เพื่อกันสรุปมั่ว) */
export function buildPromotionDetailChatReply(p: Promotion): string {
  const name = (p.name || "โปรโมชัน").trim();
  const desc = (p.description || p.aiSummary || "").trim();
  const price =
    p.extractedPrice != null && !Number.isNaN(Number(p.extractedPrice))
      ? `฿${Number(p.extractedPrice).toLocaleString("th-TH")}`
      : null;
  const period =
    p.startAt || p.endAt
      ? `${p.startAt ? new Date(p.startAt).toLocaleDateString("th-TH") : "?"} ถึง ${p.endAt ? new Date(p.endAt).toLocaleDateString("th-TH") : "?"}`
      : null;
  const proc =
    Array.isArray(p.extractedProcedures) && p.extractedProcedures.length > 0
      ? p.extractedProcedures.slice(0, 4).join(" · ")
      : null;

  const lines: string[] = [`โปร «${name}» มีประมาณนี้ค่ะ`];
  if (desc) lines.push(desc.slice(0, 120) + (desc.length > 120 ? "…" : ""));
  if (price) lines.push(`ราคา ${price}`);
  if (period) lines.push(`ช่วงโปร ${period}`);
  if (proc) lines.push(`รวม: ${proc}`);
  lines.push("ถ้าจะเอาแบบละเอียดกว่านี้ เดี๋ยวสรุปให้เพิ่มได้ค่ะ 💕");
  return lines.join("\n");
}

/** ตอบคำถามเชิงความเห็น — สั้น ยึดข้อมูลจริงบางจุด ไม่ตัดสินแทนลูกค้า */
export function buildPromotionOpinionReply(p: Promotion): string {
  const name = (p.name || "โปรโมชัน").trim();
  const price =
    p.extractedPrice != null && !Number.isNaN(Number(p.extractedPrice))
      ? `฿${Number(p.extractedPrice).toLocaleString("th-TH")}`
      : null;

  return [
    `ถ้าถามว่าโปร «${name}» ดีไหม — ขึ้นกับเป้าหมายของคุณเลยค่ะ 😊`,
    `${price ? `ราคาโปรตอนนี้ ${price}` : "มีโปรนี้ในระบบ"} ถ้าอยากเช็กว่าเหมาะกับคุณไหม ให้ทีมคลินิกช่วยประเมินสั้นๆ ได้ค่ะ`,
    "อยากดูรายละเอียดแบบข้อๆ พิมพ์ว่า «โปรนี้มีอะไรบ้าง» ได้เลยค่ะ",
  ].join("\n");
}
