# Phase 1 — ระบบ Clinic Connect (E1–E7 + FE1–FE8)

## ระบบนี้คืออะไร

**Clinic Connect** คือ ระบบหลังบ้าน (Admin) สำหรับคลินิกความงาม ที่มี:

1. **AI Chatbot** — ตอบแชทลูกค้าทาง LINE อัตโนมัติ 24 ชม.
2. **Multi-tenant** — รองรับหลายองค์กร (org) หลายสาขา (branch)
3. **RBAC** — สิทธิ์ Owner / Manager / Staff
4. **Knowledge Base** — RAG จากเอกสารที่คลินิกใส่เข้าไป
5. **Subscription & Payment** — Stripe, plan ต่อสาขา, proration
6. **Golden Dataset** — Admin mark success/fail เพื่อปรับปรุง model

---

## E1–E7 Backend สัมพันธ์กับระบบอย่างไร

| Epic | ระบบที่เกี่ยวข้อง | ไฟล์หลัก |
|------|-------------------|----------|
| **E1** Multi-tenant | organizations, branches, org_id ในทุก collection | `clinic-data.ts`, `firestore`, API routes |
| **E2** RBAC | จำกัดสิทธิ์ API (Owner แก้ org, Manager จัดการ users/branches) | `rbac.ts`, `requireRole` ในทุก route |
| **E3** Vector DB | Pinecone + Knowledge documents + embedding | `knowledge-vector.ts`, `knowledge-data.ts` |
| **E4** RAG | แทนที่ static knowledge ด้วย RAG, filter ตาม org/branch | `agents/knowledge.ts`, `knowledge-vector.ts` |
| **E5** Golden Dataset | Admin mark success/fail ในหน้า Feedback | `feedback/route.ts`, `feedback/[id]/route.ts` |
| **E6** Subscription | Plan per org, max branches, fair use 80%/100% | `subscription.ts`, `enforceLimits` |
| **E7** Payment | Stripe checkout, webhook, upgrade mid-cycle | `checkout/route.ts`, `webhooks/stripe/route.ts` |

---

## FE1–FE8 Frontend สัมพันธ์กับระบบอย่างไร

| Epic | หน้าที่เกี่ยวข้อง | Component / หน้า |
|------|-------------------|------------------|
| **FE1** Context | org_id, branch_id, currentUser, subscriptionPlan | `ClinicContext`, `ClinicTopbar` (branch switcher) |
| **FE2** RBAC | ซ่อนเมนู/ปุ่มตาม role | `RequireRole`, `ClinicSidebar`, `Finance`, `Users` |
| **FE3** Org/Branch | แก้ org, สร้าง/แก้ branch | `OrganizationSettings`, `BranchManagement` |
| **FE4** Knowledge | Smart input, duplicate check, KWM toggle (Enterprise) | `knowledge/page.tsx`, `DuplicateWarningModal` |
| **FE5** RAG Context | ส่ง org_id, branch_id ไป pipeline | `runPipeline` options, LINE webhook |
| **FE6** Billing UI | Plan, upgrade, proration, fair use warning | `BillingSection` |
| **FE7** Payment Flow | Verify session จาก backend, success/pending/failed | `checkout/verify`, `BillingSection` |
| **FE8** Safety | ทุก API ส่ง branch_id, error message ชัด | `apiFetcher`, RBAC messages |

---

## วิธีใช้

### 1. Login
- ไปที่ `/login` → เข้าใช้งานด้วย org/license
- Session จะเก็บ `org_id`, `branch_id`, `user_id`

### 2. เลือกสาขา (ถ้ามีหลายสาขา)
- ดูที่ Topbar ด้านบน — dropdown สาขา
- เลือกสาขา → Dashboard, Finance, Customers, Bookings, Promotions จะ filter ตามสาขานั้น

### 3. จัดการองค์กรและสาขา
- ไปที่ **Settings** → Organization Settings, Branch Management
- Owner แก้ชื่อ org ได้; Owner/Manager สร้าง/แก้ branch ได้

### 4. Knowledge
- ไปที่ **Knowledge** → กรอก topic, category, key_points, content
- ถ้าซ้ำ exactly → block; ซ้ำ semantic → modal Replace/Keep/Cancel

### 5. Billing & Payment
- ไปที่ **Settings** → Billing
- สมัคร Professional / อัปเกรด → Stripe Checkout
- Fair use 80% → แจ้งเตือน; 100% → ไม่ให้เพิ่มสาขา

### 6. Golden Dataset (Feedback)
- ไปที่ **Golden Dataset** → mark ✓ ดี / ✗ แย่ บนแชทจาก LINE

---

## วิธีทดสอบ

### Backend
```bash
# 1. รัน dev server
npm run dev

# 2. ทดสอบ API (ต้อง login ก่อน)
# GET /api/clinic/context     → ได้ org, branch, user, subscription
# GET /api/clinic/dashboard   → ได้ stats, bookings
# GET /api/clinic/subscription → ได้ plan, fairUse
```

### Frontend
1. Login ที่ `/login`
2. ไปที่ Dashboard → ดูสถิติ, เลือกสาขา
3. ไปที่ Settings → ทดสอบ Billing (ปุ่มสมัคร/อัปเกรด)
4. ไปที่ Knowledge → ส่งฟอร์ม ทดสอบ duplicate
5. ทดสอบ RBAC: login ด้วย staff → Finance ควรซ่อนหรือแสดง fallback

### Payment (Stripe)
```bash
# เปิด Stripe CLI เพื่อรับ webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
- สมัคร plan → redirect ไป Stripe → ชำระ → กลับมาหน้า Settings?checkout=success

### LINE Chat
- ตั้ง LINE Webhook → `https://your-domain/api/webhooks/line`
- ส่งข้อความไป LINE Bot → ระบบตอบอัตโนมัติ (ใช้ pipeline หรือ chat agent ตาม feature flag)

---

## ไฟล์สำคัญ

| ประเภท | ไฟล์ |
|--------|------|
| Context | `contexts/ClinicContext.tsx`, `api/clinic/context/route.ts` |
| RBAC | `lib/rbac.ts`, `hooks/usePermissions.ts`, `components/rbac/*` |
| Data | `lib/clinic-data.ts`, `lib/knowledge-data.ts`, `lib/knowledge-vector.ts` |
| Pipeline | `lib/agents/pipeline.ts`, `lib/agents/knowledge.ts` |
| Payment | `lib/stripe.ts`, `api/clinic/checkout/*`, `api/webhooks/stripe/route.ts` |
| Subscription | `lib/subscription.ts`, `api/clinic/subscription/route.ts` |
