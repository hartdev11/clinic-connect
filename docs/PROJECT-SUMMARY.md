# Clinic Connect — สรุปโครงสร้างและระบบทั้งหมด

เอกสารนี้สรุปว่าเว็บนี้คืออะไร ทำงานยังไง แต่ละระบบทำอะไร และโค้ดอยู่ในระดับไหน

---

## 1. เว็บนี้คืออะไร

**Clinic Connect** เป็น **แพลตฟอร์ม SaaS สำหรับคลินิกความงาม**  
คุณเป็นผู้พัฒนา/เจ้าของผลิตภัณฑ์ — **ผู้ใช้จริงคือคลินิก** (owner, manager, staff) ที่เข้ามาจัดการลูกค้า การจอง แชท LINE และให้ AI ช่วยตอบลูกค้าจากข้อมูลของคลินิก

- **Multi-tenant:** หนึ่งระบบ รองรับหลายองค์กร (org) แต่ละ org มีหลายสาขา (branch) ได้
- **ช่องทางหลัก:** เว็บแอดมิน (หลังบ้าน) + LINE (ลูกค้าคุยกับบอท)

---

## 2. โครงสร้างโฟลเดอร์หลัก

```
Clinic/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (clinic)/           # หลังบ้านคลินิก (ต้อง login)
│   │   │   ├── layout.tsx      # Sidebar + Topbar + ClinicContext
│   │   │   └── clinic/         # หน้าต่างๆ ของคลินิก
│   │   │       ├── page.tsx              # Dashboard
│   │   │       ├── customers/             # ลูกค้า & แชท
│   │   │       ├── booking/               # การจอง + หน้างานวันนี้
│   │   │       ├── promotions/            # โปรโมชัน
│   │   │       ├── insights/              # รายได้, แชท, การจอง
│   │   │       ├── finance/               # เงิน, ใบแจ้งหนี้, Executive Brief
│   │   │       ├── knowledge/             # ข้อมูลที่ AI ใช้ (Unified: บริการ, FAQ)
│   │   │       ├── knowledge-brain/       # Knowledge Health, approve/reject
│   │   │       ├── knowledge/ [topicId]   # Knowledge แบบ topic (อีกชุด)
│   │   │       ├── ai-agents/             # ดูสถานะ AI agents
│   │   │       ├── settings/              # ตั้งค่าคลินิก
│   │   │       ├── slot-settings/         # เวลาทำการ, ตารางแพทย์, วันปิด
│   │   │       ├── users/                 # User & Roles
│   │   │       ├── admin-monitoring/      # Admin Monitoring, AI Cost
│   │   │       ├── knowledge-health/      # Knowledge Health (owner)
│   │   │       └── feedback/              # Feedback จากแชท
│   │   ├── (public)/           # หน้าไม่ต้อง login
│   │   │   ├── page.tsx        # หน้าหลัก
│   │   │   ├── login/ register/
│   │   │   ├── about/ promotions/ reviews/
│   │   │   └── clinics/ [slug] # หน้าแสดงคลินิก (ถ้ามี)
│   │   ├── api/                 # API Routes
│   │   │   ├── auth/            # login, register, logout, firebase-token
│   │   │   ├── webhooks/        # line, line/[orgId], stripe
│   │   │   ├── clinic/          # ทุก API หลัง login (context, bookings, customers, ...)
│   │   │   ├── internal/        # ai-context, observability
│   │   │   └── admin/           # cleanup, embedding-worker, promotion-lifecycle, ...
│   │   ├── globals.css
│   │   └── ent-tokens.css       # Enterprise design tokens (dark-first), ดู docs/ENTERPRISE-DESIGN-SYSTEM.md
│   ├── components/              # React components
│   │   ├── layout/              # Sidebar, Topbar, PageHeader, ...
│   │   ├── clinic/              # SlotSettings, NotificationBell, ...
│   │   ├── ui/                  # Card, Button, Input, Badge, ...
│   │   └── rbac/                # RequireRole
│   ├── contexts/                # ClinicContext (org, branch, user, SWR)
│   ├── lib/                     # โค้ดหลักทั้งหมด (ดูรายละเอียดด้านล่าง)
│   ├── types/                   # TypeScript types (clinic, knowledge, organization, ...)
│   ├── worker/                   # chat-llm-worker (BullMQ)
│   └── middleware.ts            # ป้องกัน /clinic, ตรวจ session, CSP, request-id
├── tests/                       # Vitest (unified-knowledge, security-pen-test, ...)
├── scripts/                     # migrate, backfill, load-test, audit
├── firestore.indexes.json
├── vercel.json                  # crons: cleanup, promotion-lifecycle, embedding-worker
└── package.json
```

