# ระบบ AI และบทบาท (Roles & Capabilities) — คู่มือละเอียด

**อัปเดตล่าสุด:** 2025-02-10

---

## 1. สรุปภาพรวม

ระบบมี **2 ประเภทบทบาท** ที่แยกกันชัดเจน:

| ประเภท | อธิบาย |
|--------|--------|
| **User Roles (RBAC)** | บทบาทของผู้ใช้ในระบบคลินิก — owner, manager, staff |
| **AI Roles** | บทบาทของ AI Agents — Role Manager + 6 Analytics (ไม่ใช่ user) |

---

## 2. User Roles (RBAC) — ผู้ใช้ระบบ

### 2.1 บทบาทและสิทธิ์

| Role | ทำได้ | ทำไม่ได้ |
|------|-------|----------|
| **owner** | ทุกอย่างใน org • ดู Admin Monitoring, LLM cost, metrics • ตั้งค่า org, ผู้ใช้, สาขา • เชื่อม LINE • Finance • User & Roles | - |
| **manager** | เกือบเท่า owner • Finance • User & Roles • LINE • จัดการสาขา • Promotion | Admin Monitoring (เฉพาะ owner) |
| **staff** | Dashboard, Booking, Customers & Chat, Promotions, Insights • กรองตามสาขาที่ assign • Label feedback • Knowledge Input | Finance • User & Roles • LINE • Admin Monitoring • จัดการสาขา |

### 2.2 สิทธิ์ตามเมนู (Sidebar)

| เมนู | owner | manager | staff |
|------|:-----:|:-------:|:-----:|
| Dashboard | ✅ | ✅ | ✅ |
| Customers & Chat | ✅ | ✅ | ✅ |
| Booking | ✅ | ✅ | ✅ |
| Promotions | ✅ | ✅ | ✅ |
| Insights | ✅ | ✅ | ✅ |
| Finance | ✅ | ✅ | ❌ |
| AI Agents | ✅ | ✅ | ✅ |
| Knowledge Input | ✅ | ✅ | ✅ |
| Clinic Settings | ✅ | ✅ | ✅ |
| User & Roles | ✅ | ✅ | ❌ |
| Admin Monitoring | ✅ | ❌ | ❌ |

### 2.3 สิทธิ์ตาม API

| API | บทบาทที่อนุญาต |
|-----|-----------------|
| `/api/admin/*` (cleanup, audit-export, retention, llm-cost, llm-metrics-advanced) | **owner เท่านั้น** |
| `/api/clinic/organization` (แก้ org) | **owner** |
| `/api/clinic/users/*`, `/api/clinic/line`, `/api/clinic/branches/*` | **owner, manager** |
| `/api/clinic/finance` | owner, manager + branch access |
| `/api/clinic/knowledge`, `/api/clinic/feedback` | **owner, manager, staff** |
| `/api/clinic/customers`, booking, dashboard, promotions | ทุก role + branch access |

### 2.4 Branch-scoped Access

- **owner**: เข้าถึงทุกสาขา
- **manager / staff**: เข้าได้เฉพาะสาขาที่ `branch_ids` หรือ `branch_roles` กำหนด
- ถ้า `branch_ids` ว่าง และ `branch_roles` ว่าง → เข้าถึงทั้ง org (legacy)

---

## 3. AI System — โฟลว์การตอบแชท

### 3.1 โหมด AI ที่มี (3 โหมด)

ลำดับการเลือกขึ้นกับ **Feature Flags** (`CHAT_USE_7_AGENT`, `CHAT_USE_PIPELINE`):

| ลำดับ | โหมด | Env | ใช้เมื่อ |
|-------|------|-----|----------|
| 1 | **7-Agent System** | `CHAT_USE_7_AGENT=true` + `LINE_ORG_ID` | LINE webhook ใช้ orchestrator |
| 2 | **Pipeline** | `CHAT_USE_PIPELINE=true` | Intent → Template → RAG (Gemini) |
| 3 | **Chat Agent** | ไม่ตั้งทั้งสอง | OpenAI/Gemini เลย (simple) |

**หมายเหตุ:** `/api/chat` ใช้ **7-Agent เท่านั้น** (ไม่มี pipeline/chat agent fallback)

---

## 4. 7-Agent System (เมื่อเปิด)

### 4.1 โครงสร้าง

```
ลูกค้าส่งข้อความ
    ↓
6 Analytics Agents (parallel, no LLM)
    ↓
Role Manager (1 LLM call)
    ↓
คำตอบลูกค้า
```

### 4.2 Role Manager — ตอบลูกค้า

**ทำได้:**
- ตอบแชทลูกค้าให้ชัด กระชับ เป็นมิตร
- ใช้ context จาก 6 Analytics Agents เท่านั้น
- ชวนจองคิว แนะนำโปรที่เหมาะ
- ใช้ภาษาพูด เป็นกันเอง (ค่ะ ค่า นะคะ)

**ทำไม่ได้ (STRICT PROHIBITIONS):**
- ห้ามวินิจฉัยโรค
- ห้ามรับประกันผลลัพธ์
- ห้ามเปิดเผยตัวเลขรายได้/ยอดขาย
- ห้ามเปิดเผยข้อมูลลูกค้ารายอื่น
- ห้ามแต่งตัวเลขหรือสร้างข้อมูลใหม่
- ห้ามให้คำแนะนำทางกฎหมาย

