# Enterprise Scalability & Reliability Audit
## 500+ Clinics Production Readiness (Implementation-Based)

รายงานนี้อิงจาก implementation จริงใน codebase เท่านั้น

---

## SECTION 1 — IN-MEMORY CONCURRENCY RISK (CRITICAL)

### 1.1 Implementation ปัจจุบัน

**ที่มา:** `src/lib/ai/ai-queue.ts`

- **Semaphore:** ตัวแปรใน process: `globalCount` (number), `orgCount` (Map<string, number>), `waitQueue` (Array<{ orgId, resolve }>).
- **Limit:** `MAX_CONCURRENT = parseInt(process.env.CHAT_MAX_CONCURRENT ?? "10", 10) || 10`, `MAX_CONCURRENT_PER_ORG = parseInt(process.env.CHAT_MAX_CONCURRENT_PER_ORG ?? "5", 10) || 5`.
- **Flow:** `acquireLLMSlot(orgId)` — ถ้า globalCount < 10 และ orgCur < 5 则 increment แล้ว return release function; ไม่ใช่则 push ลง waitQueue แล้วรอ Promise. `tryWake()` ปลุก head of queue เมื่อมี slot ว่าง (FIFO).
- **Storage:** ทั้งหมดอยู่ใน memory ของ process เดียว ไม่มี Redis หรือ shared store.

### 1.2 Deploy 3 Instance — Global Concurrent และ Coordination

- **Instance A:** limit 10 global, 5 per org (ใน process A).
- **Instance B:** limit 10 global, 5 per org (ใน process B).
- **Instance C:** limit 10 global, 5 per org (ใน process C).

**Global concurrent สูงสุดที่ไปถึง OpenAI:** 10 + 10 + 10 = **30** (ถ้า load balancer แบ่ง request ไปทั้ง 3 instance เท่ากัน และแต่ละ instance เต็ม 10 slot).

**Global coordination:** **ไม่มี.** แต่ละ instance นับแยกกัน ไม่มี central coordinator. ดังนั้น:

- แต่ละ instance ไม่รู้ว่า instance อื่นใช้กี่ slot.
- ไม่มี global cap (เช่น 15) ที่บังคับรวมทั้ง 3 instance.
- Rate limit ฝั่ง API ใช้ Firestore (`distributed-rate-limit.ts`) — org 30/min, IP 5/10s — จึงมี coordination ระดับ request count ต่อ org/IP แต่ **concurrency ระดับ LLM slot ไม่มี coordination.**

### 1.3 Risk Analysis

| ความเสี่ยง | รายละเอียดจาก implementation |
|------------|------------------------------|
| **OpenAI 429** | สูงสุด 30 concurrent ไปที่ OpenAI (3×10). ถ้า OpenAI limit ต่อ account ต่ำกว่า 30 หรือมี burst จะได้ 429. ไม่มี global throttle ที่รวมทุก instance. |
| **Uneven load distribution** | Load balancer (round-robin / least-conn ฯลฯ) แบ่ง request ไป instance ต่างๆ. แต่ละ instance มี queue แยก. ถ้า instance A ได้ request มากกว่า B, C — A จะเต็มและ queue สูง, B/C อาจ idle. ไม่มี work stealing หรือ global queue. |
| **Latency spike** | เมื่อ slot เต็ม request ถูก push ลง waitQueue (in-process array). รอจนกว่า slot ว่าง. ไม่มี timeout ที่ code — ถ้า queue สะสม request จะรอไม่จำกัด. Latency = เวลา analytics + เวลาใน queue + เวลา Role Manager. |
| **Org starvation** | Queue เป็น FIFO (tryWake ปลุก head). ถ้า org ใหญ่ส่ง request ต่อเนื่องและเติม slot ครบ 5, org อื่นที่รอใน queue อาจรอนาน. ไม่มี fairness ต่อ org (ไม่มี round-robin ต่อ org ใน queue). |

### 1.4 สรุป Section 1

- **Risk Level:** **High** (multi-instance), **Critical** ถ้าเป้าหมาย 500+ clinics peak hour (หลายร้อย concurrent chat).
- **รองรับ 500+ clinics peak hour หรือไม่:** **ไม่รองรับ.** ปัจจุบันไม่มี global concurrency limit, state ไม่ share, queue ต่อ instance — จะเกิด 429, queue สะสม, และ latency สูงเมื่อ traffic มาก.

