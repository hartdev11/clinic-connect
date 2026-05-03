# Runbook: AI Cost Spike

## Trigger
- `ai_cost_spike_high` policy from `/api/admin/anomalies`
- unusual increase in `/api/admin/ai-cost-monitor`

## Immediate Checks
1. Open `/api/admin/anomalies` and identify impacted org(s)
2. Check `/api/admin/ai-cost-monitor` for workload breakdown
3. Validate cache hit rate and template-response ratio

## Triage
- Determine source:
  - prompt expansion
  - low cache hit rate
  - abuse or unusual traffic
- Correlate with `correlation_id` and request logs when available

## Mitigation
- Tighten token limits / response verbosity guardrails
- Increase cache usage for repetitive intents
- Apply temporary rate-limits for abusive traffic

## Recovery Criteria
- Cost slope returns near baseline for 24h
- No new critical cost anomalies
- Follow-up action items documented (prompt/caching/rate-limit tuning)