---

## 3. แต่ละระบบทำงานยังไง

### 3.1 Authentication & Session

- **Login/Register:** `src/app/(public)/login`, `register` → API `auth/login`, `auth/register`
- **Session:** JWT ใน cookie (`clinic_session`) ตรวจด้วย `jose` ใน `middleware.ts` และ `getSessionFromCookies()` ใน `lib/auth-session.ts`
- **RBAC:** `lib/rbac.ts` — EffectiveUser (role, branch_ids, branch_roles), requireRole, getEffectiveUser(session)
- **Guard:** หน้า /clinic ต้องมี token ถึงเข้าได้; middleware redirect ไป /login ถ้าไม่มี

### 3.2 โมเดลข้อมูลหลัก (Firestore)

- **organizations** — องค์กร (คลินิก)
- **branches** — สาขา
- **users** — ผู้ใช้ในระบบ (ผูก org, role, branch_ids/branch_roles)
- **bookings** — การจอง (org_id, branch_id, scheduledAt, status, ...)
- **customers** — ลูกค้า (LINE userId, ชื่อ, โทร, ประวัติแชท)
- **transactions** — ธุรกรรมทางการเงิน
- **promotions** — โปรโมชัน (รูป, ข้อความ, หมดอายุ)
- **conversation_feedback** — ประวัติแชทลูกค้า–บอท (สำหรับ analytics, RAG)
- **subscriptions** — แพลนสมัครสมาชิก (Stripe)
- **branch_hours, doctor_schedules, blackout_dates** — ใช้สำหรับ slot การจอง

ข้อมูลอ่าน/เขียนผ่าน **`lib/clinic-data.ts`** (และส่วนที่เกี่ยวข้อง เช่น financial-data, promotion-storage)

### 3.3 LINE Webhook & แชทกับลูกค้า

- **Webhook URL:** `/api/webhooks/line` หรือ `/api/webhooks/line/[orgId]` (multi-tenant)
- **Flow:** LINE ส่ง event มา → ตรวจลายเซ็น → idempotency (ไม่ตอบซ้ำ) → ส่งข้อความเข้า **Pipeline** หรือ **7-Agent Orchestrator** (ตาม feature flag) → ได้ reply + media (โปรโมชัน) → ส่งกลับ LINE ผ่าน Reply API
- **ไฟล์หลัก:** `lib/line-webhook.ts`, `lib/chat-agent.ts`, `lib/agents/pipeline.ts`, `lib/ai/orchestrator.ts`
- **ลูกค้า LINE:** upsert ลง Firestore (customers) และผูกกับ org ผ่าน channel

### 3.4 AI Pipeline (หัวใจของบอท)

ลำดับใน **`lib/agents/pipeline.ts`** (ห้ามเปลี่ยนลำดับตาม GLOBAL-GUARDRAILS):

1. **Intent** — วิเคราะห์ว่าผู้ใช้ต้องการอะไร (booking, promotion_inquiry, knowledge_inquiry, human_handoff, ฯลฯ)
2. **Safety** — ตรวจคำไม่เหมาะสม / เนื้อหาอันตราย
3. **Escalation** — ต้องส่งต่อคนหรือไม่
4. **Knowledge** — ดึงข้อมูลจาก RAG (Knowledge Base, Unified Knowledge, โปรโมชัน) ตาม org_id/branch_id
5. **Compose** — ใช้ template + state สร้างข้อความตอบ (ไม่ให้บอทลืมบริบทเดิม)

เสริมด้วย **Guards** (state-stickiness, refinement, intent-dedup, knowledge-readiness, surgery-flow, ฯลฯ) และ **Session storage** เพื่อให้คุยต่อเนื่องได้

### 3.5 7-Agent System (เมื่อเปิด feature flag)

