/**
 * Phase 9 — Pricing packages API (super_admin only)
 * GET: list, POST: create
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { listPricingPackages, createPricingPackage } from "@/lib/pricing-packages";
import type { PricingPackageCreate } from "@/types/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const items = await listPricingPackages();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/packages:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const packageName = typeof b.packageName === "string" ? b.packageName.trim() : "";
  const packageSlug = typeof b.packageSlug === "string" ? b.packageSlug.trim() : "";
  if (!packageName || !packageSlug) {
    return NextResponse.json({ error: "packageName and packageSlug required" }, { status: 400 });
  }
  const data: PricingPackageCreate = {
    packageName,
    packageSlug,
    description: typeof b.description === "string" ? b.description : "",
    price: typeof b.price === "number" ? b.price : 0,
    billingPeriod: (b.billingPeriod as "monthly" | "yearly") ?? "monthly",
    conversationsIncluded: typeof b.conversationsIncluded === "number" ? b.conversationsIncluded : 0,
    maxBranches: typeof b.maxBranches === "number" ? b.maxBranches : 1,
    maxUsers: typeof b.maxUsers === "number" ? b.maxUsers : 1,
    features: (b.features as PricingPackageCreate["features"]) ?? {},
    allowTopup: !!(b.allowTopup ?? false),
    topupPricePer100: typeof b.topupPricePer100 === "number" ? b.topupPricePer100 : 0,
    isActive: b.isActive !== false,
    isPublic: b.isPublic !== false,
    sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
  };
  try {
    const id = await createPricingPackage(data);
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error("POST /api/admin/packages:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
