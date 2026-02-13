# รายงานตรวจสอบ Pipeline vs Design

**วันที่ตรวจ:** 2025-02-08  
**บริบท:** Conversational AI คลินิกความงาม, multi-agent, ใช้งานจริงผ่าน LINE

---

## 1. ลำดับการเรียก Agent

| Design | Pipeline จริง | สถานะ |
|--------|----------------|--------|
| 1. Agent A — Intent & Context | หลัง Normalize + Memory Shortcut | ✅ ตรง |
| 2. Agent B — Safety / Medical Guard | หลัง A | ✅ ตรง |
| 3. Agent E — Escalation & Human Handoff | หลัง B | ✅ ตรง |
| 4. Agent C — Business Knowledge | หลัง E | ✅ ตรง |
| 5. Agent D — Conversation Composer | หลัง C | ✅ ตรง |
| 6. Agent F — Memory / CRM | หลัง D, รันแบบ non-blocking (`void`) | ✅ ตรง |

**สรุป:** ลำดับ A → B → E → C → D ตรง design, F เป็น background ไม่บล็อก reply

---

## 2. หน้าที่ของแต่ละ Agent

| Agent | หน้าที่ที่ออกแบบ | การทำจริง | สถานะ |
|-------|-------------------|-----------|--------|
| A | วิเคราะห์ intent, service, confidence | `analyzeIntent` → intent/service/confidence; fallback keywords ถ้า null | ✅ |
| B | ตรวจว่าตอบได้หรือส่งต่อแพทย์ | `checkSafety` → allowed / refer_to_doctor | ✅ |
| E | ตัดสินใจส่งต่อคนจริง | `checkEscalation` → handoff + target | ✅ |
| C | ดึงข้อมูลธุรกิจ (ราคา/โปร) | `getKnowledge` จาก logic/DB (KNOWLEDGE_BASE) | ✅ |
| D | เรียบเรียงคำตอบเป็นภาษาคน | `composeReply` (OpenAI) — agent เดียวที่ “พูด” กับลูกค้า | ✅ |
| F | สรุปบทสนทนา / CRM | `summarizeForCRM` เรียกเฉพาะ booking_request / promotion_inquiry | ✅ |

**สรุป:** แต่ละตัวทำเฉพาะหน้าที่ของตัวเอง ไม่ล้ำหน้าที่กัน

---

## 3. การเรียกที่ไม่จำเป็น

- **Memory Shortcut:** คำถามแนว “จำได้ไหม / คุยอะไรกัน” ถูกดักก่อนถึง Agent A → **ไม่เรียก Gemini (A)** ในเคสนี้ ✅
- **Agent F:** เรียกเฉพาะเมื่อ intent เป็น `booking_request` หรือ `promotion_inquiry` → ไม่เรียกทุก message ✅

**สรุป:** ไม่มี agent ใดถูกเรียกโดยไม่จำเป็นตาม design

---

## 4. จุด Early-Exit

| เงื่อนไข | การทำงาน | สถานะ |
|----------|----------|--------|
| ข้อความว่าง (หลัง normalize) | return safe fallback | ✅ |
| Memory inquiry (จำได้ไหม/คุยอะไรกัน) | return `composeMemoryAnswer()` ไม่เข้า A | ✅ |
| ไม่มี intent (และ fallback ก็ null) | return safe fallback | ✅ |
| B: ไม่ allowed + refer_to_doctor | return REFER_DOCTOR_MESSAGE | ✅ |
| E: handoff | return HANDOFF_MESSAGE | ✅ |

**สรุป:** มี early-exit ครบ ไม่ไหลต่อเมื่อควรจบ

---

## 5. Error ไม่ส่งถึงลูกค้า

| จุด | เมื่อ error | สิ่งที่ลูกค้าเห็น | สถานะ |
|-----|-------------|-------------------|--------|
| A (Intent) | catch → return null | ใช้ fallback keywords หรือ safe fallback | ✅ |
| B (Safety) | catch → return null (หรือ fail closed) | ไปต่อหรือ refer_to_doctor — ไม่มี raw error | ✅ |
| E (Escalation) | catch → return null | ไปต่อ ไม่ handoff — ไม่มี raw error | ✅ |
| C (Knowledge) | sync, ไม่มี API | - | ✅ |
| D (Compose) | catch → return null | `reply = replyText \|\| composeSafeFallbackMessage()` | ✅ |
| F (Memory) | catch → log เฉพาะ dev | ไม่กระทบ reply | ✅ |

**สรุป:** ทุก path ส่งให้ลูกค้าเป็นข้อความที่กำหนด (safe fallback / REFER_DOCTOR / HANDOFF / composeReply) ไม่มี stack trace หรือ error message หลุดถึงลูกค้า

---

## 6. จุดที่แก้ / แนะนำ

### 6.1 Agent B — Fail closed เมื่อ error (แนะนำ)

- **ก่อน:** B error (เช่น 429) → return null → pipeline ไปต่อ → อาจตอบคำถามการแพทย์โดยไม่ได้เช็ก safety
- **หลัง:** B error → return `{ allowed: false, action: "refer_to_doctor" }` → pipeline ส่ง REFER_DOCTOR_MESSAGE
- **เหตุผล:** ทางการแพทย์ควร “ไม่ตอบ” เมื่อเช็ก safety ไม่ได้

### 6.2 Logging

- B, D ใช้ `console.error` เมื่อ API error → แนะนำใช้ `console.warn` สำหรับ transient/ quota error เพื่อไม่สับสนกับ critical failure และไม่ส่ง error ถึงลูกค้า (ลูกค้าได้แค่ safe message อยู่แล้ว)

### 6.3 ค่า return `memory` (Agent F)

- F รันแบบ `void summarizeForCRM(...)` ดังนั้น `memory` ใน return ของ `runPipeline` จะเป็น `null` เสมอ (callback ทำงานหลัง return แล้ว)
- ถ้าต้องการใช้ `memory` จริง ต้องเปลี่ยนเป็น await F หรือส่งผลผ่าน callback/event แยก
- ตอนนี้ LINE webhook ใช้แค่ `reply` ดังนั้นพฤติกรรมปัจจุบันตรงกับ design (F เป็น background)

---

## 7. Checklist สรุป

| ข้อ | สถานะ |
|-----|--------|
| ลำดับการเรียก agent ตรง design (A→B→E→C→D, F background) | ✅ |
| แต่ละ agent ทำเฉพาะหน้าที่ของตัวเอง | ✅ |
| ไม่มี agent ถูกเรียกโดยไม่จำเป็น | ✅ |
| มี early-exit ครบ (empty, memory inquiry, no intent, B refer, E handoff) | ✅ |
| Error ของ agent ใด ๆ ไม่ถูกส่งถึงลูกค้า | ✅ |
| B error = fail closed (refer_to_doctor) — แนะนำ | แก้แล้ว |
| Logging B/D เป็น warn สำหรับ API error | แก้แล้ว |
