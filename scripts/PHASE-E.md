# Phase E — Observability Check

## Required metrics (must be recorded)

| Metric | Description | Recorded in |
|--------|-------------|-------------|
| **refund_success_count** | Successful refund creation | `src/app/api/clinic/invoices/[id]/refunds/route.ts` (POST success) |
| **refund_fail_count** | Refund creation failure (5xx) | Same route (POST catch) |
| **payment_success_count** | Successful payment confirmation | `src/app/api/clinic/invoices/[id]/confirm-payment/route.ts` (success) |
| **payment_fail_count** | Payment confirmation failure (5xx) | Same route (catch) |
| **transaction_retry_count** | Application-level Firestore transaction retries | `src/lib/financial-data.ts` (runTransactionWithRetry) |
| **dashboard_query_latency** | getDashboardStats duration in ms | `src/lib/clinic-data.ts` (getDashboardStats) |
| **migration_error_count** | Backfill/migration batch commit errors | `scripts/backfill-financial-fields.ts` (batch.commit catch) |

Module: **`src/lib/observability.ts`** — in-memory counters + optional GCP/OpenTelemetry in production.

---

## Required alerts (must be configured)

Configure in **Google Cloud Monitoring** (or your alerting backend) using the above metrics:

| Alert | Condition | Action |
|-------|-----------|--------|
| **Refund fail rate > 5%** | `refund_fail_count / (refund_success_count + refund_fail_count) > 0.05` over a window (e.g. 5m) | Notify on-call / PagerDuty |
| **Payment fail rate > 5%** | `payment_fail_count / (payment_success_count + payment_fail_count) > 0.05` over a window (e.g. 5m) | Notify on-call / PagerDuty |
| **Retry spike** | `transaction_retry_count` rate or count above threshold (e.g. > N in 5m) | Investigate contention |
| **Latency spike** | General API or Firestore latency above baseline (e.g. p99 > threshold) | Investigate |
| **Dashboard > 2s** | `dashboard_query_latency` p95 or p99 > 2000 ms over a window (e.g. 5m) | Investigate slow dashboard |

### Example (GCP Alerting Policy)

- **Metric**: custom metric `dashboard_query_latency` (export from app to Cloud Monitoring).
- **Filter**: resource type = your service.
- **Condition**: threshold p99 > 2000 ms for 5 minutes.
- **Notification**: email / Slack / PagerDuty.

---

## Validate (metrics present and alerts documented)

```bash
npx tsx scripts/validate-observability.ts
```

- Checks that all 7 metrics exist and are recordable.
- Checks that all 5 alerts are documented in this file.
- Outputs a Phase E score (%).

---

Stop after Phase E.
