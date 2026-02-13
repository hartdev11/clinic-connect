# Flow & Requirements — ระบบหลังบ้านคลินิก (Key + Login)

## สรุปความต้องการ
- **ไม่มีหน้าเว็บขายลูกค้า** — เปิดเว็บแล้วเข้าหน้า Login เลย
- **Login ต้องมี Key** — คลินิกซื้อแพ็กเกจได้คีย์ → กรอกคีย์ + เข้าสู่ระบบ ถ้าไม่มีคีย์ทำอะไรไม่ได้
- **Register เฉพาะคลินิก** — ไม่มี role ลูกค้า ขายให้ฝั่งคลินิกเท่านั้น (ระบบหลังบ้าน)
- **หลัง Login** → ไปที่ Dashboard เลย
- **Dashboard ละเอียด** — มีหัวข้อแบ่งย่อยชัดเจน แต่ละอันอธิบายว่า "คืออะไร เอาไว้ดูอะไร"
- **AI วิเคราะห์ข้อมูล** → ส่งกลับไป LINE ของคลินิก **ไม่ส่งข้อมูลวิเคราะห์/สถิติหาลูกค้าเด็ดขาด**
- **ข้อมูลที่ส่งให้ลูกค้าได้** — แชท, โปรโมชัน, นัดก่อนทำ, จองคิว (ไม่พูดเจาะลึกการแพทย์)
- **AI ทำงาน 6 Agents** — ใช้ ChatGPT, Gemini

---

## Flow การทำ (ลำดับงาน)

### Phase 1: Entry & Routing
| # | งาน | สถานะ |
|---|-----|--------|
| 1.1 | หน้าแรก `/` → redirect ไป `/login` | ✅ |
| 1.2 | หน้าที่ไม่ใช้ (clinics, reviews, promotions, about, upgrade) → redirect `/login` | ✅ |
| 1.3 | Layout public: แสดงแค่ Login, Register (ไม่มีเมนูขายลูกค้า) | ✅ |

### Phase 2: Login ต้องมี Key
| # | งาน | สถานะ |
|---|-----|--------|
| 2.1 | เพิ่มช่อง **License Key** ในฟอร์ม Login | ✅ |
| 2.2 | Validate: ไม่กรอกคีย์ หรือคีย์ไม่ถูกต้อง → ไม่ให้เข้า, แสดงข้อความ | ✅ |
| 2.3 | Login สำเร็จ → ไป `/clinic` (Dashboard) | ✅ |
| 2.4 | ลบ "เข้าสู่ด้วย Google" (ใช้แค่ Key + อีเมล/รหัสผ่าน) | ✅ |

### Phase 3: Register เฉพาะคลินิก
| # | งาน | สถานะ |
|---|-----|--------|
| 3.1 | ลบ role "ลูกค้าทั่วไป" — เหลือแค่ฟอร์มสมัครคลินิก | ✅ |
| 3.2 | ฟอร์ม: คีย์ + ชื่อคลินิก + สาขา + เบอร์ + อีเมล + รหัสผ่าน | ✅ |
| 3.3 | หลังสมัครสำเร็จ → redirect ไป `/login` หรือ `/clinic` | ✅ |

### Phase 4: Dashboard ละเอียด มีหัวข้อแบ่งย่อย
| # | งาน | สถานะ |
|---|-----|--------|
| 4.1 | แบ่ง section ชัดเจน แต่ละบล็อกมี **หัวข้อหลัก** + **คำอธิบาย** (อันนี้คืออะไร เอาไว้ดูอะไร) | ✅ |
| 4.2 | ภาพรวมธุรกิจ, แชท/ลูกค้า, จองคิว, โปรโมชัน, AI Status — มี sub-heading + คำอธิบาย | ✅ |
| 4.3 | Placeholder "AI วิเคราะห์ → ส่ง LINE คลินิก" (ยังไม่ต่อ API จริง) | ✅ |

### Phase 4.5: ข้อมูลจริงใน Admin (แทน Mock)
| # | งาน | สถานะ |
|---|-----|--------|
| 4.5.1 | ออกแบบ Firestore collections (bookings, customers, transactions, promotions ฯลฯ) ต่อคลินิก | ✅ |
| 4.5.2 | API อ่าน/เขียนข้อมูลตาม clinic ที่ล็อกอิน (session) — `/api/clinic/me`, `dashboard`, `bookings`, `customers`, `finance`, `promotions` | ✅ |
| 4.5.3 | Dashboard / Booking / Customers / Finance / Promotions ดึงข้อมูลจริงจาก Firestore (SWR + loading/error) | ✅ |
| 4.5.4 | แสดงชื่อคลินิกจาก `/api/clinic/me` ใน Topbar | ✅ |

