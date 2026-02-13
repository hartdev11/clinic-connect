# Phase 7: ตั้งค่า LINE Webhook — ส่งข้อความเทสกับ AI

ทำตามลำดับเพื่อให้ระบบรับข้อความจาก LINE และตอบกลับด้วย AI ได้

---

## 1. สร้าง LINE Channel (Messaging API)

1. ไปที่ **https://developers.line.biz/console/**
2. ล็อกอินด้วยบัญชี LINE
3. สร้าง **Provider** (ถ้ายังไม่มี) → สร้าง **Channel** เลือก **Messaging API**
4. กรอกชื่อ Channel, คำอธิบาย, หมวดหมู่ ฯลฯ ตามที่ LINE ถาม
5. หลังสร้างเสร็จ ไปที่แท็บ **Messaging API** ของ Channel นั้น
6. จด **Channel secret** และ **Channel access token** (ระยะยาว) — เก็บไว้ใส่ใน `.env.local`

---

## 2. ตั้งค่า Webhook URL

1. ใน LINE Developers Console → Channel ของคุณ → แท็บ **Messaging API**
2. หา **Webhook URL** → กด **Edit**
3. ใส่ URL ของ API ของเรา เช่น:
   - พัฒนา (ngrok): `https://xxxx.ngrok.io/api/webhooks/line`
   - Production: `https://<โดเมนของคุณ>/api/webhooks/line`
4. กด **Update**
5. เปิด **Use webhook** เป็น **Enabled**
6. (ถ้ามี) กด **Verify** เพื่อทดสอบว่า LINE เรียก Webhook ได้ — ต้องได้ 200 OK

---

## 3. ใส่ค่าใน .env.local

เพิ่มใน `.env.local`:

```env
LINE_CHANNEL_SECRET=xxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxx
OPENAI_API_KEY=sk-xxxx
```

- **LINE_CHANNEL_SECRET** — ใช้ตรวจสอบ signature ของ request จาก LINE
- **LINE_CHANNEL_ACCESS_TOKEN** — ใช้ส่งข้อความกลับผ่าน LINE Messaging API
- **OPENAI_API_KEY** — ใช้เรียก Chat Agent (OpenAI GPT-4o-mini) สร้างคำตอบ

อย่า commit ค่าเหล่านี้ลง Git

---

## 4. API ที่มีอยู่

- **POST /api/webhooks/line** — รับเหตุการณ์จาก LINE (ข้อความจากลูกค้า)
  - ตรวจสอบ signature (X-Line-Signature) ด้วย Channel Secret
  - Parse events → ถ้าเป็นข้อความ (message/text) เรียก Chat Agent (OpenAI GPT-4o-mini)
  - ส่งคำตอบกลับผ่าน LINE Messaging API (reply token)
  - ต้องมี LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, OPENAI_API_KEY ใน .env.local

---

## 5. ทดสอบส่งข้อความเทสกับ AI

เมื่อทำครบแล้ว:

1. เพิ่ม Bot เป็นเพื่อนใน LINE (สแกน QR จาก Channel)
2. ส่งข้อความไปที่ Bot
3. ระบบรับที่ Webhook → เรียก AI (Chat Agent) → ส่งคำตอบกลับ

ถ้ายังไม่ต่อ AI จริง Webhook จะรับได้แต่ไม่ตอบ — ต่อเมื่อเพิ่ม logic เรียก ChatGPT/Gemini และส่ง reply ผ่าน LINE API จึงจะตอบกลับได้

---

## อ้างอิง

- [LINE Messaging API – Webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [LINE Messaging API – Sending messages](https://developers.line.biz/en/docs/messaging-api/sending-messages/)
