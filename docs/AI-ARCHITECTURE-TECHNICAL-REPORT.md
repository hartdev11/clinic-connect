# AI Architecture — Technical Report (Implementation-Based)

รายงานนี้สรุปจาก implementation จริงใน codebase เท่านั้น ไม่ใช่ข้อความเชิงการตลาด

---

## SECTION 1 — MODEL INFORMATION

### 1.1 โมเดลที่ใช้

| ใช้ที่ | Provider | Model name จริง | Version / หมายเหตุ |
|--------|----------|------------------|---------------------|
| Role Manager (7-Agent) | OpenAI | `gpt-4o-mini` | ค่าจาก `model-versioning.ts`: `model_version: "2024-07-18"` (metadata ไม่ได้ส่งไป API) |
| Pipeline: Intent | OpenAI | `gpt-4o-mini` | hardcoded ใน `agents/intent.ts` |
| Pipeline: Compose | OpenAI | `gpt-4o-mini` | hardcoded ใน `agents/compose.ts` |
| Pipeline: Memory summarization | OpenAI | `gpt-4o-mini` | hardcoded ใน `ai/memory-summarization.ts` |
| Booking Intent (create/reschedule/cancel) | OpenAI | `gpt-4o-mini` | hardcoded ใน `ai/booking-intent.ts` |
| AI Quality Reviewer (Knowledge Brain) | OpenAI | `gpt-4o-mini` | `REVIEW_MODEL` ใน `knowledge-brain/ai-quality-reviewer.ts` |
| LLM Judge (validation หลัง Role Manager) | OpenAI | `gpt-4o-mini` | `JUDGE_MODEL` ใน `ai/llm-judge.ts` |
| Chat Agent (fallback path) | OpenAI หรือ Google | `gpt-4o-mini` หรือ `gemini-2.5-flash` | เลือกตาม `CHAT_PROVIDER`: openai / gemini / auto |
| Pipeline: Summary (CRM) | Google | `gemini-2.5-flash` | ใน `agents/summary.ts` — `getGemini()` |

**สรุป:** ใช้หลายจุดเรียก (หลายไฟล์) แต่ชื่อโมเดลจริงมีสองแบบหลัก: **OpenAI `gpt-4o-mini`** และ **Google `gemini-2.5-flash`** (ใช้ใน summary และใน chat-agent เมื่อ provider เป็น gemini หรือ auto fallback).

### 1.2 Embeddings

| ใช้ที่ | Provider | Model name | Dimension |
|--------|----------|------------|-----------|
| Knowledge (legacy) — `knowledge-vector.ts` | OpenAI | `text-embedding-3-small` | default (ไม่ระบุ dimensions ใน code) |
| Knowledge Brain — `knowledge-brain/vector.ts` | OpenAI | `text-embedding-3-large` (หรือ `KNOWLEDGE_BRAIN_EMBEDDING_MODEL`) | 1536 |

### 1.3 Context window, Function calling, Streaming

- **Context window:** ไม่ได้ส่ง `max_tokens` ไปที่ model เลยในบางจุด ใน Role Manager ใช้ `modelConfig.max_tokens` (default 220 จาก `model-versioning.ts`). Input ถูกบีบด้วย `truncateContext` ที่ประมาณ 6000 chars (`MAX_INPUT_CHARS = 6000` ใน role-manager). ดังนั้นการใช้งานจริงถูกจำกัดที่ประมาณ 6k ตัวอักษร input และ 220 tokens output ใน Role Manager.
- **Function calling:** ไม่พบ implementation — ไม่มี `tools` หรือ `function_call` ใน `openai.chat.completions.create` หรือใน Gemini generateContent ใน codebase.
- **Streaming:** ไม่พบ — ไม่มี `stream: true` หรือการ consume stream ใน chat/orchestrator/pipeline/chat-agent.

### 1.4 ใช้โมเดลเดียวหรือหลายโมเดล

