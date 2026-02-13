# Risk Assessment (Enterprise)

## 1. Overview

This document provides a structured risk assessment for the Clinic SaaS platform, aligned with enterprise and SOC2 expectations.

| Item | Value |
|------|-------|
| **Assessment Method** | Qualitative (Likelihood × Impact) |
| **Review Cadence** | Annually + ad-hoc for major changes |
| **Last Updated** | 2025-02-10 |

---

## 2. Risk Matrix

| Likelihood | 1 Low | 2 Medium | 3 High | 4 Critical |
|------------|-------|----------|--------|------------|
| **4 – Likely** | Medium | High | Critical | Critical |
| **3 – Possible** | Low | Medium | High | Critical |
| **2 – Unlikely** | Low | Low | Medium | High |
| **1 – Rare** | Low | Low | Low | Medium |

---

## 3. Identified Risks

### 3.1 Technical Risks

| ID | Risk | Likelihood | Impact | Level | Mitigation |
|----|------|------------|--------|-------|------------|
| R-T01 | Dependency vulnerability (npm) | 3 | 2 | Medium | npm audit, Dependabot, `security:audit` |
| R-T02 | Unauthorized access to org data | 2 | 4 | High | RBAC, org isolation, Firestore rules |
| R-T03 | Session compromise / token theft | 2 | 3 | Medium | HttpOnly cookie, JWT expiry, SESSION_SECRET rotation |
| R-T04 | Firestore outage or corruption | 2 | 4 | High | PITR (Blaze), scheduled exports, DR runbook |
| R-T05 | API abuse / DoS | 2 | 2 | Low | Rate limiting, bot detection |
| R-T06 | Webhook replay or tampering | 2 | 3 | Medium | HMAC (LINE), Ed25519 (Stripe), idempotency |
| R-T07 | Sensitive data exposure in logs | 2 | 3 | Medium | No PII in logs, structured logging |

### 3.2 Operational Risks

| ID | Risk | Likelihood | Impact | Level | Mitigation |
|----|------|------------|--------|-------|------------|
| R-O01 | Vercel outage | 2 | 4 | High | Multi-region, DR runbook |
| R-O02 | Secret leak (env, key) | 2 | 4 | High | Least privilege, rotation procedure |
| R-O03 | Human error in deployment | 2 | 2 | Low | CI/CD, rollback capability |
| R-O04 | Cron/job failure | 2 | 2 | Low | Manual trigger, monitoring |

### 3.3 Third-Party / Vendor Risks

| ID | Risk | Likelihood | Impact | Level | Mitigation |
|----|------|------------|--------|-------|------------|
| R-V01 | Stripe downtime or breach | 2 | 4 | High | See `docs/VENDOR_RISK_ASSESSMENT.md` |
| R-V02 | LINE API outage | 2 | 3 | Medium | Graceful degradation, retry |
| R-V03 | Firebase/Firestore incident | 2 | 4 | High | Geo-redundancy, PITR, vendor assessment |

---

## 4. Risk Treatment

| Treatment | When |
|-----------|------|
| **Accept** | Risk level Low; cost of mitigation > benefit |
| **Mitigate** | Apply controls (most risks) |
| **Transfer** | Insurance, contract (e.g., vendor SLA) |
| **Avoid** | Discontinue activity if risk unacceptable |

---

## 5. Review Process

1. **Annually**: Full risk reassessment; update this document
2. **After major incident**: Re-evaluate relevant risks
3. **After new vendor/feature**: Add new risks and reassess
4. **Evidence**: Retain risk log with dates for audit

---

## 6. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/VENDOR_RISK_ASSESSMENT.md` | Stripe, LINE, Firebase vendor risks |
| `docs/INCIDENT_RESPONSE.md` | Formal incident handling |
| `docs/DISASTER_RECOVERY_RUNBOOK.md` | Technical runbook for outages |
