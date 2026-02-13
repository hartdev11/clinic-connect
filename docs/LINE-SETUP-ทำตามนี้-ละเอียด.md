# พาทำทีละขั้นแบบละเอียด — LINE Bot + AI

ทำตามทีละขั้น **เรียงลำดับ** ไม่ข้ามขั้น

---

## เริ่มจากตรงไหน

- **ขั้นที่ 0** — ทำก่อนทุกอย่าง: ไปที่ platform.openai.com สร้าง API key แล้ว copy เก็บไว้
- **ขั้นที่ 1** — เปิด Terminal ใน Cursor → รัน `npm run dev` → จด port (3000 หรือ 3001)
- **ขั้นที่ 2** — เปิด Terminal อีกหน้าต่าง → รัน `ngrok http <port>` → จด URL ที่ได้
- **ขั้นที่ 3–4** — ไปที่ developers.line.biz สร้าง Channel แล้วจด Channel secret + token
- **ขั้นที่ 5** — เปิดไฟล์ `.env.local` ในโปรเจกต์ → แทนที่ 3 บรรทัด LINE/OpenAI ด้วยค่าจริง → บันทึก → รีสตาร์ท `npm run dev`
- **ขั้นที่ 6** — ใน LINE Console ตั้ง Webhook URL = `https://<ngrok-url>/api/webhooks/line` แล้วเปิด Use webhook
- **ขั้นที่ 7** — สแกน QR เพิ่ม Bot เป็นเพื่อน → ส่งข้อความ → ควรได้คำตอบจาก AI

---

## ขั้นที่ 0: เตรียม OpenAI API Key

### 0.1 เปิดเว็บ OpenAI
1. เปิดเบราว์เซอร์ (Chrome, Edge ฯลฯ)
2. ไปที่แถบที่อยู่พิมพ์: **https://platform.openai.com**
3. กด Enter

### 0.2 ล็อกอินหรือสมัคร
- ถ้ามีบัญชีแล้ว → กด **Log in** แล้วใส่อีเมล/รหัส
- ถ้ายังไม่มี → กด **Sign up** สมัคร (ใช้อีเมลหรือ Google ได้)

