# Firebase Client — Realtime Listeners สำหรับ Customers & Chat

เมื่อตั้งค่า Firebase Client แล้ว หน้า Customers & Chat จะใช้ **Firestore Realtime Listeners** แทน polling — อัปเดตทันทีเมื่อมีลูกค้า/แชทใหม่ โดยไม่ต้องดึงซ้ำทุก X วินาที

## ขั้นตอนตั้งค่า

### 1. เพิ่ม Web app ใน Firebase

1. ไปที่ [Firebase Console](https://console.firebase.google.com) → เลือกโปรเจกต์
2. คลิก **Project Settings** (ไอคอนฟันเฟือง)
3. ใน **Your apps** คลิก **Add app** → เลือก **Web** (</>)
4. ตั้งชื่อ (เช่น `clinic-web`) → Register
5. จะได้ `firebaseConfig` — คัดลอกค่าไปใส่ `.env.local`

### 2. ใส่ค่าใน `.env.local`

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...
```

### 3. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

Rules สำหรับ `customers` และ `conversation_feedback` ต้องใช้ `request.auth.token.org_id` (จาก custom token)

### 4. Restart dev server

```bash
npm run dev
```

## การทำงาน

- **มี Firebase config** → ใช้ Realtime Listeners (อัปเดตทันที)
- **ไม่มี Firebase config** → ใช้ Smart Polling (ทุก 5 วินาทีเมื่อ tab เปิดอยู่)

## Firestore Rules

`customers` และ `conversation_feedback` อนุญาต **read-only** เมื่อ `resource.data.org_id == request.auth.token.org_id` — client จะเห็นเฉพาะข้อมูลของ org ของตัวเอง
