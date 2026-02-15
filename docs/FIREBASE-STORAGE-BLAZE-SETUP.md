# คู่มืออัปเกรด Firebase เป็น Blaze และเปิดใช้ Storage

โปรเจกต์ clinic-connect ใช้ **Firebase Storage** สำหรับอัปโหลดรูปโปรโมชั่น ถ้ายังอยู่แผน **Spark (ฟรี)** จะใช้ Storage ไม่ได้ ต้องอัปเกรดเป็น **Blaze** ก่อน

---

## ขั้นที่ 1: เปิด Firebase Console

1. เปิดเบราว์เซอร์ไปที่ **https://console.firebase.google.com/**
2. ล็อกอินด้วย Google Account ที่เป็นเจ้าของโปรเจกต์
3. เลือกโปรเจกต์ **clinic-connect-dcbc4** (หรือชื่อโปรเจกต์ของคุณ)

---

## ขั้นที่ 2: ไปที่หน้าการเรียกเก็บเงิน (Billing)

1. คลิก **ไอคอนเฟือง ⚙️** มุมซ้ายล่าง (ข้าง "Project Overview")  
   → เปิด **Project settings**
2. ในแท็บ **General** เลื่อนลงไปหา **"Your plan"**  
   - ถ้าเขียนว่า **Spark** = แผนฟรี (ใช้ Storage ไม่ได้)  
   - ถ้าเขียนว่า **Blaze** = ข้ามไปขั้นที่ 4 ได้
3. คลิกเมนู **Usage and billing** ทางซ้าย (หรือลิงก์ **Manage** ข้าง Your plan)
4. มาที่หน้า **Usage and billing** จะเห็น:
   - **Current plan: Spark**
   - ปุ่ม **Upgrade** หรือ **Modify plan** หรือ **Upgrade to Blaze**

---

## ขั้นที่ 3: อัปเกรดเป็น Blaze

1. คลิก **Upgrade** / **Modify plan** / **Upgrade to Blaze**
2. ระบบจะพาไป **Google Cloud Console** หน้าเปิดใช้ Billing
3. **เลือกหรือสร้าง Billing account**
   - ถ้ามีบัญชีอยู่แล้ว: เลือกบัญชีนั้น
   - ถ้ายังไม่มี: กด **Create account** แล้วกรอก:
     - ประเทศ (Thailand ได้)
     - ชื่อ/ที่อยู่ (ตามบัตรหรือใบกำกับ)
     - หมายเลขบัตรเครดิต/เดบิต (ใช้ยืนยันตัวตน และเก็บเงินเมื่อเกิน free tier)
4. หลังสร้าง/เลือกบัญชีแล้ว จะกลับมาที่การผูกบัญชีกับโปรเจกต์ Firebase:
   - เลือก **Firebase project: clinic-connect-dcbc4**
   - กด **Set budget** หรือ **Continue**
5. (ถ้ามี) ตั้ง **Budget alert** (เช่น แจ้งเตือนเมื่อใช้ ฿500) เพื่อกันใช้เกินโดยไม่รู้ — **ไม่บังคับ** แต่แนะนำ
6. กด **Finish** / **Enable billing** จนเสร็จ

เสร็จแล้วโปรเจกต์จะอยู่แผน **Blaze** แล้ว

---

## ขั้นที่ 4: เปิดใช้ Storage และสร้าง bucket

1. กลับไป **Firebase Console**: https://console.firebase.google.com/
2. เลือกโปรเจกต์ **clinic-connect-dcbc4**
3. เมนูซ้าย → **Build** → **Storage**
4. ถ้าเห็นข้อความว่า *"To use Storage, upgrade your project's pricing plan"*:
   - รอสักครู่แล้ว refresh
   - หรือตรวจใน **Project settings → Usage and billing** ว่าแผนเป็น **Blaze** จริง
5. เมื่อ Storage พร้อมใช้ จะเห็นปุ่ม **Get started** → คลิก **Get started**
6. หน้า **Security rules**
   - เลือก **Start in production mode** (หรือ **test mode** ถ้าแค่ทดลอง)
   - Production = อ่าน/เขียนต้องผ่าน backend หรือ Auth
   - กด **Next**
7. หน้า **Choose location**
   - เลือก location ที่ใกล้ผู้ใช้ เช่น **asia-southeast1** (Singapore)
   - **ไม่สามารถย้ายที่อยู่ภายหลังได้** — เลือกให้ตรงกับ region ที่ต้องการ
   - กด **Done**
8. รอสักครู่ จะเห็นหน้า Storage พร้อม bucket แล้ว (รายการไฟล์ว่าง)

---

## ขั้นที่ 5: ตรวจสอบชื่อ bucket

1. ในหน้า **Storage** ด้านบนจะมีข้อความประมาณ:
   - **"Your storage bucket: clinic-connect-dcbc4.appspot.com"**  
   หรือ
   - **"clinic-connect-dcbc4.firebasestorage.app"**
2. เปิดไฟล์ **`.env.local`** ในโปรเจกต์ แล้วตั้งค่าให้ตรงกับชื่อ bucket ที่เห็น:

```env
FIREBASE_STORAGE_BUCKET=clinic-connect-dcbc4.appspot.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clinic-connect-dcbc4.appspot.com
```

ถ้าใน Console แสดงเป็น `*.firebasestorage.app` ให้ใช้รูปแบบนั้นแทน เช่น:

```env
FIREBASE_STORAGE_BUCKET=clinic-connect-dcbc4.firebasestorage.app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clinic-connect-dcbc4.firebasestorage.app
```

3. บันทึก `.env.local` แล้ว **restart dev server** (หยุดแล้วรัน `npm run dev` ใหม่)

---

## ขั้นที่ 6: ทดสอบอัปโหลด

1. รันแอป: `npm run dev`
2. ไปที่หน้า **Promotions**
3. กด **"+ Create Promotion from Image"**
4. อัปโหลดรูป → ควรเห็น "AI is analyzing..." แล้วสร้างโปรโมชั่นได้โดยไม่มี error bucket

---

## ค่าใช้จ่าย Blaze (โดยย่อ)

| รายการ        | Free quota (Blaze)      | เกินแล้วคิดเงินประมาณ   |
|---------------|-------------------------|--------------------------|
| Storage เก็บ  | 5 GB                    | ต่อ GB ต่อเดือน          |
| ดาวน์โหลด     | 1 GB/วัน (จาก North America) | ต่อ GB หลังเกิน          |
| อัปโหลด       | 20,000 ครั้ง/เดือน      | ต่อ 10,000 ครั้ง         |

ถ้าใช้แค่รูปโปรโมชั่นไม่มาก มักจะอยู่ใน free quota และไม่เสียเงิน  
แนะนำให้ตั้ง **Budget alert** ใน Google Cloud (เช่น ฿100–500) เพื่อรับแจ้งเตือนถ้ามีการใช้เกิน

---

## สรุปสั้นๆ

1. **Firebase Console** → โปรเจกต์ → **Project settings** → **Usage and billing**
2. **Upgrade** เป็น **Blaze** (ผูกบัตร/บัญชี billing)
3. **Build** → **Storage** → **Get started** → เลือก location → **Done**
4. ดูชื่อ bucket ในหน้า Storage → ใส่ใน `.env.local` ให้ตรง
5. Restart dev server แล้วทดสอบอัปโหลดรูปโปรโมชั่น

ถ้าติดขั้นตอนไหน บอกได้ว่าค้างที่ขั้นที่เท่าไหร่ จะช่วยไล่ต่อให้ละเอียดได้อีกครับ
