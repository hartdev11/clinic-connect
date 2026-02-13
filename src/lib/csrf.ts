/**
 * CSRF Protection — Enterprise Security
 * Double-Submit Cookie pattern สำหรับ state-changing requests
 * ใช้กับ form submissions ที่ไม่ผ่าน same-origin JSON
 */
import { randomBytes } from "crypto";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function getCsrfTokenFromRequest(request: Request): string | null {
  const header = request.headers.get(CSRF_HEADER);
  if (header?.trim()) return header.trim();
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`));
  return match?.[1]?.trim() ?? null;
}

export function validateCsrfToken(request: Request, cookieToken: string | null): boolean {
  const headerToken = request.headers.get(CSRF_HEADER)?.trim();
  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== 64) return false;
  return headerToken === cookieToken;
}

export { CSRF_COOKIE, CSRF_HEADER };
