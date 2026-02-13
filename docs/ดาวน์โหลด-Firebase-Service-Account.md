# วิธีดาวน์โหลดไฟล์ Service Account ที่ถูกต้อง (แก้ error Private Key)

Error **"Unparsed DER bytes remain"** มักเกิดจาก private key ในไฟล์ไม่ตรงกับที่ Firebase ออกให้  
ต้องใช้ **ไฟล์ .json ที่ดาวน์โหลดจาก Firebase โดยตรง** (ไม่ copy วาง ไม่แก้ไข key เอง)

---

## ขั้นตอน (ทำตามทีละขั้น)

### 1. เปิด Firebase Console
- ไปที่ **https://console.firebase.google.com**
- เลือกโปรเจกต์ **clinic-connect-dcbc4**

### 2. เปิด Project settings
- คลิกไอคอน **⚙️ (ฟันเฟือง)** ด้านซ้ายบน ถัดจาก "Project Overview"
- เลือก **Project settings** (การตั้งค่าโปรเจกต์)

### 3. ไปแท็บ Service accounts
- คลิกแท็บ **Service accounts** (บัญชีบริการ)
- เลื่อนลงจนเห็นส่วน **Firebase Admin SDK**
- จะมีปุ่ม **Generate new private key** (สร้างคีย์ส่วนตัวใหม่)  
  → คลิกปุ่มนี้

### 4. ดาวน์โหลดไฟล์
- จะมี popup ขึ้น → คลิก **Generate key**
- จะมีไฟล์ **หนึ่งไฟล์** ดาวน์โหลดลงเครื่อง  
  ชื่อประมาณ: **`clinic-connect-dcbc4-firebase-adminsdk-xxxxx-xxxxxxxxxx.json`**
- **สำคัญ:** ต้องเป็นไฟล์ **.json** เท่านั้น  
  ถ้าเป็น .zip แสดงว่าคลิกผิดหรือเบราว์เซอร์บีบอัดไฟล์ — ลองดาวน์โหลดใหม่หรือเปิดโฟลเดอร์ Downloads ดูว่ามีไฟล์ .json หรือไม่

### 5. ตรวจสอบว่าเป็นไฟล์ JSON จริง
- เปิดไฟล์ที่ดาวน์โหลดด้วย **Notepad** หรือ **VS Code**
- ต้องเห็นเป็น **ข้อความอ่านได้** ขึ้นต้นประมาณนี้:
  ```json
  {"type":"service_account","project_id":"clinic-connect-dcbc4",...
  ```
- ถ้าเปิดแล้วเป็นตัวอักษรแปลกๆ / binary (เช่น ขึ้นต้นด้วย PK หรือไม่ใช่ข้อความ) แสดงว่าเป็นไฟล์ผิด — ต้องดาวน์โหลดใหม่อีกครั้ง

### 6. วางไฟล์ในโปรเจกต์
- เปิดโฟลเดอร์ **`C:\Users\hartz\Clinic`** (ระดับเดียวกับ `package.json`)
- **ลบ** ไฟล์ **`firebase-service-account.json`** เดิม (ถ้ามี)
- **เปลี่ยนชื่อ** ไฟล์ที่ดาวน์โหลดมาเป็น **`firebase-service-account.json`**  
  (ชื่อต้องตรงนี้เท่านั้น)
- **ย้ายหรือ copy** ไฟล์นี้ลงในโฟลเดอร์ `C:\Users\hartz\Clinic`

### 7. รีสตาร์ทแล้วลองสมัคร
- หยุด `npm run dev` แล้วรันใหม่
- เปิดหน้า Register แล้วลองสมัครอีกครั้ง

---

## สรุป

- ใช้ **เฉพาะไฟล์ .json ที่ดาวน์โหลดจาก Firebase** (Generate new private key)
- **ไม่** ใช้ไฟล์ .zip หรือไฟล์อื่น
- เปิดด้วย Notepad/VS Code ต้องเห็นข้อความ JSON อ่านได้
- เปลี่ยนชื่อเป็น **`firebase-service-account.json`** แล้ววางในโฟลเดอร์ **`C:\Users\hartz\Clinic`**
