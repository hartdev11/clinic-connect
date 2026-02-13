# ขั้นตอนที่ 1: Firebase + Firestore (ทำก่อนทุกอย่าง)

---

## A. ถ้ายังไม่มีโปรเจกต์ Firebase

### 1. สร้างโปรเจกต์
1. ไปที่ **https://console.firebase.google.com**
2. คลิก **「สร้างโปรเจกต์」**
3. ตั้งชื่อ เช่น `clinic-connect` → ถัดไป → สร้างโปรเจกต์

### 2. เปิด Firestore
1. เมนูซ้าย → **Build** → **Firestore Database**
2. **สร้างฐานข้อมูล** → เลือก **โหมดทดสอบ** ก่อน → เลือก Location (เช่น asia-southeast1) → เปิดใช้งาน

---

## B. ดาวน์โหลด Service Account

1. คลิกไอคอน **ฟันเฟือง** (Project settings)
2. แท็บ **บัญชีบริการ** (Service accounts)
3. คลิก **「สร้างคีย์ส่วนตัวใหม่」** (Generate new private key) → **สร้างคีย์**
4. จะได้ไฟล์ JSON ดาวน์โหลดมา

---

## C. ตั้งค่าในโปรเจกต์ Clinic

1. **คัดลอก** ไฟล์ JSON ที่ดาวน์โหลดมา ไปไว้โฟลเดอร์โปรเจกต์ (ระดับเดียวกับ `package.json`)
2. **เปลี่ยนชื่อ** เป็น **`firebase-service-account.json`**
3. เปิดไฟล์ **`.env.local`**  
   - ถ้ายังไม่มี: คัดลอกจาก `.env.local.example` แล้วเปลี่ยนชื่อเป็น `.env.local`
4. ใส่บรรทัดนี้:

```
SESSION_SECRET=ใส่ข้อความลับอย่างน้อย-32-ตัวอักษร
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
```

5. บันทึก

---

## D. ตรวจสอบ

1. ตรวจว่า `.gitignore` มี `firebase-service-account.json` และ `.env*.local` (มีอยู่แล้ว)
2. รัน `npm run dev`
3. เปิด http://localhost:3000 → ควรไปหน้า /login
4. คลิก **สมัครคลินิก** → กรอกฟอร์ม → สมัคร
5. ไปที่ Firebase Console → Firestore → ควรเห็น collection `organizations` (หรือ `clinics` ตาม migration)

ถ้าทำครบ = ขั้นที่ 1 เสร็จ
