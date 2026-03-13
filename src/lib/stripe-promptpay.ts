/**
 * Phase 17 — PromptPay via Stripe PaymentIntent
 * Create PaymentIntent with payment_method_types: ['promptpay']
 * Client uses client_secret with Stripe.js confirmPromptPayPayment to display QR
 */
import { getStripe } from "@/lib/stripe";

export interface CreatePromptPayIntentParams {
  amountSatang: number;
  currency?: "thb";
  metadata?: Record<string, string>;
}

export interface CreatePromptPayIntentResult {
  clientSecret: string;
  intentId: string;
}

/** Create PaymentIntent for PromptPay — amount in satang (e.g. 100 baht = 10000) */
export async function createPromptPayPaymentIntent(
  params: CreatePromptPayIntentParams
): Promise<CreatePromptPayIntentResult> {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: params.amountSatang,
    currency: params.currency ?? "thb",
    payment_method_types: ["promptpay"],
    metadata: params.metadata ?? {},
  });
  if (!intent.client_secret) {
    throw new Error("PaymentIntent missing client_secret");
  }
  return {
    clientSecret: intent.client_secret,
    intentId: intent.id,
  };
}

export type PaymentIntentStatus = "succeeded" | "processing" | "requires_payment_method" | "requires_confirmation" | "canceled";

/** Get PaymentIntent status for polling */
export async function getPaymentIntentStatus(
  intentId: string
): Promise<{ status: PaymentIntentStatus }> {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(intentId);
  const s = intent.status as PaymentIntentStatus;
  return {
    status: s === "succeeded" || s === "processing" || s === "requires_payment_method" || s === "requires_confirmation" || s === "canceled"
      ? s
      : "requires_payment_method",
  };
}