- **หลายโมเดล:** ใช่  
  - **OpenAI gpt-4o-mini:** Role Manager, Intent, Compose, Booking Intent, Memory summarization, LLM Judge, AI Quality Reviewer.  
  - **Google gemini-2.5-flash:** Summary (CRM), และ Chat Agent เมื่อ `CHAT_PROVIDER=gemini` หรือเมื่อ auto fallback หลัง OpenAI ล้มเหลว.
- **ลำดับการเรียก:**  
  - ใน **7-Agent flow:** เรียก 6 Analytics (ไม่มี LLM) แบบ **parallel** จากนั้นเรียก **Role Manager 1 ครั้ง** (sequential หลัง analytics).  
  - ใน **Pipeline flow:** Intent (OpenAI) → ตามด้วย Safety/ Escalation (rule-based) → Knowledge (RAG) → Compose (OpenAI หรือ template) → Memory (Gemini) เป็น **sequential**.  
  - **Booking:** ถ้าเข้า booking path จะเรียก `processBookingIntent` ซึ่งภายในอาจเรียก OpenAI หลายครั้ง (create / reschedule / cancel flow).

---

## SECTION 2 — AGENT ARCHITECTURE

### 2.1 รูปแบบระบบ

- **Hybrid:** มีทั้ง **multi-step flow (7-Agent)** และ **pipeline (Intent → Safety → Knowledge → Compose)** และ **single-call fallback (Chat Agent)**. ไม่ใช่ pure single-agent และไม่ใช่ pure multi-agent ที่สื่อสารกันด้วย message queue.
- **Tool-based orchestration:** ไม่มี — ไม่มี tools/functions ที่ให้ LLM เรียก; การ “ทำอะไร” ถูกกำหนดโดย code (if/else, feature flags) ไม่ใช่โดย LLM เลือก tool.

### 2.2 เมื่อมีหลาย agent

- **7-Agent flow (เมื่อ `CHAT_USE_7_AGENT=true`):**
  - **จำนวน:** 6 Analytics + 1 Role Manager = 7 หน่วยที่เรียกว่า “agents” ในโค้ด.
  - **บทบาท:**
    - **Booking Agent:** ข้อมูลจอง (ไม่มี LLM).
    - **Promotion Agent:** โปรโมชัน (ไม่มี LLM).
    - **Customer Agent:** ข้อมูลลูกค้า (ไม่มี LLM).
    - **Finance Agent:** ข้อมูลการเงินจาก Firestore (ไม่มี LLM) — ใช้เฉพาะ internal ไม่ส่งให้ลูกค้า.
    - **Knowledge Agent:** RAG (Pinecone + Firestore), ไม่มี LLM ในตัว agent.
    - **Feedback Agent:** ข้อมูล feedback (ไม่มี LLM).
    - **Role Manager:** รับผลจาก 6 ตัวด้านบน + customer memory → เรียก **LLM 1 ครั้ง** (OpenAI gpt-4o-mini) → สร้างคำตอบลูกค้า.
  - **การสื่อสาร:** ไม่มี message queue. แต่ละ Analytics agent return structured output → รวมเป็น `AggregatedAnalyticsContext` → ส่งเข้า Role Manager ในรูปแบบ prompt (JSON ถูก truncate เป็น text).
  - **Orchestrator:** `chatOrchestrate` ใน `ai/orchestrator.ts` — เรียก Pre-LLM Safety → (optional) cost-aware cache → (optional) booking intent → `acquireLLMSlot` → โหลด customer memory → `runAllAnalytics` (parallel) → `runCrossAgentReasoning` (sync) → `runRoleManager` (1 LLM call).

- **Pipeline flow (เมื่อ `CHAT_USE_PIPELINE=true` และไม่ใช้ 7-Agent):**
  - **หน่วยที่ทำงาน:** Intent (A) → Safety (B) → Escalation (E) → Knowledge (C) → Compose (D) → Memory (F). หลายขั้นเป็น rule-based หรือ template; ที่เรียก LLM จริงคือ Intent, Compose (และบางครั้ง Knowledge ผ่าน RAG ที่ไม่ใช่ LLM ในตัว agent).
  - **Orchestrator:** `runPipeline` ใน `agents/pipeline.ts` — เป็น function เดียวที่ควบคุมลำดับและ state; ไม่มี “manager” แยกต่างหาก.

