# 🔍 Production-Ready Audit Report

**วันที่:** 2025-02-10  
**ขอบเขต:** Full Repository Audit — Senior Software Architect + Security Auditor + Financial System Reviewer

---

## STEP 1 — สรุปโครงสร้างระบบ

### Architecture สรุป

| ส่วน | รายละเอียด | ไฟล์อ้างอิง |
|------|------------|-------------|
| **Framework** | Next.js 15 (App Router) | `package.json` |
| **Database** | Firestore (Firebase Admin SDK) | `src/lib/firebase-admin.ts`, `src/lib/clinic-data.ts` |
| **Auth** | Session JWT (jose) + Cookie `clinic_session` | `src/lib/session.ts`, `src/lib/auth-session.ts` |
| **API Routes** | Next.js Route Handlers | `src/app/api/*` |
| **Middleware** | Protect `/clinic/*` only | `src/middleware.ts` (matcher: `/clinic/:path*`) |

### Backend Entry Points

| Route | Method | Auth Required | ใช้ org_id จาก |
|-------|--------|---------------|-----------------|
| `/api/auth/login` | POST | ❌ | - |
| `/api/auth/register` | POST | ❌ | - |
| `/api/auth/logout` | POST | - | - |
| `/api/auth/firebase-token` | GET | ✅ session | session.org_id / getOrgIdFromClinicId |
| `/api/chat` | POST | ❌ | **body.org_id (client-sent)** |
| `/api/clinic/*` | GET/POST/PUT/PATCH | ✅ session | session.org_id / getOrgIdFromClinicId |
| `/api/webhooks/line` | POST | ❌ (signature) | LINE_ORG_ID env |
| `/api/webhooks/line/[orgId]` | POST | ❌ (signature) | URL param orgId |
| `/api/webhooks/stripe` | POST | ❌ (signature) | Stripe metadata |

### API Routes ทั้งหมด (จากโครงสร้างไฟล์)

- `auth`: login, register, logout, firebase-token
- `chat`: route (POST)
- `clinic`: bookings, branches, checkout, context, customers, dashboard, debug-org, feedback, finance, knowledge, line, me, organization, promotions, subscription, users
- `webhooks`: line, line/[orgId], stripe

### Database Layer

- **Collections:** organizations, branches, users, clinics (legacy), bookings, customers, transactions, promotions, conversation_feedback, subscriptions, stripe_events, line_channels, knowledge_documents
- **Data access:** `src/lib/clinic-data.ts` — ทุก query ใช้ `org_id` filter (ยืนยันจาก grep)

### Middleware

- **ไฟล์:** `src/middleware.ts`
- **Logic:** Protect `/clinic/*` ด้วย `clinic_session` cookie; verify JWT ด้วย jose
- **ไม่ protect:** `/api/*` — API routes ตรวจ auth เอง

### AI Orchestration Flow

1. **7-Agent:** `src/lib/ai/orchestrator.ts` → `runAllAnalytics` (6 agents) → `runRoleManager` (1 LLM)
2. **Pipeline (legacy):** `src/lib/agents/pipeline.ts` — Intent → Safety → Knowledge → Compose
3. **LINE Webhook:** ใช้ `chatOrchestrate` (7-agent) หรือ `runPipeline` ตาม feature flag

---

## STEP 2 — ระบบ 7 Agent Architecture

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| มี Role Manager | ✅ | `src/lib/ai/role-manager.ts` — `runRoleManager()` |
| มี 6 Analytics Agents | ✅ | `src/lib/ai/agents/index.ts` — booking, promotion, customer, finance, knowledge, feedback |
| ใช้ Promise.all / parallel | ✅ | `src/lib/ai/run-analytics.ts` L23–31 — `Promise.all([...])` |
| มี Aggregated Context | ✅ | `src/lib/ai/types.ts` — `AggregatedAnalyticsContext` |
| Finance Agent ไม่ส่งลูกค้า | ✅ | `src/lib/ai/role-manager.ts` — `buildPublicContext()` ไม่มี finance; `buildInternalContext()` มี finance + note ห้ามเอ่ยตัวเลข |
| มี validation ก่อน LLM | 🟡 | Role Manager รับ context ที่มี structure แล้ว; ไม่มี explicit schema validation |
| มี error fallback | ✅ | `run-analytics` แต่ละ agent มี try/catch คืน `riskFlags`; `role-manager` มี catch คืน fallback message |

**สรุป STEP 2:** ✅ ครบตามข้อกำหนดหลัก

---

## STEP 3 — Multi-Tenant Security Audit

### 🔴 Critical

| ปัญหา | ไฟล์ | บรรทัด | รายละเอียด |
|-------|------|--------|-------------|
| **POST /api/chat ไม่ตรวจ auth** | `src/app/api/chat/route.ts` | 12–38 | `org_id` มาจาก `body.org_id` — **client ส่งอะไรก็ได้** |
| **org_id จาก client = Cross-tenant data leak** | `src/app/api/chat/route.ts` | 16, 36 | ผู้โจมตีส่ง `org_id` ของ org อื่น → ได้ analytics + AI reply ที่มีข้อมูลของ org นั้น |

