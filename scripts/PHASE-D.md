# Phase D — Firestore Index Validation

## Required indexes (must exist and be deployed)

| Collection | Fields | Used by |
|------------|--------|---------|
| **invoices** | org_id, status, paid_at | getRevenueFromPaidInvoices (no branch) |
| **invoices** | org_id, status, branch_id, paid_at | getRevenueFromPaidInvoices (with branch) |
| **refunds** | org_id, created_at | getTotalRefundSatang, getRevenueByDayFromPaidInvoices |

All three are defined in **`firestore.indexes.json`** at project root.

## Deploy index before code

1. Deploy indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```
2. Wait until indexes are built (Firebase Console → Firestore → Indexes).
3. Then deploy application code.

## Validate (no "index required" error)

```bash
npx tsx scripts/validate-firestore-indexes.ts
```

- Runs the queries that use the three indexes.
- PASS = no "index required" error.
- If FAIL: run `firebase deploy --only firestore:indexes` and re-run validation after indexes are ready.

---

Stop after Phase D.
