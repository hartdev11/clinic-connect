# Enterprise Features

## 1. Monitoring & Observability

| รายการ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| Structured logging | ✅ | `@/lib/logger.ts` — JSON format, createRequestLogger |
| Request ID tracking | ✅ | Middleware ส่ง `X-Request-ID` ให้ทุก /api, /clinic |
| Error tracking (Sentry) | ✅ | ติดตั้ง @sentry/nextjs — ตั้ง `SENTRY_DSN` ใน .env |
| Metrics | ⚠️ | Admin monitoring มี LLM cost, circuit breaker |

## 2. Security Hardening

| รายการ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| CSP headers | ✅ | Middleware — Content-Security-Policy, X-Content-Type-Options, X-Frame-Options |
| CSRF protection | ✅ | `@/lib/csrf.ts` — Double-Submit Cookie (ใช้กับ form เมื่อต้องการ) |
| IP rate limiting | ✅ | `/api/chat` มี IP limit, clinic APIs มี org limit |
| Bot detection | ✅ | Login API — ตรวจ User-Agent ก่อนรับ request |

## 3. Infrastructure

| รายการ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| Horizontal scaling | ✅ | Stateless, Distributed rate limit (Firestore) |
| Background job queue | ✅ | POST /api/admin/cleanup — Vercel Cron 02:00 daily |
| Webhook verification | ✅ | LINE: HMAC-SHA256, Stripe: Ed25519 |

## 4. Compliance Layer

| รายการ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| Audit export | ✅ | GET /api/admin/audit-export?start=&end=&format=json,csv |
| Data retention policy | ✅ | GET /api/admin/retention-policy, purgeOldAuditLogs ใน cleanup |
| Soft delete + recovery | ✅ | Customer: softDeleteCustomer, restoreCustomer, POST /api/clinic/customers/[id]/soft-delete |
| Encryption at rest | ✅ | `@/lib/encryption-info.ts` — Firestore encrypts by default |
| SOC2 documentation process | ✅ | `docs/SOC2-DOCUMENTATION-PROCESS.md` — TSC mapping, evidence, quarterly cadence |
| Disaster recovery runbook | ✅ | `docs/DISASTER_RECOVERY_RUNBOOK.md` — RTO 4h, RPO 24h, procedures |
| Automated security scanning | ✅ | `.github/workflows/security-scan.yml`, Dependabot, `npm run security:audit` |
| Penetration testing process | ✅ | `docs/PENETRATION-TESTING.md`, `tests/security-pen-test.test.ts` |
| Risk Assessment | ✅ | `docs/RISK_ASSESSMENT.md` — risk matrix, technical/ops/vendor risks |
| Vendor Risk Assessment | ✅ | `docs/VENDOR_RISK_ASSESSMENT.md` — Stripe, LINE, Firebase |
| Incident Response Plan | ✅ | `docs/INCIDENT_RESPONSE.md` — formal IR (NIST phases) |

## Env Vars สำหรับ Enterprise

```
SENTRY_DSN=          # Optional — Error tracking
CRON_SECRET=         # สำหรับ Vercel Cron เรียก /api/admin/cleanup
```
