# Firestore Index Requirements (1,000+ Org Scale)

**Audit date:** 2025-02-10  
**Scope:** All `where("org_id", "==")` and composite queries

---

## Summary

| Collection | Query Fields | Status | firestore.indexes.json |
|------------|--------------|--------|------------------------|
| organizations | _legacy_clinic_id | Auto (single) | N/A |
| organizations | licenseKey | Auto (single) | N/A |
| branches | org_id | Auto (single) | ✅ org_id+createdAt, org_id+name |
| users | org_id | Auto (single) | ✅ org_id+email |
| users | org_id + email | Composite | ✅ org_id+email |
| bookings | org_id + scheduledAt | Composite | ✅ org_id+scheduledAt |
| bookings | org_id + createdAt | Composite | ✅ org_id+createdAt |
| bookings | org_id + branch_id + scheduledAt | Composite | ✅ |
| bookings | org_id + branch_id + createdAt | Composite | ✅ |
| customers | org_id + createdAt | Composite | ✅ |
| transactions | org_id + createdAt | Composite | ✅ |
| transactions | org_id + branch_id + createdAt | Composite | ✅ |
| promotions | org_id + status + endAt | Composite | ✅ |
| promotions | org_id + branch_id + status + endAt | Composite | ✅ |
| conversation_feedback | org_id + user_id + createdAt | Composite | ✅ |
| knowledge_documents | org_id + text | Composite | ✅ org_id+text, org_id+is_active |
| knowledge_documents | org_id + is_active | Composite | ✅ |
| knowledge_documents | text + org_id + branch_id | Composite | ⚠️ Verify |
| subscriptions | org_id + createdAt | Composite | ✅ |
| subscriptions | stripe_subscription_id | Auto (single) | N/A |
| clinics | email | Auto (single) | N/A |

---

## New Collections (Require Indexes)

| Collection | Query | Required Index |
|------------|-------|----------------|
| llm_usage_daily | doc id = orgId_date | None (document lookup) |
| stripe_events | doc id = eventId | None (document lookup) |
| audit_logs | org_id + timestamp (future queries) | Add for admin viewer |
| rate_limit_events | key + windowStart (if Firestore-backed) | Add when implemented |

---

## Required Additions to firestore.indexes.json

```json
{
  "collectionGroup": "audit_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "org_id", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

---

## knowledge_data.ts — text + org_id + branch_id

Current query: `where("text", "==", normalized)` then optional `where("org_id", "==")` and `where("branch_id", "==")`.

Firestore requires: equality filters in specific order. If query uses `text` + `org_id` + `branch_id`, composite index needed:

- knowledge_documents: text (ASC) + org_id (ASC) + branch_id (ASC)

Check `firestore.indexes.json` — `org_id` + `text` exists. For `org_id` + `branch_id` + `text` — add if query uses all three.

---

## Action Items

1. Add `audit_logs` composite index for admin viewer (org_id + timestamp desc)
2. Deploy: `firebase deploy --only firestore:indexes`
3. Verify all queries run without "index required" errors in production
