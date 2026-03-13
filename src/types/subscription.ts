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

/** E6.10 — จำกัด conversations ต่อเดือนต่อ plan */
export const PLAN_CONVERSATIONS_LIMIT: Record<OrgPlan, number> = {
  starter: 500,
  professional: 2000,
  multi_branch: 8000,
  enterprise: 50000,
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
  /** Phase 11 — AI blocked when quota exceeded */
  aiBlocked?: boolean;
  /** Phase 11 — Last date (YYYY-MM-DD) quota warning was sent */
  quota_warning_sent_at?: string | null;
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