- **Orchestrator:** `lib/ai/orchestrator.ts` — เลือก agent ตาม intent (Knowledge, Booking, Promotion, Finance, Customer, Feedback, Analytics)
- **Agents:** knowledge-agent, booking-agent, promotion-agent, finance-agent, customer-agent, feedback-agent + analytics
- **Role Manager:** จัดการว่าใครเห็นข้อมูลอะไร (เช่น ข้อมูลการเงินไม่ส่งให้ลูกค้าทาง LINE)
- **Prompt Registry, Cost Governance, Observability** — ใช้ร่วมกับ LLM (OpenAI / Google GenAI)

### 3.6 Knowledge (ข้อมูลที่ AI ใช้ตอบ)

- **Unified Knowledge (หน้าหลักที่คลินิกใช้):**
  - **บริการ (Services):** จากแพลตฟอร์ม + ปรับเองได้ (custom_title, ฯลฯ) → embed ลง Pinecone
  - **FAQ:** คำถาม–คำตอบของคลินิก → embed
  - **สถานะ:** global/clinic/promotions, embedding_status, platform_managed_mode
- **Knowledge แบบ Topic (อีกชุด):** หน้า knowledge/new, knowledge/[topicId]/edit — เก็บใน Firestore + sync ไป vector (Pinecone) ผ่าน `lib/knowledge-vector.ts`, `lib/knowledge-topics-data.ts`
- **Knowledge Brain:** หน้า approve/reject, reindex, audit, drift — ใช้กับ quality และ compliance
- **RAG:** `lib/knowledge-retrieval.ts`, `lib/knowledge-brain/context-builder.ts` — ดึงจาก Pinecone ตาม org_id/branch_id/conversation ฯลฯ

### 3.7 การจอง (Booking)

- **API:** `/api/clinic/bookings` (CRUD), slots, calendar, queue, timeline, day-timeline, reports
- **Slot engine:** `lib/slot-engine.ts` — คำนวณ slot ว่างจาก branch_hours, doctor_schedules, blackout_dates
- **Booking intent ในแชท:** booking-agent + booking-intent — ลูกค้าสามารถนัด/ถาม slot ผ่าน LINE ได้
- **หน้างานวันนี้:** หน้า booking แสดงรายการจอง/คิวเรียงตามเวลา

### 3.8 โปรโมชัน

- **CRUD + Media:** API promotions, promotions/[id]/cover, upload-temp, scan-image, from-scan
- **Embedding:** promotion-embedding, promotion-storage — เก็บรูป/ข้อความ และ embed เพื่อให้ AI กล่าวถึงโปรโมชันในแชท
- **Lifecycle:** Cron `promotion-lifecycle` — อัปเดตสถานะหมดอายุ/ใกล้หมด

### 3.9 Finance

- **ใบแจ้งหนี้/การชำระ:** `lib/financial-data.ts`, API clinic/invoices, confirm-payment, refunds
- **Executive Brief:** AI สรุปภาพรวมการเงินให้ owner/manager (finance-agent, executive-finance-brief)
- **Stripe:** subscription, checkout, webhook — เก็บใน subscriptions

### 3.10 Analytics & Insights

- **ข้อมูล:** `lib/analytics-data.ts` — รายได้, แชท, การจอง, heatmap, operational
- **หน้า Insights:** รายได้ตามวัน/ตามบริการ, การกระจาย Intent, คำถามยอดนิยม, การจองตามชั่วโมง
- **Alerts, Comparison, Scoring:** analytics-alert-engine, analytics-comparison, analytics-scoring

### 3.11 Observability & Admin

- **runWithObservability:** ห่อ API ไว้วัด latency, บันทึก 5xx, orgId/branchId
- **Latency, Errors, Firestore, Cache metrics** — ใช้ใน internal/observability และ admin
- **Admin routes:** cleanup, embedding-worker, promotion-lifecycle, ai-cost-monitor, circuit-breaker, knowledge-health, drift, audit-export ฯลฯ
- **Crons (vercel.json):** cleanup, promotion-lifecycle, embedding-worker

### 3.12 Infrastructure

