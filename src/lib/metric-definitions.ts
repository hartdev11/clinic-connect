/**
 * Enterprise: Single Source of Truth for metric definitions.
 * Dashboard and Insights MUST use these definitions — no duplicate formulas.
 *
 * Data sources:
 * - Revenue: financial-data (getRevenueFromPaidInvoices, getRevenueByDayFromPaidInvoices*)
 * - Chats / Bookings: clinic-data (conversation_feedback, bookings) — always filtered by org_id, optional branch_id
 * - Conversion / AI Close: computed in analytics-data from the same sources
 */

/** Revenue = SUM(PAID invoice grand_total_satang) - SUM(refund amount_satang). Source: financial-data. */
export const METRIC_REVENUE_SOURCE = "financial-data" as const;

/** Conversion rate = (bookings in range / total chats in range) * 100. Source: analytics-data getAnalyticsOverview. */
export const METRIC_CONVERSION_FORMULA = "conversionRate = totalChats > 0 ? round((bookingsCount / totalChats) * 10000) / 100 : 0" as const;

/** AI Close rate = (success feedback / labeled feedback) * 100. Labeled = adminLabel success|fail. Source: analytics-data. */
export const METRIC_AI_CLOSE_FORMULA = "aiCloseRate = labeled.length > 0 ? round((successFeedbackCount / labeled.length) * 10000) / 100 : 0" as const;

/** Rounding for percentages: 2 decimal places (round(x * 10000) / 100). */
export const PERCENT_ROUND_SCALE = 100;

/** Dashboard: revenue uses getRevenueFromPaidInvoices (month). Chart: getRevenueByDayFromPaidInvoices (last 7 days). */
/** Insights: revenue uses getRevenueFromPaidInvoices(orgId, { from, to }). Same function, different range. */
export const METRIC_REVENUE_FN = "getRevenueFromPaidInvoices" as const;