### 0.3 เข้าเมนู API keys
1. หลังล็อกอินแล้ว จะอยู่ที่หน้า Dashboard
2. ด้านซ้ายมีเมนู → คลิก **API keys** (หรือไปที่ **https://platform.openai.com/api-keys** โดยตรง)

### 0.4 สร้าง API key ใหม่
1. กดปุ่ม **Create new secret key** (หรือ **+ Create new secret key**)
2. ตั้งชื่อ (optional) เช่น `Clinic Bot` → กด **Create secret key**
3. จะโชว์ key แค่ครั้งเดียว (ขึ้นต้น `sk-...`) → กด **Copy** คัดลอก
4. เก็บไว้ใน Notepad หรือที่ปลอดภัย — **จะ copy อีกครั้งไม่ได้**
5. ใส่ค่านี้ในขั้นที่ 5 ในไฟล์ `.env.local` ที่บรรทัด `OPENAI_API_KEY=...`

---

## ขั้นที่ 1: เปิดเซิร์ฟเวอร์โปรเจกต์

1. ใน Cursor เปิด **Terminal** (เมนู **Terminal** → **New Terminal** หรือกด **Ctrl+`**)
2. ตรวจว่า path อยู่ที่โฟลเดอร์ `Clinic`  
   - ถ้าไม่ใช่ ให้พิมพ์: **`cd C:\Users\hartz\Clinic`** แล้วกด Enter
3. พิมพ์คำสั่ง: **`npm run dev`** แล้วกด Enter
4. รอจนเห็นข้อความประมาณ:
   - `▲ Next.js 15.x.x`
   - `- Local: http://localhost:3000` (หรือ `localhost:3001` ถ้า port 3000 ถูกใช้อยู่)
   - `✓ Ready in ...`
5. **จดหมายเลข port** ที่ใช้ (เช่น 3000 หรือ 3001) — ใช้ในขั้นที่ 2 ตอนรัน ngrok
6. **อย่าปิดหน้าต่าง Terminal นี้** — ปล่อยให้รันไว้ตลอดตอนทดสอบ

---

## ขั้นที่ 2: ใช้ ngrok (ให้ LINE เรียก Webhook ได้)

### 2.1 ติดตั้ง ngrok (ถ้ายังไม่มี)
1. เปิดเบราว์เซอร์ไปที่ **https://ngrok.com**
2. กด **Sign up** หรือ **Log in** (ใช้ Google/GitHub ได้)
3. หลังล็อกอิน → ไปที่ **Your Authtoken** (หรือ **Dashboard** → **Setup & Installation**)
4. คัดลอก **Authtoken** (ยาวๆ)
5. เปิด **Terminal ใหม่** ใน Cursor (Terminal → New Terminal — จะได้หน้าต่างที่ 2)
6. พิมพ์คำสั่งติดตั้ง (เลือกอย่างใดอย่างหนึ่ง):
   - ใช้ npm: **`npm install -g ngrok`**
   - หรือดาวน์โหลดจาก https://ngrok.com/download แล้วแตกไฟล์
7. ถ้าใช้ npm หลังติดตั้งเสร็จ ให้ลงทะเบียน token (รันครั้งเดียว):
   - **`ngrok config add-authtoken <วาง token ที่ copy ไว้>`**

### 2.2 รัน ngrok
1. ใน **Terminal หน้าต่างที่ 2** (ที่ยังไม่รันอะไร หรือรันแค่ authtoken แล้ว) พิมพ์:
   - **`ngrok http 3000`** (ถ้าในขั้นที่ 1 เซิร์ฟเวอร์ใช้ port 3000)
   - หรือ **`ngrok http 3001`** (ถ้าในขั้นที่ 1 ขึ้นว่าใช้ port 3001 แทน)
2. กด Enter
3. จะเห็นหน้าจอแบบข้อความ มีบรรทัดประมาณ:
   - **Forwarding** `https://xxxx-xx-xx-xx-xx.ngrok-free.app` **->** `http://localhost:3000`
4. **จดหรือ copy URL ด้านซ้าย** (ที่อยู่ก่อนลูกศร `->`)  
   ตัวอย่าง: `https://a1b2c3d4.ngrok-free.app`
5. **อย่าปิดหน้าต่าง ngrok** — ต้องเปิดไว้ตลอดตอนทดสอบ Bot

*(ถ้าผมรัน ngrok ให้ใน Terminal อีกหน้าต่าง คุณจะเห็น URL ใน output — ใช้ URL นั้นในขั้นที่ 6)*

---

## ขั้นที่ 3: สร้าง LINE Channel (Messaging API)

### 3.1 เปิด LINE Developers
1. เปิดเบราว์เซอร์ (แท็บใหม่ได้)
2. ไปที่ **https://developers.line.biz/console/**
3. กด **Log in with LINE** (หรือปุ่มล็อกอิน) → ล็อกอินด้วยบัญชี LINE ของคุณ

### 3.2 สร้าง Provider (ถ้าหน้าแรกมีปุ่ม Create provider)
1. ที่หน้า Console หลังล็อกอิน จะเห็นรายการ Provider
2. ถ้ายังไม่มี Provider → กด **Create a new provider**
3. ใส่ **Provider name** เช่น `Clinic Connect`
4. กด **Create**

### 3.3 สร้าง Channel แบบ Messaging API
1. เข้าไปใน Provider ที่สร้าง (คลิกชื่อ Provider)
2. กด **Create a new channel**
3. เลือก **Messaging API** → กด **Next**
4. กรอกฟอร์ม:
   - **Channel name**: เช่น `Clinic Bot` (ชื่อที่ผู้ใช้เห็น)
   - **Channel description**: เช่น `Bot สำหรับคลินิก ทดสอบ AI`
   - **Category**: เลือก เช่น **Health** หรือ **Other**
   - **Subcategory**: เลือกตามที่ dropdown ให้
   - **Email address**: อีเมลของคุณ (LINE ใช้ติดต่อ)
   - **Privacy policy URL**: ถ้ามีเว็บนโยบายส่วนตัวใส่ได้ ไม่มีใส่ `https://example.com` ชั่วคราวได้
   - **Terms of use URL**: เหมือนกัน ใส่ได้หรือ `https://example.com`
5. กด **Create** แล้วกด **Agree** กับข้อกำหนดถ้ามี popup

### 3.4 ไปที่แท็บ Messaging API
1. หลังสร้าง Channel จะเข้าไปที่หน้ารายละเอียด Channel
2. ด้านบนมีแท็บ เช่น **Basic settings**, **Messaging API** ฯลฯ
3. คลิกแท็บ **Messaging API**

---

## ขั้นที่ 4: จด Channel secret และสร้าง Channel access token

### 4.1 หา Channel secret
1. อยู่ที่แท็บ **Messaging API**
2. บางครั้ง Channel secret อยู่ที่แท็บ **Basic settings** — ถ้าไม่เห็นใน Messaging API ให้คลิก **Basic settings**
3. หา **Channel secret**
4. กด **Show** (หรือปุ่มลูกตา) → ค่าจะโผล่
5. กด **Copy** (หรือเลือกแล้ว Ctrl+C) → เก็บไว้ใน Notepad

### 4.2 สร้าง Channel access token (ระยะยาว)
1. กลับไปที่แท็บ **Messaging API**
2. เลื่อนลงหา **Channel access token (long-lived)**
3. กดปุ่ม **Issue** (หรือ **Generate**)
4. จะโชว์ token แค่ครั้งเดียว → กด **Copy** เก็บไว้ใน Notepad

---

## ขั้นที่ 5: ใส่ค่าใน .env.local

1. ใน Cursor เปิดไฟล์ **`.env.local`** ที่โฟลเดอร์ `C:\Users\hartz\Clinic` (ระดับเดียวกับ `package.json`)
2. หาบรรทัดที่เขียนว่า:
   - `LINE_CHANNEL_SECRET=...`
   - `LINE_CHANNEL_ACCESS_TOKEN=...`
   - `OPENAI_API_KEY=...`
3. **แทนที่ค่าด้านขวาของ =** ด้วยค่าจริง:
   - **LINE_CHANNEL_SECRET** = วางค่าที่ copy จากขั้นที่ 4.1 (ไม่ต้องมีช่องว่างหรือเครื่องหมายคำพูด)
   - **LINE_CHANNEL_ACCESS_TOKEN** = วางค่าที่ copy จากขั้นที่ 4.2
   - **OPENAI_API_KEY** = วางค่าที่ copy จากขั้นที่ 0.4 (ขึ้นต้น `sk-...`)
4. บันทึกไฟล์ (Ctrl+S)
5. **รีสตาร์ทเซิร์ฟเวอร์**: ไปที่ Terminal ที่รัน `npm run dev` → กด Ctrl+C เพื่อหยุด → พิมพ์ `npm run dev` อีกครั้ง → Enter

---

## ขั้นที่ 6: ตั้ง Webhook URL ใน LINE

1. เปิดเบราว์เซอร์กลับไปที่ **LINE Developers Console** → เลือก Provider → เลือก Channel ของคุณ
2. ไปที่แท็บ **Messaging API**
3. หา **Webhook URL**
4. กด **Edit**
5. ในช่อง URL ใส่:
   - **`https://<URL จาก ngrok>/api/webhooks/line`**
   - ตัวอย่าง: ถ้า ngrok แสดง `https://a1b2c3d4.ngrok-free.app` ให้ใส่  
     **`https://a1b2c3d4.ngrok-free.app/api/webhooks/line`**
   - ไม่มี `http://` อื่น ไม่มีเว้นวรรคท้าย
6. กด **Update**
7. เปิด **Use webhook** เป็น **Enabled** (สลับปุ่มให้เป็นเปิด)
8. ถ้ามีปุ่ม **Verify** กดได้ — ควรขึ้นว่าสำเร็จ (200)

---

## ขั้นที่ 7: ทดสอบส่งข้อความกับ AI

1. อยู่ที่ LINE Developers Console → Channel → แท็บ **Messaging API** (หรือ **Basic settings**)
2. หา **QR code** สำหรับให้ผู้ใช้เพิ่ม Bot เป็นเพื่อน (มักอยู่ส่วนบนของหน้า)
3. เปิดแอป **LINE** บนมือถือ (หรือ LINE บน PC)
4. สแกน QR code ด้วย LINE (ใน LINE: เมนู → Add friends → QR code)
5. เพิ่ม Bot เป็นเพื่อน (กด **Add** หรือ **เพิ่มเพื่อน**)
6. เข้าแชทกับ Bot แล้ว **ส่งข้อความ** เช่น `สวัสดี` หรือ `อยากทราบราคาบริการ`
7. รอ 2–5 วินาที — **Bot ควรตอบกลับ** ด้วยข้อความจาก AI (โทนผู้ช่วยคลินิก)

---

## ถ้า Bot ไม่ตอบ — เช็คตามนี้

- **ngrok ยังเปิดอยู่ไหม** — หน้าต่างที่รัน `ngrok http 3000` ต้องไม่ปิด
- **npm run dev ยังรันอยู่ไหม** — ต้องเห็น Ready ที่ localhost:3000
- **Webhook URL ถูกไหม** — ต้องลงท้าย `/api/webhooks/line` และใช้ URL จาก ngrok จริง
- **.env.local ครบและถูกไหม** — มี 3 บรรทัด LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, OPENAI_API_KEY และรีสตาร์ท dev แล้ว
- ดู **Terminal ที่รัน npm run dev** — มี error สีแดงไหม (LINE, OpenAI, signature ฯลฯ)

ถ้าทำครบทุกขั้นแล้ว Bot ยังไม่ตอบ ให้ copy ข้อความ error จาก Terminal มาให้ดู จะช่วยไล่ต่อให้ได้