- **Fallback (เมื่อไม่เปิด 7-Agent และไม่เปิด Pipeline):**  
  เรียก `chatAgentReply` (OpenAI หรือ Gemini ตาม `CHAT_PROVIDER`) — single LLM call, ไม่มี agent แยก.

### 2.3 Role Manager จริงหรือ prompt illusion

- **จริง:** Role Manager คือการเรียก LLM จริง 1 ครั้ง ใน `ai/role-manager.ts` ผ่าน `openai.chat.completions.create` ด้วย system prompt (จาก Prompt Registry หรือ default) และ user content ที่เป็นผลจาก 6 Analytics + customer memory. ไม่ใช่แค่ข้อความใน promptที่ “แกล้ง” เป็น manager — มีการส่ง context จริงและได้ reply จาก API.

---

## SECTION 3 — TOOL / FUNCTION CALLING

### 3.1 มี function calling หรือไม่

**ไม่มี.** ไม่พบการส่ง `tools` หรือ `functions` ใน OpenAI chat completion หรือเทียบเท่าใน Gemini ใน codebase.

### 3.2 มี tools อะไรบ้าง

**ไม่มี tools ในความหมายของ “function ที่ LLM เรียกได้”.**  
การทำงานด้านข้อมูลเกิดขึ้นใน code โดยตรง เช่น:

- **Booking:** `processBookingIntent` → ภายในเรียก `createBookingAtomic`, `updateBooking`, `getLatestReschedulableBooking` จาก `clinic-data` — ไม่ได้เปิดเป็น “tool” ให้ LLM สั่งเรียก.
- **Finance / Invoice / Payment:** ไม่มี path ที่ AI เรียก API สร้าง invoice หรือ confirm payment (ดู Section 3.4).

### 3.3 แต่ละ “flow” เชื่อมกับ service ไหน

- **Knowledge:**  
  - RAG: `knowledge-brain/vector.ts` (Pinecone + OpenAI embeddings) หรือ `knowledge-vector.ts` (Pinecone) + Firestore fallback ผ่าน `knowledge-data` / `knowledge-brain`.
- **Booking:**  
  - `clinic-data`: `createBookingAtomic`, `updateBooking`, `getBranchesByOrgId` + `slot-engine`: `isSlotAvailable`.
- **Finance (read-only สำหรับ AI):**  
  - `clinic-data`: `getDashboardStats` (ดึงจาก invoices/revenue ที่ implement แล้ว) — ใช้ใน Finance Agent เพื่อสร้าง context ภายในเท่านั้น.
- **Customer memory:**  
  - Firestore `customer_memory` ผ่าน `customer-memory-store.ts`.
- **Caching:**  
  - Firestore `ai_response_cache` ผ่าน `ai-feedback-loop.ts`.

### 3.4 สิทธิ์ของ AI ต่อ Invoice / Payment / การลบ

- **สร้าง invoice:** **ไม่ได้.** ไม่มี code path ที่ให้ AI เรียก API หรือ function สร้าง invoice.
- **Mark invoice PAID:** **ไม่ได้.** การเปลี่ยนสถานะเป็น PAID ทำเฉพาะใน `POST /api/clinic/invoices/[id]/confirm-payment` ซึ่งต้องมี session (human) และ body มี `amount_satang` + `idempotency_key`; ไม่มี tool หรือ LLM call ที่ไปเรียก endpoint นี้.
- **สร้าง payment:** **ไม่ได้.** Payment ถูกสร้างเฉพาะภายใน confirm-payment API (transaction) หลัง human ยืนยัน.
- **ลบข้อมูล (invoices, payments, refunds):** **ไม่ได้.** ไม่มี endpoint หรือ function ที่ให้ AI ลบ record เหล่านี้; นโยบายคือ no hard delete.

---

## SECTION 4 — MEMORY & CONTEXT

### 4.1 ประเภท memory

