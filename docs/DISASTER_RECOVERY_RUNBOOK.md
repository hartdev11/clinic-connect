# Disaster Recovery Runbook (Enterprise)

## 1. Overview

| Item | Value |
|------|-------|
| **RPO (Recovery Point Objective)** | 24 hours max data loss |
| **RTO (Recovery Time Objective)** | 4 hours max downtime |
| **Last Updated** | 2025-02-10 |

### RPO / RTO Definition

| Tier | RPO | RTO | Scope |
|------|-----|-----|-------|
| **Critical** | 24h | 4h | Firestore, Auth, Knowledge Brain |
| **High** | 48h | 8h | AI activity logs, audit logs |
| **Medium** | 7d | 24h | Embedding queue, drift prediction jobs |

---

## 2. Infrastructure Dependencies

| Component | Provider | Failover Strategy |
|-----------|----------|-------------------|
| Application | Vercel | Multi-region; auto-failover |
| Database | Firestore (Firebase) | Geo-replicated; PITR (Blaze plan) |
| Auth/Session | JWT + HttpOnly cookie | Stateless; no failover needed |
| Vector Search | Pinecone | Region failover via PINECONE_FAILOVER_INDEX |
| Embedding | OpenAI | Circuit breaker; fallback to cached |
| Files | Firebase Storage | Geo-redundant |
| Cron/Jobs | Vercel Cron | Re-run manual or reschedule |

---

## 3. Pinecone Region Failover

### Primary / Failover Config

| Env Var | Purpose |
|---------|---------|
| `PINECONE_INDEX_NAME` | Primary index (e.g. `clinic-knowledge`) |
| `PINECONE_FAILOVER_INDEX` | Restored backup index in secondary region |
| `PINECONE_CONTROLLER_HOST` | Override API host for region switch (optional) |

### Failover Procedure

1. **Backup** (weekly): Create Pinecone backup via console or API
   - `POST /backups` on primary index
   - Store `backup_id` in runbook

2. **Primary region down**:
   - Create new index in secondary region (e.g. eu-west-1)
   - Restore from backup: `POST /indexes/restore` with `backup_id`
   - Wait for restore completion (~minutes to hours by size)
   - Set `PINECONE_FAILOVER_INDEX=<new-index-name>` in Vercel
   - Redeploy or use Vercel env preview

3. **Circuit breaker** will auto-isolate Pinecone after 5 consecutive failures; vector search returns `[]` and failsafe message is shown.

---

## 4. Firestore Backup Strategy

### Scheduled Exports (SOC2 / ISO 27001)

- **Schedule**: Daily at 02:00 UTC (`0 2 * * *`)
- **Retention**: 90 days
- **Destination**: GCS bucket `gs://<project>-firestore-backup/`

### Setup (gcloud)

```bash
gcloud firestore export gs://<project>-firestore-backup/$(date +%Y%m%d) \
  --collection-ids="clinic_knowledge","global_knowledge","ai_activity_logs","audit_logs"
```

### Point-in-Time Recovery (PITR)

- **Plan**: Firebase Blaze
- **Window**: 7 days
- **Contact**: Firebase Support for PITR restore

### Cross-Region Redundancy

- Firestore is **multi-region** by default (e.g. `nam5` = us-central)
- For dual-region: use Firestore multi-region locations at project creation
- Exports to GCS can use multi-region bucket (e.g. `us` or `eu`)

---

## 5. Incident Classification

| Severity | Definition | Example |
|----------|-------------|---------|
| **P1 – Critical** | Full outage, data loss, security breach | App down, DB unreachable |
| **P2 – High** | Major feature broken, partial outage | Chat down, Pinecone unreachable |
| **P3 – Medium** | Degraded, workaround exists | Slow, circuit breaker open |
| **P4 – Low** | Minor, cosmetic | UI glitch |

---

## 6. Runbook Procedures

### 6.1 Full Application Outage (Vercel)

**Symptoms:** 5xx errors, site unreachable.

**Steps:**

1. Check [Vercel Status](https://www.vercel-status.com/)
2. Check deployment: `vercel ls` or Vercel dashboard
3. Rollback if bad deploy: `vercel rollback` or promote previous deployment
4. If env vars broken: Redeploy with correct env in Vercel project settings

**Escalation:** Vercel support if provider incident.

---

### 6.2 Database (Firestore) Unreachable or Corrupted

**Symptoms:** Timeouts, "permission denied", data missing.

**Steps:**

1. Check [Firebase Status](https://status.firebase.google.com/)
2. Verify service account key and project ID in env
3. Check Firestore console for quota/limits
4. If data corruption suspected: Contact Firebase support for PITR (Blaze plan)

**Backup:** Use scheduled exports; verify last export in GCS.

---

### 6.3 Pinecone / Vector Search Unreachable

**Symptoms:** Knowledge Brain failsafe message, `[KnowledgeBrain] Vector search failed` logs.

**Steps:**

1. Check [Pinecone Status](https://status.pinecone.io/)
2. Circuit breaker may have opened — check `provider_circuit_breaker` in Firestore
3. Admin reset: `POST /api/admin/circuit-breaker/reset` (if implemented) or wait 1 min cooldown
4. If region down: Execute **Pinecone Region Failover** (Section 3)

---

### 6.4 Security Breach / Unauthorized Access

**Symptoms:** Unusual audit logs, admin actions, suspicious logins.

**Steps:**

1. **Immediate**: Revoke affected sessions — invalidate JWT secret or rotate `SESSION_SECRET`
2. **Investigate**: Export audit logs (`GET /api/admin/knowledge-brain/export-audit`)
3. **Contain**: Disable compromised user(s), rotate credentials
4. **Notify**: Per `docs/INCIDENT_RESPONSE.md` and DATA-POLICY

---

### 6.5 Cron / Background Job Failure

**Symptoms:** Old data not purged, embedding queue backlog.

**Steps:**

1. Manually trigger: `POST /api/admin/cleanup` with `Authorization: Bearer <CRON_SECRET>`
2. Drift prediction: `POST /api/admin/drift-prediction`
3. Verify `CRON_SECRET` matches in Vercel env

---

### 6.6 Environment Variable / Secret Leak

**Steps:**

1. Rotate leaked secret immediately (SESSION_SECRET, Stripe, LINE, Firebase, Pinecone, OpenAI)
2. Update in Vercel Project Settings → Environment Variables
3. Redeploy
4. Revoke old API keys in respective providers

---

## 7. Contact & Escalation

| Role | Responsibility |
|------|----------------|
| **On-call** | First response, runbook execution |
| **Engineering Lead** | Technical decisions, rollback approval |
| **Security Lead** | Breach assessment, external notification |
| **Compliance** | Data breach notification (if required) |

---

## 8. Post-Incident

1. **Postmortem** within 48 hours
2. Update this runbook with lessons learned
3. Add monitoring/alerting if gap identified
