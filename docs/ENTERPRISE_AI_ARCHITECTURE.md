# Enterprise AI Architecture — 10 Pillars

**อัปเดตล่าสุด:** 2025-02-10

---

## สรุปภาพรวม

ระบบ AI รองรับ **10 เสาหลักระดับ Enterprise** สำหรับคลินิก SaaS:

| # | Pillar | สถานะ | ไฟล์หลัก |
|---|--------|-------|----------|
| 1 | Customer Long-Term Memory | ✅ | `customer-memory-store.ts`, `memory-summarization.ts` |
| 2 | Vector Knowledge Layer (RAG) | ✅ | `knowledge-vector.ts`, `knowledge-agent.ts` |
| 3 | AI Observability | ✅ | `ai-observability.ts` |
| 4 | Prompt Versioning | ✅ | `prompt-registry.ts`, `role-manager.ts` |
| 5 | Pre-LLM Safety Layer | ✅ | `pre-llm-safety.ts` |
| 6 | AI Evaluation Harness | ✅ | `ai-evaluation-harness.test.ts`, `ai-golden-dataset.json` |
| 7 | Cross-Agent Reasoning | ✅ | `cross-agent-reasoning.ts` |
| 8 | Multi-Tenant AI Isolation | ✅ | `orchestrator.ts`, webhook `[orgId]` |
| 9 | AI Feedback Loop | ✅ | `ai-feedback-loop.ts` |
| 10 | Cost Governance | ✅ | `cost-governance.ts` |
| 11 | Cache Invalidation | ✅ | `ai-feedback-loop.ts`, `invalidateAICache()` |
| 12 | Embedding Version Drift | ✅ | `knowledge-vector.ts`, `pinecone.ts` (versioned namespace) |
| 13 | Memory Explosion Prevention | ✅ | `customer-memory-store.ts`, `memory-summarization.ts` |
| 14 | Queue System (Concurrency) | ✅ | `ai-queue.ts`, `acquireLLMSlot()` |

---

## 1. Customer Long-Term Memory

**วัตถุประสงค์:** เก็บ "ความจำจริง" ต่อลูกค้า — ไม่ใช่แค่ context ครั้งเดียว

### โครงสร้าง

- **Per-Customer Memory Store** — Firestore `customer_memory`
  - `org_id`, `user_id`, `summary`, `preferences`, `booking_pattern`, `sentiment_trend`
  - `message_count`, `last_summarized_at`
- **Memory Summarization Job** — ทุก 10 ข้อความ → สรุปเป็น profile ด้วย GPT-4o-mini
- **Org-isolated** — แยก memory ต่อ org ห้าม cross-tenant

### การใช้งาน

- `getCustomerMemory(orgId, userId)` — โหลดก่อนเรียก analytics
- `upsertCustomerMemory()` — อัปเดตหลังแชท
- `runMemorySummarizationForCustomer()` — รันเมื่อถึง threshold

---

## 2. Vector Knowledge Layer (RAG จริง)

**วัตถุประสงค์:** Semantic retrieval จาก Pinecone — ไม่ใช่แค่ lookup ธรรมดา

### โครงสร้าง

- **Pinecone** — `knowledge_documents` embed ด้วย `text-embedding-3-small`
- **Pyramid Filter** — `global` → `org` → `branch` → `conversation`
- **Knowledge Agent** — ใช้ `searchKnowledgeWithPyramid()` เมื่อมี `userMessage`

### การใช้งาน

- `searchKnowledgeWithPyramid(query, context)` — filter ตาม org, branch
- Knowledge Agent ดึงทั้ง RAG + Firestore fallback

---

## 3. AI Observability (Enterprise Grade)

**วัตถุประสงค์:** บันทึกทุก activity — audit, metrics, evaluation

### โครงสร้าง

- **Collection:** `ai_activity_logs`
- **ฟิลด์:** `prompt_version`, `model_version`, `tokens_used`, `agents_triggered`, `latency_per_agent_ms`, `policy_violation_detected`, `hallucination_detected`
- **Retention:** 30 วัน — purge ผ่าน cron cleanup