### 1.5 Implementation Plan (Pseudo Architecture)

**ตัวเลือก A: Redis-based global semaphore**

- ใช้ Redis (e.g. INCR/DECR + key `llm:global:slots`, TTL เป็น safety).
- `acquireLLMSlot(orgId)`: Lua script หรือ INCR `llm:global:slots` ถ้า ≤ global_limit แล้ว INCR `llm:org:{orgId}:slots` ถ้า ≤ per_org_limit; ไม่ใช่则 push ลง Redis list `llm:queue` (หรือ Redis Stream) แล้วบล็อกรอ (BLPOP) หรือ poll.
- Release: DECR global และ org key แล้ว publish message เพื่อปลุก waiter (หรือให้ worker ที่รอ BLPOP ทำงานต่อ).
- **Global limit:** กำหนดที่เดียว (e.g. 15–20) เพื่อไม่ให้เกิน OpenAI limit.

**ตัวเลือก B: Distributed queue (BullMQ)**

- สร้าง queue ชื่อ `chat-llm` (Redis).
- API layer: ไม่เรียก Role Manager โดยตรง — ส่ง job เข้า queue (payload: org_id, message, correlationId, userId ฯลฯ). Return 202 หรือ reply ผ่าน webhook/polling.
- Worker(s): ดึง job จาก queue (concurrency 1 ต่อ worker หรือต่อ queue), เรียก orchestrator/Role Manager, ส่งผลกลับ (webhook / write to Firestore / push).
- **Org-level quota:** ใช้ BullMQ job options หรือ separate queue ต่อ org; หรือใช้ Redis counter ต่อ org ก่อน enqueue (ถ้าเกิน quota ให้ reject หรือ delay).

**Pseudo Architecture (Text-Based) — หลังแก้**

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    Load Balancer                         │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
              ▼                                 ▼                                 ▼
     ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
     │   Instance A     │             │   Instance B     │             │   Instance C     │
     │  (API + Worker)  │             │  (API + Worker)  │             │  (API + Worker)  │
     └────────┬────────┘             └────────┬────────┘             └────────┬────────┘
              │                               │                               │
              │     Rate Limit (Firestore)     │     Org 30/min, IP 5/10s      │
              │                               │                               │
              └───────────────────────────────┼───────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  Redis: Global Semaphore (e.g. 15) + Per-Org (e.g. 5)    │
                    │  OR BullMQ Queue "chat-llm" (workers consume)             │
                    └───────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │  OpenAI API (single global throttle from Redis/BullMQ)   │
                    └─────────────────────────────────────────────────────────┘
