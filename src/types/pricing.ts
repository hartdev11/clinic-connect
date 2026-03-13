/**
 * Phase 9 — Flexible packages & coupons
 */

export type BillingPeriod = "monthly" | "yearly";

export type PackageFeatures = {
  ai_chat?: boolean;
  analytics?: boolean;
  white_label?: boolean;
  api_access?: boolean;
  priority_support?: boolean;
};

export interface PricingPackage {
  id: string;
  packageName: string;
  packageSlug: string;
  description: string;
  price: number;
  currency: "THB";
  billingPeriod: BillingPeriod;
  conversationsIncluded: number;
  maxBranches: number;
  maxUsers: number;
  features: PackageFeatures;
  allowTopup: boolean;
  topupPricePer100: number;
  topupPricePer500?: number;
  topupPricePer1000?: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingPackageCreate {
  packageName: string;
  packageSlug: string;
  description?: string;
  price: number;
  currency?: "THB";
  billingPeriod: BillingPeriod;
  conversationsIncluded?: number;
  maxBranches?: number;
  maxUsers?: number;
  features?: PackageFeatures;
  allowTopup?: boolean;
  topupPricePer100?: number;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export interface PricingPackageUpdate {
  packageName?: string;
  packageSlug?: string;
  description?: string;
  price?: number;
  billingPeriod?: BillingPeriod;
  conversationsIncluded?: number;
  maxBranches?: number;
  maxUsers?: number;
  features?: PackageFeatures;
  allowTopup?: boolean;
  topupPricePer100?: number;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export type CouponDiscountType = "percentage" | "fixed_amount" | "free_trial";

export interface Coupon {
  id: string;
  couponCode: string;
  discountType: CouponDiscountType;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  maxTotalUses: number;
  currentUses: number;
  isActive: boolean;
}

export interface CouponCreate {
  couponCode: string;
  discountType: CouponDiscountType;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  maxTotalUses?: number;
  isActive?: boolean;
}
