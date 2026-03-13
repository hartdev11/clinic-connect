/**
 * POST /api/onboarding/step4 — Create promotions (up to 3)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBranchesByOrgId, createPromotion } from "@/lib/clinic-data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { promotions } = body as {
      promotions: Array<{
        name: string;
        discountType: "percent" | "fixed";
        value: number;
        startAt?: string;
        endAt?: string;
        description?: string;
      }>;
    };
    if (!Array.isArray(promotions) || promotions.length > 3) {
      return NextResponse.json({ error: "ส่งโปรโมชันได้สูงสุด 3 รายการ" }, { status: 400 });
    }

    const branches = await getBranchesByOrgId(orgId);
    const branchIds = branches.map((b) => b.id);

    const ids: string[] = [];
    for (const p of promotions) {
      if (!p.name?.trim()) continue;
      const desc =
        p.discountType === "percent"
          ? `ส่วนลด ${p.value}%`
          : `ส่วนลด ${p.value} บาท`;
      const id = await createPromotion(orgId, {
        name: p.name.trim(),
        description: p.description ?? desc,
        targetGroup: "all",
        branchIds,
        status: "draft",
        startAt: p.startAt || new Date().toISOString(),
        endAt: p.endAt || undefined,
        visibleToAI: true,
      });
      ids.push(id);
    }
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    console.error("POST /api/onboarding/step4:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