- **Stateless ต่อ request:** บาง path (เช่น คำนวณแล้วตอบเลย) ไม่ได้เก็บ state ข้ามข้อความ.
- **Conversation memory (short-term):**  
  - ใน Pipeline ใช้ **in-memory session** ผ่าน `session-storage.ts` (Map keyed by `userId`) — เก็บ `ConversationState` (recentMessages, service, area, stage, preference, …). ไม่ได้เก็บใน Firestore/Redis; รีเซ็ตเมื่อ process รีสตาร์ท.
- **Long-term memory (ลูกค้า):**  
  - Firestore collection `customer_memory` — เก็บ summary, preferences, booking_pattern, sentiment_trend, message_count, last_summarized_at. อัปเดตผ่าน `upsertCustomerMemory`; summary ถูกสร้างโดย `memory-summarization.ts` (OpenAI) หรือ `summarizeForCRM` (Gemini) แบบ fire-and-forget.
- **Vector database:**  
  - **Pinecone** ใช้สำหรับ RAG ของ Knowledge (และ Knowledge Brain) — namespace ตาม org / knowledge version.
- **Firestore retrieval:**  
  - ใช้เป็น fallback หรือแหล่งหลักของ knowledge ในบาง path (เช่น `listKnowledgeDocsForOrg`, Knowledge Brain Firestore path).
- **Hybrid:** ใช่ — รวม conversation (in-memory), long-term (Firestore customer_memory), RAG (Pinecone + Firestore).

### 4.2 การสร้าง context

- **System prompt:**  
  - Role Manager: จาก Prompt Registry (`getPromptContent`) หรือ `DEFAULT_ROLE_MANAGER_PROMPT`; มีการระบุข้อจำกัด (เช่น ห้ามสร้างข้อมูลที่ไม่มีใน context, ห้ามเอ่ย finance กับลูกค้า).
- **Dynamic injected data:**  
  - ผลจาก 6 Analytics (booking, promotion, customer, finance, knowledge, feedback) ถูก serialize เป็น JSON แล้ว truncate เข้า user message; customer memory summary ถูกใส่ใน context ให้ Role Manager.
- **User role injection:**  
  - ใน Pipeline มี `RunPipelineOptions.role` และ `subscriptionPlan` ส่งเข้า pipeline (ใช้สำหรับ RAG pyramid / logic อื่น); ไม่พบการส่ง “role” ตรงๆ เข้า Role Manager prompt เป็นข้อความแยก.
- **Branch scope:**  
  - `branch_id` ถูกส่งใน analytics context และใช้ใน RAG/knowledge (org_id, branch_id) เพื่อกรองความรู้ตามสาขา.

### 4.3 RAG

- **มี RAG:** ใช่.
- **Knowledge Agent (7-Agent):** ใช้ `searchKnowledgeBrain` (Pinecone + OpenAI embeddings ใน knowledge-brain) หรือ path อื่นที่ใช้ `searchKnowledgeWithPyramid` (knowledge-vector) กับ org/branch; ผลถูกส่งเข้า Role Manager เป็น structured context.
- **Pipeline Knowledge:** ใช้ `searchKnowledgeWithPyramid` จาก `knowledge-vector.ts` (Pinecone + text-embedding-3-small) และ static KNOWLEDGE_BASE เป็น fallback.
- **Retrieval:** top-k (เช่น RAG_TOP_K = 5), มี confidence / abstain logic และ timeouts (เช่น 150ms) ใน Knowledge Agent.

---

## SECTION 5 — SECURITY BOUNDARY

### 5.1 AI bypass permission layer ได้หรือไม่

- **โดย design ไม่ได้:**  
  - Chat/API ต้องผ่าน `getSessionFromCookies()` และ `org_id` มาจาก session; AI ไม่มี “session” แยก — มันรันบน backend หลัง auth แล้ว.
  - การยืนยัน payment ต้องผ่าน human-only endpoint (confirm-payment) ที่ตรวจ session และ role (owner/manager/staff) และ branch access.
