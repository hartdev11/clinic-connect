# คู่มือตั้งค่า Firebase (Firestore) — ทุกขั้นตอนแบบละเอียด

ทำตามลำดับจากขั้นที่ 1 ถึงขั้นสุดท้าย

---

## ขั้นที่ 1: สร้างโปรเจกต์ Firebase

1. เปิดเบราว์เซอร์ไปที่ **https://console.firebase.google.com**
2. ล็อกอินด้วยบัญชี Google (ถ้ายังไม่มีให้สมัครก่อน)
3. คลิก **「สร้างโปรเจกต์」** (หรือ "Add project" / "Create a project")
4. ตั้งชื่อโปรเจกต์ เช่น **`clinic-connect`** (หรือชื่ออื่นที่ต้องการ) แล้วคลิก **ถัดไป**
5. ถ้ามีตัวเลือก "Google Analytics" จะเปิดหรือปิดก็ได้ (สำหรับโปรเจกต์นี้ไม่จำเป็น) → คลิก **ถัดไป** แล้ว **สร้างโปรเจกต์**
6. รอสักครู่ แล้วคลิก **ดำเนินการต่อ** เมื่อสร้างเสร็จ

ตอนนี้คุณจะอยู่ที่หน้า Overview ของโปรเจกต์ Firebase แล้ว

---

## ขั้นที่ 2: เปิดใช้ Firestore Database

1. ในเมนูด้านซ้าย ให้คลิก **「Build」** (สร้าง)
2. คลิก **「Firestore Database」**
3. คลิกปุ่ม **「สร้างฐานข้อมูล」** (Create database)
4. เลือกโหมดความปลอดภัย:
   - **โหมดทดสอบ (Test mode)** — ใช้ได้ทันที แต่ใน 30 วันจะจำกัด (เหมาะสำหรับพัฒนา)
   - **โหมด production** — ต้องตั้งกฎความปลอดภัยก่อนถึงจะอ่าน/เขียนได้  
   → แนะนำให้เลือก **「เริ่มในโหมดทดสอบ」** ก่อน แล้วคลิก **ถัดไป**
5. เลือก **Location** สำหรับเก็บข้อมูล (เช่น `asia-southeast1` สำหรับ Singapore) แล้วคลิก **เปิดใช้งาน**
6. รอให้ Firestore ถูกสร้าง แล้วคุณจะเห็นหน้า Firestore Database (ตอนนี้ยังไม่มี collection — จะมีเมื่อแอปสมัคร/ล็อกอินครั้งแรก)

Firestore พร้อมใช้แล้ว

---

## ขั้นที่ 3: ดาวน์โหลด Service Account (สำหรับ Admin SDK)

โปรเจกต์ของเราใช้ **Firebase Admin SDK** ใน API (ฝั่งเซิร์ฟเวอร์) จึงต้องใช้ "Service Account" ไม่ใช่แค่ API Key ฝั่งเว็บ

1. คลิกไอคอน **ฟันเฟือง** ด้านซ้ายบน (ถัดจาก "Project Overview") → **「การตั้งค่าโปรเจกต์」** (Project settings)
2. ไปที่แท็บ **「บัญชีบริการ」** (Service accounts)
3. ด้านล่างจะมีข้อความว่า "Firebase Admin SDK" และปุ่ม **「สร้างคีย์ส่วนตัวใหม่」** (Generate new private key) → คลิก **「สร้างคีย์ส่วนตัวใหม่」**
4. ใน popup ให้คลิก **「สร้างคีย์」** (Generate key) — จะดาวน์โหลดไฟล์ JSON ลงเครื่อง (ชื่อประมาณ `clinic-connect-xxxxx-firebase-adminsdk-xxxxx.json`)
5. **เก็บไฟล์นี้ไว้ในที่ปลอดภัย** — อย่าเอาไป commit ลง Git หรือแชร์ให้คนอื่น (ไฟล์นี้มีสิทธิ์เทียบเท่า admin ของโปรเจกต์)

เราจะใช้ค่าจากไฟล์ JSON นี้ในขั้นถัดไป

---

## ขั้นที่ 4: วางไฟล์ JSON ในโปรเจกต์ (วิธีที่ 1 — แนะนำ)