- **Firestore:** ข้อมูลหลัก (Firebase Admin SDK ใน `lib/firebase-admin.ts`)
- **Pinecone:** Vector สำหรับ Knowledge + โปรโมชัน (embedding)
- **Redis:** BullMQ (คิว chat-llm), rate-limit, LLM budget, semaphore (ถ้าใช้)
- **Stripe:** ชำระเงินและ subscription
- **LINE:** Messaging API (reply, push), channel ต่อ org

---

## 4. ระดับของโค้ดตอนนี้

### 4.1 สิ่งที่มีอยู่แล้วและทำงาน

- **TypeScript ทั้งโปรเจกต์** — strict, ไม่มี type error (tsc --noEmit ผ่าน)
- **Tests 44 ตัว (Vitest)** — unified-knowledge, ai-evaluation-harness, enterprise-hardening, security-pen-test ผ่าน
- **Flow หลัก:** Login → Dashboard → ลูกค้า/จอง/โปรโมชัน/ความรู้/AI/เงิน/ตั้งค่า ครบ
- **LINE ↔ Pipeline/Orchestrator:** รับข้อความ → Intent → Safety → Escalation → Knowledge → Compose → ส่งกลับ LINE
- **Multi-tenant:** org_id, branch_id ใช้ทั่วระบบ (Firestore, API, RAG)
- **Guardrails ชัดเจน:** GLOBAL-GUARDRAILS (ไม่แก้ pipeline flow, ไม่ลบ clinics, soft block fair use)
- **Enterprise patterns:** RBAC, observability, feature flags, circuit breaker, idempotency, rate limit

### 4.2 สิ่งที่ “มีแต่ยังไม่ละเอียดทุกจุด”

- **Lint:** ยังใช้ `next lint` (deprecated ใน Next 16) — ยังไม่ได้ย้ายไป ESLint CLI
- **Build บนเครื่องคุณ:** เคย EPERM ตอนเขียน .next (เรื่องสิทธิ์/สภาพเครื่อง ไม่ใช่ logic)
- **การทดสอบด้วยมือ:** คุณลองเล่นแล้วไม่เจอ error แต่ยังไม่ได้เล่นครบทุก flow

### 4.3 สรุประดับ

| ด้าน              | ระดับ        | หมายเหตุ                                      |
|------------------|-------------|-----------------------------------------------|
| โครงสร้างโปรเจกต์ | ระดับ Production | App Router, แยก clinic/public, API ชัด       |
| Type safety      | ระดับ Production | strict TS, แก้ error ครบแล้ว                 |
| Tests            | ระดับกลาง+  | 44 tests ครอบ logic หลัก ไม่ได้ครอบทุก API   |
| AI/Chat          | ระดับ Production | Pipeline + 7-Agent, RAG, Knowledge ครบ      |
| Multi-tenant     | ระดับ Production | org/branch แนวราบทั้งระบบ                   |
| Security         | ระดับกลาง+  | Session, RBAC, CSP, security tests มี        |
| Observability    | ระดับ Production | Latency, errors, metrics มีใช้               |

**ภาพรวม:** โค้ดอยู่ในระดับ **Production-ready สำหรับคลินิก** — โครงสร้างชัด ระบบหลักครบ และมี guardrails/observability รองรับ การที่คุณทำมาให้คลินิกใช้และไม่ได้ใช้เองสอดคล้องกับโครงแบบ SaaS นี้

---

## 5. สรุปหนึ่งย่อหน้า

**Clinic Connect** เป็น SaaS สำหรับคลินิกความงาม ใช้ Next.js 15 + TypeScript + Firestore + Pinecone + Redis + Stripe + LINE ลูกค้าคลินิกคุยกับบอทผ่าน LINE โดยบอทใช้ Pipeline (Intent → Safety → Escalation → Knowledge → Compose) และเลือกได้ว่าจะใช้ 7-Agent Orchestrator หรือไม่ ข้อมูลที่ AI ใช้มาจาก Unified Knowledge (บริการ, FAQ) และ Knowledge แบบ topic รวมถึงโปรโมชัน คลินิกใช้เว็บหลังบ้านจัดการ Dashboard ลูกค้า การจอง โปรโมชัน Insights เงิน ข้อมูลที่ AI ใช้ และตั้งค่าต่างๆ โค้ดมี type-safe, tests หลักผ่าน, และมี observability/guardrails อยู่ในระดับที่นำไปใช้กับคลินิกจริงได้