- **ความเสี่ยง:** ถ้ามี endpoint อื่นที่รับ input จากผู้ใช้แล้วไปเรียก confirm-payment หรือสร้าง payment โดยไม่ตรวจสิทธิ์อีกครั้ง จะเป็นช่องโหว่ — จากที่ตรวจ, confirm-payment อ่าน session เองและไม่รับ “AI” เป็น caller โดยตรง. ดังนั้นใน implementation ปัจจุบัน AI ไม่สามารถ bypass permission layer ของ payment/invoice ได้ เพราะมันไม่มี path เรียก confirm-payment เลย.

### 5.2 การยืนยัน payment ต้องผ่าน human เสมอหรือไม่

- **ใช่.** การ mark PAID และสร้าง payment ทำเฉพาะใน `POST /api/clinic/invoices/[id]/confirm-payment` ซึ่งต้องมี session (cookie) และ role ที่อนุญาต; ไม่มี LLM หรือ agent ใดใน codebase ที่เรียก endpoint นี้หรือ function ที่ทำการเดียวกัน.

### 5.3 Guardrail ป้องกัน AI แก้ไข financial record หรือไม่

- **ทางสถาปัตยกรรม:**  
  - ไม่มี tool/function ที่ให้ AI สร้าง/อัปเดต invoice หรือ payment.  
  - Finance context ใน Role Manager ถูกระบุเป็น internal only (`buildInternalContext`) และมีข้อความใน prompt ห้ามเอ่ยตัวเลขรายได้/ยอดขายกับลูกค้า.  
  - Pre-LLM Safety (`pre-llm-safety.ts`) จับคำถามแนว financial_sensitive (รายได้, ยอดขาย, revenue, ข้อมูลการเงิน) แล้ว **block** และตอบด้วยข้อความตายตัว ไม่ให้เข้า LLM เพื่อลดความเสี่ยงที่ model จะตอบข้อมูลภายใน.
- **ไม่มี guardrail แยกเพิ่มเติม** (เช่น post-output filter) ที่ตรวจข้อความตอบแล้วบล็อกการ “สั่งยืนยัน payment” — เพราะอยู่แล้วว่า AI ไม่มี path จะไปยืนยัน payment ได้เลย.

---

## SECTION 6 — SCALABILITY

### 6.1 รองรับ concurrency กี่ session

- **จำกัดที่ process:**  
  - ใน `ai-queue.ts` ใช้ in-memory semaphore: `MAX_CONCURRENT` (default 10) และ `MAX_CONCURRENT_PER_ORG` (default 5) จาก env `CHAT_MAX_CONCURRENT`, `CHAT_MAX_CONCURRENT_PER_ORG`.  
  - “Session” ในที่นี้หมายถึงการรอ slot แล้วเรียก LLM (ใน 7-Agent flow หลังผ่าน cache/booking/pre-LLM). จำนวน session ที่รันพร้อมกันจึงถูกจำกัดโดยตัวเลขนี้ต่อ process.  
- **หลาย instance:** ค่าเหล่านี้เป็น per-process; ถ้า scale แนวนอนหลาย instance แต่ละ instance มี limit ของตัวเอง (รวมแล้วอาจสูงขึ้น) แต่ไม่มี coordination ระหว่าง instance — ไม่พบการใช้ Redis/Bull สำหรับ queue ใน implementation ปัจจุบัน.

### 6.2 Rate limit handling

- **มี.** ใน `distributed-rate-limit.ts` (Firestore-based sliding window):  
  - ต่อ IP: `IP_LIMIT` = 5 requests / 10 วินาที.  
  - ต่อ org: `ORG_CHAT_LIMIT` = 30 requests / 60 วินาที.  
- เกินแล้ว API คืน 429 และ `Retry-After`; มีการบันทึก rate limit hit และส่งเข้า org circuit breaker.

### 6.3 Fallback model

