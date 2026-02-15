/**
 * Enterprise Financial — เก็บเงินเป็น integer satang เท่านั้น (ห้าม float)
 * Booking ≠ Revenue | Invoice PENDING ≠ Revenue | Invoice PAID = Revenue
 */

// ─── Treatment Catalog ────────────────────────────────────────────────────

export type TreatmentStatus = "active" | "inactive";

export interface Treatment {
  id: string;
  org_id: string;
  treatment_id: string;
  treatment_name: string;
  category?: string | null;
  base_price: number;
  duration_minutes?: number | null;
  commission_rule?: Record<string, unknown> | string | null;
  consumable_cost?: number | null;
  tax_applicable?: boolean;
  active_status: TreatmentStatus;
  created_at: string;
  updated_at: string;
}

export interface TreatmentCreate {
  org_id: string;
  treatment_id: string;
  treatment_name: string;
  category?: string | null;
  base_price: number;
  duration_minutes?: number | null;
  commission_rule?: Record<string, unknown> | string | null;
  consumable_cost?: number | null;
  tax_applicable?: boolean;
  active_status?: TreatmentStatus;
}

export interface TreatmentPricingOverride {
  id: string;
  org_id: string;
  treatment_id: string;
  branch_id?: string | null;
  doctor_id?: string | null;
  override_price: number;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Package ───────────────────────────────────────────────────────────────

export type PackageStatus = "active" | "expired" | "consumed";

export interface CustomerPackage {
  id: string;
  org_id: string;
  customer_id: string;
  package_id: string;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  package_price: number;
  expiry_date: string;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
}

// ─── Invoice (all amounts in satang — integer) ───────────────────────────────

export type InvoiceStatus = "PENDING" | "PAID" | "CANCELLED";

export interface InvoiceLineItem {
  treatment_id: string;
  treatment_name: string;
  quantity: number;
  unit_price_satang: number;
  discount_satang: number;
  final_line_total_satang: number;
}

export interface Invoice {
  id: string;
  org_id: string;
  branch_id?: string | null;
  booking_id?: string | null;
  customer_id?: string | null;
  line_items: InvoiceLineItem[];
  subtotal_satang: number;
  discount_total_satang: number;
  tax_total_satang: number;
  grand_total_satang: number;
  status: InvoiceStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
  confirmed_by?: string | null;
  /** Optional — backfilled later; default 0 if absent */
  refunded_total_satang?: number;
  /** Optional — backfilled later; default 0 if absent */
  paid_total_satang?: number;
  /** Optional — backfilled later; default 0 if absent */
  overpayment_total_satang?: number;
}

export interface InvoiceCreate {
  org_id: string;
  branch_id?: string | null;
  booking_id?: string | null;
  customer_id?: string | null;
  line_items: InvoiceLineItem[];
  subtotal_satang: number;
  discount_total_satang: number;
  tax_total_satang: number;
  grand_total_satang: number;
  created_by: string;
}

// ─── Payment (amount_satang, idempotency_key) ───────────────────────────────

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";

export interface Payment {
  id: string;
  org_id: string;
  invoice_id: string;
  amount_satang: number;
  method: PaymentMethod;
  reference?: string | null;
  idempotency_key: string;
  created_by: string;
  confirmed_by?: string | null;
  created_at: string;
  updated_at: string;
  /** Optional — backfilled later; default amount_satang if absent */
  applied_satang?: number;
  /** Optional — backfilled later; default 0 if absent */
  overpayment_satang?: number;
}

export interface PaymentCreate {
  org_id: string;
  invoice_id: string;
  amount_satang: number;
  method: PaymentMethod;
  reference?: string | null;
  idempotency_key: string;
  created_by: string;
}

// ─── Refund ─────────────────────────────────────────────────────────────────

export interface Refund {
  id: string;
  org_id: string;
  invoice_id: string;
  payment_id: string;
  amount_satang: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface RefundCreate {
  org_id: string;
  invoice_id: string;
  payment_id: string;
  amount_satang: number;
  reason: string;
  created_by: string;
}

// ─── Financial Audit Log ───────────────────────────────────────────────────

export type FinancialEntityType = "invoice" | "payment" | "refund" | "booking";

export type FinancialAuditAction = "create" | "update" | "confirm_payment" | "cancel" | "refund";

export interface FinancialAuditLog {
  id: string;
  org_id: string;
  entity_type: FinancialEntityType;
  entity_id: string;
  action: FinancialAuditAction;
  user_id: string;
  timestamp: string;
  payload?: Record<string, unknown> | null;
}

// ─── Revenue (computed; display in baht from satang) ────────────────────────

export interface RevenueSummary {
  actualRevenueSatang: number;
  projectedRevenueSatang: number;
  paidCount: number;
  pendingCount: number;
}
