# Incident Response Plan (Enterprise)

## 1. Overview

This document defines the formal incident response process for the Clinic SaaS platform, aligned with NIST/SANS IR phases.

| Item | Value |
|------|-------|
| **Scope** | Security incidents, data breaches, availability, integrity |
| **Last Updated** | 2025-02-10 |

---

## 2. Incident Definition

An **incident** is any event that:

- Compromises confidentiality, integrity, or availability of systems or data
- Violates security policy or regulatory requirements
- Requires coordinated response beyond routine operations

---

## 3. Severity Levels

| Severity | Definition | Response Time |
|----------|-------------|---------------|
| **P1 – Critical** | Full outage, data breach, active compromise | Immediate (≤15 min) |
| **P2 – High** | Major feature down, partial breach | ≤1 hour |
| **P3 – Medium** | Degraded service, potential exposure | ≤4 hours |
| **P4 – Low** | Minor, cosmetic, low impact | Next business day |

---

## 4. IR Phases (NIST-aligned)

### Phase 1: Preparation

| Task | Owner |
|------|-------|
| Maintain contact list (on-call, Security Lead, Compliance) | Operations |
| Keep runbooks current (`docs/DISASTER_RECOVERY_RUNBOOK.md`) | Engineering |
| Define escalation paths | Security Lead |
| Conduct tabletop exercises (annually) | Security / Compliance |

---

### Phase 2: Detection & Analysis

**Detection Sources:**

- Sentry alerts
- Audit log anomalies
- User reports
- Vendor notifications (Stripe, LINE, Firebase)
- External notification (e.g., HackerOne, abuse report)

**Initial Analysis:**

1. Confirm incident (vs. false positive)
2. Assign severity (P1–P4)
3. Identify scope (data, systems, users)
4. Assign Incident Commander (IC)

---

### Phase 3: Containment

**Short-term (Immediate):**

- Isolate affected systems or accounts
- Revoke compromised credentials (rotate SESSION_SECRET, API keys)
- Block malicious IPs if applicable
- Disable compromised user accounts

**Long-term (if needed):**

- Apply patches, configuration changes
- Restore from known-good backup

**Reference:** Technical steps in `docs/DISASTER_RECOVERY_RUNBOOK.md` § 4.3, 4.5

---

### Phase 4: Eradication

- Remove cause of incident (malware, vulnerability, misconfiguration)
- Verify no persistence (backdoors, extra accounts)
- Document actions taken

---

### Phase 5: Recovery

- Restore services from backup if needed
- Re-enable systems after validation
- Monitor for recurrence
- Confirm RTO/RPO per `DISASTER_RECOVERY_RUNBOOK.md`

---

### Phase 6: Post-Incident

| Task | Timing |
|------|--------|
| **Postmortem** | Within 48 hours |
| **Document** | What happened, root cause, timeline |
| **Lessons learned** | Update runbooks, add monitoring |
| **Evidence retention** | Per SOC2 (e.g., 7 years for breach-related) |

---

## 5. Notification Requirements

| Scenario | Notify | Timing |
|----------|--------|--------|
| Data breach (PII) | Compliance, Legal | Immediate |
| Regulatory (PDPA, GDPR) | Compliance Lead | Per applicable law |
| Vendor incident affecting us | Relevant team | As soon as known |
| Customer impact | Per DATA-POLICY | Per policy/contract |

---

## 6. Roles & Responsibilities

| Role | Responsibility |
|------|----------------|
| **Incident Commander (IC)** | Coordinates response, decisions, communication |
| **On-call / Engineering** | Technical containment, runbook execution |
| **Security Lead** | Breach assessment, forensics, external communication |
| **Compliance** | Regulatory notification, evidence, audit support |
| **Legal** | Contractual, regulatory, external counsel if needed |

---

## 7. Contact Escalation

```
On-call → Engineering Lead → Security Lead → Compliance / Legal
```

*(Fill in actual contacts; keep offline copy.)*

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/DISASTER_RECOVERY_RUNBOOK.md` | Technical runbook (outage, breach, cron, secrets) |
| `docs/RISK_ASSESSMENT.md` | Risk register |
| `docs/VENDOR_RISK_ASSESSMENT.md` | Vendor risks (Stripe, LINE, Firebase) |
| `DATA-POLICY.md` | Data handling, notification obligations |
