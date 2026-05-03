/**
 * Public promotions for marketing page (/promotions) — no session.
 * Resolves org via PROMOTIONS_PUBLIC_ORG_ID, or agency custom domain (single org under agency),
 * or ?org_id= in development only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgencyByCustomDomain, getOrgsByAgencyId } from "@/lib/agency-data";
import { getPublicPromotionsForOrg } from "@/lib/clinic-data";
import { toSignedUrlIfFirebaseStorage } from "@/lib/promotion-storage";

export const dynamic = "force-dynamic";

async function resolvePublicPromotionsOrgId(request: NextRequest): Promise<string | null> {
  if (process.env.NODE_ENV === "development") {
    const devOrg = request.nextUrl.searchParams.get("org_id")?.trim();
    if (devOrg) return devOrg;
  }

  const envOrg = process.env.PROMOTIONS_PUBLIC_ORG_ID?.trim();
  if (envOrg) return envOrg;

  const hostParam = request.nextUrl.searchParams.get("host");
  const raw =
    hostParam ??
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  const host = raw.split(":")[0].toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;

  const agency = await getAgencyByCustomDomain(host);
  if (!agency) return null;
  const orgs = await getOrgsByAgencyId(agency.id);
  if (orgs.length === 1) return orgs[0].id;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const orgId = await resolvePublicPromotionsOrgId(request);
    if (!orgId) {
      return NextResponse.json({ items: [] as { id: string; title: string; description: string; imageUrl?: string }[] });
    }

    const promos = await getPublicPromotionsForOrg(orgId, { limit: 36 });
    const items = await Promise.all(
      promos.map(async (p) => {
        const first = p.media?.[0];
        const rawUrl = first?.type === "image" && first?.url ? first.url : "";
        const imageUrl = rawUrl ? await toSignedUrlIfFirebaseStorage(rawUrl) : undefined;
        return {
          id: p.id,
          title: p.name || "โปรโมชัน",
          description: (p.description ?? p.aiSummary ?? "").trim() || "—",
          imageUrl,
        };
      })
    );

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("[GET /api/public/promotions]", err);
    return NextResponse.json(
      { items: [], error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
