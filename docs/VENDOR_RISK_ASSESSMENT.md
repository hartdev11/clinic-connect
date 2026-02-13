# Vendor Risk Assessment (Enterprise)

## 1. Overview

This document assesses the security and operational risks of third-party vendors used by the Clinic SaaS platform.

| Item | Value |
|------|-------|
| **Assessment Cadence** | Annually |
| **Last Updated** | 2025-02-10 |

---

## 2. Vendor Inventory

| Vendor | Service | Data Accessed | Criticality |
|--------|---------|---------------|-------------|
| **Stripe** | Payment processing, subscriptions | Payment methods, customer IDs, billing metadata | High |
| **LINE** | Messaging, customer chat | User messages, LINE user IDs, profile data | High |
| **Firebase / Google Cloud** | Firestore, Auth, Storage | All application data (PII, org, transactions) | Critical |

---

## 3. Stripe

### 3.1 Service Description

- Payment processing (cards, etc.)
- Subscription management
- Webhook for checkout events

### 3.2 Data Flow

- **We send**: Org ID, plan ID, customer email, checkout metadata
- **Stripe holds**: Card tokens, payment records, customer objects
- **PCI**: We do not store card numbers; Stripe is PCI-DSS Level 1 certified

### 3.3 Risk Assessment

| Risk | Likelihood | Impact | Level | Mitigation |
|------|------------|--------|-------|------------|
| Stripe outage | Low | High | Medium | Stripe status page; graceful degradation; retry |
| Stripe breach | Rare | Critical | Medium | Stripe SOC2; we don't store PANs |
| Webhook tampering | Low | Medium | Low | Ed25519 signature verification |
| API key leak | Possible | High | Medium | Restrict keys; rotate on leak |
| Misconfiguration | Possible | Medium | Low | Test mode for dev; code review |

### 3.4 Compliance & Certifications

- PCI-DSS Level 1
- SOC 2 Type II
- [Stripe Security](https://stripe.com/docs/security)

### 3.5 Recommendation

**Risk level: Medium (Accept with controls)** — Use restricted API keys, verify webhooks, monitor Stripe status.

---

## 4. LINE (LINE Corporation)

### 4.1 Service Description

- LINE Messaging API for chat with customers
- Webhook for incoming messages

### 4.2 Data Flow

- **We send**: Reply messages, rich content
- **LINE holds**: User messages, LINE user IDs, channel config
- **We store**: LINE user ID, display name (for chat context); messages in conversation_feedback

### 4.3 Risk Assessment

| Risk | Likelihood | Impact | Level | Mitigation |
|------|------------|--------|-------|------------|
| LINE API outage | Low | Medium | Low | Graceful fallback; status monitoring |
| LINE breach | Rare | Medium | Low | Limited data; no financial data |
| Webhook spoofing | Possible | Medium | Low | HMAC-SHA256 verification |
| Channel secret leak | Possible | Medium | Low | Env var; rotate on leak |
| Message content exposure | Low | Medium | Low | Encrypt at rest (Firestore) |

### 4.4 Compliance & Certifications

- LINE Business: Standard terms; [LINE Developers](https://developers.line.biz/)
- No public SOC2; treat as medium-trust for messaging

### 4.5 Recommendation

**Risk level: Low–Medium (Accept)** — Webhook verification, minimal PII storage, channel secret protection.

---

## 5. Firebase / Google Cloud

### 5.1 Service Description

- **Firestore**: Primary database (orgs, users, customers, bookings, etc.)
- **Firebase Admin SDK**: Server-side auth, Firestore access
- **Firebase Auth** (if used): User authentication
- **Firebase Storage** (if used): File storage

### 5.2 Data Flow

- **We store**: All application data including PII, org data, transactions
- **Google holds**: Data at rest (encrypted); geo-replicated

### 5.3 Risk Assessment

| Risk | Likelihood | Impact | Level | Mitigation |
|------|------------|--------|-------|------------|
| Firestore outage | Low | Critical | High | Multi-region; PITR; DR runbook |
| Data corruption | Rare | Critical | High | PITR (Blaze); scheduled exports |
| Service account leak | Possible | Critical | High | Least privilege; key rotation |
| Misconfigured rules | Possible | High | Medium | Firestore rules review; testing |
| Unauthorized access | Low | Critical | High | Client blocked; Admin SDK only; org_id filter |

### 5.4 Compliance & Certifications

- SOC 2 Type II
- ISO 27001, 27017, 27018
- [Google Cloud Compliance](https://cloud.google.com/security/compliance)

### 5.5 Recommendation

**Risk level: High (Critical dependency)** — Strongest controls: Firestore rules, org isolation, service account restriction, PITR, backups.

---

## 6. Summary Matrix

| Vendor | Overall Risk | Key Mitigations |
|--------|--------------|-----------------|
| Stripe | Medium | Webhook verify, restricted keys, PCI delegated |
| LINE | Low–Medium | Webhook verify, minimal PII, secret protection |
| Firebase | High (critical) | Rules, org filter, PITR, backups, key management |

---

## 7. Review Schedule

| Action | Frequency |
|--------|-----------|
| Re-assess each vendor | Annually |
| Check vendor security pages / status | Quarterly |
| Rotate keys (if no rotation policy) | Annually or on personnel change |
| Update this doc on new vendor | Before go-live |
