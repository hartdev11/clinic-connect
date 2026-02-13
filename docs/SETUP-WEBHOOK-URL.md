# ตั้งค่า Webhook URL + LINE (ทำตามขั้นตอน)

---

## ขั้นที่ 1: ตั้งค่า NEXT_PUBLIC_APP_URL

เปิดไฟล์ **`.env.local`** (ถ้ายังไม่มี ให้คัดลอกจาก `.env.local.example`)

เพิ่มบรรทัดนี้ (แก้เป็นโดเมนจริงของคุณ):

```env
# โดเมนของเว็บ — ใช้สร้าง Webhook URL ให้คลินิก
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**ตัวอย่างตามสภาพแวดล้อม:**

| สภาพแวดล้อม | ค่าที่ใส่ |
|-------------|-----------|
| **รัน local (ทดสอบ)** | `http://localhost:3000` |
| **Deploy บน Vercel** | `https://your-project.vercel.app` (หรือโดเมน custom) |
| **Production จริง** | `https://clinic-connect.com` (โดเมนของคุณ) |

บันทึกไฟล์ แล้ว restart server (`npm run dev`)

---

## ขั้นที่ 2: เลือกแบบไหน — ระบบเก่า vs ระบบใหม่

### ระบบเก่า (1 คลินิก ใช้ env)

ใช้เมื่อ: มีคลินิกเดียว ใส่ credentials ใน `.env.local`

```env
LINE_CHANNEL_SECRET=xxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxx
LINE_ORG_ID=org_id ของคลินิก
```

Webhook URL ที่ตั้งใน LINE Developers:
```
https://your-domain.com/api/webhooks/line
```

---

### ระบบใหม่ (หลายคลินิก ใช้ Firestore)

ใช้เมื่อ: มีหลายคลินิก แต่ละคลินิกเชื่อม LINE ของตัวเองผ่านหน้า Settings

1. **ไม่ต้องใส่** LINE_CHANNEL_*, LINE_ORG_ID ใน `.env.local`
2. คลินิกแต่ละคนไปที่ **Settings → LINE Connection** → กรอก credentials
3. ระบบจะแสดง Webhook URL ให้ เช่น:
   ```
   https://your-domain.com/api/webhooks/line/abc123
   ```
   (abc123 = org_id ของคลินิกนั้น)
4. คลินิกนำ URL นี้ไปตั้งใน LINE Developers → Webhook URL

---

## ขั้นที่ 3: ถ้ายังใช้ระบบเก่าอยู่ อยากเปลี่ยนเป็นระบบใหม่

1. คลินิก login → Settings → LINE Connection
2. กรอก Channel Secret + Channel Access Token (ตัวเดียวกับที่ใส่ใน .env)
3. กดเชื่อมต่อ
4. นำ Webhook URL ใหม่ไปตั้งใน LINE Developers (แทนของเก่า)
5. ลบ LINE_CHANNEL_*, LINE_ORG_ID ออกจาก `.env.local` ได้ (ถ้าไม่ใช้แล้ว)

---

## สรุปสั้น ๆ

| คำถาม | คำตอบ |
|-------|--------|
| ต้องตั้ง NEXT_PUBLIC_APP_URL ไหม? | ต้อง (สำหรับระบบใหม่ที่สร้าง Webhook URL ให้คลินิก) |
| รัน local จะใช้ได้ไหม? | ได้ ใช้ `http://localhost:3000` แต่ LINE Webhook ต้องเป็น URL สาธารณะ (ใช้ ngrok ถ้าทดสอบ) |
| Vercel มี VERCEL_URL ให้ไหม? | มี — ระบบจะใช้ VERCEL_URL ถ้าไม่มี NEXT_PUBLIC_APP_URL |
