/**
 * Phase 20 — Agency / White Label
 * Firestore: agencies, agency_commissions
 */

export type AgencyStatus = "active" | "suspended";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string | null;
  /** 0.0–1.0 */
  commissionRate: number;
  status: AgencyStatus;
  totalRevenue: number;
  totalCommission: number;
  /** Phase 20: Custom domain, logo, primary color */
  customDomain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyCreate {
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string | null;
  commissionRate: number;
  customDomain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export type CommissionStatus = "paid" | "reversed";

export interface AgencyCommission {
  id: string;
  agencyId: string;
  orgId: string;
  subscriptionId: string;
  amount: number; // satang
  commissionAmount: number; // satang
  status: CommissionStatus;
  createdAt: string;
  reversedAt?: string | null;
  reverseReason?: string | null;
}
