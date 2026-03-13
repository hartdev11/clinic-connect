# Phase 7 — Human Handoff: สรุปการตั้งค่า

## ✅ สิ่งที่เตรียมไว้แล้วในโค้ด

| รายการ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| Firestore indexes | อยู่ใน `firestore.indexes.json` | `status` + `createdAt` (ASC/DESC) |
| Firestore rules | อยู่ใน `firestore.rules` | `handoff_sessions`, `notifications` |
| Worker script | `npm run worker:handoff-reminder` | เพิ่มใน `package.json` แล้ว |

## 📋 คำสั่งที่คุณต้องรันเอง (ครั้งเดียว)

### 1. Deploy Firestore (indexes + rules)
```bash
firebase deploy --only firestore
```

### 2. ใส่ REDIS_URL ใน .env.local (ถ้าใช้ reminders)
```env
REDIS_URL=redis://localhost:6379
```
หรือ Redis Cloud / Upstash สำหรับ production

### 3. รัน Handoff Reminder Worker (แยก process)
```bash
npm run worker:handoff-reminder
```
รันคู่กับ Next.js (หรือใช้ PM2 / systemd ใน production)

### 4. LINE Messaging API
- ต้องมี Channel Access Token ของคลินิก
- ตั้งค่าตาม `docs/LINE-WEBHOOK-SETUP.md`

---

ไม่มีขั้นตอนอื่นที่ต้องทำเองนอกจากนี้
