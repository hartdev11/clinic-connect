# รายงานตรวจสอบระดับ Enterprise — หน้า Promotions

**วันที่ตรวจ:** ก.พ. 2569  
**ขอบเขต:** Promotions Page, API, Data Layer, AI Integration  
**อัปเดต:** เพิ่ม checklist ตาม ENTERPRISE-STANDARD (UX) และแก้จุดที่ขาด

---

## ENTERPRISE-STANDARD (UX) — หน้า Promotion

| ข้อกำหนด | สถานะ | หมายเหตุ |
|----------|--------|----------|
| Loading states | ✅ | Skeleton ตอนโหลด stats/list; spinner ใน modal analyzing และ form upload; "กำลังโหลดสาขา..." ใน form/modal |
| Empty states | ✅ | "ยังไม่มีโปรโมชั่น", "ไม่พบโปรโมชั่นที่ตรงกับคำค้น", "ยังไม่มีสาขา" |
| Error handling | ✅ | List/Stats: error + ปุ่ม "ลองใหม่"; แถว: inline error + ปุ่มปิด; Form/Modal: กล่อง error + ปุ่ม "ลองอีกครั้ง" |
| ปุ่ม Refresh | ✅ | ปุ่ม "โหลดใหม่" ในส่วนรายการ |
| Keyboard | ✅ | Escape ปิด modal; Enter ส่ง form |
| Pagination | ✅ | ปุ่ม "โหลดเพิ่ม" เมื่อมี 50 รายการ (limit 50→100) |
| Filter/Search | ✅ | Filter: สถานะ, สาขา, กลุ่มเป้าหมาย; Search: ค้นชื่อโปรโมชั่น (client-side) |
| Fallback / Type safety | ✅ | Fallback ชื่อสาขา/ไม่มีรูป/ชื่อโปรโมชั่น; TypeScript ครบ |

---

## สรุปผลการประเมิน

| หมวด | ระดับ | หมายเหตุ |
|------|-------|----------|
| ภาพรวม | **Pro+** | ใกล้เคียง Enterprise แต่ยังมีจุดที่ควรปรับ |
| UI/UX | ✅ Enterprise | Overview, filters, error+retry, Escape, โหลดใหม่ |
| Security | ⚠️ Pro | RBAC ครบ แต่ยังไม่มี rate limit / audit log |
| AI Integration | ✅ Enterprise | Scan image, semantic search, embedding |
| Data & API | ✅ Enterprise | Multi-branch, lifecycle, CRUD ครบ |
| Scalability | ⚠️ Pro | ยังไม่มี cache, pagination จำกัด |

---

## ✅ ส่วนที่อยู่ในระดับ Enterprise แล้ว

### 1. UI/UX
- **Promotion Overview** — 4 เมตริก (active, expiringSoon, scheduled, expired)
- **AI-first creation** — อัปโหลดรูป → AI วิเคราะห์ → แก้ไข preview → บันทึก
- **Create manually** — ฟอร์มสร้างแบบปกติ
- **Filters** — สถานะ, สาขา, กลุ่มเป้าหมาย
- **รายการโปรโมชั่น** — thumbnail, procedures, ราคา, วันหมดอายุ, การใช้งาน
- **ปุ่มแก้ไข / เก็บถาวร / ลบ**
- **Error + Retry** — โหลด list ไม่สำเร็จแสดงข้อความ + ปุ่ม "ลองใหม่"; ลบ/เก็บถาวรผิดพลาดแสดง inline error + ปุ่มปิด
- **ปุ่มโหลดใหม่** — รีเฟรชรายการและ stats
- **Keyboard** — Escape ปิด modal สร้างจากรูป, Enter ส่ง form

### 2. AI Integration
- **Scan Image** — Vision API วิเคราะห์รูปโปรโมชั่น ดึง procedures, price, benefits, keywords
- **AI Summary** — สร้าง aiSummary + aiTags อัตโนมัติ
- **Semantic Search** — Embedding + cosine similarity ค้นหาตามความหมาย ("โปรจมูก", "ฟิลเลอร์")
- **Promotion Agent** — ให้ AI แนะนำโปรที่เกี่ยวข้องกับคำถามลูกค้า
- **visibleToAI** — ควบคุมว่าโปรนี้จะให้ AI แนะนำหรือไม่

