# Enterprise Load Test Guide

## Overview

Stress test target: **5k–10k concurrent requests** with latency percentile reporting and memory observation.

## Prerequisites

- Node.js 18+
- Server running (local or deployed)
- Optional: Valid session cookie for authenticated chat

## Running the Load Test

### Basic (5k concurrent, default)

```bash
npx tsx scripts/load-test-stress.ts
```

### Custom concurrency (up to 10k)

```bash
CONCURRENCY=8000 npx tsx scripts/load-test-stress.ts
```

### Against deployed app

```bash
SERVER_URL=https://your-app.vercel.app CONCURRENCY=5000 npx tsx scripts/load-test-stress.ts
```

### With session (authenticated chat)

```bash
LOAD_TEST_COOKIE="session=..." SERVER_URL=http://localhost:3000 npx tsx scripts/load-test-stress.ts
```

## Output

- **Success / Fail counts** and success rate
- **Latency percentiles**: p50, p95, p99 (ms)
- **Throughput**: req/s
- **Memory usage**: RSS, heap (test runner process)
- **Status code distribution**
- **Report file**: `load-test-report.json`

## Interpreting Results

| Metric | Target (Enterprise) |
|--------|---------------------|
| p50 latency | < 800ms |
| p95 latency | < 2000ms |
| p99 latency | < 4000ms |
| Success rate | > 99% |
| Throughput | Scales with concurrency |

## Server Memory Under Load

- **Vercel**: Use Vercel Dashboard → Project → Analytics / Logs for memory and execution time
- **Self-hosted**: Monitor `process.memoryUsage()` via APM or custom `/api/admin/health` endpoint
- **Load test script** reports its own process memory; server memory must be observed separately

## Evidence for SOC2 / ISO 27001

1. Run load test monthly or per major release
2. Store `load-test-report.json` in audit trail
3. Document baseline: concurrency, p95, success rate
4. Alert if p95 exceeds 2x baseline
