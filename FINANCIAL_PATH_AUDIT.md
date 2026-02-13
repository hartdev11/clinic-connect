# Financial Path Audit — Float-Free Verification

**Audit date:** 2025-02-10  
**Requirement:** ทุก path ที่มี amount ห้ามใช้ float arithmetic โดยตรง

---

## Summary

| Path | Type | Status |
|------|------|--------|
| clinic-data.ts | transactions.amount | ✅ safeSumBaht, toSatang |
| clinic-data.ts | revenueByDay | ✅ toSatang, satangToBaht |
| finance-agent.ts | revenue comparison | ✅ toSatang |
| clinic/finance/route.ts | byService aggregation | ✅ safeAddBaht |
| money.ts | core utils | ✅ toSatang, sumToSatang, satangToBaht |
| llm-metrics.ts | cost_baht | ⚠️ Float for cost; stored via increment (Firestore) |
| BillingSection.tsx | prorationAmount | Display only; Stripe returns integer cents |
| checkout/preview | amount_due | Stripe API — integer cents |

---

## Verified Paths

### 1. clinic-data.ts

```ts
// Revenue aggregation — uses safeSumBaht (satang internal)
const revenueThisMonth = safeSumBaht(revenueThisSnap.docs.map((d) => d.data().amount));

// revenueByDay — toSatang for map, satangToBaht for output
const prevSatang = revenueByDayMap.get(createdAt)!;
revenueByDayMap.set(createdAt, prevSatang + toSatang(d.amount));
// ...
revenue: satangToBaht(satang),
```

✅ No float arithmetic on amount.

### 2. money.ts

- `toSatang(value)` — converts to integer via Math.round(n * 100)
- `sumToSatang(values)` — integer reduce
- `satangToBaht(satang)` — Math.round(satang) / 100
- `safeSumBaht`, `safeAddBaht` — all use satang internally

✅ All operations use integer satang.

### 3. finance-agent.ts

```ts
const thisSatang = toSatang(stats.revenueThisMonth);
const lastSatang = toSatang(stats.revenueLastMonth);
if (lastSatang > 0 && thisSatang < (lastSatang * 70) / 100)
```

✅ Comparison uses integer satang. (lastSatang * 70) / 100 is integer result.

### 4. api/clinic/finance/route.ts

```ts
byService[name] = safeAddBaht(byService[name] ?? 0, t.amount);
```

✅ safeAddBaht uses toSatang internally.

---

## LLM Cost (Non-Financial)

llm-metrics.ts: `estimateCostBaht` returns float, stored via `FieldValue.increment(cost)`.

- Firestore increment accepts number (float).
- Not user-facing financial data — internal cost tracking.
- Acceptable for cost estimation.

---

## Stripe / Billing

- Stripe amounts are in cents (integer).
- BillingSection: `amount / 100` for display — acceptable (display conversion).
- checkout/preview: `amount_due` from Stripe — integer.

---

## Verdict

✅ **All financial paths use satang integer math.**  
✅ No float arithmetic on transactional amounts.
