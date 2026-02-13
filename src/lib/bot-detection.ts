/**
 * Bot Detection — Enterprise Security
 * ตรวจสอบ User-Agent ที่เป็น bot/crawler ที่ไม่พึงประสงค์
 */
const BOT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /^curl\b/i,
  /^wget\b/i,
  /python-requests/i,
  /go-http-client/i,
  /^java\//i,
  /^php\b/i,
  /^$/,
];

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent || typeof userAgent !== "string") return true;
  const ua = userAgent.trim();
  if (ua.length < 10) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

export function getClientUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}
