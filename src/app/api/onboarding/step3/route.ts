/**
 * PATCH /api/onboarding/step3 — Update service prices
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { updateClinicService } from "@/lib/unified-knowledge/data";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
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
    const { updates } = body as {
      updates: Array<{ id: string; custom_price: string }>;
    };
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "updates must be array" }, { status: 400 });
    }
    for (const u of updates) {
      if (u.id && typeof u.custom_price === "string") {
        await updateClinicService(orgId, u.id, { custom_price: u.custom_price });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/onboarding/step3:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