### การใช้งาน

- `logAIActivity()` — เรียกหลัง Role Manager
- `checkPolicyViolation(reply)` — rule-based
- `purgeOldAIActivityLogs()` — ใน `runAllCleanup()`

---

## 4. Prompt Versioning System

**วัตถุประสงค์:** Version tag, rollback, A/B test — ไม่ใช่ static string

### โครงสร้าง

- **Collection:** `prompt_registry`
- **ฟังก์ชัน:** `getActivePrompt(key, org_id?)`, `getPromptByVersion()`, `rollbackToVersion()`, `getPromptContent()`
- **Role Manager** — ใช้ `getPromptContent("role-manager", { org_id, useDefault })`

### การใช้งาน

- เพิ่ม prompt ใน Firestore ด้วย `key`, `version`, `content`, `is_active`
- Org-specific: ใส่ `org_id` ใน document
- Rollback: `rollbackToVersion("role-manager", "1.0.0")`

---

## 5. Pre-LLM Safety Layer

**วัตถุประสงค์:** Content classification ก่อนเข้า LLM — block/escalate ก่อนเรียก LLM

### โครงสร้าง

- **Classification:** `medical_intent`, `legal_intent`, `financial_sensitive`, `abusive`, `block`
- **SAFETY_FALLBACK_MESSAGES** — สำหรับแต่ละประเภท
- **เรียกก่อน** analytics และ LLM

### การใช้งาน

- `classifyPreLLM(message)` → `{ classification, block, escalate }`
- ถ้า block หรือ escalate → คืน fallback message ทันที ไม่เรียก LLM

---

## 6. AI Evaluation Harness

**วัตถุประสงค์:** Golden dataset, regression test — ไม่โง่เมื่อเปลี่ยน prompt

### โครงสร้าง

- **Golden Dataset:** `tests/fixtures/ai-golden-dataset.json`
- **Tests:** `tests/ai-evaluation-harness.test.ts`
  - Pre-LLM Safety
  - Policy Violation
  - Hallucination Check
  - Golden cases → Pre-LLM expectations
  - Regression: `chatOrchestrate` (opt-in `RUN_E2E_AI=1`)

### การใช้งาน

```bash
npm run test -- tests/ai-evaluation-harness.test.ts
RUN_E2E_AI=1 npm run test -- tests/ai-evaluation-harness.test.ts  # E2E
```

---

## 7. Cross-Agent Reasoning

**วัตถุประสงค์:** รวม logic ข้าม agents — ไม่ใช่แค่ดึงข้อมูล แต่ "วิเคราะห์เชิงกลยุทธ์"

### โครงสร้าง

- **Insight types:** `booking_promo`, `finance_campaign`, `churn_risk`, `upsell_opportunity`
- **Logic:** combine Booking + Promotion, Finance trend → recommend campaign, Customer churn detection

### การใช้งาน

- `runCrossAgentReasoning(analyticsContext)` — เรียกใน orchestrator
- ส่ง `_crossAgentInsights` ให้ Role Manager ผ่าน context

---

## 8. Multi-Tenant AI Isolation

**วัตถุประสงค์:** แยก org ชัดเจน — ไม่มี cross-tenant

### โครงสร้าง

- **Webhook:** `/api/webhooks/line/[orgId]` — dynamic org resolution
- **Orchestrator:** รับ `org_id` แล้วส่งต่อทุก layer
- **แยก:** memory store, knowledge index, prompt registry (org_id), cost budget

---

## 9. AI Feedback Loop (Self-Improvement)

**วัตถุประสงค์:** feedback → retrain prompt, cache, failure tagging, auto label hallucination

### โครงสร้าง

- **High-confidence cache** — `ai_response_cache` (org_id + hash, TTL 24h)
- **Failure tagging** — `ai_failure_tags` (policy_violation, hallucination, llm_error)
- **Feedback aggregation** — `ai_feedback_aggregates` เมื่อ admin label success/fail
- **Hallucination check** — `checkHallucination()` heuristic ก่อน cache

