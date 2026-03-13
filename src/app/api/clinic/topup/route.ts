/**
 * Phase 17 — Top-up conversations
 * POST { amount: 100 | 500 | 1000 }
 * Creates Stripe Checkout Session (one-time payment)
 * On success webhook → increment conversations_included in subscription
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getStripe } from "@/lib/stripe";
import { listPricingPackages, getPricingPackage } from "@/lib/pricing-packages";
import {
  checkBillingIdempotency,
  setBillingIdempotencyResult,
} from "@/lib/billing-idempotency";

export const dynamic = "force-dynamic";

const ALLOWED_AMOUNTS = [100, 500, 1000] as const;

function getTopupPriceSatang(
  pkg: { topupPricePer100: number; topupPricePer500?: number; topupPricePer1000?: number },
  amount: 100 | 500 | 1000
): number {
  if (amount === 100) return Math.round(pkg.topupPricePer100 * 100); // baht → satang
  if (amount === 500) {
    const price = pkg.topupPricePer500 ?? pkg.topupPricePer100 * 5;
    return Math.round(price * 100);
  }
  const price = pkg.topupPricePer1000 ?? pkg.topupPricePer100 * 10;
  return Math.round(price * 100);
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const amount = ALLOWED_AMOUNTS.includes(body.amount) ? body.amount : null;
    if (!amount) {
      return NextResponse.json({ error: "amount ต้องเป็น 100, 500 หรือ 1000" }, { status: 400 });
    }

    const packageId = typeof body.packageId === "string" ? body.packageId.trim() : null;
    let pkg;
    if (packageId) {
      pkg = await getPricingPackage(packageId);
    } else {
      const pkgs = await listPricingPackages();
      pkg = pkgs.find((p) => p.allowTopup) ?? pkgs[0] ?? null;
    }
    if (!pkg || !pkg.allowTopup) {
      return NextResponse.json({ error: "ไม่พบแพ็กเกจที่รองรับ topup" }, { status: 400 });
    }

    const amountSatang = getTopupPriceSatang(pkg, amount);
    if (amountSatang <= 0) {
      return NextResponse.json({ error: "ราคา topup ไม่ถูกต้อง" }, { status: 400 });
    }

    const period = `topup-${amount}-${new Date().toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:mm
    const idem = await checkBillingIdempotency(orgId, period);
    if (idem.duplicate && idem.result) {
      return NextResponse.json(idem.result);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const successUrl = body.successUrl ?? `${baseUrl}/clinic/settings?topup=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancelUrl ?? `${baseUrl}/clinic/settings?topup=cancelled`;

    const stripe = getStripe();
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: {
              name: `Top-up ${amount} conversations`,
              description: `${pkg.packageName} — เพิ่ม ${amount} คำถาม`,
            },
            unit_amount: amountSatang,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgId,
      metadata: {
        org_id: orgId,
        type: "topup",
        amount: String(amount),
        packageId: pkg.id,
      },
    };
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    const result = { url: checkoutSession.url, sessionId: checkoutSession.id };
    await setBillingIdempotencyResult(orgId, period, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/clinic/topup:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
