import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/session";

/** Enterprise: Request ID for tracing — ส่งต่อใน header ให้ API ใช้ */
const REQUEST_ID_HEADER = "x-request-id";

/** CSP — Content Security Policy (Enterprise Security) */
const CSP_HEADER =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https: wss:; frame-ancestors 'self'";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (
    pathname.startsWith("/clinic") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/agency")
  ) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      return addEnterpriseHeaders(NextResponse.redirect(loginUrl), requestId);
    }
    const payload = await verifyToken(token);
    if (!payload) {
      const loginUrl = new URL("/login", request.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
      return addEnterpriseHeaders(res, requestId);
    }
    requestHeaders.set("x-org-id", payload.org_id ?? "");
    requestHeaders.set("x-user-id", payload.user_id ?? "");
    requestHeaders.set("x-role", payload.role ?? "owner");
  }

  return addEnterpriseHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    requestId
  );
}

function addEnterpriseHeaders(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId);
  res.headers.set("Content-Security-Policy", CSP_HEADER);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  return res;
}

/** Webhooks ข้าม middleware — เพื่อไม่ให้ body ถูก consume/corrupt (LINE, Stripe ฯลฯ) */
export const config = {
  matcher: [
    "/clinic/:path*",
    "/onboarding/:path*",
    "/agency/:path*",
    "/api/((?!webhooks/).*)", // ข้าม /api/webhooks/*
  ],
};
