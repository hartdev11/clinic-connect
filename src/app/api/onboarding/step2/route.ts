/**
 * POST /api/onboarding/step2 — Save selected services (batch create clinic_services)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { createClinicService, softDeleteAllClinicServices } from "@/lib/unified-knowledge/data";
import { getAllPresets } from "@/lib/onboarding-presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const presets = getAllPresets();
  return NextResponse.json({ items: presets });
}

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
    const { selected } = body as { selected: Array<{ id: string; name: string; category: string; defaultPrice: number; duration: number; description: string }> };
    if (!Array.isArray(selected) || selected.length === 0) {
      return NextResponse.json({ error: "เลือกอย่างน้อย 1 บริการ" }, { status: 400 });
    }

    const presets = getAllPresets();
    const presetMap = new Map(presets.map((p) => [p.id, p]));

    await softDeleteAllClinicServices(orgId);
    const ids: string[] = [];
    for (const s of selected.slice(0, 100)) {
      const preset = presetMap.get(s.id) ?? s;
      const id = await createClinicService({
        clinic_id: orgId,
        global_service_id: s.id.startsWith("preset_") ? null : s.id,
        custom_title: preset.name,
        custom_highlight: preset.description?.slice(0, 200) ?? "",
        custom_price: String(preset.defaultPrice || 0),
        custom_description: preset.description ?? "",
        status: "active",
      });
      ids.push(id);
    }
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    console.error("POST /api/onboarding/step2:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
