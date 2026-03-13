/**
 * Phase 9 — Reorder pricing packages (super_admin only)
 * PUT: { ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { setPricingPackagesOrder } from "@/lib/pricing-packages";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ids = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  const validIds = ids.filter((x): x is string => typeof x === "string");
  try {
    await setPricingPackagesOrder(validIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/packages/reorder:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