- **มีใน config:** ใน cost-governance มี `fallback_model` ใน `OrgAIBudget` และ `getEffectiveModel(orgId)` คืน fallback เมื่อเปิด `model_downgrade_enabled` และเกิน threshold.  
- **การใช้งานจริงใน Role Manager:** ใน `role-manager.ts` ใช้ `getModelConfig(input.org_id)` ซึ่งอ่านจาก Firestore `ai_model_config` (model_name, max_tokens, temperature) — **ไม่ได้เรียก `getEffectiveModel`** ในโค้ดที่อ่าน. ดังนั้นการ downgrade ตาม budget ที่กำหนดใน cost-governance ยังไม่ได้ถูกเชื่อมกับ Role Manager ใน implementation ปัจจุบัน.  
- **Fallback ระหว่าง provider:** ใน `chat-agent.ts` เมื่อ `CHAT_PROVIDER=auto` จะลอง OpenAI ก่อน ถ้า fail หรือ null ค่อยเรียก Gemini — นี่คือ fallback จริงที่ใช้ใน path ที่ใช้ chatAgentReply (LINE เมื่อไม่เปิด 7-Agent และไม่เปิด Pipeline).

### 6.4 เมื่อ model fail จะเกิดอะไร

- **Role Manager fail:** catch ใน role-manager, คืนข้อความ fallback (“ตอนนี้ข้อความเข้ามาเยอะ…”) และ `success: false`; บันทึก `recordProviderFailure("openai")` (circuit breaker).  
- **Orchestrator:** catch ใน chatOrchestrate; ถ้าเป็น `isFailsafeError` คืน `FAILSAFE_MESSAGE` เป็น success; ไม่ใช่ failsafe คืนข้อความข้อผิดพลาดทั่วไปและ success: false.  
- **API layer:** reserve budget แล้วถ้า error จะ reconcile; บันทึก LLM error และอาจเปิด circuit breaker สำหรับ org.  
- **ไม่มี retry อัตโนมัติ** สำหรับ LLM call ใน Role Manager (มีแค่ timeout และ abort).

---

## SECTION 7 — COST STRUCTURE

### 7.1 1 conversation ใช้กี่ model call

- **7-Agent path (ปกติ, ไม่เข้า booking):**  
  - 1 ครั้ง ต่อข้อความ (Role Manager เท่านั้น) — หลังผ่าน cache / pre-LLM / cost check / (และถ้าไม่เข้า booking).  
- **7-Agent + booking path:**  
  - 1 ครั้งจาก Role Manager ไม่ถูกเรียก (return ตั้งแต่ booking); แต่ `processBookingIntent` ภายในอาจเรียก OpenAI หลายครั้ง (extract create / reschedule / cancel + clarification).  
- **Pipeline path:**  
  - อย่างน้อย 1 ครั้ง (Intent) และอาจมีอีก 1 ครั้ง (Compose) ถ้าเข้า getKnowledge + composeReply; บาง path ใช้แค่ template ไม่เรียก LLM. Memory (summarizeForCRM) เป็น fire-and-forget อีก 1 call (Gemini).  
- **Chat Agent path:** 1 ครั้ง ต่อข้อความ (OpenAI หรือ Gemini).

### 7.2 มี sub-agent call ซ้อนหรือไม่

- **7-Agent:** 6 Analytics ไม่ใช่ LLM; มีเพียง Role Manager เป็น LLM call เดียว. ถ้ามี LLM Judge เปิด (`ENABLE_LLM_JUDGE`), จะมี **LLM call ที่สอง** หลัง Role Manager (llm-judge) เพื่อตรวจ reply vs knowledge.  
- **Pipeline:** Intent (1) + Compose (1) + อาจมี Memory summary (1 Gemini) = มากกว่า 1 call ต่อข้อความได้.  
- **Booking:** `processBookingIntent` อาจเรียก OpenAI หลายครั้งใน flow เดียว (extraction, clarification).

### 7.3 Caching

- **มี.** Firestore collection `ai_response_cache`:  
  - ก่อนเรียก LLM ใน orchestrator มี `getCachedResponse({ org_id, userMessage })`; ถ้า hit คืน reply ทันที ไม่เรียก Role Manager.  
  - หลังได้ reply จาก Role Manager ถ้า confidence ≥ 0.85 และไม่มี policy/hallucination flag จะ `setCachedResponse`.  
  - Cache key จาก hash ของ `org_id` + normalized user message; TTL 24 ชั่วโมง (`CACHE_TTL_HOURS`).  