```

**สถานะ Section 1:** **ไม่ผ่าน** — ต้องเปลี่ยนจาก in-memory semaphore/queue เป็น Redis semaphore หรือ distributed queue และกำหนด global + per-org quota.

---

## SECTION 2 — CONVERSATION STATE PERSISTENCY

### 2.1 Implementation ปัจจุบัน

**ที่มา:** `src/lib/agents/session-storage.ts`

- **Storage:** `const sessionStore = new Map<string, ConversationState>();` — key เป็น `userId` (จาก pipeline/orchestrator — ใน LINE path คือ LINE userId).
- **TTL:** 30 นาที — ตรวจใน `getSessionState`: ถ้า `now - state.lastUpdated > SESSION_TTL` จะ delete และ return null.
- **ไม่มี Redis / DB persist.** ไม่มี `sessionStore` อื่นใน codebase ที่ persist state ไปที่อื่น.

**ที่ใช้ session state:** `src/lib/agents/pipeline.ts` — ใช้ `getSessionState(userId)`, `saveSessionState(userId, state)`, `clearSession(userId)` เมื่อมี `userId` (LINE webhook ส่ง userId จาก event.source.userId). Path 7-Agent (chatOrchestrate) **ไม่ใช้** session-storage นี้ — ใช้ customer_memory (Firestore) สำหรับ long-term เท่านั้น ไม่มี short-term conversation state ใน 7-Agent flow.

ดังนั้น **conversation state (Map) ใช้เฉพาะ Pipeline flow** (เมื่อ `CHAT_USE_PIPELINE=true` และไม่ใช้ 7-Agent).

### 2.2 Process restart

- **จะเกิดอะไร:** ทุก key ใน `sessionStore` หายทันที (process memory ถูกล้าง). ลูกค้าที่กำลังคุยใน Pipeline flow จะได้ state = null ครั้งถัดไป → ระบบจะถือว่าเป็น conversation ใหม่ (createInitialState).
- **ผล:** บริบทสนทนา (service, area, stage, preference, recentMessages) หาย — ถือว่า **state lost.**

### 2.3 Horizontal 4 Instance — State consistency

- แต่ละ instance มี `Map` ของตัวเอง. Request ครั้งที่ 1 ไป instance A → state เก็บที่ A. Request ครั้งที่ 2 ไป instance B (load balancer) → B ไม่มี state → ได้ state = null → **inconsistent.** ลูกค้าจะเหมือนเริ่มใหม่หรือได้พฤติกรรมแปลก (ถามซ้ำ, context หาย).
- **สรุป:** **ไม่ consistent** ข้าม instance — state ไม่ share.

### 2.4 LINE webhook retry — State mismatch หรือไม่?

- LINE ส่ง webhook; ถ้าเราตอบไม่ทันหรือ error LINE จะ retry (มักเป็น request ใหม่ที่อาจไปคนละ instance). ครั้งแรกอาจไป instance A → สร้าง/อัปเดต state ที่ A. Retry ไป instance B → B ไม่มี state → **mismatch** (state ว่างหรือไม่ตรงกับที่ A มี).
- นอกจากนี้ ถ้า retry มาพร้อมกับข้อความเดิม การประมวลผลซ้ำอาจทำให้ตอบซ้ำหรืออัปเดต state ซ้ำ (ถ้าไปที่ instance เดิม). ปัญหาหลักคือ **cross-instance state ไม่มี** จึงมีโอกาส mismatch สูงเมื่อ retry ไปอีก instance.

### 2.5 Risk Level และการยอมรับได้สำหรับ 500+ clinics

- **Risk Level:** **High** สำหรับการ scale horizontal (หลาย instance) ถ้าใช้ Pipeline flow; **Medium** ถ้าใช้แค่ 7-Agent (ไม่มี short-term state ใน memory แต่ long-term อยู่ Firestore).
- **500+ clinics production:** **ไม่ acceptable** ถ้าใช้ Pipeline + หลาย instance. State จะหายและไม่สอดคล้องข้าม instance.

### 2.6 Solution (Implementation แนวทาง)

- **Redis session store:** เก็บ `ConversationState` (serialize เป็น JSON) ใน Redis. Key design: `session:{org_id}:{channel}:{user_id}` (หรือ `session:{org_id}:{user_id}` ถ้า channel ไม่แยก). TTL 30 นาที (เหมือนปัจจุบัน) — ใช้ Redis EXPIRE.
- **TTL strategy:** 30 นาที ต่อ key; ไม่ต้อง cleanup job แยกถ้าใช้ TTL. ถ้าต้องการ extend on access: GET แล้ว SET ใหม่พร้อม EXPIRE.
- **Key design:** `org_id` + `user_id` (และถ้ามี `channel` เช่น line/web) เพื่อแยก state ต่อ org และต่อ user. ตัวอย่าง key: `conv:${org_id}:line:${userId}`.

**Pseudo Architecture (State)**

```
  Instance A/B/C  →  getSessionState(orgId, userId)
                         │
                         ▼
                    Redis GET conv:{org_id}:{channel}:{user_id}
                         │
                    hit → return state
                    miss → return null (new conversation)
                         │
  saveSessionState → Redis SET conv:... + EXPIRE 1800
