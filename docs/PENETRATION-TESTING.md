# Penetration Testing Process (Enterprise)

## 1. Overview

This document defines the penetration testing process for the Clinic SaaS platform, aligned with OWASP Top 10 and enterprise best practices.

---

## 2. Test Scope

| Scope | Inclusion |
|-------|-----------|
| **In Scope** | `/api/*`, `/clinic/*`, auth flows, webhooks (with test keys) |
| **Out of Scope** | Third-party (Firebase, Stripe, LINE) infrastructure |
| **Credentials** | Dedicated test org; never production |

---

## 3. OWASP Top 10 Mapping

| OWASP | Control / Mitigation | Test Method |
|-------|---------------------|-------------|
| A01 Broken Access Control | RBAC, org isolation, Firestore rules | Manual: try cross-org access |
| A02 Cryptographic Failures | TLS, JWT, bcrypt, Firestore encryption | Check headers, key storage |
| A03 Injection | Parameterized queries, Firestore SDK | SQLi/NoSQLi payloads (expect 0 impact) |
| A04 Insecure Design | Auth flow, rate limit, CSRF | Architecture review |
| A05 Security Misconfiguration | CSP, headers, env | Automated scan (see §5) |
| A06 Vulnerable Components | npm audit, Dependabot | CI pipeline |
| A07 Auth Failures | Session, JWT, bot detection | Brute force, session fixation |
| A08 Integrity Failures | Webhook verification (HMAC, Ed25519) | Tamper payloads |
| A09 Logging Failures | Audit log, Sentry | Verify logs on test actions |
| A10 SSRF | No user-controlled URLs | N/A (out of scope if none) |

---

## 4. Manual Test Checklist

### 4.1 Authentication

- [ ] Brute force on `/api/auth/login` — expect rate limit
- [ ] Session fixation — new session after login
- [ ] JWT tampering — invalid signature rejected
- [ ] Access `/clinic/*` without cookie — redirect to login

### 4.2 Authorization

- [ ] Access org A data with org B token — 403
- [ ] Access admin routes as non-owner — 403
- [ ] Firestore rules: direct client access blocked (use Admin SDK only)

### 4.3 Injection

- [ ] Chat input: `'"; DROP TABLE--` — no DB impact
- [ ] API params: NoSQL injection patterns — filtered by Firestore SDK

### 4.4 Headers & Config

- [ ] CSP present and blocks inline scripts where appropriate
- [ ] X-Frame-Options, X-Content-Type-Options set
- [ ] No sensitive data in response headers

### 4.5 Webhooks

- [ ] LINE: Invalid `X-Line-Signature` — 401
- [ ] Stripe: Invalid `stripe-signature` — 401

---

## 5. Automated Security Scanning

See `.github/workflows/security-scan.yml` for:

- `npm audit` (dependency vulnerabilities)
- Optional: OWASP ZAP baseline, Snyk

Run locally:

```bash
npm run security:audit
npm run security:scan   # if scripts defined
```

---

## 6. Frequency

| Test Type | Frequency |
|-----------|-----------|
| Automated (npm audit, Dependabot) | Every PR / Weekly |
| Manual pen test | Annually (or pre-major release) |
| External pen test | Annually (recommended for SOC2) |

---

## 7. Reporting

- Store findings in internal issue tracker
- Critical/High: Fix within 7 days
- Medium: Fix within 30 days
- Low: Backlog

---

## 8. External Pen Test

For SOC2 / enterprise customers:

1. **Scope agreement** with vendor
2. **Test environment** — staging, never production
3. **Report retention** — 3 years, restricted access
4. **Remediation tracking** — link to this doc
