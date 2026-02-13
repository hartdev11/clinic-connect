# พาทำ: ตั้งค่า LINE Bot + AI ตอบข้อความ (ทีละขั้น)

ทำตามลำดับด้านล่าง **ทีละขั้น** — ถ้าทำบนเครื่องตัวเอง (local) ต้องใช้ **ngrok** ก่อน

---

## ขั้นที่ 0: เตรียม OpenAI API Key (ถ้ายังไม่มี)

1. ไปที่ **https://platform.openai.com/**
2. ล็อกอิน/สมัคร → เมนู **API keys**
3. สร้าง API key ใหม่ → **Copy** เก็บไว้ (ขึ้นต้น `sk-...`)
4. ใส่ใน `.env.local` ในขั้นที่ 4 ด้านล่าง

---

## ขั้นที่ 1: เปิดเซิร์ฟเวอร์โปรเจกต์

1. เปิด Terminal ในโฟลเดอร์โปรเจกต์ `C:\Users\hartz\Clinic`
2. รัน:
   ```bash
   npm run dev
   ```
3. รอจนเห็น `Ready in ...` และ `localhost:3000`
4. **เปิด Terminal อีกหนึ่งหน้าต่าง** (หรือแท็บใหม่) — ไว้ใช้รัน ngrok ในขั้นถัดไป

---

## ขั้นที่ 2: ใช้ ngrok ให้ LINE เรียก Webhook ได้ (สำคัญสำหรับ local)

1. **ติดตั้ง ngrok** (ถ้ายังไม่มี):
   - ไปที่ **https://ngrok.com/** → สมัคร/ล็อกอิน
   - ดาวน์โหลดและติดตั้งตามที่เว็บบอก หรือใช้ `npm install -g ngrok`
2. ใน **Terminal อีกหน้าต่าง** (ไม่ต้องปิด `npm run dev`) รัน:
   ```bash
   ngrok http 3000
   ```
3. จะเห็นข้อความประมาณ:
   ```
   Forwarding   https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:3000
   ```
4. **จด URL ด้านหน้า `->`** เช่น `https://xxxx-xx-xx-xx-xx.ngrok-free.app`  
   → นี่คือ URL ที่ LINE จะเรียกได้ (ใช้ในขั้นที่ 6)
5. **อย่าปิดหน้าต่าง ngrok** — ต้องเปิดไว้ตลอดตอนทดสอบ

---

## ขั้นที่ 3: สร้าง LINE Channel (Messaging API)

1. เปิดเบราว์เซอร์ไปที่ **https://developers.line.biz/console/**
2. ล็อกอินด้วยบัญชี LINE
3. **สร้าง Provider** (ถ้ายังไม่มี):
   - กด **Create a new provider** → ตั้งชื่อ เช่น `Clinic Connect` → Create
4. **สร้าง Channel**:
   - กด **Create a new channel**
   - เลือก **Messaging API** → Next
   - กรอก:
     - **Channel name**: เช่น `Clinic Bot`
     - **Channel description**: เช่น `Bot สำหรับคลินิก`
     - **Category**: เลือกตามที่เหมาะสม (เช่น Health)
     - **Privacy policy URL** / **Terms of use URL**: ใส่ได้หรือข้าม
   - กด **Create**
5. หลังสร้างเสร็จ จะเข้าไปที่หน้า Channel → ไปที่แท็บ **Messaging API**

---

## ขั้นที่ 4: จด Channel secret และสร้าง Channel access token

1. ในแท็บ **Messaging API** ของ Channel:
2. **Channel secret**  
   - หาในส่วน **Basic settings** (หรือในแท็บ Channel basic settings)  
   - กด **Show** → **Copy** → เก็บไว้ (ใส่ใน `.env.local` ในขั้นที่ 5)
