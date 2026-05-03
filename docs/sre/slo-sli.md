# SLO / SLI Definition (Phase 7)

## Scope
- Service: Clinic Connect API + AI pipeline + booking flow
- Window: rolling 30 days for SLO, rolling 5m/1h for live monitoring
- Timezone for reports: Asia/Bangkok

## SLI-1 API Availability
- **Definition**: `1 - (5xx responses / total API responses)`
- **Source**: `src/lib/observability/latency.ts`, `src/lib/observability/errors.ts`, `/api/internal/observability/sre-dashboard`
- **SLO target**: >= `99.5%` (30d)
- **Alert**:
  - Warning: < `99.7%` (1h)
  - Critical: < `99.5%` (1h)

## SLI-2 API Latency (P95)
- **Definition**: 95th percentile API response latency
- **Source**: `src/lib/observability/latency.ts`, `/api/internal/observability/sre-dashboard`
- **SLO target**: P95 <= `800ms` for critical APIs
- **Alert**:
  - Warning: p95 > `900ms` (15m)
  - Critical: p95 > `1200ms` (15m)

## SLI-3 Readiness Health
- **Definition**: % of readiness checks returning HTTP 200
- **Source**: `/api/health/ready`
- **SLO target**: >= `99.9%`
- **Alert**:
  - Critical: readiness 503 for >= `5m`

## SLI-4 Handoff Response SLA
- **Definition**: % of sessions accepted within target SLA
- **Source**: `src/lib/handoff-sla.ts`, `/api/clinic/learning-handoff-rate`
- **SLO target**: >= `95%` within SLA
- **Alert**:
  - Warning: < `93%` (1d)
  - Critical: < `90%` (1d)

## SLI-5 AI Cost Stability
- **Definition**: Daily AI cost deviation against baseline
- **Source**: `/api/admin/anomalies`, `/api/admin/ai-cost-monitor`
- **SLO target**: no org with > `3x` day-over-day cost spike without acknowledged alert
- **Alert**:
  - Critical: policy `ai_cost_spike_high`

## Error Budget Policy
- Availability SLO 99.5% => monthly budget 0.5%
- When burn rate > 2.0 (from `/api/internal/observability/sre-dashboard`):
  - Freeze non-critical deploys
  - Assign incident owner
  - Execute relevant runbook in `docs/sre/runbooks/`

