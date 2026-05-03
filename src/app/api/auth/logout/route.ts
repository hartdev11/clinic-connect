import { NextResponse } from "next/server";
import { COOKIE_NAME, getCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { ...getCookieOptions(), maxAge: 0 });
  return response;
}