3. **Channel access token**  
   - เลื่อนลงหา **Channel access token (long-lived)**
   - กด **Issue** → **Copy** token ที่ได้ → เก็บไว้ (ใส่ใน `.env.local` ในขั้นที่ 5)

---

## ขั้นที่ 5: ใส่ค่าใน .env.local

1. เปิดไฟล์ **`.env.local`** ในโฟลเดอร์ `C:\Users\hartz\Clinic` (ระดับเดียวกับ `package.json`)
2. เพิ่มบรรทัดด้านล่าง (แทน `xxxx` ด้วยค่าจริงที่จดไว้):

```env
LINE_CHANNEL_SECRET=ค่าที่ copy จาก Channel secret
LINE_CHANNEL_ACCESS_TOKEN=ค่าที่ copy จาก Channel access token
OPENAI_API_KEY=sk-xxxx
```

3. **OPENAI_API_KEY** ใช้ค่าจากขั้นที่ 0 (platform.openai.com)
4. **บันทึกไฟล์** แล้วรีสตาร์ท `npm run dev` (ใน Terminal ที่รัน dev) เพื่อให้โหลด env ใหม่

---

## ขั้นที่ 6: ตั้ง Webhook URL ใน LINE

1. กลับไปที่ **LINE Developers Console** → Channel ของคุณ → แท็บ **Messaging API**
2. หา **Webhook URL**
3. กด **Edit**
4. ใส่ URL ตามนี้ (ใช้ URL จาก **ขั้นที่ 2** แทน `xxxx-xx-xx-xx-xx.ngrok-free.app`):

   ```
   https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/webhooks/line
   ```

   ตัวอย่างจริง: ถ้า ngrok แสดง `https://abc123.ngrok-free.app` ให้ใส่  
   `https://abc123.ngrok-free.app/api/webhooks/line`
5. กด **Update**
6. เปิด **Use webhook** เป็น **Enabled**
7. (ถ้ามีปุ่ม **Verify**) กด **Verify** — ควรขึ้นว่าสำเร็จ (200)

---

## ขั้นที่ 7: ทดสอบส่งข้อความกับ AI

1. ใน LINE Developers Console → แท็บ **Messaging API** (หรือ Channel basic settings)
2. หา **QR code** สำหรับเพิ่ม Bot เป็นเพื่อน → **สแกนด้วย LINE** บนมือถือหรือ PC
3. เพิ่ม Bot เป็นเพื่อน (กด Add)
4. **ส่งข้อความ** ไปที่ Bot เช่น `สวัสดี` หรือ `อยากทราบราคาบริการ`
5. รอสักครู่ — **Bot ควรตอบกลับ** ด้วยข้อความจาก AI (ผู้ช่วยคลินิก)

---

## ถ้า Bot ไม่ตอบ ให้เช็ค

- **ngrok ยังเปิดอยู่ไหม** — Terminal ที่รัน `ngrok http 3000` ต้องไม่ปิด
- **npm run dev ยังรันอยู่ไหม** — ต้องเห็น Ready และ port 3000
- **Webhook URL ถูกไหม** — ต้องลงท้ายด้วย `/api/webhooks/line` และใช้ URL จาก ngrok
- **.env.local ครบไหม** — LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, OPENAI_API_KEY (และรีสตาร์ท dev แล้ว)
- ดู **Terminal ที่รัน npm run dev** — มี error จาก LINE หรือ OpenAI ไหม

---

## สรุปลำดับ (local)

1. รัน `npm run dev`  
2. รัน `ngrok http 3000` → จด URL  
3. สร้าง LINE Channel (Messaging API) → จด Channel secret + ออก Channel access token  
4. ใส่ 3 ค่าใน `.env.local` → บันทึก → รีสตาร์ท dev  
5. ตั้ง Webhook URL = `https://<ngrok-url>/api/webhooks/line` → Enabled  
6. สแกน QR เพิ่ม Bot → ส่งข้อความ → ควรได้คำตอบจาก AI  
