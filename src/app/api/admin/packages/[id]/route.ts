/**
 * Phase 9 — Pricing package by ID (super_admin only)
 * PATCH: update, DELETE: (not used - archive via isActive)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { updatePricingPackage } from "@/lib/pricing-packages";
import type { PricingPackageUpdate } from "@/types/pricing";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const data: PricingPackageUpdate = {};
  if (typeof b.packageName === "string") data.packageName = b.packageName.trim();
  if (typeof b.packageSlug === "string") data.packageSlug = b.packageSlug.trim();
  if (typeof b.description === "string") data.description = b.description;
  if (typeof b.price === "number") data.price = b.price;
  if (b.billingPeriod === "monthly" || b.billingPeriod === "yearly") data.billingPeriod = b.billingPeriod;
  if (typeof b.conversationsIncluded === "number") data.conversationsIncluded = b.conversationsIncluded;
  if (typeof b.maxBranches === "number") data.maxBranches = b.maxBranches;
  if (typeof b.maxUsers === "number") data.maxUsers = b.maxUsers;
  if (b.features && typeof b.features === "object") data.features = b.features as PricingPackageUpdate["features"];
  if (typeof b.allowTopup === "boolean") data.allowTopup = b.allowTopup;
  if (typeof b.topupPricePer100 === "number") data.topupPricePer100 = b.topupPricePer100;
  if (typeof b.isActive === "boolean") data.isActive = b.isActive;
  if (typeof b.isPublic === "boolean") data.isPublic = b.isPublic;
  if (typeof b.sortOrder === "number") data.sortOrder = b.sortOrder;
  try {
    const ok = await updatePricingPackage(id, data);
    if (!ok) return NextResponse.json({ error: "Package not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/packages/[id]:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
