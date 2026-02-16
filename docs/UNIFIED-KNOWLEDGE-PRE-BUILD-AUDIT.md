# Pre-Build Audit: Unified AI Knowledge (Enterprise 10/10)

**Date:** 2025-02-15  
**Scope:** Full codebase scan before implementing spec changes  
**Rule:** Do NOT implement until user says "เริ่มทำ"

---

## 1. What Already Exists

### 1.1 Unified Knowledge Implementation
| Component | Location | Status |
|----------|----------|--------|
| Types | `src/types/unified-knowledge.ts` | ✅ GlobalService, ClinicService, ClinicFaq, UnifiedKnowledgeStatus |
| Data layer | `src/lib/unified-knowledge/data.ts` | ✅ list/get/create/update clinic_services, clinic_faq; global_services mapped from global_knowledge |
| Vector upsert | `src/lib/unified-knowledge/vector.ts` | ✅ upsertUnifiedServiceToVector, upsertUnifiedFaqToVector, delete by id |
| APIs | `src/app/api/clinic/unified-knowledge/*` | ✅ status, global, services, services/[id], faq, faq/[id] |
| UI | `src/app/(clinic)/clinic/knowledge/page.tsx` | ✅ Single page: status cards, Services/FAQ/Promotions tabs, Platform Managed Mode |
| Migration | `src/lib/unified-knowledge/migrate.ts` + `POST /api/admin/unified-knowledge-migrate` | ✅ knowledge_topics + clinic_knowledge → clinic_services/faq |
| Feature flag | `src/lib/feature-flags.ts` | ✅ isPlatformManagedMode(orgPlan) — enterprise = managed |

### 1.2 Embedding Queue Logic
| Item | Location | Status |
|------|----------|--------|
| Queue collection | `embedding_job_queue` (Firestore) | ✅ PENDING → process → PROCESSED/FAILED |
| Job types | `embedding-queue.ts` | ✅ clinic, global, knowledge_version, **unified_service**, **unified_faq** |
| Process | `processEmbeddingQueue()` | ✅ Batch BATCH_SIZE=10, orderBy created_at |
| Triggers | API routes + cron | ✅ Enqueue on save; cron `/api/admin/embedding-worker` every 5 min (CRON_SECRET) |
| Retry / backoff / DLQ | — | ❌ **None**: single attempt, then FAILED; no retry count, no exponential backoff, no dead-letter |
| Idempotency | — | ⚠️ No dedup key per entity (same entity can be enqueued multiple times) |
| Job timeout | — | ❌ Not implemented |
| markVersionFailed | knowledge_version only | ✅ markVersionFailed(orgId, versionId) on failure; **unified_service/faq do NOT set embedding_failed on entity** |

### 1.3 Pinecone Namespace Usage
| Namespace | Used by | Location |
|-----------|---------|----------|
| `knowledge` or `knowledge_${EMBEDDING_NAMESPACE_VERSION}` | knowledge_topics (knowledge-vector) | `src/lib/knowledge-vector.ts`, `getEmbeddingNamespace()` |
| `kb_${orgId}` | knowledge-brain clinic + **unified** (unified_svc_*, unified_faq_*) | `src/lib/knowledge-brain/vector.ts` getOrgNamespace(), `src/lib/unified-knowledge/vector.ts` same prefix |
| `kb_global` | knowledge-brain global templates | `src/lib/knowledge-brain/vector.ts` |
| Isolation | Per-org by namespace | ✅ No cross-org in same namespace |

### 1.4 Audit Log System
| System | Location | Scope |
|--------|----------|--------|
| Knowledge-brain audit | `src/lib/knowledge-brain/audit.ts` | logKnowledgeAudit(org_id, action, user_id, target_id, target_type, details) → `audit_logs` |
| General security audit | `src/lib/audit-log.ts` | writeAuditLog(event, org_id, user_id, …) → `audit_logs` (login, logout, subscription, etc.) |
| Unified knowledge | — | ❌ **No audit** on clinic_services / clinic_faq create/update/delete |
| Immutability / hash | — | ❌ Append-only only; no hash integrity field |

### 1.5 RBAC Middleware
| Pattern | Location | Usage |
|---------|----------|--------|
| getSessionFromCookies + getOrgIdFromClinicId | All clinic APIs | ✅ |
| getEffectiveUser(session) + requireRole(role, ["owner","manager","staff"]) | Unified + knowledge + others | ✅ |
| Admin | requireAdminSession() | Admin routes |
| No dedicated RBAC middleware file | — | Per-route auth in getAuth() |