*Firestore indexes: ดู `firestore.indexes.json` — deploy ด้วย `firebase deploy --only firestore:indexes`*

### Phase 5: กฎข้อมูล AI & LINE (Spec)
| # | งาน | สถานะ |
|---|-----|--------|
| 5.1 | เอกสาร/comment: ข้อมูลที่ส่งให้**ลูกค้า** = แชท, โปรโมชัน, นัดก่อนทำ, จองคิว (ไม่เจาะลึกการแพทย์) | ✅ |
| 5.2 | ข้อมูลที่ส่งให้**คลินิก (LINE)** = วิเคราะห์, สถิติ, แจ้งเตือน — **ไม่ส่งหาลูกค้า** | ✅ |
| 5.3 | (ภายหลัง) Webhook/API ส่งไป LINE | |

*เอกสาร: **docs/AI-DATA-SPEC.md** • AI ตอบแชท 24 ชม. → `docs/AI-CHAT-24H-AND-DATA.md`*

### Phase 6: AI 6 Agents (ChatGPT, Gemini)
| # | งาน | สถานะ |
|---|-----|--------|
| 6.1 | กำหนดชื่อและหน้าที่ 6 Agents (Booking, Promotion, Pre-care, Chat, Analytics, LINE Notify ฯลฯ) | ✅ |
| 6.2 | ระบุว่า agent ไหนใช้ ChatGPT / Gemini | ✅ |
| 6.3 | หน้า AI Agents ใน dashboard แสดง 6 agents + สถานะ + คำอธิบาย + badge กลุ่มเป้าหมาย | ✅ |

*Spec: **src/lib/ai-agents.ts** (AI_AGENTS_SPEC)*

### Phase 7: เชื่อม LINE / Facebook / IG + AI ตอบข้อความ (ส่งข้อความเทสกับ AI)
| # | งาน | สถานะ |
|---|-----|--------|
| 7.1 | สร้างแอป/ช่องทาง: LINE (LINE Developers), Facebook (Meta for Developers), Instagram (ใช้ Messaging API ผ่าน Meta) | |
| 7.2 | ตั้งค่า Webhook URL ในแต่ละแพลตฟอร์ม → ชี้ไปที่ API ของเรา (เช่น `POST /api/webhooks/line`) — ดู `docs/LINE-WEBHOOK-SETUP.md` | |
| 7.3 | API รับข้อความจาก Webhook → เรียก AI (Chat Agent / OpenAI) สร้างคำตอบ | ✅ |
| 7.4 | ส่งคำตอบกลับไปยัง LINE ผ่าน Messaging API | ✅ |
| 7.5 | **ส่งข้อความเทสกับ AI ได้** — ส่งข้อความใน LINE → ได้คำตอบจาก AI จริง | ✅ |

*(ผูก channel กับ clinic หลายคลินิก — ทำภายหลัง)*

*ลำดับแนะนำ: ทำ LINE ก่อน (เอกสาร/ตัวอย่างเยอะ) แล้วค่อยทำ Facebook / Instagram*

---

## 6 Agents ที่จะใช้ (รายการเบื้องต้น)
1. **Booking Agent** — จองคิว, ยืนยันนัด (ส่งให้ลูกค้าได้)
2. **Promotion Agent** — เสนอโปรโมชัน (ส่งให้ลูกค้าได้)
3. **Pre-care Agent** — เตือน/ปรึกษาก่อนเข้ารับบริการ (ส่งให้ลูกค้าได้, ไม่เจาะลึกการแพทย์)
4. **Chat Agent** — พูดคุยกับลูกค้า (ส่งให้ลูกค้าได้)
5. **Analytics Agent** — วิเคราะห์ข้อมูล สถิติ (ส่งให้คลินิกทาง LINE เท่านั้น ไม่ส่งหาลูกค้า)
6. **LINE Notify Agent** — ส่งสรุป/แจ้งเตือนไป LINE คลินิก (เฉพาะฝั่งคลินิก)

*ใช้ ChatGPT และ Gemini ตามที่กำหนดในแต่ละ agent*
