# Enterprise Knowledge Brain System

**อัปเดตล่าสุด:** 2025-02-10

---

## Architecture

```
Global Industry Knowledge (global_knowledge)
        ↓
Clinic Override Layer (clinic_knowledge)
        ↓
Structured Context Builder
        ↓
Vector Embedding (Pinecone namespace per org)
        ↓
AI Orchestrator (7-Agent → Role Manager)
```

---

## Collections

| Collection | Description |
|------------|-------------|
| `global_knowledge` | Industry baseline — services, risks, contraindications |
| `clinic_knowledge` | Clinic overrides — custom_brand, price_range, differentiator |
| `knowledge_versions` | Version snapshots — rollback support |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clinic/knowledge-brain/global` | List global services |
| GET | `/api/clinic/knowledge-brain/clinic` | List clinic knowledge |
| POST | `/api/clinic/knowledge-brain/clinic` | Create (Add to My Clinic) |
| PATCH | `/api/clinic/knowledge-brain/clinic/:id` | Update override fields |
| POST | `/api/clinic/knowledge-brain/submit/:id` | Submit for review (draft → pending) |
| POST | `/api/clinic/knowledge-brain/approve/:id` | Approve (owner/manager) |
| POST | `/api/clinic/knowledge-brain/reject/:id` | Reject → draft |
| POST | `/api/clinic/knowledge-brain/reindex` | Re-embed approved docs |
| POST | `/api/clinic/knowledge-brain/rollback` | Rollback to version |
| GET | `/api/clinic/knowledge-brain/versions?knowledge_id=` | Version history |
| GET | `/api/clinic/knowledge-brain/audit` | Audit log |

---

## UI

**Path:** `/clinic/knowledge-brain`

**Tabs:**
1. **Industry Library** — Global services, "Add to My Clinic"
2. **My Clinic Knowledge** — Override fields, status badge, Submit for Review
3. **Approval Panel** — Approve/Reject (owner/manager only)
4. **Audit Log** — ใครแก้อะไร เมื่อไร

---

## Validation

ก่อนบันทึก `clinic_knowledge`:
- `suitable_for`, `not_suitable_for`, `risks` ต้องไม่ว่าง (จาก global)
- `description` ≥ 200 ตัวอักษร (จาก global)
- ห้ามมี "รับประกัน 100%"

---

## Vector RAG

- **Model:** `text-embedding-3-large` (configurable via `KNOWLEDGE_BRAIN_EMBEDDING_MODEL`)
- **Namespace:** `kb_{org_id}` สำหรับ clinic, `kb_global` สำหรับ global
- **Embed:** เฉพาะ `status=approved`
- **Fallback:** clinic → global

---

## Seed Global Knowledge

```bash
npx tsx scripts/seed-global-knowledge.ts
```

---

## RBAC

| Action | staff | manager | owner |
|--------|-------|---------|-------|
| View Industry / My Clinic | ✅ | ✅ | ✅ |
| Add to Clinic, Edit draft | ✅ | ✅ | ✅ |
| Submit for Review | ✅ | ✅ | ✅ |
| Approve / Reject | ❌ | ✅ | ✅ |
| Re-index | ❌ | ✅ | ✅ |
| Rollback | ❌ | ✅ | ✅ |
| Audit Log | ❌ | ✅ | ✅ |