### 3. Data & Lifecycle
- **Status** — draft, scheduled, active, expired, archived
- **Lifecycle Cron** — scheduled→active, active→expired, autoArchiveAt
- **Multi-branch** — branchIds รองรับหลายสาขา
- **Target Group** — new, existing, all
- **Usage limit** — maxUsage, currentUsage

### 4. Security
- **RBAC** — requireBranchAccess ทุก endpoint
- **Org isolation** — กรองตาม org_id
- **Auth** — Session + getEffectiveUser

### 5. API Design
- **GET** — list, stats, get by id
- **POST** — create
- **PATCH** — update (allowlist field)
- **DELETE** — ลบ + ลบ media
- **Sub-routes** — upload-temp, scan-image, from-scan, [id]/media, [id]/cover

---

## ⚠️ ส่วนที่ยังไม่ถึงระดับ Enterprise

### 1. Rate Limiting & Caching
- **ยังไม่มี** rate limit บน API promotions
- **ยังไม่มี** cache สำหรับ list/stats (เหมือน calendar ที่มี Cache-Control)
- **แนะนำ:** เพิ่ม rate limit สำหรับ scan-image, upload (ป้องกัน abuse)

### 2. Role-based Create/Edit
- ตอนนี้ **staff** สร้าง/แก้ไข/ลบได้ ถ้ามี branch access
- **Enterprise มักกำหนด:** เฉพาะ owner/manager สร้างโปรโมชั่นได้
- **แนะนำ:** ใช้ requireRole สำหรับ POST/PATCH/DELETE

### 3. Audit Log
- **ยังไม่มี** audit log สำหรับการสร้าง/แก้ไข/ลบโปรโมชั่น
- **Enterprise ต้องการ:** ใคร ทำอะไร เมื่อไหร่

### 4. Pagination
- ใช้ limit สูงสุด 50–100
- **ยังไม่มี** cursor-based pagination สำหรับรายการเยอะมาก
- **แนะนำ:** รองรับ startAfter สำหรับ scroll infinite

### 5. Error Handling
- ยังไม่มี error code แบบ structured (เช่น `PROMOTION_NOT_FOUND`, `RATE_LIMITED`)
- response เป็น `{ error: string }` เท่านั้น

### 6. Validation
- **ชื่อ** — ตรวจแค่มีหรือไม่ ยังไม่ limit ความยาว / ตัวอักษรต้องห้าม
- **media** — ยังไม่ validate ขนาดไฟล์/ประเภทอย่างเข้มงวด
- **วันเริ่ม-วันสิ้นสุด** — ยังไม่ตรวจว่า endAt > startAt

### 7. Cover API Security
- `/api/clinic/promotions/[id]/cover` — ตรวจ branch access แล้ว แต่ถ้า promotion เป็นหลายสาขา ใช้ branchIds[0] อาจไม่ครอบคลุมทุกเคส

---

## แนวทางปรับขึ้นระดับ Enterprise

### สิ่งที่ควรทำ (Quick Wins)
1. เพิ่ม **Cache-Control** สำหรับ GET list/stats (เช่น 30 วินาที)
2. เพิ่ม **requireRole** สำหรับ POST/PATCH/DELETE — จำกัดเฉพาะ owner, manager
3. ตรวจ **endAt > startAt** ใน POST/PATCH

### สิ่งที่ควรพิจารณา (Medium)
4. เพิ่ม **rate limit** สำหรับ scan-image, upload-temp
5. เพิ่ม **audit log** สำหรับการสร้าง/แก้ไข/ลบโปรโมชั่น
6. เพิ่ม **error code** ใน response

### สิ่งที่ทำได้ภายหลัง (Future)
7. Cursor-based **pagination** สำหรับรายการมาก
8. Validation **media** (ขนาด, ประเภท)
9. **Promotion analytics** — จำนวนครั้งที่ AI แนะนำ, conversion rate (ถ้ามีข้อมูล)

---

## สรุปท้าย

ระบบ Promotions อยู่ในระดับ **Pro+ ถึงใกล้ Enterprise** มีฟีเจอร์หลักครบ โดยเฉพาะ AI scan, semantic search, และ lifecycle อัตโนมัติ

เพื่อให้อยู่ในระดับ Enterprise เต็มรูปแบบ ควรเติม:
- Rate limit + cache
- Role restriction สำหรับ create/edit/delete
- Audit log
- Validation และ error codes ที่ชัดเจนขึ้น
