# คู่มือตั้งค่าอีเมล (Resend) และ URL แอป — แบบละเอียด

เอกสารนี้อธิบายการตั้งค่า **RESEND_API_KEY**, **EMAIL_FROM** และ **NEXT_PUBLIC_APP_URL** สำหรับระบบยืนยันการซื้อแพ็คเกจและยืนยันอีเมล (Enterprise flow)

**พร้อมทดสอบและใช้งานจริง (ไม่มีโดเมน):** ใช้ผู้ส่ง **onboarding@resend.dev** ได้เลย ไม่ต้องเพิ่มโดเมนใน Resend — แค่ใส่ **RESEND_API_KEY** และ **NEXT_PUBLIC_APP_URL** ใน `.env.local` แล้วรีสตาร์ท dev server

---

## สารบัญ

1. [ภาพรวมว่าตัวแปรใช้ทำอะไร](#1-ภาพรวมว่าตัวแปรใช้ทำอะไร)
2. [ขอ RESEND_API_KEY จาก Resend](#2-ขอ-resend_api_key-จาก-resend)
3. [ตั้งค่า EMAIL_FROM (ตัวเลือก)](#3-ตั้งค่า-email_from-ตัวเลือก)
4. [ตั้งค่า NEXT_PUBLIC_APP_URL](#4-ตั้งค่า-next_public_app_url)
5. [ใส่ค่าลง .env.local](#5-ใส่ค่าลง-envlocal)
6. [ตรวจสอบว่าทำงาน](#6-ตรวจสอบว่าทำงาน)
7. [กรณีไม่ตั้ง RESEND_API_KEY](#7-กรณีไม่ตั้ง-resend_api_key)

---

## 1. ภาพรวมว่าตัวแปรใช้ทำอะไร

| ตัวแปร | บังคับหรือไม่ | ใช้ทำอะไร |
|--------|----------------|-----------|
| **RESEND_API_KEY** | บังคับถ้าต้องการส่งอีเมลจริง | ใช้ยืนยันตัวตนกับ Resend API เพื่อส่งอีเมล (ยืนยันการซื้อ + ลิงก์ยืนยันอีเมล) |
| **EMAIL_FROM** | ไม่บังคับ | อีเมลผู้ส่งที่แสดงในกล่องจดหมาย (ถ้าไม่ใส่จะใช้ `onboarding@resend.dev`) |
| **NEXT_PUBLIC_APP_URL** | แนะนำใน production | Base URL ของเว็บ ใช้สร้างลิงก์ยืนยันอีเมล (เช่น `https://your-domain.com`) |

---

## 2. ขอ RESEND_API_KEY จาก Resend

### 2.1 สมัคร / เข้าสู่ระบบ Resend

1. เปิดเบราว์เซอร์ไปที่ **https://resend.com**
2. กด **Sign Up** (สมัคร) หรือ **Log In** (ถ้ามีบัญชีแล้ว)
3. สมัครด้วยอีเมล หรือใช้ Google / GitHub ได้

### 2.2 สร้าง API Key

1. หลังเข้าสู่ระบบ ให้ไปที่ **API Keys**:  
   - ในแดชบอร์ด มักมีเมนู **API Keys** หรือ **Developers → API Keys**
   - หรือเปิดตรง: **https://resend.com/api-keys**
2. กด **Create API Key**
3. ตั้งชื่อ (เช่น `Clinic Connect Production` หรือ `Clinic Connect Dev`)
4. เลือก Permission:
   - **Sending access** (ส่งอีเมลได้) — เลือกอย่างนี้พอ
   - ไม่ต้องให้ **Full access** ถ้าไม่จำเป็น
5. กด **Add** / **Create**
6. **คัดลอก API Key ทันที** — Resendจะแสดงแค่ครั้งเดียว (ขึ้นต้นด้วย `re_`)

ตัวอย่างรูปแบบ:
```text
re_123abc456def789...
```

เก็บค่านี้ไว้ใช้ในขั้นตอนที่ 5

### 2.3 (ถ้าใช้โดเมนตัวเอง) เพิ่มโดเมนใน Resend

ถ้าอยากให้อีเมลส่งจากโดเมนของคุณ (เช่น `noreply@your-domain.com`):

1. ใน Resend ไปที่ **Domains** → **Add Domain**
2. ใส่โดเมน (เช่น `your-domain.com`)
3. Resend จะให้คุณเพิ่ม DNS records (SPF, DKIM ฯลฯ) ที่ผู้ให้บริการโดเมน
4. หลัง DNS propagate แล้ว กด **Verify** ใน Resend

ถ้ายังไม่เพิ่มโดเมน สามารถใช้ `onboarding@resend.dev` ได้เลย (ไม่ต้องตั้ง EMAIL_FROM)

---

## 3. ตั้งค่า EMAIL_FROM (ตัวเลือก)

**EMAIL_FROM** คืออีเมลผู้ส่งที่ลูกค้าเห็นในกล่องจดหมาย

### 3.1 ไม่ตั้ง EMAIL_FROM

- ระบบจะใช้ค่าเริ่มต้น: **`Clinic Connect <onboarding@resend.dev>`**
- ใช้ได้ทันทีหลังมี RESEND_API_KEY
- เหมาะสำหรับทดสอบหรือรันบน local

### 3.2 ตั้ง EMAIL_FROM (แนะนำใน production)

รูปแบบที่ใช้ได้:

```env
EMAIL_FROM=Clinic Connect <noreply@your-domain.com>
```

หรือแค่อีเมล:

```env
EMAIL_FROM=noreply@your-domain.com
```

ข้อควรระวัง:

- โดเมนหลัง `@` ต้องเป็นโดเมนที่คุณเพิ่มและ verify ใน Resend แล้ว (เช่น `your-domain.com`)
- ถ้าโดเมนยังไม่ verify ใน Resend การส่งจากอีเมลนั้นอาจถูกปฏิเสธ

---

## 4. ตั้งค่า NEXT_PUBLIC_APP_URL

**NEXT_PUBLIC_APP_URL** ใช้เป็น “ฐาน” ของลิงก์ยืนยันอีเมล เช่น:

- ลิงก์ที่ส่งในอีเมลจะอยู่ในรูปแบบ:  
  `{NEXT_PUBLIC_APP_URL}/verify-email?token=xxx`

### 4.1 รันบนเครื่องตัวเอง (localhost)

ใช้:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

หมายเหตุ: ลิงก์ในอีเมลจะชี้ไปที่ localhost — ลูกค้าที่เปิดจากเครื่องอื่นจะเข้าไม่ได้ ใช้ได้สำหรับทดสอบ flow บนเครื่องคุณเท่านั้น

### 4.2 รันบนเซิร์ฟเวอร์ / Production (Vercel, โดเมนตัวเอง ฯลฯ)

ใช้ URL จริงของเว็บ เช่น:

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

หรือถ้าใช้ Vercel:

```env
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

- **ห้าม** ปิดท้ายด้วย `/` (ใช้ `https://your-domain.com` ไม่ใช้ `https://your-domain.com/`)
- ต้องเป็น URL ที่ลูกค้าเข้าเว็บได้จริง

---

## 5. ใส่ค่าลง .env.local

### 5.1 เปิดไฟล์ .env.local

- อยู่ที่โฟลเดอร์รากของโปรเจกต์ Clinic (ระดับเดียวกับ `package.json`)
- ถ้ายังไม่มี: คัดลอกจาก `.env.local.example` แล้วเปลี่ยนชื่อเป็น `.env.local`

### 5.2 เพิ่มหรือแก้บรรทัดเหล่านี้

เปิด `.env.local` แล้วเพิ่ม/แก้ตามนี้ (ใส่ค่าจริงแทน placeholder):

```env
# ─── อีเมล (Resend) ─────────────────────────────────────────────
# คัดลอกจาก Resend → API Keys → Create API Key (ขึ้นต้นด้วย re_)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# ไม่บังคับ: ถ้าไม่ใส่จะใช้ onboarding@resend.dev
# ถ้าใส่ ต้องเป็นโดเมนที่ verify ใน Resend แล้ว
# EMAIL_FROM=Clinic Connect <noreply@your-domain.com>

# ─── URL แอป (สำหรับลิงก์ยืนยันอีเมล) ───────────────────────────
# Local: http://localhost:3000
# Production: https://your-domain.com (ไม่มี / ปิดท้าย)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

ตัวอย่างเมื่อรันจริงบนโดเมน:

```env
RESEND_API_KEY=re_abc123...
EMAIL_FROM=Clinic Connect <noreply@clinicconnect.com>
NEXT_PUBLIC_APP_URL=https://clinicconnect.com
```

### 5.3 บันทึกไฟล์

- บันทึก `.env.local` แล้วรีสตาร์ท dev server (`npm run dev`) เพื่อให้ Next.js โหลดค่าล่าสุด
- **ห้าม** commit `.env.local` ขึ้น Git (ไฟล์นี้อยู่ใน .gitignore อยู่แล้ว)

---

## 6. ตรวจสอบว่าทำงาน

### 6.1 ตรวจว่า env โหลด

1. รัน `npm run dev`
2. ไปที่หน้า **เลือกดูแพ็คเกจ** (`/packages`)
3. เลือกแพ็คเกจ **Starter** กรอกอีเมลที่รับได้จริง แล้วกดยืนยัน

ถ้าตั้งค่าถูกต้อง:

- ขึ้นข้อความประมาณ “บันทึกการซื้อสำเร็จ” และแจ้งว่าส่งอีเมลแล้ว
- ในกล่องจดหมาย (และถ้ามี: junk/spam) ควรเห็นอีเมลจาก Resend มีหัวเรื่องประมาณ “ยืนยันการซื้อแพ็คเกจ …” และมีลิงก์ยืนยันอีเมล

### 6.2 ตรวจลิงก์ยืนยันอีเมล

1. เปิดอีเมลที่ส่งมา
2. คลิกลิงก์ “ยืนยันอีเมล” (หรือลิงก์ที่ขึ้นต้นด้วย `NEXT_PUBLIC_APP_URL` ตามที่คุณตั้ง)
3. ควรเปิดไปที่ `/verify-email?token=...` แล้ว redirect ไป `/login?verified=1`
4. หน้า Login ควรแสดงข้อความประมาณ “ยืนยันอีเมลสำเร็จแล้ว สามารถเข้าสู่ระบบได้”

ถ้าลิงก์ผิด (เช่น ไปที่ localhost ในขณะที่คุณรันบน production) ให้ตรวจ **NEXT_PUBLIC_APP_URL** ว่าเป็น URL ของเซิร์ฟเวอร์จริงและไม่มี `/` ปิดท้าย

### 6.3 ตรวจใน Resend Dashboard

- ใน Resend ไปที่ **Emails** / **Logs**
- ควรเห็นเมลที่ส่งออก (สถานะ Success / Bounced ฯลฯ) ใช้ตรวจว่า API Key ทำงานและโดเมน (ถ้าใช้) ผ่าน

---

## 7. กรณีไม่ตั้ง RESEND_API_KEY

ถ้า **ไม่ใส่ RESEND_API_KEY** ใน `.env.local`:

- **การซื้อแพ็คเกจยังทำงาน:** ข้อมูลบันทึกใน Firestore ครบ (device_id, email, plan, license_key, verification_token)
- **ระบบจะไม่ส่งอีเมล:** ฟังก์ชันส่งอีเมลจะ return ไม่สำเร็จ
- **API บันทึกการซื้อจะตอบกลับแบบนี้:**  
  `success: true`, `emailSent: false` และมีข้อความแจ้งว่า  
  “บันทึกสำเร็จ แต่ส่งอีเมลไม่สำเร็จ — กรุณาใช้ปุ่ม ยืนยันอีเมล์ ในหน้า Login เพื่อส่งลิงก์ใหม่”

ดังนั้นลูกค้าสามารถ:

1. ไปที่ **Login** (`/login`)
2. ในบล็อก **“ยืนยันอีเมล์”** กรอกอีเมลที่ใช้ซื้อ
3. กด **“ส่งลิงก์ยืนยันอีเมล”**  
   → เรียก `POST /api/public/send-verification-email`  
   → ถ้ายังไม่มี RESEND_API_KEY การส่งจะไม่สำเร็จอีก แต่บันทึกการซื้อและ flow อื่นยังใช้ได้

สรุป: ระบบออกแบบให้รันได้แม้ยังไม่ตั้งอีเมล แต่ถ้าต้องการส่งอีเมลจริงต้องตั้ง **RESEND_API_KEY** (และถ้าต้องการผู้ส่งเป็นโดเมนตัวเอง ต้องตั้ง **EMAIL_FROM** และ verify โดเมนใน Resend)

---

## สรุปสั้น ๆ

1. สมัคร Resend → สร้าง API Key → ใส่ใน `.env.local` เป็น **RESEND_API_KEY**
2. (ถ้าต้องการ) ตั้ง **EMAIL_FROM** เป็นอีเมลจากโดเมนที่ verify ใน Resend
3. ตั้ง **NEXT_PUBLIC_APP_URL** ให้ตรงกับ URL จริงของเว็บ (ไม่มี `/` ปิดท้าย)
4. บันทึก `.env.local` แล้วรีสตาร์ท `npm run dev`
5. ทดสอบที่หน้าเลือกแพ็คเกจ → เลือก Starter → กรอกอีเมล → ตรวจกล่องจดหมายและลิงก์ยืนยัน

ถ้าทำครบแล้วแต่ส่งอีเมลไม่ได้ ให้ตรวจ Resend Dashboard (Logs) และ DNS ของโดเมน (ถ้าใช้ EMAIL_FROM โดเมนตัวเอง)