วิธีที่ง่ายที่สุดคือให้โปรเจกต์อ่านไฟล์ JSON โดยตรง ไม่ต้อง copy ค่าไปใส่ใน .env

1. เปิดโฟลเดอร์โปรเจกต์ Clinic (ระดับเดียวกับ `package.json`)
2. **คัดลอก** ไฟล์ JSON ที่ดาวน์โหลดจาก Firebase (ขั้นที่ 3) มาวางในโฟลเดอร์นี้
3. **เปลี่ยนชื่อไฟล์** เป็น **`firebase-service-account.json`**  
   (ชื่อนี้ถูกใส่ใน .gitignore แล้ว จะไม่ถูก commit ขึ้น Git)
4. เปิดไฟล์ **`.env.local`** (ถ้ายังไม่มี ให้คัดลอกจาก `.env.local.example` แล้วเปลี่ยนชื่อเป็น `.env.local`)
5. ใส่แค่สองบรรทัดนี้ก่อน (ไม่ต้องใส่ FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY):

```env
SESSION_SECRET=ใส่ข้อความลับอย่างน้อย-32-ตัวอักษร
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
```

6. บันทึกไฟล์ แล้วข้ามไป **ขั้นที่ 7** (รันและทดสอบ)

ถ้าต้องการใช้วิธีใส่ค่าลง .env แทน ให้ทำ **ขั้นที่ 4B** ด้านล่าง

---

## ขั้นที่ 4B: (ทางเลือก) ใส่ค่า Firebase ลง .env.local โดยตรง

ถ้าไม่ใช้ไฟล์ JSON (ขั้นที่ 4) และอยากใส่ค่าสามตัวลง `.env.local`:

1. เปิดไฟล์ JSON ที่ดาวน์โหลดจาก Firebase
2. คัดลอกค่าสามตัว: **project_id**, **client_email**, **private_key**
3. สร้างหรือเปิดไฟล์ **`.env.local`** (คัดลอกจาก `.env.local.example` แล้วเปลี่ยนชื่อ)
4. ใส่ค่าดังนี้:

- **SESSION_SECRET** = ข้อความลับอย่างน้อย 32 ตัว (เช่น `my-super-secret-key-for-clinic-connect-2024`)
- **FIREBASE_PROJECT_ID** = ค่า `project_id` จาก JSON
- **FIREBASE_CLIENT_EMAIL** = ค่า `client_email` จาก JSON
- **FIREBASE_PRIVATE_KEY** = ค่า `private_key` จาก JSON ใส่ในเครื่องหมายคำพูด `"..."` และ**เก็บ \n ไว้** (ไม่กด Enter จริง)

ตัวอย่างหนึ่งบรรทัดของ private key:

```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...(ยาว)...\n-----END PRIVATE KEY-----\n"
```

บันทึกไฟล์ `.env.local`

---

## ขั้นที่ 6: ตรวจสอบว่า .env.local และไฟล์ JSON ไม่ถูก commit

1. เปิดไฟล์ **`.gitignore`**
2. ตรวจสอบว่ามีบรรทัด **`.env*.local`** และ **`firebase-service-account.json`** (มีอยู่แล้วในโปรเจกต์นี้)
3. แสดงว่า Git จะไม่เอา `.env.local` และไฟล์คีย์ Firebase ขึ้นไปที่ remote — ปลอดภัย

---

## ขั้นที่ 7: รันโปรเจกต์และทดสอบ

1. เปิด Terminal ในโฟลเดอร์โปรเจกต์ (ที่เดียวกับ `package.json`)
2. รันคำสั่ง:

```bash
npm run dev
```

3. รอจนขึ้นข้อความประมาณ `Local: http://localhost:3000`
4. เปิดเบราว์เซอร์ไปที่ **http://localhost:3000**  
   - ระบบจะพาไปที่ **/login** อัตโนมัติ

---

## ขั้นที่ 8: ทดสอบสมัครคลินิก (Register)

