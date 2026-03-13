# 📘 คู่มือการใช้งาน Clinic Connect — ทุกระบบครบ

คู่มือนี้สอนวิธีใช้เว็บ Clinic Connect ทุกระบบ สำหรับคลินิกความงามที่ใช้ระบบหลังบ้านและ AI แชทตอบลูกค้าทาง LINE

---

## สารบัญ

1. [เริ่มต้นใช้งาน](#1-เริ่มต้นใช้งาน)
2. [Dashboard](#2-dashboard)
3. [Customers & Chat](#3-customers--chat)
4. [Handoff](#4-handoff)
5. [Booking](#5-booking)
6. [Promotions](#6-promotions)
7. [Insights](#7-insights)
8. [Finance](#8-finance)
9. [ข้อมูลที่ AI ใช้ตอบลูกค้า (Knowledge)](#9-ข้อมูลที่-ai-ใช้ตอบลูกค้า-knowledge)
10. [ตั้งค่า (Settings)](#10-ตั้งค่า-settings)
11. [การตั้งค่าคิว (Slot Settings)](#11-การตั้งค่าคิว-slot-settings)
12. [User & Roles](#12-user--roles)
13. [Admin Monitoring](#13-admin-monitoring)
14. [Knowledge Health](#14-knowledge-health)
15. [Feedback](#15-feedback)
16. [AI Agents](#16-ai-agents)
17. [Knowledge Brain](#17-knowledge-brain)

---

## 1. เริ่มต้นใช้งาน

### 1.1 เข้าสู่ระบบ (Login)

1. เปิดเว็บ → ไปที่ **/login**
2. กรอก:
   - **License Key** — คีย์จากแพ็กเกจที่ซื้อ (หรือจากซัพพลายเออร์)
   - **อีเมล** — อีเมลของบัญชีคลินิก
   - **รหัสผ่าน**
3. กด **เข้าสู่ระบบ**
4. ถ้าสำเร็จ จะ redirect ไป **Dashboard** (`/clinic`)

### 1.2 สมัครสมาชิก (Register)

- ไปที่ **/register** → กรอกข้อมูลคลินิก, สาขา, อีเมล, รหัสผ่าน
- หลังสมัครแล้วใช้ **License Key** + อีเมล + รหัสผ่าน เพื่อ login

### 1.3 เมนูหลัก (Sidebar)

หลัง login จะเห็นเมนูด้านซ้าย แบ่งเป็นกลุ่ม:

| กลุ่ม | เมนู | สำหรับ |
|------|------|--------|
| ภาพรวม | Dashboard | ทุกคน |
| การดำเนินงาน | Customers & Chat, Handoff, Booking, Promotions | ทุกคน |
| ข้อมูล & AI | Insights, Finance, ข้อมูลที่ AI ใช้ | Finance: Owner/Manager |
| ตั้งค่า | Clinic Settings, การตั้งค่าคิว, User & Roles, Admin Monitoring, Knowledge Health | ตาม Role |

### 1.4 เลือกสาขา (Branch)

- ที่ **Topbar** ด้านบน มี dropdown เลือกสาขา
- Dashboard, Customers, Booking, Insights จะ filter ตามสาขาที่เลือก
- ถ้ามีแค่ 1 สาขา อาจไม่แสดง dropdown

---

## 2. Dashboard

**เส้นทาง:** `/clinic` หรือเมนู **Dashboard**

### ใช้ทำอะไร
- ดูภาพรวมธุรกิจแบบ real-time
- KPI: แชทวันนี้, ลูกค้าใหม่, การจองวันนี้/พรุ่งนี้, รายได้เดือนนี้
- AI Alerts: แจ้งเตือน (เช่น คิว handoff รอ, โปรโมชันหมดอายุ, Hot leads)
- แชตและรายได้ตามวัน (กราฟ)
- การจองล่าสุดตามวันที่
- Hot leads widget
- Revenue Impact, Branch Comparison (ถ้ามีหลายสาขา)

### วิธีใช้
1. เปิด Dashboard จะเห็น KPI cards, กราฟ และกิจกรรมล่าสุด
2. เลือกสาขาจาก dropdown ถ้าต้องการดูเฉพาะสาขา
3. ถ้ามี AI Alerts — อ่านข้อความแล้วกดลิงก์ไปหน้าที่เกี่ยวข้อง
4. กด **รีเฟรช** ถ้าต้องการดึงข้อมูลล่าสุด

---

## 3. Customers & Chat

**เส้นทาง:** `/clinic/customers`

### ใช้ทำอะไร
- รายชื่อลูกค้า (จาก LINE และช่องทางอื่น)
- คุยแชทกับลูกค้าได้จากหน้าหน้านี้
- ค้นหา, filter ตามสาขา/สถานะ
- ดู Lead score (Hot / Warm / Cold)

### วิธีใช้
1. เปิด **Customers & Chat**
2. ค้นหา: พิมพ์ชื่อหรือคำค้นในช่องค้นหา
3. Filter: เลือกสาขา, ช่องทาง (LINE/อื่นๆ), สถานะ
4. คลิกลูกค้า → ดูรายละเอียด + ประวัติแชท
5. ส่งข้อความ: พิมพ์ในช่องข้อความด้านล่าง แล้วกด **ส่ง**
   - ถ้าต่อ LINE อยู่ ข้อความจะถูกส่งไป LINE ของลูกค้า

---

## 4. Handoff

**เส้นทาง:** `/clinic/handoff`

### ใช้ทำอะไร
- รับคิวลูกค้าที่ AI ส่งต่อมา (human handoff)
- เหตุผล: ลูกค้าขอคนจริง, AI ไม่แน่ใจ, เรื่องแพทย์, ลูกค้าโกรธ ฯลฯ
- รายการที่รอจะแสดงแบบ real-time

### วิธีใช้
1. เปิด **Handoff** → เห็นรายการรอ (pending)
2. แต่ละรายการแสดง: ชื่อลูกค้า, เหตุผล, ข้อความที่ trigger
3. **กด "รับคิว"** → ระบบจะเปิดแชทให้คุยต่อ และหยุด AI ตอบอัตโนมัติ
4. คุยกับลูกค้าจาก **Customers & Chat** (เลือกลูกค้าที่รับคิว)
5. เมื่อจบ → กด **Resolve** ในหน้าประวัติ Handoff

### ประวัติ Handoff
- ไปที่ `/clinic/handoff/history` เพื่อดูรายการที่ resolve แล้ว

---

## 5. Booking

**เส้นทาง:** `/clinic/booking`

### ใช้ทำอะไร
- ดูคิววันนี้, ปฏิทินการจอง
- สร้าง/แก้ไข/ยกเลิกการจอง
- ดูรายงานการจอง (ยกเลิก, No-show, ตามแพทย์)

### วิธีใช้

#### คิววันนี้
- เลือกวันที่ → ดูรายการจองเรียงตามเวลา
- สถานะ: รอ / มาแล้ว / ยกเลิก / No-show

#### สร้างการจองใหม่
1. กด **+ สร้างการจอง**
2. เลือกลูกค้า (ค้นหาชื่อ)
3. เลือกบริการ, แพทย์, วันเวลา
4. กด **บันทึก**

#### แก้ไข/ยกเลิก
- คลิกการจอง → แก้ไขข้อมูลหรือกด **ยกเลิก**

#### รายงาน
- แท็บ Reports → ดูสถิติตามวัน, แพทย์, อัตรายกเลิก ฯลฯ

---

## 6. Promotions

**เส้นทาง:** `/clinic/promotions`

### ใช้ทำอะไร
- จัดการโปรโมชัน (เพิ่ม/แก้ไข/ลบ)
- อัปโหลดรูป, ตั้งวันหมดอายุ
- AI จะนำโปรโมชันไปตอบลูกค้าที่ถาม

### วิธีใช้
1. กด **+ เพิ่มโปรโมชัน**
2. กรอกชื่อ, รายละเอียด, ราคา, วันหมดอายุ
3. อัปโหลดรูป (ถ้ามี)
4. บันทึก
5. แก้ไข: คลิกโปรโมชัน → แก้ไข
6. ลบ: คลิกโปรโมชัน → ลบ

---

## 7. Insights

**เส้นทาง:** `/clinic/insights`

### ใช้ทำอะไร
- วิเคราะห์รายได้, แชท, การจอง
- กราฟรายได้ตามวัน/ตามบริการ
- การกระจาย Intent แชท, คำถามยอดนิยม
- Heatmap การจองตามชั่วโมง

### วิธีใช้
1. เลือกช่วงเวลา (7 วัน / 30 วัน / 90 วัน)
2. ดูแท็บ Revenue, Conversation, Operational
3. เลื่อนดูกราฟและตาราง

---

## 8. Finance

**เส้นทาง:** `/clinic/finance`  
**สิทธิ์:** Owner, Manager เท่านั้น

### ใช้ทำอะไร
- ดูรายได้, ใบแจ้งหนี้, การชำระเงิน
- Executive Brief (AI สรุปภาพรวมการเงิน)
- Refund, ยืนยันการชำระ

### วิธีใช้
1. เปิด **Finance**
2. ดูรายได้ตามช่วง, ตามบริการ/สาขา
3. ใบแจ้งหนี้: ดูสถานะ, ยืนยันการชำระ
4. Refund: คลิกใบแจ้งหนี้ → Refund (ถ้ามีสิทธิ์)

---

## 9. ข้อมูลที่ AI ใช้ตอบลูกค้า (Knowledge)

**เส้นทาง:** `/clinic/knowledge`

### ใช้ทำอะไร
- จัดการข้อมูลที่ AI ใช้ตอบลูกค้าทาง LINE
- **บริการ (Services):** บริการ + ราคา
- **FAQ:** คำถาม-คำตอบที่คลินิกตั้งเอง
- AI จะ search จากข้อมูลนี้เมื่อลูกค้าถาม

### วิธีใช้
1. เปิด **ข้อมูลที่ AI ใช้ตอบลูกค้า**
2. ดูสถานะ: ข้อมูลแพลตฟอร์ม, ข้อมูลคลินิก, โปรโมชัน

#### บริการ (Services)
- แก้ไขได้จากแต่ละรายการ
- ระบุ custom_title, ราคา (ถ้ามี)
- บริการจากแพลตฟอร์มจะแสดงเป็นฐาน แล้วปรับเพิ่มได้

#### FAQ
- กด **+ เพิ่ม FAQ** → กรอกคำถามและคำตอบ
- แก้ไข: คลิก FAQ → แก้ไข
- ลบ: คลิก FAQ → ลบ

#### Knowledge แบบ Topic (อีกชุด)
- ไปที่ **Knowledge** → **+ เพิ่ม Topic** (หรือจาก knowledge/new)
- กรอก Topic, Category, Key points, Content

---

## 10. ตั้งค่า (Settings)

**เส้นทาง:** `/clinic/settings`

### แท็บต่างๆ

#### ตั้งค่าทั่วไป (Organization)
- ชื่อคลินิก, ที่อยู่, โทร
- แก้ไขแล้วกด **บันทึก**

#### บิล (Billing) — Owner เท่านั้น
- แผนปัจจุบัน (Starter / Professional / Enterprise)
- อัปเกรดแผน → ไป Stripe Checkout
- Fair use: ดู % การใช้งานแชท

#### LINE
- ต่อ LINE Channel กับระบบ
- กรอก Channel ID, Channel Secret, Access Token (จาก LINE Developers Console)
- ดู docs/LINE-WEBHOOK-SETUP.md สำหรับวิธีตั้งค่า Webhook

#### AI Config
- ตั้งค่ารูปแบบการตอบของ AI
- Voice persona, Sales strategy
- แสดงช่วงราคา / ราคาแน่นอน / ต่อรอง
- การแสดงโปรโมชั่น
- Medical policy (อย.)

#### สาขา (Branches)
- เพิ่ม/แก้ไข/ลบสาขา
- Owner/Manager เท่านั้น

---

## 11. การตั้งค่าคิว (Slot Settings)

**เส้นทาง:** `/clinic/slot-settings`  
**สิทธิ์:** Owner, Manager

### ใช้ทำอะไร
- เวลาทำการของแต่ละสาขา
- ตารางแพทย์ (วัน/time slot)
- วันปิด (blackout dates)

### วิธีใช้
1. เลือกสาขา
2. **เวลาทำการ:** ตั้งวัน-เวลาเปิด-ปิด
3. **ตารางแพทย์:** เพิ่มแพทย์ + วันเวลาที่รับจอง
4. **วันปิด:** กำหนดวันที่ปิด เช่น วันหยุดเทศกาล

---

## 12. User & Roles

**เส้นทาง:** `/clinic/users`  
**สิทธิ์:** Owner, Manager

### ใช้ทำอะไร
- จัดการผู้ใช้ในคลินิก
- สิทธิ์: Owner / Manager / Staff

### วิธีใช้
1. ดูรายชื่อผู้ใช้
2. **เพิ่มผู้ใช้:** Invite ทางอีเมล (Magic link)
3. **แก้ Role:** เปลี่ยน Owner/Manager/Staff
4. **ลบ:** เอาผู้ใช้ออกจากระบบ (ถ้าอนุญาต)

---

## 13. Admin Monitoring

**เส้นทาง:** `/clinic/admin-monitoring`  
**สิทธิ์:** Owner เท่านั้น

### ใช้ทำอะไร
- ดูสถานะระบบ AI
- AI Cost Monitor (ค่าใช้จ่าย AI)
- Circuit Breaker (รีเซ็ตเมื่อ AI error)
- Safety & Compliance

### วิธีใช้
1. เปิด **Admin Monitoring**
2. ดู AI Cost, การใช้งาน
3. ถ้า AI error ต่อเนื่อง → รีเซ็ต Circuit Breaker ได้ (ตามปุ่มที่มี)

---

## 14. Knowledge Health

**เส้นทาง:** `/clinic/knowledge-health`  
**สิทธิ์:** Owner เท่านั้น

### ใช้ทำอะไร
- สุขภาพของ Knowledge Base
- ระบบเรียนรู้จาก Handoff (3-Source Learning)
- อนุมัติ/ปฏิเสธความรู้ที่ AI แนะนำ

### วิธีใช้
1. **Knowledge Health tab:** ดูคะแนนสุขภาพ, RAG quality, knowledge gaps
2. **การเรียนรู้ AI tab:**
   - **อนุมัติแล้ว:** ดูรายการที่อนุมัติแล้ว, กด [ดู], [ลบ] ถ้าผิด
   - **รอตรวจสอบ:** อนุมัติทีละรายการ หรือ Batch approve (score > 0.8)
   - **ถูกปฏิเสธ:** ดูเหตุผล, กด [ดูอีกครั้ง] เพื่อ re-evaluate
3. **ผลกระทบการเรียนรู้:** ดู Handoff rate ตามสัปดาห์, เป้าหมาย < 15%

---

## 15. Feedback

**เส้นทาง:** `/clinic/feedback`

### ใช้ทำอะไร
- ดูแชทที่ AI ตอบลูกค้า
- Mark ✓ ดี / ✗ แย่ (Golden Dataset)
- ใช้ปรับปรุง model

### วิธีใช้
1. ดูรายการแชท
2. คลิกแชท → อ่านคำถาม-คำตอบ
3. กด ✓ ถ้าตอบดี, ✗ ถ้าตอบแย่

---

## 16. AI Agents

**เส้นทาง:** `/clinic/ai-agents`

### ใช้ทำอะไร
- ดูสถานะ AI Agents (Knowledge, Booking, Promotion, Finance ฯลฯ)
- enabled/disabled

---

## 17. Knowledge Brain

**เส้นทาง:** `/clinic/knowledge-brain`

### ใช้ทำอะไร
- อนุมัติ/ปฏิเสธ knowledge ที่ AI แนะนำจาก handoff
- Reindex, Audit, Rollback
- ใช้ร่วมกับ Knowledge Health

---

## ลัดแป้นพิมพ์ (Keyboard)

| คีย์ | ฟังก์ชัน |
|-----|----------|
| **Escape** | ปิด Modal / Panel |
| **Enter** | ส่งฟอร์ม (ในฟอร์มส่วนใหญ่) |

---

## ติดต่อและเอกสารเพิ่มเติม

- **LINE Webhook:** ดู `docs/LINE-WEBHOOK-SETUP.md`
- **อีเมล (Resend):** ดู `docs/SETUP-EMAIL-RESEND.md`
- **โครงสร้างระบบ:** ดู `docs/PROJECT-MAP.md`, `docs/PROJECT-SUMMARY.md`
