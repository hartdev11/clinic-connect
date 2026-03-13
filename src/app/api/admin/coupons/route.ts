/**
 * Phase 9 — Coupons API (super_admin only)
 * GET: list, POST: create
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { listCoupons, createCoupon } from "@/lib/coupons";
import type { CouponCreate } from "@/types/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const items = await listCoupons();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/admin/coupons:", err);
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
  const couponCode = typeof b.couponCode === "string" ? b.couponCode.trim() : "";
  const discountType = (b.discountType as CouponCreate["discountType"]) ?? "percentage";
  const discountValue = typeof b.discountValue === "number" ? b.discountValue : 0;
  const validFrom = typeof b.validFrom === "string" ? b.validFrom : new Date().toISOString();
  const validUntil = typeof b.validUntil === "string" ? b.validUntil : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  if (!couponCode) {
    return NextResponse.json({ error: "couponCode required" }, { status: 400 });
  }
  const data: CouponCreate = {
    couponCode,
    discountType,
    discountValue,
    validFrom,
    validUntil,
    maxTotalUses: typeof b.maxTotalUses === "number" ? b.maxTotalUses : 0,
    isActive: b.isActive !== false,
  };
  try {
    const id = await createCoupon(data);
    return NextResponse.json({ id, success: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("already exists")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("POST /api/admin/coupons:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Server error" },
      { status: 500 }
    );
  }
}
