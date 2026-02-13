# GLOBAL GUARDRAILS

กฎสำหรับการพัฒนาผลิตภัณฑ์ Clinic — ทั้ง human และ AI assistant ต้องปฏิบัติตาม

---

## ❌ ห้าม (FORBIDDEN)

- **แก้ pipeline flow** — ห้ามเปลี่ยนลำดับ/ logic ของ Intent → Safety → Escalation → Knowledge → Compose
- **ลบ clinics** — ห้าม implement หรือเปิด API ที่ลบ clinics/organizations
- **Implement Affiliate / White Label** — design ไว้แล้ว แต่ยังไม่ implement (Phase 2+)
- **Implement Washing Machine** — E5.10 design only, ไม่ implement
- **Hard block fair use** — E6.9 ใช้ soft block เท่านั้น (80% warning, 100% soft block) ห้าม return HTTP 403 หรือ throw

---

## ✅ ทำได้ (ALLOWED)

- **เพิ่ม context เท่านั้น** — เพิ่ม system prompt, instructions, หรือข้อมูลเสริมให้ agents ได้ แต่ห้ามเปลี่ยน flow
- **Feature flags ตาม spec** — ใช้ feature flags ตามที่กำหนดในแต่ละ schema (เช่น E5.10 KNOWLEDGE_WASHING_MACHINE_ENABLED)

---

## Feature Flags ตาม spec

| Flag | Default | Spec | หมายเหตุ |
|------|---------|------|----------|
| `KNOWLEDGE_WASHING_MACHINE_ENABLED` | false | E5.10 | เปิดเฉพาะ org ที่ plan = enterprise (ยังไม่ implement) |
| `CHAT_USE_PIPELINE` | - | - | ใช้ multi-agent pipeline แทน chat agent เดิม |