1. ที่หน้า Login คลิก **「สมัครคลินิก」**
2. กรอกฟอร์ม:
   - **License Key**: อย่างน้อย 8 ตัว (เช่น `TEST-KEY-001` หรือ `abcdefgh`)
   - **ชื่อคลินิก**: เช่น คลินิกความงาม สวยใส
   - **จำนวนสาขา**: 1
   - **เบอร์ติดต่อ**: (ไม่บังคับ)
   - **อีเมลเจ้าของ**: เช่น `owner@clinic.com`
   - **รหัสผ่าน**: อย่างน้อย 6 ตัว
3. คลิก **「สมัครคลินิก」**
4. ถ้าสำเร็จ จะถูกพาไปหน้า **Login**

ตรวจสอบใน Firebase Console:
- ไปที่ **Firestore Database**
- จะเห็น **collection ชื่อ `clinics`** และมี **document** หนึ่งรายการ (ข้อมูลคลินิกที่สมัคร)

---

## ขั้นที่ 9: ทดสอบเข้าสู่ระบบ (Login)

1. อยู่ที่หน้า Login
2. กรอก:
   - **License Key**: ตัวเดียวกับที่ใช้สมัคร (เช่น `TEST-KEY-001`)
   - **อีเมล**: ตัวเดียวกับที่สมัคร (เช่น `owner@clinic.com`)
   - **รหัสผ่าน**: รหัสที่ตั้งไว้
3. คลิก **「เข้าสู่ระบบ」**
4. ถ้าสำเร็จ จะถูกพาไปที่ **/clinic** (Dashboard)

---

## ขั้นที่ 10: ทดสอบ Guard (กันคนที่ยังไม่ล็อกอิน)

1. ออกจากระบบ: ที่เมนูด้านซ้ายของ Dashboard คลิก **「ออกจากระบบ」** → จะกลับไปหน้า Login
2. ในแถบที่อยู่ (address bar) พิมพ์ **http://localhost:3000/clinic** แล้วกด Enter
3. ระบบควร **พาคุณกลับไปที่ /login** ทันที (เพราะไม่มี session)
4. ล็อกอินอีกครั้ง แล้วเข้า /clinic ได้ตามปกติ

---

## สรุป Checklist

- [ ] ขั้นที่ 1: สร้างโปรเจกต์ Firebase
- [ ] ขั้นที่ 2: เปิดใช้ Firestore (โหมดทดสอบหรือ production)
- [ ] ขั้นที่ 3: สร้าง Service Account และดาวน์โหลดไฟล์ JSON
- [ ] ขั้นที่ 4: วางไฟล์ JSON ในโปรเจกต์ เปลี่ยนชื่อเป็น `firebase-service-account.json`
- [ ] ขั้นที่ 5: สร้าง `.env.local` ใส่ `SESSION_SECRET` และ `FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json`
- [ ] ขั้นที่ 6: ตรวจสอบ .gitignore
- [ ] ขั้นที่ 7: รัน `npm run dev`
- [ ] ขั้นที่ 8–10: ทดสอบ Register → Login → เข้า /clinic → ออกจากระบบ → พิมพ์ /clinic ต้องถูกส่งกลับไป /login

ถ้าขั้นไหนติดหรือ error ออกมา ให้จดข้อความ error และบอกขั้นที่อยู่ จะช่วยไล่ให้ละเอียดต่อได้

---

## (Phase 4.5) Deploy Firestore Indexes

เมื่อใช้ข้อมูลจริงใน Admin (Dashboard, Booking, Customers, Finance, Promotions) ต้องมี **Composite Index** ใน Firestore

1. โปรเจกต์มีไฟล์ **`firestore.indexes.json`** อยู่แล้ว (ระดับเดียวกับ `package.json`)
2. ติดตั้ง Firebase CLI: `npm install -g firebase-tools` แล้ว `firebase login`
3. ในโฟลเดอร์โปรเจกต์: `firebase init firestore` (เลือกใช้ไฟล์ `firestore.indexes.json` ที่มีอยู่)
4. Deploy indexes: **`firebase deploy --only firestore:indexes`**
5. รอให้ index สร้างเสร็จ (ใน Firebase Console → Firestore → Indexes จะเห็นสถานะ)

ถ้าไม่ deploy index แล้ว query ที่ใช้ `where` + `orderBy` หลาย field อาจ error — ระบบจะบอกว่าต้องสร้าง index ไหน และมีลิงก์ไปสร้างใน Console ได้