### การใช้งาน

- Cache lookup ก่อนเรียก LLM
- Cache store เมื่อ confidence ≥ 0.85
- `recordFeedbackForPromptImprovement()` — เรียกเมื่อ admin label (PATCH feedback)
- `getFeedbackSummaryForPrompt(org_id)` — สำหรับ prompt tuning

---

## 10. Cost Governance Layer

**วัตถุประสงค์:** Budget cap, hard stop, model downgrade, alert threshold

### โครงสร้าง

- **Collection:** `org_ai_budgets`
- **ฟังก์ชัน:** `getOrgAIBudget()`, `checkBudgetHardStop()`, `getEffectiveModel()`
- **Hard stop** — เมื่อเกิน budget → คืน fallback ไม่เรียก LLM

### การใช้งาน

- `checkBudgetHardStop(org_id)` — ก่อน analytics
- ตั้งค่า budget ใน Firestore ต่อ org

---

## 11. Cache Invalidation

**วัตถุประสงค์:** ลบ cache เมื่อข้อมูลเปลี่ยน — knowledge, promo, prompt

### การใช้งาน

- `invalidateAICache({ org_id?, scope? })` — ลบ `ai_response_cache`
- เรียกอัตโนมัติเมื่อ: `processKnowledgeInput`, `rollbackToVersion`
- Admin API: `POST /api/admin/ai-cache-invalidate` — body: `{ org_id?: string }`

---

## 12. Embedding Version Drift

**วัตถุประสงค์:** เมื่อเปลี่ยน embedding model — ใช้ namespace ใหม่

### โครงสร้าง

- `EMBEDDING_VERSION` — constant ใน `knowledge-vector.ts`
- `EMBEDDING_NAMESPACE_VERSION` — env (ว่าง = backward compat `knowledge`, ตั้ง `v1` = `knowledge_v1`)
- เมื่อเปลี่ยน model → ตั้ง `v2` แล้ว re-embed
- Metadata: `embedding_version` ใน Pinecone

### การ migrate

ตั้ง `EMBEDDING_NAMESPACE_VERSION=v2` → re-embed documents ลง namespace ใหม่

---

## 13. Memory Explosion Prevention

**วัตถุประสงค์:** Cap ขนาด memory ต่อลูกค้า — ป้องกัน unbounded growth

### โครงสร้าง

- `MAX_SUMMARY_CHARS = 800`
- `MAX_PREFERENCES_ITEMS = 15`
- `MAX_BOOKING_PATTERN_ITEMS = 10`
- `SUMMARIZATION_INPUT_LIMIT = 25` — จำกัด conversation ที่ใช้สร้าง summary

---

## 14. Queue System (Concurrency Limit)

**วัตถุประสงค์:** จำกัด concurrent LLM calls — ป้องกัน overload

### โครงสร้าง

- `CHAT_MAX_CONCURRENT` (default 10) — global limit
- `CHAT_MAX_CONCURRENT_PER_ORG` (default 5) — per-org limit
- `acquireLLMSlot(orgId)` — รอ slot ก่อนเรียก LLM
- In-memory semaphore — อนาคตสลับเป็น Redis/Bull ได้

---

## Firestore Collections (Enterprise AI)

| Collection | Indexes |
|-----------|---------|
| `customer_memory` | org_id + user_id |
| `ai_activity_logs` | org_id + created_at |
| `prompt_registry` | key + org_id + is_active |
| `org_ai_budgets` | org_id |
| `ai_response_cache` | cache_key + org_id |
| `ai_feedback_aggregates` | org_id + created_at |
| `ai_failure_tags` | (single-field auto) |

---

## Cron / Cleanup

- **`/api/admin/cleanup`** — purge `ai_activity_logs` เก่ากว่า 30 วัน
- เรียกผ่าน Vercel Cron หรือ Admin POST
