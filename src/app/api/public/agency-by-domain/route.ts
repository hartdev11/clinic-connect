/**
 * Phase 20 — Agency by custom domain (public)
 * สำหรับ login page แสดง logo + สีตาม agency
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgencyByCustomDomain } from "@/lib/agency-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get("host") ?? request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname) {
    return NextResponse.json({ agency: null });
  }
  const agency = await getAgencyByCustomDomain(hostname);
  if (!agency) {
    return NextResponse.json({ agency: null });
  }
  return NextResponse.json({
    agency: {
      id: agency.id,
      name: agency.name,
      logoUrl: agency.logoUrl,
      primaryColor: agency.primaryColor,
    },
  });
}
