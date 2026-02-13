# FE-5 — Conversation & RAG Context (รองรับ E4)

## วัตถุประสงค์
ทุก conversation request ต้องแนบ context (org_id, branch_id, role, subscription plan) เพื่อให้ระบบจัด context อัตโนมัติสำหรับ RAG pyramid

## สิ่งที่ทำ

### 1. Extended RunPipelineOptions Interface
**File**: `src/lib/agents/pipeline.ts`

เพิ่ม `role` และ `subscriptionPlan` ใน `RunPipelineOptions`:

```typescript
export interface RunPipelineOptions {
  org_id?: string;
  branch_id?: string;
  role?: string; // FE-5 — user role (org-level)
  subscriptionPlan?: string; // FE-5 — subscription plan
}
```

### 2. Updated LINE Webhook
**File**: `src/app/api/webhooks/line/route.ts`

- ดึง subscription plan จาก `getSubscriptionByOrgId()` เมื่อมี `LINE_ORG_ID`
- ส่ง context ทั้งหมดไปยัง `runPipeline()`:
  - `org_id`: จาก `LINE_ORG_ID` env var
  - `branch_id`: `undefined` (LINE ไม่มี branch context)
  - `role`: `undefined` (LINE ไม่มี user session)
  - `subscriptionPlan`: จาก subscription data

### 3. Auto Context Determination
**File**: `src/lib/agents/knowledge.ts`

ระบบจัด context อัตโนมัติใน `getKnowledge()`:

```typescript
// Pyramid context — auto-determined from org_id/branch_id
const level = options?.org_id && options?.branch_id 
  ? "branch" 
  : options?.org_id 
    ? "org" 
    : "global";
```

**ไม่ต้องให้ user เลือกระดับ knowledge** — ระบบจัดให้อัตโนมัติตาม:
- `org_id` + `branch_id` → `branch` level
- `org_id` only → `org` level
- ไม่มี → `global` level

### 4. chatAgentReply
**File**: `src/lib/chat-agent.ts`

`chatAgentReply` ไม่ใช้ RAG หรือ knowledge retrieval (ใช้แค่ system prompt) ดังนั้นไม่ต้องเพิ่ม context parameters

## Flow

```
LINE Webhook
  ↓
Fetch subscription plan (if LINE_ORG_ID exists)
  ↓
runPipeline(userText, userId, state, {
  org_id: LINE_ORG_ID,
  branch_id: undefined,
  role: undefined,
  subscriptionPlan: subscription?.plan
})
  ↓
getKnowledge(intent, service, area, {
  org_id: pipelineOptions.org_id,
  branch_id: pipelineOptions.branch_id
})
  ↓
Auto-determine level: branch | org | global
  ↓
searchKnowledgeWithPyramid(query, context)
```

## Constraints

✅ **ห้ามเปลี่ยน conversation flow เดิม** — เพิ่มเฉพาะ context payload
✅ **ระบบจัด context อัตโนมัติ** — ไม่ต้องให้ user เลือกระดับ knowledge
✅ **Backward compatible** — context parameters เป็น optional

## Testing

1. LINE webhook ควรส่ง context ไปยัง `runPipeline`
2. Knowledge level ควรถูก auto-determine จาก `org_id`/`branch_id`
3. RAG pyramid filter ควรทำงานถูกต้องตาม level

## Notes

- LINE webhook ไม่มี branch context และ user session → `branch_id` และ `role` จะเป็น `undefined`
- Subscription plan จะถูก fetch เมื่อมี `LINE_ORG_ID`
- Knowledge level selection UI ไม่มี — ระบบจัดให้อัตโนมัติ (knowledge input page มี `level` field แต่เป็นสำหรับสร้าง knowledge documents ไม่ใช่ conversation context)
