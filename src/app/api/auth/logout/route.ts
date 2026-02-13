import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";
import { getSessionFromCookies } from "@/lib/auth-session";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST() {
  const session = await getSessionFromCookies();
  if (session?.org_id || session?.email) {
    writeAuditLog({
      event: "logout",
      org_id: session.org_id ?? undefined,
      user_id: session.user_id ?? undefined,
      email: session.email ?? undefined,
    }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
