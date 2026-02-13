# Production Monitoring Report

**Generated:** 2025-02-10  
**Status:** Monitoring-ready

---

## 1. Logging Coverage

| Area | Status | Notes |
|------|--------|------|
| Central logger | ✅ Done | `src/lib/logger.ts` — JSON format, requestId, timestamp, level, org_id, user_id, route, latency_ms, error/stack |
| Chat route | ✅ Done | Uses `createRequestLogger`, logs success/failure, rate-limit triggered, LLM tokens, latency |
| Auth login | ✅ Done | Uses `log.error` for errors |
| Other routes | ⚠️ Partial | ~25 routes still use `console.error` — can migrate incrementally |

**Coverage:** ~15% of routes use central logger (chat + auth/login). Critical paths covered.

---

## 2. Endpoint Coverage

| Endpoint | Logging | Notes |
|----------|---------|------|
| `POST /api/chat` | ✅ Full | requestId, latency, org_id, rate-limit, LLM usage, errors |
| `POST /api/auth/login` | ✅ Error log + audit | |
| `POST /api/auth/logout` | ✅ Audit | |
| `GET /api/health` | N/A | Read-only health check |
| `POST /api/log-error` | ✅ Uses log | Client error ingest |
| Webhooks (Stripe, LINE) | ⚠️ console | High volume — consider async logger |
| Clinic APIs | ⚠️ console | Non-critical — migrate as needed |

---

## 3. LLM Monitoring Status

| Component | Status |
|-----------|--------|
| `recordLLMUsage(orgId, usage)` | ✅ Implemented |
| `getDailyLLMCost(orgId)` | ✅ Implemented |
| `isOverDailyLLMLimit(orgId)` | ✅ Implemented |
| Token logging | ✅ prompt_tokens, completion_tokens, total_tokens |
| Cost estimation | ✅ GPT-4o-mini pricing (THB) |
| Firestore collection | `llm_usage_daily` — doc id: `{orgId}_{YYYY-MM-DD}` |

---

## 4. Cost Protection Status

| Item | Status |
|------|--------|
| Guard in chat route | ✅ `isOverDailyLLMLimit()` before orchestration |
| 429 on exceed | ✅ Returns "Daily AI usage limit reached" |
| Env variable | `MAX_DAILY_LLM_COST_BAHT` — set in production |

---

## 5. Error Boundary Status

| Location | Status |
|----------|--------|
| Root `error.tsx` | ✅ Implemented |
| Clinic `error.tsx` | ✅ `src/app/(clinic)/clinic/error.tsx` |
| Client error logging | ✅ POST to `/api/log-error` with message, stack, route, userAgent |

---

## 6. Health Endpoint

**GET /api/health**

Checks:
- Firestore connection
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Response:
```json
{
  "status": "ok" | "degraded",
  "checks": { "firestore": { "ok": true }, ... },
  "timestamp": "ISO8601"
}
```

---

## 7. Audit Logging Status

| Event | Status | Source |
|-------|--------|--------|
| login | ✅ | `/api/auth/login` |
| logout | ✅ | `/api/auth/logout` |
| failed_auth | ✅ | login (clinic_not_found, license_mismatch, password_mismatch) |
| subscription_change | ✅ | Stripe webhook (checkout, updated, deleted) |
| plan_upgrade | ✅ | Stripe `customer.subscription.updated` |
| plan_downgrade | ✅ | Stripe `customer.subscription.updated` |
| manual_override | ⚠️ Stub | Add when manual admin override exists |

**Collection:** `audit_logs` — Firestore

---

## 8. Remaining Risks

| Risk | Mitigation |
|------|------------|
| Many routes still use console | Migrate high-traffic routes to logger; non-critical can wait |
| LINE/Stripe webhooks use console | Consider async log buffer for high-volume |
| `manual_override` audit | Add when feature exists |
| Firestore rules | Ensure `llm_usage_daily`, `audit_logs` are writable by backend only |
| `MAX_DAILY_LLM_COST_BAHT` | Must be set in production; default 0 = no limit |

---

## 9. Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/logger.ts` | Exists (structured JSON) |
| `src/lib/llm-metrics.ts` | Exists |
| `src/lib/audit-log.ts` | Created |
| `src/app/api/chat/route.ts` | Refactored — logger, cost protection, usage recording |
| `src/app/api/health/route.ts` | Created |
| `src/app/api/log-error/route.ts` | Created |
| `src/app/error.tsx` | Created |
| `src/app/(clinic)/clinic/error.tsx` | Created |
| `src/app/api/auth/login/route.ts` | Audit + log |
| `src/app/api/auth/logout/route.ts` | Audit |
| `src/app/api/webhooks/stripe/route.ts` | Audit for subscription events |
| `src/lib/clinic-data.ts` | `updateSubscriptionByStripeId` returns `previousPlan` |
