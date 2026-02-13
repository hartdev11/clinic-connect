# LINE Multi-tenant — คู่มือใช้งาน

## สรุป

แต่ละคลินิก (org) สามารถเชื่อมต่อ LINE Official Account ของตัวเองได้ โดย:
1. กรอก Channel Secret + Channel Access Token ในหน้า **Settings → LINE Connection**
2. ตั้ง Webhook URL ใน LINE Developers ตามที่ระบบแสดงให้
3. ลูกค้าแชทกับ LINE Bot → AI ตอบอัตโนมัติ

---

## ขั้นตอนสำหรับคลินิก

### 1. สร้าง LINE Channel
- ไปที่ https://developers.line.biz/console/
- สร้าง Provider (ถ้ายังไม่มี) → สร้าง Channel ประเภท **Messaging API**
- ตั้งชื่อ Channel

### 2. ดึง credentials
- แท็บ **Basic settings**: Copy **Channel secret**
- แท็บ **Messaging API**: Copy **Channel access token** (ต้องกด Issue ถ้ายังไม่มี)

### 3. กรอกในเว็บ
- Login เข้า Clinic Connect → **Settings**
- หัวข้อ **LINE Connection**
- กรอก Channel Secret และ Channel Access Token
- กด **เชื่อมต่อ LINE**

### 4. ตั้ง Webhook
- ระบบจะแสดง Webhook URL (เช่น `https://your-domain.com/api/webhooks/line/xxxx`)
- ไปที่ LINE Developers → Channel → Messaging API
- Webhook URL → ใส่ URL ที่ได้
- กด **Verify** (ต้องได้ success)

### 5. ทดสอบ
- ส่งข้อความไปที่ LINE Bot
- AI ควรตอบกลับ

---

## Environment

- `NEXT_PUBLIC_APP_URL` หรือ `VERCEL_URL` — ใช้สร้าง Webhook URL
  - Production: ตั้ง `NEXT_PUBLIC_APP_URL=https://your-domain.com`
  - Vercel: `VERCEL_URL` มีให้อัตโนมัติ

---

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|------|---------|
| `line_channels` (Firestore) | เก็บ credentials ต่อ org_id |
| `/api/clinic/line` | GET/PUT สถานะและบันทึก credentials |
| `/api/webhooks/line/[orgId]` | Webhook รับข้อความจาก LINE |
| `LineConnectionSettings` | UI ใน Settings |
