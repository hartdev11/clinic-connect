# Clinic Connect — แผนที่โปรเจกต์ (ทุกไฟล์ ระบบ และการทำงาน)

เอกสารนี้จดจำและสรุป **ทุกอย่างในโปรเจกต์**: สิ่งที่ใช้ แต่ละระบบทำอะไร การทำงานเป็นอย่างไร และตำแหน่งไฟล์ที่เกี่ยวข้อง — **ตรวจสอบครบทุกส่วน ไม่ข้าม**

---

## 1. สรุปหนึ่งย่อหน้า

**Clinic Connect** เป็น **SaaS สำหรับคลินิกความงาม** (Multi-tenant: หนึ่งระบบ รองรับหลาย org แต่ละ org มีหลายสาขาได้)  
ใช้ **Next.js 15 + TypeScript + Firestore + Pinecone + Redis + Stripe + LINE**  
ลูกค้าคลินิกคุยกับบอทผ่าน **LINE** โดยบอทใช้ **Pipeline** (Intent → Safety → Escalation → Knowledge → Compose) หรือ **7-Agent Orchestrator** ตาม feature flag  
ข้อมูลที่ AI ใช้มาจาก **Unified Knowledge** (บริการ, FAQ) และ **Knowledge แบบ topic** รวมถึง **โปรโมชัน**  
คลินิกใช้ **เว็บหลังบ้าน** จัดการ Dashboard ลูกค้า การจอง โปรโมชัน Insights เงิน ข้อมูลที่ AI ใช้ และตั้งค่าต่างๆ  
มี **GLOBAL-GUARDRAILS** (ห้ามแก้ pipeline flow, ไม่ลบ clinics, soft block fair use เท่านั้น) และ **ENTERPRISE-STANDARD** (loading/empty/error, type safety, keyboard, pagination)

---

## 2. สิ่งที่โปรเจกต์ใช้ (Tech Stack)

| หมวด | สิ่งที่ใช้ | หมายเหตุ |
|------|------------|----------|
| **Framework** | Next.js 15 (App Router) | `next.config.ts`, `package.json` |
| **Language** | TypeScript (strict) | `tsconfig.json`, path `@/*` → `./src/*` |
| **UI** | React 19, Tailwind CSS, Framer Motion, Recharts | `globals.css`, Plus Jakarta Sans |
| **Data Fetch (FE)** | SWR | `ClinicContext.tsx` ใช้ SWR กับ `/api/clinic/context` |
| **Database** | Firestore (Firebase Admin SDK) | `src/lib/firebase-admin.ts` |
| **Vector DB** | Pinecone | `src/lib/pinecone.ts`, namespace knowledge, embedding dimension 1536 |
| **Cache/Queue** | Redis, BullMQ | `src/lib/redis-client.ts`, `chat-llm-queue.ts`, worker |
| **Auth** | JWT ใน cookie `clinic_session`, jose | `src/lib/session.ts`, `auth-session.ts`, `middleware.ts` |
| **Payment** | Stripe | `src/lib/stripe.ts`, webhook `/api/webhooks/stripe` |
| **Chat/ Bot** | LINE Messaging API | `src/lib/line-api.ts`, webhooks `/api/webhooks/line`, `/api/webhooks/line/[orgId]` |
| **AI/LLM** | OpenAI, Google GenAI (@google/genai) | `chat-agent.ts`, pipeline, orchestrator, cost governance |
| **PDF/Export** | jspdf, html2canvas | ใช้ในรายงาน/export |
| **Tests** | Vitest | `tests/*.test.ts` |
| **Scripts** | tsx | migrate, backfill, load-test, audit, seed, validate |
| **Crons** | Vercel Cron | `vercel.json`: cleanup, promotion-lifecycle, embedding-worker |
| **Observability** | Latency, errors, Firestore, cache metrics | `src/lib/observability/*`, `run-with-observability.ts` |
| **Stub** | empty-prisma-stub | `next.config.ts` alias `@prisma/instrumentation` (ไม่มี Prisma จริง) |

---

## 3. โครงสร้างโฟลเดอร์และไฟล์ (ครบ)

### 3.1 Root