**Model:** `gpt-4o-mini` (OpenAI)

### 4.3 6 Analytics Agents — วิเคราะห์ข้อมูล (NO LLM)

| Agent | หน้าที่ | ข้อมูลที่ส่ง Role Manager |
|-------|---------|---------------------------|
| **Booking** | คิว, วันว่าง, แนวโน้ม | keyFindings, recommendation |
| **Promotion** | โปร active | โปรเหมาะกับลูกค้า |
| **Customer** | ประวัติแชท, พฤติกรรม | current_customer, ความสนใจ |
| **Finance** | ยอดขาย, รายได้ | **INTERNAL ONLY** — ห้ามส่งลูกค้า |
| **Knowledge** | KB, บริการ, ราคา | topics, categories |
| **Feedback** | Golden Dataset | success rate, ปรับปรุงคำตอบ |

- ทุก Agent: **Data/Logic only** — ไม่เรียก LLM
- รันแบบขนาน ประมาณ <250ms รวม
- Finance ใช้เฉพาะ internal context เท่านั้น

---

## 5. Pipeline Flow (เมื่อเปิด CHAT_USE_PIPELINE)

### 5.1 โฟลว์หลัก

```
User Message
  → Intent (A) → Safety (B) → Escalation (E)
  → Knowledge (C) → Compose (D) → Reply
  → Memory (F) — fire-and-forget
```

### 5.2 สิ่งที่ทำได้
- วิเคราะห์ intent (จองคิว, โปร, ราคา, บริการ ฯลฯ)
- ใช้ template เป็นหลัก (ลด AI improvise)
- RAG จาก Knowledge Base เมื่อจำเป็น
- เก็บ Conversation State ต่อเนื่อง (session)
- Escalation → ส่งต่อ human

### 5.3 สิ่งที่ทำไม่ได้
- Medical: refer to doctor
- Legal: ไม่ให้คำแนะนำกฎหมาย
- Safety: บล็อกตามกฎ

---

## 6. Chat Agent (โหมดธรรมดา)

- โหมด fallback เมื่อไม่เปิด 7-Agent หรือ Pipeline
- ใช้ OpenAI หรือ Gemini โดยตรง
- ไม่มี analytics context
- System prompt เน้นสุภาพ ตอบตรงประเด็น ไม่วินิจฉัย

---

## 7. สิทธิ์การเรียก AI

| Endpoint | Auth | Rate Limit | Cost Guard |
|----------|------|------------|------------|
| `/api/chat` | Session (org_id จาก session) | IP + Org | LLM reserve/reconcile |
| LINE Webhook | Signature HMAC | - | ไม่มี (fire-and-forget) |

- **Staff/Manager/Owner** เรียก `/api/chat` ได้เท่ากัน (ขึ้นกับ session)
- ไม่มี RBAC แยกระหว่าง role สำหรับ Chat API

---

## 8. จุดที่อาจปรับปรุง (Recommendations)

### 8.1 User Roles
- [ ] **Staff** ไม่ควรเห็น AI Agents page หรือเห็นแบบ read-only — ปัจจุบันเห็นเท่า manager
- [ ] พิจารณา **custom roles** หรือ permission เฉพาะ (เช่น staff สาขา A เข้าถึงแค่สาขา A)

### 8.2 AI System
- [ ] **Pipeline** ยังไม่ส่ง `role` จาก user ไปให้ context — `pipelineOptions.role` เป็น undefined ตอนเรียกจาก LINE
- [ ] 7-Agent ใช้ `LINE_ORG_ID` แบบ single org — ถ้ามีหลาย org/line ต้องปรับให้รองรับ
- [ ] **AI Agents page** — ปุ่ม "แก้ไข Prompt", toggle เปิด/ปิด ยังไม่ทำงาน (UI only)

### 8.3 Compliance / Safety
- [ ] Role Manager มี STRICT PROHIBITIONS ใน prompt — พิจารณาเพิ่ม content filter ก่อนส่ง LLM
- [ ] ตรวจสอบว่า Finance context ไม่รั่วไปใน reply (ปัจจุบันแยก public vs internal ใน role-manager แล้ว)

### 8.4 Observability
- [ ] Admin Monitoring เฉพาะ **owner** — manager อาจต้องการดู cost แบบจำกัด
- [ ] ยังไม่มี Activity Log จริงสำหรับ AI Agents (หน้า AI Agents มี section แต่ยังไม่มีข้อมูล)

---

## 9. ไฟล์ที่เกี่ยวข้อง

| ระบบ | ไฟล์หลัก |
|------|----------|
| RBAC | `src/lib/rbac.ts`, `src/lib/admin-guard.ts` |
| User Roles | `src/types/organization.ts` |
| Permissions (FE) | `src/hooks/usePermissions.ts`, `src/components/rbac/RequireRole.tsx` |
| 7-Agent | `src/lib/ai/orchestrator.ts`, `src/lib/ai/role-manager.ts`, `src/lib/ai/run-analytics.ts` |
| Pipeline | `src/lib/agents/pipeline.ts` |
| Chat Agent | `src/lib/chat-agent.ts` |
| Feature Flags | `src/lib/feature-flags.ts` |
| LINE Webhook | `src/app/api/webhooks/line/route.ts` |
| Chat API | `src/app/api/chat/route.ts` |
