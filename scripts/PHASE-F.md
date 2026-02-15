# Phase F — Performance Load Test

## Load (ต้องยิง)

| Workload | Concurrency | Description |
|----------|-------------|-------------|
| **Payments** | 500 | 500 concurrent `confirmPaymentAndCreateRecord` (one per invoice, unique idempotency_key) |
| **Refunds** | 200 | 200 concurrent `createRefundWithAudit` (on first 200 paid invoices from above) |
| **Dashboard 30 วัน** | 50 | 50 concurrent `getRevenueFromPaidInvoices(orgId, { branchId, from: 30d ago, to: now })` — branch + date filter |

## Criteria (ต้อง)

- **No timeout** — Per-request timeout 30s; no request may time out.
- **p95 < 1.5s** — Latency p95 for payments, refunds, and dashboard 30-day query must be &lt; 1500 ms.
- **Firestore read budget** — Stay within expected read usage; validate in Firebase Console → Firestore → Usage.

### Firestore read budget (reference)

| Operation | Expected max reads per call | Notes |
|-----------|-----------------------------|--------|
| Revenue 30-day + branch | invoices limit 2000 + refunds limit 2000 | ~4000 reads per `getRevenueFromPaidInvoices` with date range |
| Payment (transaction) | 1 invoice + 1 payment write + 1 audit | Writes; reads minimal |
| Refund (transaction) | 1 invoice + 1 refund write + 1 audit | Writes; reads minimal |

Validate total reads in Firebase Console after a run; ensure daily/monthly usage is within your plan.

## Run

```bash
npx tsx scripts/load-test-phase-f.ts
```

**Env:** `FIREBASE_*` or `FIREBASE_SERVICE_ACCOUNT_PATH`, optional `STRESS_TEST_ORG_ID`, `PHASE_F_BRANCH_ID` (for dashboard branch filter).

**Note:** Creates 500 invoices, 500 payments, 200 refunds in Firestore. Use a **test project** or dedicated test org.

---

Stop after Phase F.
