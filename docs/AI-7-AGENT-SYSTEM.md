# AI 7-Agent System — Production

## สถาปัตยกรรม

- **1 Role Manager** — เรียก LLM เพียง 1 ครั้งต่อข้อความ
- **6 Analytics Agents** — Data/Logic only (NO LLM), ดึงจาก Firestore

### Analytics Agents
1. **Booking** — คิว, วันว่าง, แนวโน้ม
2. **Promotion** — โปรโมชันที่ active
3. **Customer** — ลูกค้า, แหล่งที่มา
4. **Finance** — INTERNAL ONLY ห้ามส่งลูกค้า
5. **Knowledge** — topics, categories จาก KB
6. **Feedback** — Golden Dataset, success rate

---

## ไฟล์

```
src/lib/ai/
├── types.ts              # Shared types
├── run-analytics.ts      # เรียก 6 agents แบบขนาน
├── role-manager.ts       # LLM 1 ครั้ง
├── orchestrator.ts       # Flow ทั้งหมด
└── agents/
    ├── index.ts
    ├── booking-agent.ts
    ├── promotion-agent.ts
    ├── customer-agent.ts
    ├── finance-agent.ts
    ├── knowledge-agent.ts
    └── feedback-agent.ts

src/app/api/chat/route.ts  # POST /api/chat
```

---

## วิธีใช้

### 1. API Chat
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"มีโปรอะไรบ้าง","org_id":"YOUR_ORG_ID"}'
```

Body:
- `message` (required): ข้อความลูกค้า
- `org_id` (required): organization ID
- `branch_id` (optional): scope ตามสาขา
- `userId` (optional): LINE userId หรือ customer id

### 2. LINE Webhook
ตั้ง env:
```
CHAT_USE_7_AGENT=true
LINE_ORG_ID=your_org_id
```

ลำดับการเลือก: 7-Agent > Pipeline > Chat Agent

---

## Environment

- `OPENAI_API_KEY` — ต้องมี (Role Manager ใช้ gpt-4o-mini)
- `CHAT_USE_7_AGENT=true` — เปิด 7-Agent ใน LINE
- `LINE_ORG_ID` — org ที่ผูกกับ LINE Bot

---

## Performance

- Analytics: <200ms ต่อ agent, รันขนาน ≈ <250ms รวม
- Role Manager: <8s timeout
- Token: max 6000 chars input, 220 tokens output
