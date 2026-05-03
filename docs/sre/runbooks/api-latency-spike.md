# Runbook: API Latency Spike

## Trigger
- p95 latency above threshold from `/api/internal/observability/sre-dashboard`
- API availability warning/critical alerts

## Immediate Checks (5 minutes)
1. Check `/api/health/live` and `/api/health/ready`
2. Check `/api/internal/observability/sre-dashboard` for:
   - `p95LatencyMs`
   - `errorRatePct`
   - dependency status
3. Check `/api/admin/service-health` for Firestore/Redis/Pinecone state

## Triage
- If Firestore degraded: switch incident to Firestore runbook
- If Redis degraded and optional: evaluate cache fallback performance impact
- If only specific route is slow: identify route from logs with `x-request-id`

## Mitigation
- Scale down expensive background workloads
- Temporarily disable non-critical features behind feature flags
- Roll back latest risky deployment if regression confirmed

## Exit Criteria
- p95 latency back within SLO target for >= 30 minutes
- error rate stable and readiness 200