```

**สถานะ Section 2:** **ไม่ผ่าน** — สำหรับ Pipeline flow ต้องย้าย session state ไป Redis (หรือ DB ที่ share ได้) และใช้ key ร่วมกันทุก instance.

---

## SECTION 3 — COST GOVERNANCE LOGIC GAP

### 3.1 Implementation ปัจจุบัน

**ที่มา:**  
- `src/lib/ai/cost-governance.ts`: `getEffectiveModel(orgId)` — อ่าน `checkBudgetHardStop` และ `getOrgAIBudget`; ถ้า `shouldUseFallbackModel` และมี `fallback_model` และ currentBaht >= threshold แล้ว return `budget.fallback_model` ไม่ใช่ return `"gpt-4o-mini"`.  
- `src/lib/ai/role-manager.ts`: บรรทัด 215–217 ใช้ `getModelConfig(input.org_id ?? undefined)` เท่านั้น — ไม่มีการเรียก `getEffectiveModel`.

**ที่มา getModelConfig:** `src/lib/ai/model-versioning.ts` — อ่าน Firestore `ai_model_config` (org-level หรือ default) คืน `model_name`, `max_tokens`, `temperature`. **ไม่อ่าน org_ai_budgets หรือ cost.** ดังนั้น Role Manager ไม่รู้ว่า org ใกล้หรือเกิน budget.

### 3.2 Model downgrade ตาม budget ทำงานจริงหรือไม่?

**ไม่ทำงาน.** ใน code path ของ Role Manager มีเพียง `getModelConfig(...).model_name` — ไม่มีที่ไหนเรียก `getEffectiveModel`. ดังนั้นการตั้ง `model_downgrade_enabled: true` และ `fallback_model` ใน org_ai_budgets **ไม่มีผล** กับโมเดลที่ Role Manager ใช้.

### 3.3 Cost threshold enforcement มีผลกับ Role Manager หรือไม่?

- **Hard stop (เกิน budget):** มีผล. ใน `orchestrator.ts` บรรทัด 89–97 เรียก `checkBudgetHardStop(input.org_id)`; ถ้า `!budgetCheck.allowed` จะ return ทันทีโดยไม่เข้า `acquireLLMSlot` หรือ `runRoleManager`. ดังนั้นเมื่อเกิน daily limit แล้ว **จะไม่เรียก Role Manager.**
- **Soft threshold (downgrade model):** ไม่มีผล. `checkBudgetHardStop` คืน `shouldUseFallbackModel` แต่ค่านี้ไม่ถูกส่งไปที่ Role Manager และ Role Manager ไม่เรียก `getEffectiveModel`. ดังนั้น **cost threshold สำหรับการ downgrade ไม่มีผลกับ Role Manager.**

### 3.4 ถ้า org เกิน budget — เกิดอะไรจริงใน code path?

1. Request เข้า `chatOrchestrate`.
2. เรียก `checkBudgetHardStop(org_id)`.
3. อ่าน `getDailyLLMCost(org_id)` และเปรียบกับ `daily_budget_baht`; ถ้าเกินและ hard_stop_enabled → return `{ allowed: false, reason: "BUDGET_EXCEEDED" }`.
4. Orchestrator return ทันที: `reply: "โควต้าตอนนี้เต็มแล้วค่ะ ..."`, `success: false`, **ไม่เรียก acquireLLMSlot ไม่เรียก runRoleManager.**
5. ดังนั้น **เมื่อเกิน budget แล้วจะไม่มีการเรียก LLM จริง** — นโยบาย hard stop ทำงาน.

### 3.5 Risk Level และ Policy leak

- **Risk Level:** **Medium.** Hard stop ทำงาน แต่ policy “downgrade เมื่อใกล้ budget” ไม่ทำงาน — ถ้าคาดหวังว่า org ที่ใกล้ limit จะถูกสลับไปใช้โมเดลถูกกว่า จะไม่เกิดขึ้น.
- **Policy leak:** ใช่ — มีการออกแบบและ implement `getEffectiveModel` และ `shouldUseFallbackModel` ใน cost-governance แต่ **ไม่ได้เชื่อมกับ Role Manager** จึงเป็น policy ที่ประกาศแต่ไม่ใช้ใน code path จริง.

### 3.6 Refactor (Implementation แนวทาง)

- **Layer ที่แก้:** **Role Manager** (และถ้ามีที่อื่นที่เรียก LLM ตาม org budget ควรใช้ logic เดียวกัน).
- **วิธี inject effectiveModel:**
  - ใน `role-manager.ts` ก่อนเรียก `getModelConfig`: เรียก `getEffectiveModel(input.org_id)` ได้ model name ที่ควรใช้ตาม budget.
  - สร้าง config สำหรับ LLM: ใช้ `model_name` จาก `getEffectiveModel(org_id)` แทน `modelConfig.model_name` (หรือใช้ getModelConfig สำหรับ max_tokens/temperature แล้ว override เฉพาะ model_name โดย effectiveModel).
  - ตัวอย่าง (pseudo):  
    `const effectiveModel = await getEffectiveModel(input.org_id ?? "");`  
    `const modelConfig = await getModelConfig(input.org_id ?? undefined);`  
    `const modelToUse = effectiveModel || modelConfig.model_name;`  
    แล้วส่ง `modelToUse` เข้า `openai.chat.completions.create({ model: modelToUse, ... })`.
- **ทางเลือก:** ให้ orchestrator เรียก `getEffectiveModel(org_id)` แล้วส่ง `modelOverride` เข้า `runRoleManager`; Role Manager ใช้ `modelOverride ?? modelConfig.model_name`. แก้ทั้ง orchestrator และ role-manager.

**สถานะ Section 3:** **ไม่ผ่าน** — ต้องเชื่อม getEffectiveModel กับ Role Manager (และ path อื่นที่ใช้ model ตาม org) เพื่อให้ model downgrade ตาม budget ทำงานจริง.

---

## SECTION 4 — LLM RETRY & RESILIENCY

### 4.1 Implementation ปัจจุบัน

**ที่มา:** `src/lib/ai/role-manager.ts` — try/catch รอบ `openai.chat.completions.create`; มี timeout 8000 ms ผ่าน AbortController. ใน catch: `recordProviderFailure("openai")`, log, return object `{ reply: "ตอนนี้ข้อความเข้ามาเยอะ ...", success: false, error: ... }`. **ไม่มี retry, ไม่มี exponential backoff, ไม่มี jitter.**

Orchestrator รับผลจาก runRoleManager แล้ว return ต่อ; ไม่มี retry loop ที่ orchestrator เช่นกัน.

### 4.2 ถ้า OpenAI transient error 2 วินาที — เสีย conversion เท่าไร?

- **1 request = 1 conversion.** ถ้าเกิด transient error (เช่น 503, 429, timeout ชั่วคราว) ครั้งแรกและครั้งเดียวของ request นั้น → Role Manager return failure → ลูกค้าได้ข้อความ fallback และ **ไม่มีคำตอบจาก LLM.** ไม่มีการลองใหม่.
- **สรุป:** transient 1 ครั้ง = **เสีย 1 conversion** (request นั้นไม่ได้รับ reply จาก model).

### 4.3 ไม่มี retry — acceptable หรือไม่?

- **Production ที่เน้น reliability:** **ไม่ acceptable.** Transient error พบได้บ่อย (network, provider 503/429) การไม่ retry ทำให้ conversion ลดและ UX แย่โดยไม่จำเป็น.
- **Acceptable ได้เฉพาะ** ถ้ายอมรับว่า “บาง request จะเสีย” และไม่ต้องการความซับซ้อนของ retry.

### 4.4 Risk Level

**Risk Level:** **Medium** — ไม่มี retry เพิ่มโอกาสเสีย conversion และเพิ่มโอกาสเห็น fallback message เมื่อเกิด transient error.

### 4.5 Implementation แนวทาง

- **จำนวน retry:** 2–3 ครั้ง (รวมครั้งแรก = 3–4 ครั้งเรียก API). มากกว่านี้เสี่ยงยืด latency และสะสม 429.
- **Backoff strategy:** Exponential backoff ระหว่างครั้ง: ตัวอย่าง 1s, 2s, 4s (หรือ 1s, 2s ถ้า retry 2 ครั้ง). เพิ่ม jitter (random 0–500 ms) เพื่อลด thundering herd.
- **Retry เฉพาะ error type ไหน:**  
  - Retry: 429 (rate limit), 503/502/500 (server error), timeout (AbortError / message มี "timeout"), connection errors.  
  - ไม่ retry: 400, 401, 403 (auth/invalid request).
- **Timeout policy:** ครั้งแรกใช้ 8000 ms ได้; ครั้ง retry อาจใช้เท่ากันหรือเพิ่มเป็น 10000 ms ต่อครั้ง. รวมแล้วไม่เกิน ~30s ต่อ request (รวม backoff) เพื่อไม่ให้ client รอนานเกินไป.

**สถานะ Section 4:** **ไม่ผ่าน** — ควรเพิ่ม retry (2–3 ครั้ง) + exponential backoff + jitter และ retry เฉพาะ error type ที่เหมาะสม.

---

## SECTION 5 — FINAL VERDICT

### 5.1 Production Readiness Score (0–100)

| มิติ | คะแนน (0–100) | เหตุผลจาก implementation |
|------|----------------|---------------------------|
| **Distributed scalability** | 20 | Concurrency และ queue อยู่แค่ใน process; 3 instance = 30 concurrent ไม่มี global coordination; ไม่รองรับ 500+ clinics แบบรวมศูนย์. |
| **State consistency** | 25 | Pipeline state เก็บใน Map ต่อ process; restart = state หาย; หลาย instance = state ไม่ share; 7-Agent ไม่ใช้ short-term state ใน memory แต่ Pipeline ใช้. |
| **Cost governance integrity** | 60 | Hard stop ทำงาน (เกิน budget ไม่เรียก LLM); แต่ model downgrade ตาม budget ไม่ทำงาน (Role Manager ใช้แค่ getModelConfig). |
| **LLM resiliency** | 40 | มี fallback message และ timeout; ไม่มี retry/backoff/jitter; transient error = เสีย conversion. |
| **Enterprise readiness** | 35 | Rate limit ใช้ Firestore (distributed ได้); แต่ queue/state/cost-downgrade/retry ยังไม่ครบสำหรับ multi-instance และความน่าเชื่อถือระดับ enterprise. |

**คะแนนรวม (เฉลี่ยถ่วงน้ำหนักเท่ากัน):** (20 + 25 + 60 + 40 + 35) / 5 = **36/100.**

### 5.2 รองรับ 500+ clinics พร้อมกันได้หรือไม่?

**คำตอบ: NO (ต้องแก้ก่อน)**

**เหตุผลเชิง implementation:**

1. **Concurrency:** ไม่มี global limit; หลาย instance จะส่งรวมกันไปที่ OpenAI เกินที่ออกแบบ (เช่น 30 ถ้า 3 instance). โอกาส 429 และ queue สะสมสูง; ไม่มี coordination สำหรับ 500+ org ที่อาจมีหลายร้อย concurrent chat ใน peak.
2. **State:** ถ้าใช้ Pipeline flow กับหลาย instance state จะไม่ consistent และหายเมื่อ restart; ไม่ acceptable สำหรับ production ขนาดใหญ่.
3. **Cost governance:** Hard stop ใช้ได้ แต่ downgrade ยังไม่ทำงาน — นโยบายต้นทุนไม่ครบ.
4. **Resiliency:** ไม่มี retry — transient error จะทำให้ conversion เสียโดยไม่จำเป็น.

ดังนั้น **ต้องแก้อย่างน้อย:** (1) global concurrency / distributed queue, (2) session state แบบ distributed (Redis), (3) เชื่อม getEffectiveModel กับ Role Manager, (4) retry + backoff สำหรับ LLM call — ก่อนจะถือว่ารองรับ 500+ clinics production ได้.

---

## สรุปตารางการตรวจสอบ

| Section | ผ่าน/ไม่ผ่าน | Risk Level |
|---------|--------------|------------|
| 1. In-memory concurrency (3 instance → global 30, no coordination) | ไม่ผ่าน | High / Critical |
| 2. Conversation state (Map, no Redis, restart/4-instance inconsistent) | ไม่ผ่าน | High |
| 3. Cost governance (downgrade not applied in Role Manager) | ไม่ผ่าน | Medium |
| 4. LLM retry (no retry, no backoff) | ไม่ผ่าน | Medium |
| 5. Production readiness 500+ clinics | ไม่ผ่าน (คะแนน 36/100, NO) | — |

---

*รายงานนี้อิงจาก codebase ปัจจุบันเท่านั้น*
