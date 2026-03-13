/**
 * E7.1–E7.4 — Stripe Webhook Handler
 * Phase 18 — on failure → enqueue webhook-retry
 */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { processStripeWebhookEvent, isStripeEventProcessed } from "@/lib/stripe-webhook-handler";
import { enqueueWebhookRetry } from "@/lib/webhook-retry-queue";

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[Stripe Webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    await processStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    enqueueWebhookRetry({
      source: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: event.data,
    }).catch(() => {});
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Handler error" },
      { status: 500 }
    );
  }
}
