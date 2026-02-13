/**
 * E6.1–E6.4 — Subscription & Pricing
 * Pricing per-branch, subscriptions collection
 */
import type { OrgPlan } from "./organization";

/** จำกัดจำนวนสาขาต่อ plan (per-branch pricing) */
export const PLAN_MAX_BRANCHES: Record<OrgPlan, number> = {
  starter: 1,
  professional: 3,
  multi_branch: 10,
  enterprise: 999,
};

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing";

export interface Subscription {
  id: string;
  org_id: string;
  plan: OrgPlan;
  status: SubscriptionStatus;
  max_branches: number;
  current_period_start: string; // ISO
  current_period_end: string; // ISO
  stripe_subscription_id?: string | null; // E7 — ผูกกับ Stripe
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCreate {
  org_id: string;
  plan: OrgPlan;
  status?: SubscriptionStatus;
  max_branches?: number;
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id?: string | null;
}

/** E6.10 — Add-on Credit (Design only) */
export type AddOnType = "branch" | "user" | "storage";

export interface AddOnCredit {
  id: string;
  org_id: string;
  type: AddOnType;
  quantity: number;
  used?: number;
  expires_at?: string | null; // ISO
  createdAt: string;
  updatedAt: string;
}
