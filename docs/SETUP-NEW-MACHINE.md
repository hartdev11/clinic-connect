# การติดตั้งบนเครื่องใหม่ — Clinic Connect

คู่มือติดตั้งโปรเจกต์ Clinic Connect บนเครื่องคอมพิวเตอร์เครื่องใหม่

---

## 1. สิ่งที่ต้องติดตั้งบนเครื่องใหม่

### 1.1 Node.js (จำเป็น)
- ดาวน์โหลด: https://nodejs.org/ (แนะนำ LTS เช่น v20 หรือ v22)
- ติดตั้งเสร็จแล้ว เปิด Terminal/PowerShell แล้วเช็ค:
  ```bash
  node -v    # ควรเห็นเช่น v20.x.x
  npm -v     # ควรเห็นเช่น 10.x.x
  ```

### 1.2 Git (จำเป็น ถ้าจะ clone จาก repo)
- ดาวน์โหลด: https://git-scm.com/
- เช็คหลังติดตั้ง:
  ```bash
  git --version
  ```

### 1.3 สิ่งที่ต้องเตรียม (ไม่ต้องติดตั้ง แต่ต้องมี)
- **ไฟล์ `.env.local`** — คัดลอกจากเครื่องเก่า (หรือสร้างจาก `.env.local.example`)
- **ไฟล์ `firebase-service-account.json`** — ถ้าใช้วิธี path ไปยังไฟล์ (ดาวน์โหลดจาก Firebase Console)
- **API Keys ต่างๆ** — LINE, OpenAI, Stripe ฯลฯ ตามที่ใช้อยู่

---

## 2. ขั้นตอนย้ายโปรเจกต์ไปเครื่องใหม่

### วิธีที่ 1: ใช้ Git (แนะนำ ถ้ามี repo)
```bash
git clone <url-repo-your-clinic>
cd Clinic
npm install
```

### วิธีที่ 2: คัดลอกโฟลเดอร์
1. คัดลอกโฟลเดอร์โปรเจกต์ทั้งหมด (เช่น `Clinic`) ไปเครื่องใหม่ (USB, ฝากไฟล์, ส่งผ่านเน็ต)
2. **สำคัญ:** ไม่ต้องคัดลอกโฟลเดอร์ `node_modules` และ `.next` (ลบออกได้ จะให้ `npm install` สร้างใหม่)
3. เปิด Terminal แล้วไปที่โฟลเดอร์โปรเจกต์:
   ```bash
   cd C:\path\to\Clinic
   npm install
   ```

---

## 3. ตั้งค่า Keys และ Environment

### 3.1 ไฟล์ `.env.local` (จำเป็น)

ไฟล์นี้เก็บ API keys และค่า config — **ต้องมี** จึงจะรันได้

**วิธีที่ 1:** คัดลอกจากเครื่องเก่า (ง่ายสุด)
```
 copy .env.local ไปวางที่ root โฟลเดอร์โปรเจกต์
```

**วิธีที่ 2:** สร้างใหม่จาก template แล้วใส่ค่าจริง
```bash
copy .env.local.example .env.local
```
จากนั้นแก้ไข `.env.local` — ตัวแปรที่ต้องใส่อย่างน้อย:

| ตัวแปร | ที่มา | หมายเหตุ |
|--------|-------|----------|
| `SESSION_SECRET` | สร้างเอง (อย่างน้อย 32 ตัวอักษร) | สำหรับ JWT session |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ใส่ path เช่น `firebase-service-account.json` | ถ้าใช้วิธีไฟล์ |
| `FIREBASE_PROJECT_ID` | Firebase Console | ถ้าไม่ใช้ path ไปยังไฟล์ |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Service Account | ถ้าไม่ใช้ path |
| `FIREBASE_PRIVATE_KEY` | Firebase Console → Service Account | ถ้าไม่ใช้ path |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | สำหรับ AI Chat |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | ทางเลือกแทน OpenAI |
| `LINE_CHANNEL_SECRET` | LINE Developers Console | ถ้าใช้ LINE |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | ถ้าใช้ LINE |
| `NEXT_PUBLIC_APP_URL` | โดเมนเว็บ เช่น `http://localhost:3000` | สำหรับ Webhook URL |