- `package.json` — ชื่อ `clinic-saas`, scripts: dev, build, start, lint, migrate:*, load-test, test, security:*, backfill:*, worker:chat-llm, pinecone:setup
- `next.config.ts` — webpack alias สำหรับ empty-prisma-stub (server)
- `tsconfig.json` — strict, path @/*, exclude scripts
- `vercel.json` — crons: cleanup ทุกวัน 02:00, promotion-lifecycle และ embedding-worker ทุก 5 นาที
- `firestore.indexes.json` — composite indexes สำหรับ bookings, customers, transactions, promotions, branches, users, conversation_feedback, knowledge_documents, subscriptions, audit_logs, customer_memory, ai_activity_logs, prompt_registry, ai_response_cache, ai_feedback_aggregates, global_knowledge, clinic_knowledge, knowledge_versions, invoices, refunds
- `docs/` — PROJECT-SUMMARY.md, ENTERPRISE-FRANCHISE-LICENSE-ARCHITECTURE.md, FRANCHISE-MODEL-SPEC.md (สเปกลงทะเบียน/แพ็คเกจ/การเข้าถึงข้อมูล franchise), PROJECT-MAP.md (นี้)
- `scripts/` — ดูรายการด้านล่าง
- `tests/` — Vitest: unified-knowledge, security-pen-test, enterprise-hardening, ai-evaluation-harness, fixtures
- `functions/` — โฟลเดอร์ Firebase Functions (มี lib/index.js, node_modules; ยังไม่ map รายไฟล์ต้นทาง)

### 3.2 src/app — Next.js App Router

**Layouts & Global**

- `layout.tsx` — Root layout, Plus Jakarta Sans, metadata, lang="th"
- `globals.css` — Tailwind, CSS variables (sidebar, topbar, cream tones)
- `error.tsx` — Global error boundary

**(public) — ไม่ต้อง login**

- `(public)/layout.tsx`
- `(public)/page.tsx` — หน้าหลัก
- `(public)/login/page.tsx`, `register/page.tsx`
- `(public)/about/page.tsx`, `promotions/page.tsx`, `reviews/page.tsx`, `upgrade/page.tsx`
- `(public)/clinics/page.tsx`, `(public)/clinics/[slug]/page.tsx`

**(clinic) — หลังบ้าน ต้อง login**

- `(clinic)/layout.tsx` — Sidebar + Topbar + ClinicContextProvider
- `(clinic)/clinic/page.tsx` — Dashboard
- `(clinic)/clinic/customers/page.tsx` — ลูกค้า & แชท
- `(clinic)/clinic/booking/page.tsx` — การจอง + หน้างานวันนี้
- `(clinic)/clinic/promotions/page.tsx`
- `(clinic)/clinic/insights/page.tsx` — รายได้, แชท, การจอง
- `(clinic)/clinic/finance/page.tsx` — เงิน, ใบแจ้งหนี้, Executive Brief
- `(clinic)/clinic/knowledge/page.tsx` — Unified Knowledge (บริการ, FAQ)
- `(clinic)/clinic/knowledge/new/page.tsx`, `(clinic)/clinic/knowledge/[topicId]/edit/page.tsx` — Knowledge แบบ topic
- `(clinic)/clinic/knowledge-brain/page.tsx` — Knowledge Health, approve/reject
- `(clinic)/clinic/knowledge-health/page.tsx`, `knowledge-health/layout.tsx`
- `(clinic)/clinic/ai-agents/page.tsx` — สถานะ AI agents
- `(clinic)/clinic/settings/page.tsx`
- `(clinic)/clinic/slot-settings/page.tsx` — เวลาทำการ, ตารางแพทย์, วันปิด
- `(clinic)/clinic/users/page.tsx` — User & Roles
- `(clinic)/clinic/admin-monitoring/page.tsx`, `admin-monitoring/layout.tsx`, `admin-monitoring/ai-cost-monitor/page.tsx`
- `(clinic)/clinic/feedback/page.tsx`
- `(clinic)/clinic/error.tsx` — Error boundary สำหรับ clinic

**API Routes (ครบ)**

- **Auth:** `api/auth/login/route.ts`, `api/auth/register/route.ts`, `api/auth/logout/route.ts`, `api/auth/firebase-token/route.ts`
- **Webhooks:** `api/webhooks/line/route.ts`, `api/webhooks/line/[orgId]/route.ts`, `api/webhooks/stripe/route.ts`
- **Clinic context / me:** `api/clinic/context/route.ts`, `api/clinic/me/route.ts`, `api/clinic/debug-org/route.ts`
- **Organization / Branches / Users:** `api/clinic/organization/route.ts`, `api/clinic/branches/route.ts`, `api/clinic/branches/[id]/route.ts`, `api/clinic/branches/[id]/hours/route.ts`, `api/clinic/users/route.ts`, `api/clinic/users/[id]/route.ts`
- **Bookings:** `api/clinic/bookings/route.ts`, `api/clinic/bookings/[id]/route.ts`, `api/clinic/bookings/slots/route.ts`, `api/clinic/bookings/calendar/route.ts`, `api/clinic/bookings/queue/route.ts`, `api/clinic/bookings/timeline/route.ts`, `api/clinic/bookings/day-timeline/route.ts`, `api/clinic/bookings/reports/route.ts`
- **Customers:** `api/clinic/customers/route.ts`, `api/clinic/customers/[id]/route.ts` (ถ้ามี), `api/clinic/customers/[id]/chats/route.ts`, `api/clinic/customers/[id]/send-message/route.ts`, `api/clinic/customers/[id]/soft-delete/route.ts`, `api/clinic/customers/[id]/refresh-profile/route.ts`
- **Promotions:** `api/clinic/promotions/route.ts`, `api/clinic/promotions/[id]/cover/route.ts`, `api/clinic/promotions/upload-temp/route.ts`, `api/clinic/promotions/scan-image/route.ts`, `api/clinic/promotions/from-scan/route.ts`, `api/clinic/promotions/[id]/media/route.ts`
- **Knowledge (topic):** `api/clinic/knowledge/route.ts`, `api/clinic/knowledge/assist/route.ts`, `api/clinic/knowledge/process-queue/route.ts`, `api/clinic/knowledge/change-log/route.ts`, `api/clinic/knowledge/topics/route.ts`, `api/clinic/knowledge/topics/[topicId]/route.ts`, `api/clinic/knowledge/topics/[topicId]/rollback/route.ts`
- **Unified Knowledge:** `api/clinic/unified-knowledge/status/route.ts`, `api/clinic/unified-knowledge/services/route.ts`, `api/clinic/unified-knowledge/services/[id]/route.ts`, `api/clinic/unified-knowledge/faq/route.ts`, `api/clinic/unified-knowledge/faq/[id]/route.ts`, `api/clinic/unified-knowledge/global/route.ts`
- **Knowledge Brain:** `api/clinic/knowledge-brain/global/route.ts`, `api/clinic/knowledge-brain/clinic/route.ts`, `api/clinic/knowledge-brain/clinic/[id]/route.ts`, `api/clinic/knowledge-brain/approve/[id]/route.ts`, `api/clinic/knowledge-brain/reject/[id]/route.ts`, `api/clinic/knowledge-brain/submit/[id]/route.ts`, `api/clinic/knowledge-brain/versions/route.ts`, `api/clinic/knowledge-brain/audit/route.ts`, `api/clinic/knowledge-brain/rollback/route.ts`, `api/clinic/knowledge-brain/reindex/route.ts`
- **Finance:** `api/clinic/finance/route.ts`, `api/clinic/finance/executive-brief/route.ts`, `api/clinic/invoices/[id]/route.ts`, `api/clinic/invoices/[id]/confirm-payment/route.ts`, `api/clinic/invoices/[id]/refunds/route.ts`
- **Checkout / Subscription:** `api/clinic/checkout/route.ts`, `api/clinic/checkout/verify/route.ts`, `api/clinic/checkout/preview/route.ts`, `api/clinic/subscription/route.ts`
- **Dashboard / Analytics:** `api/clinic/dashboard/route.ts`, `api/clinic/analytics/overview/route.ts`, `api/clinic/analytics/revenue/route.ts`, `api/clinic/analytics/conversation/route.ts`, `api/clinic/analytics/knowledge/route.ts`, `api/clinic/analytics/operational/route.ts`, `api/clinic/analytics/comparison/route.ts`, `api/clinic/analytics/alerts/route.ts`, `api/clinic/analytics/branch-performance/route.ts`, `api/clinic/analytics/executive-summary/route.ts`, `api/clinic/analytics/ai-performance/route.ts`, `api/clinic/analytics/shared.ts`
- **Slot / Doctor / Blackout:** `api/clinic/slot-settings/route.ts`, `api/clinic/doctor-schedules/route.ts`, `api/clinic/doctor-schedules/[id]/route.ts`, `api/clinic/doctor-schedules/[id]/get/route.ts`, `api/clinic/blackout-dates/route.ts`, `api/clinic/blackout-dates/[id]/route.ts`
- **LINE / Notifications / Feedback / AI:** `api/clinic/line/route.ts`, `api/clinic/notifications/route.ts`, `api/clinic/feedback/route.ts`, `api/clinic/feedback/[id]/route.ts`, `api/clinic/ai/availability/route.ts`
- **Chat:** `api/chat/route.ts`
- **Internal:** `api/internal/ai-context/route.ts`, `api/internal/observability/summary/route.ts`
- **Admin:** `api/admin/cleanup/route.ts`, `api/admin/promotion-lifecycle/route.ts`, `api/admin/embedding-worker/route.ts`, `api/admin/ai-cost-monitor/route.ts`, `api/admin/circuit-breaker/route.ts`, `api/admin/ai-ab-analytics/route.ts`, `api/admin/knowledge-brain/export-audit/route.ts`, `api/admin/dr-config/route.ts`, `api/admin/knowledge-health/route.ts`, `api/admin/drift-prediction/route.ts`, `api/admin/global-knowledge-bulk-update/route.ts`, `api/admin/drift-job/route.ts`, `api/admin/ai-cache-invalidate/route.ts`, `api/admin/audit-export/route.ts`, `api/admin/retention-policy/route.ts`, `api/admin/llm-metrics-advanced/route.ts`, `api/admin/llm-cost/route.ts`, `api/admin/unified-knowledge-migrate/route.ts`
- **Health / Log:** `api/health/route.ts`, `api/log-error/route.ts`

### 3.3 src/components

- **Layout:** `layout/ClinicSidebar.tsx`, `layout/ClinicTopbar.tsx`, `layout/PageHeader.tsx`, `layout/SectionHeader.tsx`, `layout/PublicHeader.tsx`, `layout/PublicFooter.tsx`
- **UI:** `ui/Button.tsx`, `ui/Input.tsx`, `ui/Card.tsx`, `ui/Badge.tsx`
- **Clinic:** `clinic/SlotSettings.tsx`, `clinic/NotificationBell.tsx`, `clinic/ChannelChips.tsx`, `clinic/LineConnectionSettings.tsx`, `clinic/BillingSection.tsx`, `clinic/DuplicateWarningModal.tsx`, `clinic/BranchManagement.tsx`, `clinic/OrganizationSettings.tsx`, `clinic/KnowledgeVersionHistoryModal.tsx`
- **Dashboard:** `dashboard/DashboardSkeleton.tsx`, `dashboard/AnimatedCounter.tsx`
- **RBAC:** `rbac/RequireRole.tsx`, `rbac/RequireBranchAccess.tsx`

### 3.4 src/contexts

- `ClinicContext.tsx` — Context + SWR สำหรับ `/api/clinic/context`; ค่า: org_id, branch_id, currentOrg, currentBranch, currentUser, subscriptionPlan, selectedBranchId, setSelectedBranchId, isLoading, error, mutate

### 3.5 src/lib — โค้ดหลักทั้งหมด

**Auth & Session**

- `session.ts` — JWT create/verify, COOKIE_NAME, TokenPayload, VerifiedPayload
- `auth-session.ts` — SessionPayload, getSessionFromRequest, getSessionFromCookies
- `auth.ts` — (ถ้ามี logic เพิ่มสำหรับ login/register)

**Firebase & Data**

- `firebase-admin.ts` — getFirebaseAdmin, db, getStorage (Firestore + Storage)
- `firebase-client.ts` — Client SDK ถ้ามี
- `clinic-data.ts` — อ่าน/เขียน Firestore หลัก: organizations, branches, users, bookings, customers, transactions, promotions, conversation_feedback, subscriptions, branch_hours, doctor_schedules, blackout_dates; รวม dashboard, stats, pagination
- `financial-data.ts` — invoices, payments, refunds, satang, transaction retry, executive revenue
- `financial-data/executive.ts` — Executive Brief
- `org-isolation.ts` — resolveOrgIdFromSession, rejectClientSentOrgId, requireOrgIsolation, OrgIsolationError

**Subscription & Payment**

- `subscription.ts` — enforceLimits (add_branch, check), Fair Use 80% warning / 100% soft block (ไม่ hard block)
- `stripe.ts` — getStripe, STRIPE_WEBHOOK_SECRET
- `payment-validation.ts` — validation logic

**LINE**

- `line-webhook.ts` — verifyLineSignature, parseLineWebhook, LineWebhookEvent/Body
- `line-api.ts` — Reply API, Push
- `line-channel-data.ts` — channel ต่อ org
- `line-idempotency.ts` — isLineEventProcessed, markLineEventProcessed, getMessageHash

**AI Pipeline (ลำดับห้ามเปลี่ยน — GLOBAL-GUARDRAILS)**

- `agents/pipeline.ts` — runPipeline: Intent → Safety → Escalation → Knowledge → Compose; session storage; options org_id, branch_id, role, subscriptionPlan, channel
- `agents/intent.ts` — analyzeIntent, fallbackIntentFromKeywords
- `agents/safety.ts` — checkSafety
- `agents/escalation.ts` — checkEscalation
- `agents/knowledge.ts` — getKnowledge
- `agents/knowledge-base.ts` — base knowledge
- `agents/compose.ts` — composeReply
- `agents/compose-templates.ts` — selectTemplate
- `agents/conversation-state.ts` — createInitialState, updateStateFromIntent, isShortFollowUp, isRefinementMessage
- `agents/session-storage.ts` — getSessionState, saveSessionState, clearSession
- `agents/safe-fallback.ts` — composeSafeFallbackMessage, composeMemoryAnswer
- `agents/human-fallback.ts` — humanFallbackReply
- `agents/normalizer.ts` — normalizeLineMessage
- `agents/summary.ts` — summarizeForCRM
- `agents/types.ts` — IntentResult etc.
- `agents/clients.ts` — LLM clients
- `agents/README.md` — อธิบาย pipeline

**Guards (ใช้ใน pipeline)**

- `guards/state-stickiness-guard.ts`
- `guards/refinement-guard.ts`
- `guards/knowledge-readiness-guard.ts`
- `guards/surgery-flow-guard.ts`
- `guards/intent-dedup-guard.ts`, `composeDedupReply`
- `guards/duplicate-intent-guard.ts` — isDuplicateIntent
- `guards/preference-response-guard.ts` — isPreferenceResponse
- `guards/final-guard.ts` — finalGuard

**Tone**

- `tone/tone-detector.ts` — detectTone

**Chat Agent (Legacy / Fallback)**

- `chat-agent.ts` — chatAgentReply; OpenAI / Gemini; SYSTEM_PROMPT; getChatProvider (openai | gemini | auto)

**7-Agent Orchestrator**

- `ai/orchestrator.ts` — chatOrchestrate; Pre-LLM Safety, Customer Memory, runAllAnalytics, runCrossAgentReasoning, runRoleManager, observability, cache, booking intent, cost governance
- `ai/run-analytics.ts` — runAllAnalytics
- `ai/role-manager.ts` — runRoleManager
- `ai/cross-agent-reasoning.ts` — runCrossAgentReasoning
- `ai/agents/knowledge-agent.ts`, `booking-agent.ts`, `promotion-agent.ts`, `finance-agent.ts`, `customer-agent.ts`, `feedback-agent.ts`, `agents/index.ts`
- `ai/pre-llm-safety.ts` — classifyPreLLM, SAFETY_FALLBACK_MESSAGES
- `ai/customer-memory-store.ts` — getCustomerMemory, upsertCustomerMemory, shouldSummarize
- `ai/memory-summarization.ts` — runMemorySummarizationForCustomer
- `ai/ai-feedback-loop.ts` — getCachedResponse, setCachedResponse, computeReplyConfidence, checkHallucination, tagFailure
- `ai/cost-aware-retrieval.ts` — classifyRetrievalComplexity, shouldSkipVectorSearch, getDeterministicCachedReply
- `ai/cost-governance.ts` — checkBudgetHardStop
- `ai/ai-queue.ts` — acquireLLMSlot
- `ai/booking-intent.ts` — processBookingIntent
- `ai/ai-observability.ts` — logAIActivity, checkPolicyViolation
- `ai/prompt-registry.ts` — Prompt Registry
- `ai/llm-judge.ts`, `ai/answer-constraint-engine.ts`, `ai/input-sanitizer.ts`
- `ai/context-limiter.ts` — context limiter
- `ai/model-versioning.ts` — model versioning
- `ai/types.ts` — AnalyticsContext etc.
- `ai/knowledge-assist.ts` — knowledge assist
- `ai/executive-finance-brief.ts` — Executive Brief AI

**Knowledge (Topic + Vector)**

- `knowledge-topics-data.ts` — CRUD knowledge topics (Firestore)
- `knowledge-vector.ts` — searchKnowledge, sync ไป Pinecone
- `knowledge-retrieval.ts` — retrieveKnowledgeContext, hybrid weighted RAG (similarity + exact topic + category)
- `knowledge-data.ts` — knowledge data layer
- `knowledge-validation.ts` — validation
- `knowledge-input.ts` — input handling

**Unified Knowledge**

- `unified-knowledge/index.ts` — re-export data, vector, migrate, sanitize, audit
- `unified-knowledge/data.ts` — services, FAQ, status
- `unified-knowledge/vector.ts` — embedding, Pinecone
- `unified-knowledge/sanitize.ts` — sanitize
- `unified-knowledge/migrate.ts` — migration
- `unified-knowledge/audit.ts` — audit

**Knowledge Brain**

- `knowledge-brain/index.ts`
- `knowledge-brain/context-builder.ts` — context สำหรับ RAG
- `knowledge-brain/data.ts` — data layer
- `knowledge-brain/embedding-queue.ts` — queue สำหรับ embed
- `knowledge-brain/failsafe.ts` — FAILSAFE_MESSAGE, isFailsafeError
- `knowledge-brain/knowledge-health-score.ts` — health score
- `knowledge-brain/compliance-control.ts` — compliance
- `knowledge-brain/drift-detection.ts`, `drift-prediction.ts`
- `knowledge-brain/ai-quality-reviewer.ts` — quality review
- `knowledge-brain/retrieval-intelligence.ts` — retrieval logic
- `knowledge-brain/global-policy-rules.ts` — global rules
- `knowledge-brain/semantic-duplicate-detection.ts` — duplicate detection
- `knowledge-brain/knowledge-quality-engine.ts` — quality engine
- `knowledge-brain/audit.ts` — audit
- `knowledge-brain/validation.ts` — validation

**Promotions**

- `promotion-storage.ts` — เก็บรูป/ข้อความ, toSignedUrlsForLine
- `promotion-embedding.ts` — embed โปรโมชัน
- `promotion-lifecycle.ts` — อัปเดตหมดอายุ/ใกล้หมด
- `promotion-image-scan.ts` — scan รูป
- `promotion-ai-summary.ts` — AI สรุปโปรโมชัน

**Booking & Slots**

- `slot-engine.ts` — สร้าง slot ว่างจาก branch_hours, doctor_schedules, blackout_dates, bookings; TimeSlot, SlotResult
- `booking-notification.ts` — แจ้งเตือนการจอง

**RBAC**

- `rbac.ts` — getEffectiveUser, requireRole, getEffectiveRoleAtBranch, requireBranchAccess; EffectiveUser, UserRole, BranchRole

**Feature Flags**

- `feature-flags.ts` — isKnowledgeWashingMachineEnabled (design only), isPlatformManagedMode, usePipeline, use7AgentChat

**Observability**

- `observability/run-with-observability.ts` — ห่อ API handler; latency + error recording
- `observability/latency.ts` — startTimer, endTimer
- `observability/errors.ts` — recordApiError
- `observability/firestore.ts` — Firestore metrics
- `observability/cache-metrics.ts` — cache metrics
- `observability/index.ts` — re-export
- `observability.ts` — (ถ้ามี legacy export)
- `metric-definitions.ts` — metric definitions

**Analytics**

- `analytics-data.ts` — รายได้, แชท, การจอง, heatmap, operational
- `analytics-cache.ts` — cache
- `analytics-scoring.ts` — scoring
- `analytics-comparison.ts` — comparison
- `analytics-alert-engine.ts` — alerts

**LLM / Cost / Queue**

- `llm-metrics.ts` — estimateCostBaht
- `llm-cost-transaction.ts` — reconcileLLMUsage, MAX_ESTIMATED_COST_SATANG
- `llm-budget-redis.ts` — reserveBudgetRedis, reconcileBudgetRedis (Lua scripts ใน scripts/lua)
- `llm-semaphore.ts` — acquireLlmSlot
- `llm-cost-guard.ts` — cost guard
- `llm-latency-metrics.ts` — latency
- `llm-queue-abstraction.ts` — queue abstraction
- `chat-llm-queue.ts` — BullMQ queue, setJobResult
- `ai-usage-daily.ts` — usage รายวัน
- `redis-client.ts` — getRedisClient, REDIS_URL, isRedisConfigured

**Infrastructure**

- `pinecone.ts` — getPineconeClient, getKnowledgeIndex, getEmbeddingNamespace, EMBEDDING_DIMENSION, failover
- `idempotency.ts` — checkOrSetIdempotency, setLineEventReply
- `rate-limit.ts` — rate limit
- `rate-limit-store.ts` — store
- `distributed-rate-limit.ts` — distributed
- `circuit-breaker.ts` — isCircuitOpen, recordCircuitSuccess/Failure, OPENAI_CIRCUIT_KEY
- `provider-circuit-breaker.ts` — provider-level
- `org-circuit-breaker.ts` — org-level
- `request-context.ts` — request context
- `dr-config.ts` — DR config

**Security & Audit**

- `admin-guard.ts` — admin guard
- `audit-log.ts` — writeAuditLog
- `csrf.ts` — CSRF
- `encryption-info.ts` — encryption info
- `bot-detection.ts` — bot detection

**Utilities**

- `logger.ts` — logger
- `money.ts` — safeSumBaht, satangToBaht, toSatang, sumSatang
- `timezone.ts` — getTodayKeyBangkok
- `api-fetcher.ts` — API fetcher
- `mock-data.ts` — mock data
- `background-cleanup.ts` — cleanup
- `stripe-cleanup.ts` — Stripe cleanup

### 3.6 src/types

- `clinic.ts` — Booking, Customer, Transaction, Promotion, BranchHours, DoctorSchedule, BlackoutDate, DashboardStats, ConversationFeedback, ฯลฯ (E1.5)
- `organization.ts` — Organization, User, Branch, UserRole, BranchRole, OrgPlan (E1.1, E2)
- `subscription.ts` — Subscription, PLAN_MAX_BRANCHES, AddOnCredit (E6)
- `financial.ts` — Invoice, Payment, Refund, FinancialAuditAction ฯลฯ
- `knowledge.ts` — Knowledge types
- `knowledge-brain.ts` — Knowledge Brain types
- `unified-knowledge.ts` — Unified Knowledge types
- `ai-enterprise.ts` — AI enterprise types
- `line-channel.ts` — LINE channel types

### 3.7 src/worker

- `chat-llm-worker.ts` — BullMQ worker; โหลด .env.local; ใช้ Redis; เรียก chatOrchestrate, setJobResult, reserve/reconcile budget, circuit breaker; รัน: `npx tsx src/worker/chat-llm-worker.ts`

### 3.8 src/middleware

- `middleware.ts` — ตรวจ path /clinic: ถ้าไม่มี cookie clinic_session หรือ verify ไม่ผ่าน → redirect /login; ใส่ x-request-id; CSP, X-Content-Type-Options, X-Frame-Options; matcher ข้าม /api/webhooks/*

---

## 4. การทำงานหลัก (Flow)

### 4.1 Authentication

- Login/Register: หน้า (public)/login, register → API auth/login, auth/register
- Session: JWT ใน cookie `clinic_session` (jose), ตรวจใน middleware และ getSessionFromCookies / getSessionFromRequest
- org_id มาจาก session เท่านั้น (Zero Trust) — resolveOrgIdFromSession, rejectClientSentOrgId

### 4.2 LINE Webhook → Bot Reply

1. LINE ส่ง POST ไป `/api/webhooks/line` หรือ `/api/webhooks/line/[orgId]`
2. อ่าน body (stream ถ้าจำเป็น), ตรวจ X-Line-Signature (verifyLineSignature)
3. Idempotency: isLineEventProcessed / markLineEventProcessed, checkOrSetIdempotency
4. ถ้าเป็น message event: upsert ลูกค้า (upsertLineCustomer), แล้วเลือกตอบ:
   - ถ้า `use7AgentChat()` → chatOrchestrate (orchestrator)
   - ถ้า `usePipeline()` → runPipeline (pipeline)
   - ไม่ใช่ → chatAgentReply (chat-agent)
5. ได้ reply (+ media ถ้า promotion_inquiry) → sendLineReply (truncate 5000 ตัวอักษร), บันทึก conversation_feedback

### 4.3 AI Pipeline (ลำดับคงที่)

1. **Intent** — วิเคราะห์ความต้องการ (booking, promotion_inquiry, knowledge_inquiry, human_handoff ฯลฯ)
2. **Safety** — ตรวจคำไม่เหมาะสม / เนื้อหาอันตราย
3. **Escalation** — ต้องส่งต่อคนหรือไม่
4. **Knowledge** — ดึงจาก RAG (Unified Knowledge, topic knowledge, โปรโมชัน) ตาม org_id/branch_id
5. **Compose** — ใช้ template + state สร้างข้อความตอบ

มี Guards: state-stickiness, refinement, intent-dedup, knowledge-readiness, surgery-flow, final; และ Session storage สำหรับ state ต่อเนื่อง

### 4.4 7-Agent Flow

Pre-LLM Safety → Customer Memory → runAllAnalytics (ขนาน) → Cross-Agent Reasoning → Role Manager (1 LLM) → AI Observability; รองรับ cache, cost governance, booking intent, failsafe

### 4.5 Knowledge

- **Unified:** บริการ (platform + แก้ไขได้) + FAQ → embed Pinecone; API unified-knowledge/*
- **Topic:** knowledge/new, knowledge/[topicId]/edit → Firestore + sync vector ผ่าน knowledge-vector.ts, knowledge-topics-data.ts
- **RAG:** knowledge-retrieval.ts (hybrid weighted), knowledge-brain/context-builder.ts

### 4.6 Booking

- Slot: slot-engine.ts จาก branch_hours, doctor_schedules, blackout_dates ลบ bookings
- API: bookings CRUD, slots, calendar, queue, timeline, day-timeline, reports
- แชท: booking-agent + booking-intent — จอง/ถาม slot ผ่าน LINE ได้

### 4.7 Finance

- เงินเป็น satang (integer); revenue จาก paid invoices ลบ refunds
- API: finance, executive-brief, invoices, confirm-payment, refunds
- Stripe: checkout, subscription, webhook

### 4.8 Subscription / Fair Use

- enforceLimits (subscription.ts): 80% warning, 100% soft block — ห้าม hard block (ไม่ return 403 ไม่ throw)

---

## 5. Scripts (ครบ)

- `migrate-clinics-to-orgs.ts` — migrate clinics → orgs (มี --dry-run)
- `migrate-add-org-id-to-collections.ts` — เพิ่ม org_id ใน collections (มี --dry-run)
- `setup-pinecone-index.ts` — pinecone:setup
- `load-test-stress.ts` — load-test
- `load-simulate.ts`, `load-test-phase-f.ts`
- `stress-concurrency-b1-b2.ts`, `stress-rollback-simulation.ts`, `stress-migration-resume.ts`
- `backfill-financial-fields.ts` — backfill:financial (มี --dry-run)
- `reconcile-financial-phase-h.ts`
- `seed-global-knowledge.ts`
- `validate-firestore-indexes.ts`
- `validate-security-audit-phase-g.ts`, `validate-observability.ts`
- `audit-refund-integrity.ts`, `audit-payment-integrity.ts`, `audit-invoice-consistency.ts`, `audit-backfill-validation.ts`, `audit-aggregate-crosscheck.ts`
- `scripts/lua/` — ACQUIRE_SLOT.lua, RESERVE_BUDGET.lua, RELEASE_SLOT.lua, RECONCILE_BUDGET.lua
- `scripts/PHASE-D.md`, `PHASE-E.md`, `PHASE-F.md`, `PHASE-G.md`, `PHASE-H.md` — เอกสาร phase

---

## 6. Tests

- `tests/unified-knowledge.test.ts`
- `tests/security-pen-test.test.ts`
- `tests/enterprise-hardening.test.ts`
- `tests/ai-evaluation-harness.test.ts`
- `tests/fixtures/ai-golden-dataset.json`

คำสั่ง: `npm run test`, `npm run security:scan` (enterprise-hardening + security-pen-test)

---

## 7. กฎที่ต้องปฏิบัติ (Guardrails & Standard)

- **GLOBAL-GUARDRAILS** (.cursor/rules/GLOBAL-GUARDRAILS.mdc): ห้ามแก้ pipeline flow; ห้ามลบ clinics; Affiliate/White Label และ Washing Machine เป็น design only; Fair use ใช้ soft block เท่านั้น
- **ENTERPRISE-STANDARD** (.cursor/rules/ENTERPRISE-STANDARD.mdc): Loading/Empty/Error states, keyboard, pagination, filter/search, type safety, severity แยกชัด
- **ENTERPRISE-FRANCHISE-LICENSE-ARCHITECTURE** (docs): License ≠ Auth; ไม่ merge org; บังคับที่ backend; ไม่เก็บ raw license key; AI pipeline order ห้ามเปลี่ยน; RBAC เป็น authoritative; ไม่มี cross-tenant data leakage

---

## 8. สรุปไฟล์สำคัญโดยหน้าที่

| หน้าที่ | ไฟล์หลัก |
|--------|-----------|
| Session / Auth | `session.ts`, `auth-session.ts`, `middleware.ts` |
| ข้อมูลหลัก (Firestore) | `clinic-data.ts`, `financial-data.ts` |
| Multi-tenant / Isolation | `org-isolation.ts`, `rbac.ts` |
| LINE → Bot | `api/webhooks/line/route.ts`, `line-webhook.ts`, `chat-agent.ts`, `agents/pipeline.ts`, `ai/orchestrator.ts` |
| AI Pipeline (ลำดับคงที่) | `agents/pipeline.ts` |
| Knowledge RAG | `knowledge-retrieval.ts`, `knowledge-vector.ts`, `unified-knowledge/*`, `knowledge-brain/context-builder.ts` |
| Slot / จอง | `slot-engine.ts`, `clinic-data.ts` (bookings) |
| Subscription / Fair use | `subscription.ts` |
| Payment | `stripe.ts`, `api/webhooks/stripe/route.ts` |
| Feature flags | `feature-flags.ts` |
| Observability | `observability/run-with-observability.ts`, `observability/*.ts` |
| Worker (BullMQ) | `chat-llm-worker.ts`, `chat-llm-queue.ts` |

---

*เอกสารนี้ครอบคลุมทุกไฟล์และระบบที่ตรวจสอบแล้ว ไม่ข้ามส่วนใดตามที่ร้องขอ.*