### 1.6 Rate Limiting
| Item | Location | Usage |
|------|----------|--------|
| checkRateLimit / distributed | `src/lib/rate-limit.ts`, `distributed-rate-limit.ts` | Used in knowledge/assist, feedback, chat, etc. |
| Unified knowledge APIs | — | ❌ **No rate limiting** on unified-knowledge/* |

### 1.7 Observability / Logging
| Item | Location | Status |
|------|----------|--------|
| runWithObservability(route, request, handler) | `src/lib/observability/run-with-observability.ts` | ✅ Latency + recordApiError on 5xx |
| recordApiError | observability | ✅ |
| Embedding success/backlog/latency | — | ❌ **Not tracked** (no metrics for embedding queue backlog, success rate, vector latency) |
| Sentry / Datadog | — | ❌ Not found in codebase |

### 1.8 global_services Schema
| Source | Reality |
|--------|--------|
| Spec | global_services with version, effective_from, deprecated_at |
| Code | **No** `global_services` collection. Unified uses **global_knowledge** (listGlobalKnowledge) mapped to GlobalService (id, name, standard_description, compliance_locked, version, created_at, updated_at). **No** effective_from, deprecated_at. |

### 1.9 clinic_services / clinic_faq Schema (Current)
| Field | clinic_services | clinic_faq |
|-------|-----------------|------------|
| embedding_version | ✅ | ✅ |
| last_embedded_at | ✅ | ✅ |
| template_version_at_embed | ❌ | N/A |
| deleted_at (soft delete) | ❌ | ❌ |
| status | ✅ active \| inactive | ❌ (no status) |
| status embedding_failed | ❌ | ❌ |

### 1.10 Firestore Indexes
| Collection | Query | Index |
|------------|-------|--------|
| embedding_job_queue | status + created_at | Required for processEmbeddingQueue (where status, orderBy created_at) — **verify exists** |
| organizations/{id}/clinic_services | orderBy updated_at | Single-field, auto |
| organizations/{id}/clinic_faq | orderBy updated_at | Single-field, auto |
| audit_logs | org_id + timestamp | Documented in FIRESTORE_INDEX_REQUIREMENTS.md (add for admin viewer) |

---

## 2. Conflicts With This Spec

1. **Embedding pipeline**
   - Spec: Max retry 3, exponential backoff, dead-letter, job timeout, idempotent dedup key.
   - Current: Single attempt, then FAILED; no retry, no DLQ, no timeout, no dedup.

2. **On failure:** Spec: mark entity as `embedding_failed`, keep previous vector, show badge in UI.
   - Current: unified_service/faq do **not** set any field on the entity; only job doc gets FAILED. UI has no `embedding_failed` status.

3. **global_services:** Spec wants effective_from, deprecated_at, version incremental.
   - Current: global_services is a **mapping** from global_knowledge; no separate table. effective_from/deprecated_at don’t exist.

4. **clinic_services / clinic_faq:** Spec wants deleted_at (soft delete), template_version_at_embed (clinic_services), status enum including embedding_failed (both).
   - Current: No deleted_at, no template_version_at_embed, clinic_faq has no status, no embedding_failed.

5. **audit_logs:** Spec wants immutable, append-only, optional hash.
   - Current: audit_logs exist (knowledge-brain + general) but **unified knowledge does not write** to them. No hash field.

6. **Version drift:** Spec: if global_service.version > template_version_at_embed → “Template Update Available” badge, review diff, accept/keep.
   - Current: No template_version_at_embed, no version drift UI or flow.

7. **Safety before embed:** Spec: strip HTML, max length, validate medical claims, normalize whitespace, dedup sentences.
   - Current: Only text slice in vector build (e.g. 8191); no HTML strip or medical validation in unified path.

8. **Observability:** Spec: track embedding success rate, backlog, vector latency, retrieval latency, token per org; alert on backlog/error rate/empty namespace/embedding_failed.
   - Current: No such metrics or alerts.

9. **Performance:** Spec: P95 API <300ms, retrieval <500ms, Redis cache for status.
   - Current: Status endpoint has no Redis cache; no P95 targets enforced.

10. **Tests:** Spec: unit (data), integration (API), embedding pipeline (mock vector), multi-tenant, permission, soft delete, version drift, expired promotion.
    - Current: No tests found for unified-knowledge or embedding queue.

---

## 3. What Must Be Refactored (Not Duplicated)

1. **Embedding queue** (`src/lib/knowledge-brain/embedding-queue.ts`)
   - Add: retry_count (max 3), exponential backoff, optional job timeout, dedup key per (type, org_id, entity_id) to avoid duplicate jobs.
   - On failure for unified_service/faq: update entity with status = embedding_failed (and optionally last_embed_error); do **not** remove previous vector.
   - Optionally: dead-letter collection or status = "dead_letter" after max retries.

2. **Unified data layer** (`src/lib/unified-knowledge/data.ts`, types)
   - Add: deleted_at, template_version_at_embed (clinic_services), status for clinic_faq (active | inactive | embedding_failed).
   - Extend ClinicServiceStatus to include embedding_failed.
   - All list/get must filter out deleted_at (or expose a “withDeleted” for admin only).

3. **Global “template” versioning**
   - Either: add effective_from, deprecated_at (and version) to global_knowledge or to a real global_services collection and use them in mapping.
   - Or: keep mapping from global_knowledge and add version + effective_from/deprecated_at there; unify in one place, don’t duplicate two sources.

4. **Audit**
   - Use existing `logKnowledgeAudit` (or extend with target_type clinic_service / clinic_faq) for all unified create/update/delete; same collection `audit_logs`. Do **not** create a second audit system.

5. **RBAC**
   - Keep current per-route getAuth() + requireRole; add rate limiting to unified-knowledge routes using existing checkRateLimit.

6. **Observability**
   - Extend existing runWithObservability + recordApiError; add structured metrics for embedding (success/fail count, queue depth, latency) in the same observability layer rather than a separate system.

7. **Pinecone**
   - Keep single namespace pattern (kb_orgId) for unified; no new namespace. Retrieval already uses searchKnowledgeBrain (same index/namespace).

---

## 4. What Must NOT Be Duplicated

- **Do not** create a second queue system; extend `embedding_job_queue` and `processEmbeddingQueue`.
- **Do not** create a second audit collection; use `audit_logs` and existing logKnowledgeAudit or a small extension.
- **Do not** add a second RBAC or auth layer; keep getSessionFromCookies + getEffectiveUser + requireRole.
- **Do not** add a second Pinecone index or new namespace for unified; keep kb_orgId.
- **Do not** reintroduce Knowledge Control Center or approval workflow.
- **Do not** block UI on embedding; keep async enqueue only.

---

## 5. Pipeline Safety (Do Not Break)

- **knowledge-agent** uses searchKnowledgeBrain(org_id, query, topK) and optionally retrieveKnowledgeContext (knowledge_topics). Both feed the same pipeline. Unified vectors live in the same kb_orgId namespace and are already returned by searchKnowledgeBrain. **Do not** change pipeline order in `src/lib/agents/pipeline.ts`.
- **knowledge-brain** (ClinicKnowledge, GlobalKnowledge, approve/reject) still exists and is used by booking/slot-settings and reindex; redirect from `/clinic/knowledge-brain` to `/clinic/knowledge` is already in place. New work must not remove or break knowledge-brain **read** paths used by other features until deprecation is explicit.

---

## 6. Summary Table

| Spec item | Exists | Action |
|-----------|--------|--------|
| Unified knowledge (data, API, UI) | ✅ | Extend only (fields, audit, safety) |
| Embedding queue | ✅ | Refactor: retry, backoff, DLQ, timeout, dedup, set embedding_failed on entity |
| Pinecone namespace | ✅ | No change |
| Audit log | ✅ (other) | Wire unified to existing audit_logs |
| RBAC | ✅ | Add rate limit on unified APIs |
| Rate limiting | ✅ (other) | Apply to unified-knowledge |
| Observability | ✅ (basic) | Add embedding metrics + optional Redis for status |
| global_services (effective_from, deprecated_at) | ❌ | Add to source (global_knowledge or new collection) |
| clinic_services (deleted_at, template_version_at_embed, embedding_failed) | ❌ | Add fields + migration |
| clinic_faq (deleted_at, status) | ❌ | Add fields |
| Version drift UI | ❌ | Add after template_version_at_embed |
| Pre-embed safety (HTML, medical, etc.) | ❌ | Add in unified vector build path |
| Tests | ❌ | Add per spec |
| Redis cache status | ❌ | Optional add |

---

**Next step:** Wait for user to say "เริ่มทำ" before implementing any of the above.