- **Cost-aware cache:** มี `getDeterministicCachedReply` สำหรับ low-complexity / FAQ-like ก่อนเข้า flow หลัก.

---

## SECTION 8 — RISK ANALYSIS

### 8.1 จุดเสี่ยงทางสถาปัตยกรรม

- **Concurrency / queue อยู่แค่ใน process:** `acquireLLMSlot` ใช้ in-memory Map และ array เป็น queue. Scale หลาย instance จะได้หลายกลุ่ม limit แยกกัน และไม่มี global queue — อาจ overload provider หรือไม่สม่ำเสมอระหว่าง org.  
- **Conversation state ไม่ persist:** Session state (Pipeline) เก็บใน memory; restart หรือหลาย instance จะทำให้ state หายหรือไม่สอดคล้องกัน.  
- **Role Manager ไม่ใช้ fallback model ตาม cost:** `getEffectiveModel` มีใน cost-governance แต่ Role Manager ใช้แค่ `getModelConfig` — ถ้าเปิด downgrade ตาม budget จะไม่มีผลจนกว่าจะต่อเชื่อม.  
- **ไม่มี streaming:** latency รับรู้ได้มากถ้า reply ยาว; ไม่มีทางลด time-to-first-token.  
- **Embedding สองแบบ:** knowledge-vector ใช้ text-embedding-3-small, knowledge-brain ใช้ text-embedding-3-large — ต้องจัดการ namespace/version ให้ชัดถ้าใช้ทั้งสองในระบบเดียวกัน.

### 8.2 จุดที่ไม่ enterprise-ready

- **In-memory queue และ session state:** ไม่เหมาะกับ multi-instance และการ restart บ่อย.  
- **Rate limit อยู่ที่ Firestore:** ทำงานได้แต่ latency และ throughput ของ Firestore จะเป็นขีดจำกัดเมื่อ request สูงมาก.  
- **ไม่มี retry/backoff สำหรับ LLM:** fail แล้วจบ ไม่มี retry อัตโนมัติ.  
- **Fallback model ใน cost governance ยังไม่ต่อกับ Role Manager.**  
- **Observability:** มีการ log และ `logAIActivity` แต่ไม่มี single tracing ID ที่ไล่ทั้ง pipeline ครบทุกขั้นในทุก path (มี correlationId แต่การเชื่อมกับทุก sub-step ขึ้นกับ implementation แต่ละจุด).

### 8.3 ถ้าจะ scale 500+ clinics ควรแก้อะไร

- **Queue และ concurrency:** ย้ายไป Redis (หรือระบบ queue แบบ distributed) สำหรับ `acquireLLMSlot` และถ้าต้องการ global rate limit ให้ใช้ Redis-based sliding window แทนหรือเสริม Firestore.  
- **Conversation/session state:** เก็บ state ใน Redis (หรือ Firestore/DB) แทน in-memory เพื่อให้หลาย instance ใช้ร่วมกันและ survive restart.  
- **Rate limit:** พิจารณา Redis-based rate limit สำหรับ high RPS; เหลือ Firestore สำหรับ persistence/audit ถ้าต้องการ.  
- **Caching:** พิจารณา Redis สำหรับ ai_response_cache เพื่อลด latency และ load ที่ Firestore.  
- **Cost และ model selection:** ต่อ `getEffectiveModel` (หรือ logic downgrade ตาม budget) เข้ากับ Role Manager และจุดอื่นที่เรียก LLM ให้สอดคล้องกับนโยบายต้นทุนต่อ org.  
- **Monitoring และ tracing:** ใช้ correlationId ให้ครบทุกขั้น และส่งเข้า centralized logging/metrics เพื่อดู latency ต่อขั้น, failure ต่อ org, และการใช้โควต้า.

---

*รายงานนี้สรุปจาก codebase ปัจจุบันเท่านั้น การเปลี่ยนแปลงใน repo หลังจากนี้อาจทำให้รายละเอียดบางส่วนไม่ตรงกับ implementation ล่าสุด.*
