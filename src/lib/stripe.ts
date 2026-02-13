/**
 * E7.1–E7.4 — Stripe Payment Gateway
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret?.trim()) {
      throw new Error("STRIPE_SECRET_KEY is required");
    }
    _stripe = new Stripe(secret.trim(), {});
  }
  return _stripe;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
