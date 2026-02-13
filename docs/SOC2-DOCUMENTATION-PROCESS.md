# SOC2 Documentation Process (Enterprise)

## Overview

This document defines the enterprise-level process for maintaining SOC2 Type II compliance documentation for the Clinic SaaS platform.

---

## 1. Trust Service Criteria (TSC) Mapping

| TSC | Control Area | Evidence Location | Owner | Review Cadence |
|-----|--------------|-------------------|-------|----------------|
| CC6.1 | Logical & physical access controls | `docs/ENTERPRISE_FEATURES.md` § Security Hardening, RBAC | Security | Quarterly |
| CC6.2 | Prior to issuing access | `docs/schemas/E2.1-E2.2-role-model.md`, Firestore rules | Engineering | Per release |
| CC6.3 | Authorization of access | `src/middleware.ts`, `src/lib/auth-session.ts` | Engineering | Per release |
| CC6.6 | Logical access – credentials | Session JWT, bcrypt passwords, `src/lib/session.ts` | Engineering | Per release |
| CC6.7 | Security events | Audit logs, `src/app/api/admin/audit-export`, Sentry | Security | Monthly |
| CC7.1 | Detection of security events | Audit export, retention policy, `docs/ENTERPRISE_FEATURES.md` | Compliance | Quarterly |

---

## 2. Documentation Artifacts

| Artifact | Path | Purpose | Update Trigger |
|----------|------|---------|----------------|
| Enterprise Features | `docs/ENTERPRISE_FEATURES.md` | Security & compliance controls inventory | Per feature change |
| Enterprise Infrastructure | `docs/ENTERPRISE_INFRASTRUCTURE.md` | Infra design, scaling, jobs | Per infra change |
| Firestore Security Rules | `firestore.rules` | Database access control | Per schema change |
| Audit Export API | `src/app/api/admin/audit-export` | Export compliance evidence | N/A (API) |
| Retention Policy | `src/app/api/admin/retention-policy`, `src/lib/background-cleanup.ts` | Data retention evidence | Per policy change |
| Disaster Recovery | `docs/DISASTER_RECOVERY_RUNBOOK.md` | BC/DR procedures | Per DR change |
| Pen Test | `docs/PENETRATION-TESTING.md` | Security testing process | Per pen test |
| Risk Assessment | `docs/RISK_ASSESSMENT.md` | Risk register, treatment | Annually |
| Vendor Risk Assessment | `docs/VENDOR_RISK_ASSESSMENT.md` | Stripe, LINE, Firebase | Annually |
| Incident Response | `docs/INCIDENT_RESPONSE.md` | Formal IR process | Per incident / annually |

---

## 3. Annual / Quarterly Process

### Quarterly

1. **Evidence Collection**
   - Export audit logs for period (via `/api/admin/audit-export`)
   - Review access logs, failed logins, admin actions
   - Update TSC mapping table if controls changed

2. **Access Review**
   - List users with admin/owner roles per org
   - Verify need-to-know for each

3. **Vulnerability Scan Review**
   - Review GitHub Security tab / Dependabot / npm audit results
   - Document remediation for critical/high findings

### Annually

1. **SOC2 Gap Assessment**
   - External auditor engagement (or internal checklist)
   - Update this process doc based on findings

2. **Policy Refresh**
   - Data retention policy
   - Incident response (see `docs/INCIDENT_RESPONSE.md`)

---

## 4. Change Control

- **Code changes** affecting auth, RBAC, audit, or encryption require:
  - PR review by designated security reviewer
  - Update to `ENTERPRISE_FEATURES.md` if new control added

- **Infrastructure changes** (Vercel, Firebase, Firestore rules) require:
  - Update to `ENTERPRISE_INFRASTRUCTURE.md` or `firestore.rules`
  - DR runbook update if RTO/RPO affected

---

## 5. Evidence Retention

| Evidence Type | Retention | Storage |
|---------------|-----------|---------|
| Audit export (JSON/CSV) | 7 years | Offline/secure archive |
| Pen test reports | 3 years | Restricted access |
| Access reviews | 7 years | Compliance folder |

---

## 6. Contact

- **Compliance Lead**: [Assign]
- **Security Lead**: [Assign]
- **Auditor Contact**: [Assign]
