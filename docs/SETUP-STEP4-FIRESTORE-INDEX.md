# ขั้นตอนที่ 4: Firestore Composite Index (knowledge_documents)

Index นี้ใช้สำหรับ **Knowledge Analytics Agent** ใน 7-Agent System — query `org_id` + `is_active`

---

## วิธีที่ 1: Deploy ผ่าน Firebase CLI (แนะนำ)

1. ติดตั้ง Firebase CLI (ถ้ายังไม่มี):
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. ในโฟลเดอร์โปรเจกต์ (ที่เดียวกับ `package.json`):
   ```bash
   firebase deploy --only firestore:indexes
   ```

4. รอสักครู่ (2–5 นาที) — Firebase จะสร้าง index ให้

5. ตรวจสอบ: Firebase Console → Firestore → Indexes → ควรเห็น `knowledge_documents` (org_id, is_active) สถานะ **Enabled**

---

## วิธีที่ 2: สร้างใน Console (ถ้า deploy ไม่ได้)

1. ไปที่ **https://console.firebase.google.com** → เลือกโปรเจกต์
2. Firestore Database → แท็บ **Indexes**
3. คลิก **สร้าง index** (Create index)
4. ตั้งค่า:
   - Collection: `knowledge_documents`
   - Field 1: `org_id` (Ascending)
   - Field 2: `is_active` (Ascending)
5. คลิก **สร้าง**

---

## เมื่อไหร่ต้องทำ

- ทำตอนมี **org_id** ใน Firestore แล้ว และเริ่มใช้ **7-Agent Chat** หรือหน้า **Knowledge**
- ถ้ายังไม่มี knowledge_documents หรือยังไม่เรียก API ที่ query นี้ → อาจยังไม่ error
- ถ้า error ขึ้นว่า "The query requires an index" → Firebase จะให้ลิงก์สร้าง index ใน Console โดยตรง

---

## หมายเหตุ

Index `org_id` + `is_active` ถูกเพิ่มใน `firestore.indexes.json` แล้ว  
เมื่อรัน `firebase deploy --only firestore:indexes` จะ deploy index นี้พร้อมกับ index อื่น ๆ