รายละเอียดเต็ม: ดู `.env.local.example` และ `docs/FIREBASE-SETUP.md`

### 3.2 ไฟล์ `firebase-service-account.json` (จำเป็น ถ้าใช้ Firebase ด้วยไฟล์)

- **ที่มา:** Firebase Console → Project Settings → Service accounts → Generate new private key
- **วิธีได้:** ดาวน์โหลดไฟล์ JSON แล้วเปลี่ยนชื่อเป็น `firebase-service-account.json`
- **วางไว้ที่:** root โฟลเดอร์โปรเจกต์ (เดียวกับ `package.json`)
- **หรือ:** คัดลอกจากเครื่องเก่าที่มีอยู่แล้ว

⚠️ ไฟล์นี้เป็นความลับ — อย่าอัปโหลดขึ้น GitHub

---

## 4. รันโปรเจกต์

### โหมดพัฒนาการ (Development)
```bash
npm run dev
```
- เปิด browser: http://localhost:3000

### โหมด Production (หลัง build แล้ว)
```bash
npm run build
npm start
```

---

## 5. เช็คลิสต์ก่อนใช้งาน

- [ ] Node.js ติดตั้งแล้ว (`node -v`, `npm -v`)
- [ ] โปรเจกต์อยู่ในเครื่อง (`cd` ไปโฟลเดอร์ได้)
- [ ] `npm install` รันเสร็จ (มีโฟลเดอร์ `node_modules`)
- [ ] มีไฟล์ `.env.local` พร้อมใส่ค่า SESSION_SECRET, Firebase, OPENAI_API_KEY (หรือ GEMINI_API_KEY)
- [ ] มีไฟล์ `firebase-service-account.json` วางที่ root (ถ้าใช้วิธี path)
- [ ] `npm run build` ผ่าน (ไม่มี error)

---

## 6. ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|-------|--------|
| `npm install` error | ลบโฟลเดอร์ `node_modules` แล้วรันใหม่ หรือลอง `npm cache clean --force` |
| `.env.local` หาย | คัดลอกจากเครื่องเก่า หรือสร้างจาก `.env.local.example` |
| Firebase error | ตรวจว่าไฟล์ service account อยู่ถูก path และ project ID ตรง |
| `npm run build` error | ดู error message ในเทอร์มินัล ส่วนใหญ่เป็น type/import — แก้ตามที่แจ้ง |
| พอร์ต 3000 ถูกใช้ | ปิดโปรแกรมที่ใช้พอร์ต หรือรัน `npm run dev -- -p 3001` |

---

## 7. ไฟล์/โฟลเดอร์ที่ควรคัดลอกจากเครื่องเก่า

| รายการ | จำเป็น | หมายเหตุ |
|--------|--------|----------|
| โฟลเดอร์ `src` | ใช่ | โค้ดหลัก |
| `package.json` | ใช่ | รายการ dependencies |
| `.env.local` | ใช่ | ค่า config (เป็นความลับ — อย่าส่งทางที่ไม่ปลอดภัย) |
| `firebase-service-account.json` | ใช่ (ถ้าใช้) | Service Account จาก Firebase |
| `firestore.indexes.json` | ใช่ | Index สำหรับ Firestore |
| `node_modules` | ไม่ | ให้รัน `npm install` สร้างใหม่ |
| `.next` | ไม่ | build cache — ให้ `npm run build` สร้างใหม่ |
| `.env` | ขึ้นอยู่กับ | ถ้ามีและใช้อยู่ ก็ควรคัดลอก |

---

## 8. ลิงก์เอกสารเพิ่มเติม

- Firebase: `docs/FIREBASE-SETUP.md`
- LINE Webhook: `docs/LINE-WEBHOOK-SETUP.md`