**Reasoning:** `/api/chat` ถูกเรียกจาก LINE webhook (server-side, org มาจาก webhook context) แต่ endpoint เปิด public และรับ org_id จาก body โดยไม่ตรวจ session — ทำให้任何人สามารถส่ง org_id ใดก็ได้และ leak ข้อมูล org นั้นได้

### ✅ Endpoints ที่ใช้ org_id จาก verified source

| Endpoint | org_id มาจาก | ไฟล์ |
|----------|--------------|------|
| /api/clinic/* | session.org_id / getOrgIdFromClinicId | ทุก route ใน clinic |
| /api/auth/firebase-token | session | route.ts L19–20 |
| /api/webhooks/line | LINE_ORG_ID env | route.ts |
| /api/webhooks/line/[orgId] | URL param + validate with line_channel | [orgId]/route.ts |

### clinic-data.ts — ทุก query มี org_id filter

- `getBookings`, `getCustomers`, `getTransactions`, `getPromotions`, `listConversationFeedback`, `listConversationFeedbackByUserId`, `getDashboardStats`, `getDashboardBookingsByDate`, `getDashboardChartData` — ล้วน `where("org_id", "==", orgId)`
- `getCustomerById`, `updateFeedbackLabel` — ตรวจ `d.org_id !== orgId` return null/false

### Audit logging

- ❌ **Missing** — ไม่มี audit log สำหรับการเข้าถึงข้อมูล cross-org หรือการเปลี่ยนแปลงสำคัญ

---

## STEP 4 — Financial Logic Audit

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| Pricing ตาม tier | ✅ | `src/types/subscription.ts` — `PLAN_MAX_BRANCHES` |
| Rounding logic | ❌ | ไม่พบ — ใช้ `Number()` โดยตรง |
| Annual discount | ❌ | **Missing** — ไม่มี logic |
| Coupon | ❌ | **Missing** — ไม่มี |
| Proration | ✅ | `src/app/api/clinic/checkout/route.ts` — `proration_behavior: "always_invoice"` |
| ใช้ Decimal หรือ float | 🔴 | **ใช้ float** — `getDashboardStats` L397–404: `Number(d.amount)`; `clinic-data.ts` คำนวณ revenue ด้วย Number |

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/clinic-data.ts` L397–404: `revenueThisMonth`, `revenueLastMonth` คำนวณจาก `Number(d.amount)`
- `src/app/api/clinic/checkout/route.ts`: Stripe proration
- `src/app/api/webhooks/stripe/route.ts`: Idempotency ด้วย `stripe_events` collection

**ความเสี่ยง:** การคำนวณเงินด้วย float อาจเกิด floating-point error — ควรใช้ Decimal หรือเก็บเป็นสตางค์ (integer)

---

## STEP 5 — Fair Use + Usage Tracking

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| นับ conversation | ❌ | **Missing** — ไม่มีการนับจำนวน conversation ต่อ plan |
| กัน duplicate | ❌ | **Missing** — ไม่มี dedup สำหรับการนับ |
| Timezone Asia/Bangkok | ❌ | ใช้ `new Date()`, `setUTCHours` — ไม่มีการตั้ง timezone ชัดเจน |
| Grace period | ❌ | **Missing** |
| Threshold 80%, 100%, 125%, 150% | 🟡 | มีเฉพาะ **branches**: 80% warning, 100% soft block (`src/lib/subscription.ts` L15–16) |
| Reset รายเดือน | ❌ | **Missing** สำหรับ conversation |
| Atomic counter | ❌ | **Missing** — Fair use ใช้ branch count จาก query โดยตรง ไม่ใช่ atomic counter |

**สรุป:** Fair Use มีเฉพาะสำหรับ **จำนวนสาขา** ไม่มี conversation usage tracking เลย

---

## STEP 6 — Fraud Detection

| ข้อกำหนด | สถานะ |
|----------|--------|
| Scoring system | ❌ **Missing** |
| Weighted signals | ❌ **Missing** |
| Human review flow | ❌ **Missing** |
| Appeal system | ❌ **Missing** |
| Whitelist | ❌ **Missing** |

**สรุป:** ไม่มี fraud detection — ไม่ block อัตโนมัติแบบไม่มี review (ไม่มี block logic ให้วิเคราะห์)

---

## STEP 7 — Thai Business Validation

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| Validate เบอร์ไทย | ❌ | `OrganizationSettings.tsx`, `register` — รับ phone โดยไม่มี validation format |
| Tax ID checksum | ❌ | **Missing** — ไม่มี tax id field/validation |
| ชื่อไทยยาว | 🟡 | รับ string ทั่วไป ไม่มี max length / validation เฉพาะ |
| ที่อยู่ไทย | 🟡 | รับ address string — ไม่มี format validation |
| Buddhist Era | ❌ | ใช้ `toLocaleString("th-TH")` — แสดงวันที่เป็น locale ไทย แต่ไม่ใช่ พ.ศ. โดยตรง |

---

## STEP 8 — AI Prompt Quality Audit

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| System prompt แยกชัด | ✅ | `src/lib/ai/role-manager.ts` — `SYSTEM_PROMPT` |
| Objection handling | 🟡 | ไม่มี prompt เฉพาะสำหรับ objection |
| Compliance check ก่อนตอบ | 🟡 | มี policy ใน prompt: "finance = INTERNAL ONLY — ห้ามเอ่ยตัวเลข" |
| กัน medical claim | ✅ | `src/lib/agents/safety.ts` — `medical_question` → `refer_to_doctor` |
| จำกัดความยาวข้อความ | ✅ | `role-manager.ts` — `MAX_OUTPUT_TOKENS = 220`, `MAX_INPUT_CHARS = 6000` |
| Persona consistency | ✅ | System prompt กำหนด "AI แอดมินคลินิก", "ภาษาพูด เป็นกันเอง" |

**Pipeline (legacy):** `src/lib/agents/safety.ts` — medical_question → refer_to_doctor (ไม่ให้ AI ตอบ)

---

## STEP 9 — Frontend System Audit

| ข้อกำหนด | สถานะ | อ้างอิง |
|----------|--------|---------|
| Dashboard usage | 🟡 | มี Dashboard (`/clinic`) แต่เป็น overview ไม่ใช่ usage/conversation count |
| จัดการ subscription | ✅ | `BillingSection.tsx` ใน Settings — plan, upgrade, proration preview |
| Pricing breakdown | ✅ | BillingSection — แสดง plan, max branches, fair use |
| Fair Use warning | ✅ | BillingSection L228–243 — warning, softBlock |
| Admin whitelist | ❌ | **Missing** |
| Error handling UI | 🟡 | มี error message ในหลายหน้า แต่ไม่มี centralized error boundary |
| Loading state | ✅ | ใช้ SWR + isLoading, animate-pulse |
| Auth protection | ✅ | Middleware protect `/clinic/*`; RequireRole ในหน้า Finance, Billing |
| API error boundary | 🟡 | แต่ละ component handle error เอง — ไม่มี React Error Boundary ครอบ |
| Environment separation | 🟡 | มี `NODE_ENV` checks ในหลายที่ — ไม่มี explicit dev/prod UI separation |

---

# สรุปความเสี่ยงและข้อเสนอแนะ

## 🔴 Critical — แก้ไขแล้ว (2025-02-10)

1. ~~**POST /api/chat ไม่ตรวจ auth**~~ ✅ แก้แล้ว
   - ใช้ session + org_id จาก getSessionFromCookies / getOrgIdFromClinicId เท่านั้น

2. ~~**การคำนวณเงินใช้ float**~~ ✅ แก้แล้ว
   - สร้าง `src/lib/money.ts` — ใช้ satang (integer) สำหรับการคำนวณ
   - อัปเดต clinic-data, finance API, finance page

## 🟠 High — แก้ไขแล้ว (2025-02-10)

1. ~~**ไม่มี Rate Limiting**~~ ✅ แก้แล้ว — เพิ่ม `src/lib/rate-limit.ts`, ใช้กับ `/api/chat`: 5 req/10s per IP, 30 req/min per org
2. **ไม่มี Conversation Usage Tracking** — ไม่นับ conversation ต่อ plan
3. **ไม่มี Fraud Detection** — ไม่มี scoring, review, appeal, whitelist

## 🟡 Medium

1. ไม่มี audit logging
2. Thai validation ไม่ครบ (phone, tax id)
3. ไม่มี atomic counter สำหรับ Fair Use (ใช้ branch count จาก query)

## Financial Float — Strict sweep (2025-02-10)

- ลบ fallback calculation ฝั่ง client ใน finance page — ใช้ `byService` จาก API เท่านั้น
- finance-agent: threshold ใช้ satang `(lastSatang * 70) / 100` แทน `* 0.7`
- ไม่มี reduce(.*amount) หรือ acc + amount เหลือใน financial path

## 🟢 Low

1. Services & Pricing, Operating Hours เป็น hardcoded — ยังไม่ integrate กับ database
2. ไม่มี Admin whitelist UI

---

# สรุปสุดท้าย

**Critical items แก้ไขครบแล้ว** — ระบบพร้อม deploy production ด้าน security และ financial calculation

ควรพิจารณาเพิ่ม (High priority):

- Conversation usage tracking + Fair Use สำหรับแชท
- Fraud detection (scoring, human review, appeal)
- Audit logging
- Thai business validation (phone, tax id)

---

*รายงานนี้อ้างอิงจากไฟล์จริงใน repository ณ วันที่ตรวจสอบ*
