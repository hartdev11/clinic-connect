# Enterprise Release Checklist

## 1) Quality Gates (must pass)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- GitHub Actions:
  - `.github/workflows/ci.yml` (Lint/Typecheck/Test/Build)
  - `.github/workflows/nightly-quality.yml` (Node 20/22 + flaky + build smoke)

## 2) Security / Access Control
- RBAC enforced on all clinic/admin/agency APIs
- Branch scoping required for `manager` and `staff` sensitive flows
- Public/auth endpoints protected by rate limiting
- Idempotency guard active for webhook and booking-side effects

## 3) Reliability / Resilience
- Worker graceful shutdown (`SIGINT`/`SIGTERM`) validated
- Retry and dead-letter paths validated for webhook/queue jobs
- External HTTP retry policy enabled for outbound calls
- Booking notification/reminder duplication guards active

## 4) Observability / SRE
- Liveness endpoint: `/api/health/live`
- Health endpoint: `/api/health`
- Readiness endpoint: `/api/health/ready`
- Internal SRE dashboard: `/api/internal/observability/sre-dashboard`
- Internal summary: `/api/internal/observability/summary`
- SLO/SLI baseline: `docs/sre/slo-sli.md`
- Alert policies: `docs/sre/alert-policies.yaml`
- Runbooks:
  - `docs/sre/runbooks/api-latency-spike.md`
  - `docs/sre/runbooks/firestore-unreachable.md`
  - `docs/sre/runbooks/ai-cost-spike.md`

## 5) Production Config Validation
- Required env vars validated during startup/build
- Internal observability secret configured:
  - `INTERNAL_OBSERVABILITY_SECRET` (or fallback secret)
- Durable observability export toggle reviewed:
  - `OBS_DURABLE_EXPORT=true` in production only

## 6) Go/No-Go Decision
- No blocker defects in auth/booking/payment/webhook critical paths
- No unresolved P1/P2 security incidents
- SLO alerts green for pre-release observation window
- Rollback plan and owner confirmed

