# Enterprise Dashboard — UX/UI Design Specification

**Role:** Senior Product Designer + Enterprise UX/UI Specialist  
**Scope:** Dashboard page — UX/UI only (no business logic / flow / feature removal)  
**Target:** Professional, Enterprise-grade, data-dense, accessible, premium SaaS feel

---

## 1. UX Analysis

### 1.1 Current State Summary

| ด้าน | สถานะปัจจุบัน | โอกาสปรับปรุง |
|------|----------------|----------------|
| **ข้อมูลที่มี** | stats (5 KPIs), revenueByDay, activityByDay, bookingsByDate, aiAlerts, WoW | ครบสำหรับ Summary + Charts + Activity + Status + Notifications |
| **Layout** | แนวตั้งเรียงส่วน (Header → KPI grid → Charts 2 คอลัมน์ → Bookings 3 คอลัมน์ → Alerts → AI LINE → Quick nav) | ยังไม่เป็น Grid ชัดเจน 8pt; บางส่วนรู้สึกแน่นหรือกระจายไม่สม่ำเสมอ |
| **Visual Hierarchy** | มีหัวข้อและตัวเลข แต่ระดับความสำคัญ (primary / secondary / tertiary) ไม่ชัดมาก | กำหนดระดับ type scale + spacing + colour usage ให้ชัด |
| **Charts** | Area (รายได้), Bar (แชท vs จอง) | ขาด Line (trend), Donut/Pie (distribution) ตาม spec; สี/ความหนา/empty state ยังปรับได้ |
| **Animation** | มี fade-in-up, chart animation, hover บางจุด | ยังไม่มี KPI counter animation, card hover แบบ elevation ชัดเจน, staggered load, skeleton ที่สอดคล้อง |
| **Loading / Empty / Error** | มี skeleton, empty ใน chart, error card | ทำให้เป็นระบบเดียวกัน (skeleton 8pt grid, empty state มี copy + CTA, error มี recovery ชัด) |
| **Cognitive Load** | ข้อมูลหลายบล็อกเรียงยาว | จัดกลุ่มเป็น “Overview → Performance → Activity → Operations” และใช้ spacing + background แยกโซน |

### 1.2 User Goals (คงไว้ ไม่เปลี่ยน Flow)

- ดูตัวเลขสรุปสำคัญ (KPIs) ในพริบตา
- ดูแนวโน้มรายได้และกิจกรรม (แชท/จอง)
- ดูการจองถึงวันที่ (วันนี้/พรุ่งนี้/มะรืน)
- รับแจ้งเตือนจาก AI และสถานะระบบ
- ไปยังหน้าหลัก (Customers, Booking, AI Agents, Finance) ได้เร็ว
- Export PDF / Refresh ได้

### 1.3 Data Inventory (จาก API — ไม่แก้ backend)

- **stats:** chatsToday, newCustomers, bookingsToday, bookingsTomorrow, revenueThisMonth, revenueLastMonth  
- **chartData:** revenueByDay[], activityByDay[] (day, chats, bookings)  
- **bookingsByDate:** [{ dateLabel, date, total, items[] }]  
- **aiAlerts[]**, activePromotionsCount, pendingBookingsCount, unlabeledFeedbackCount  
- **chatsWoW, bookingsWoW** (thisWeek, lastWeek)

จากชุดนี้ **Line / Donut-Pie ทำได้จากข้อมูลเดิมที่ frontend** (ไม่ต้องเปลี่ยน API):

- **Line Chart (Trend):** ใช้ `revenueByDay` หรือรวม `activityByDay.chats + activityByDay.bookings` เป็น series เดิม — แค่สลับจาก Area เป็น Line หรือเพิ่ม Line layer
- **Donut/Pie (Distribution):**  
  - ตัวเลือก A: สัดส่วน “แชทวันนี้ : ลูกค้าใหม่ : จองวันนี้ : จองพรุ่งนี้” จาก stats (normalize เป็น %).  
  - ตัวเลือก B: สัดส่วน “แชท vs การจอง” จากผลรวมของ activityByDay (total chats vs total bookings).  
  เลือกหนึ่งแบบหรือทั้งคู่แล้วแต่ความหมายที่อยากสื่อ

---

## 2. Enterprise Dashboard Layout Proposal

### 2.1 Grid System (8pt Base)

- **Base unit:** 8px  
- **Gutter:** 16px (sm), 24px (md+)
- **Max content width:** 1440px (optional) หรือเต็ม main ที่มี padding
- **Breakpoints:** ใช้ Tailwind sm (640), md (768), lg (1024), xl (1280)

### 2.2 Proposed Layout (Grid-based)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Page title] Dashboard              [Updated] [Refresh] [Export]  │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ KPI Overview (5 cards) — 1 row, 5 cols on lg; 2+2+1 on sm    │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐              │
│ │ Area Chart           │ │ Bar Chart             │  Row 1       │
│ │ Revenue by Day       │ │ Chats vs Bookings     │  (Charts)    │
│ └──────────────────────┘ └──────────────────────┘              │
│ ┌──────────────────────┐ ┌──────────────────────┐              │
│ │ Line Chart           │ │ Donut/Pie            │  Row 2      │
│ │ Trend (revenue/act.) │ │ Distribution         │  (Charts)    │
│ └──────────────────────┘ └──────────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Recent Activity — Bookings by date (3 cols)                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│ │ Status & Alerts             │ │ Quick Actions (4 cards)      ││
│ │ (compact list)              │ │ C&C | Booking | AI | Finance ││
│ └─────────────────────────────┘ └─────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ [AI → LINE one-liner]                                            │
└─────────────────────────────────────────────────────────────────┘
```

- **Spacing ระหว่าง section:** 24px (6) หรือ 32px (8) — สม่ำเสมอทั้งหน้า
- **Card padding:** 20px / 24px (5 / 6) ตาม 8pt

---

## 3. KPI Redesign

### 3.1 Structure (คง 5 KPIs เดิม)

1. แชทวันนี้ (ลิงก์ → Customers)  
2. ลูกค้าใหม่  
3. จองวันนี้ / พรุ่งนี้ (ลิงก์ → Booking)  
4. รายได้เดือนนี้  
5. โปรโมชันที่ใช้งาน (ลิงก์ → Promotions)

### 3.2 Visual Spec (Enterprise)

- **Container:** แผงเดียว (single panel) แทน 5 การ์ดแยก — ลดเส้นขอบและ shadow ที่รก
- **Cell:** แต่ละ KPI เป็น cell ใน grid มี:
  - **Label:** 10–11px, uppercase หรือ small caps, tracking-wide, สี secondary (surface-500)
  - **Value:** 24–28px (lg), font-semibold, tabular-nums, สี primary (surface-900)
  - **Animated counter:** ค่าเลขนับจาก 0 → value ใน 400–600ms (ease-out) เมื่อโหลดเสร็จ
  - **Trend (ถ้ามี):** 11–12px, ↑/↓ + ข้อความเทรนด์, สี success/error (ไม่ฉูดฉาด)
  - **Link (ถ้ามี):** 11px, สี surface-500, hover → surface-700 หรือ primary-600
- **Divider:** เส้นแบ่งระหว่าง cell (vertical/horizontal ตาม breakpoint) สี surface-100
- **Hover:** เฉพาะ cell มี hover state (background surface-50) ไม่ยกทั้งการ์ด

### 3.3 Animation: KPI Counter

- ใช้ requestAnimationFrame หรือ library เล็ก (e.g. count up)  
- Duration 300–400ms, ease-out  
- เริ่มเมื่อ `!isLoading && data` (หรือเมื่อ section อยู่ใน viewport ถ้องการ)

---

## 4. Chart System Design

### 4.1 Chart Types (ครบตาม Requirement)

| ประเภท | ข้อมูลที่ใช้ | วัตถุประสงค์ |
|--------|----------------|--------------|
| **Area** | revenueByDay | Growth / รายได้รายวัน (คงเดิม) |
| **Bar** | activityByDay | Comparison แชท vs การจอง (คงเดิม) |
| **Line** | revenueByDay หรือ (chats+bookings) ต่อวัน | Trend analysis |
| **Donut/Pie** |  derived: สัดส่วนจาก stats หรือจากผลรวม activityByDay | Distribution |

- **Line:** ใช้ `revenueByDay` เป็น Line แทน Area หรือเพิ่ม Line อีกชาร์ตจากผลรวม `activityByDay[].chats + activityByDay[].bookings` ต่อวัน
- **Donut/Pie:**  
  - Option A: [แชทวันนี้, ลูกค้าใหม่, จองวันนี้, จองพรุ่งนี้] จาก stats (ถ้าผลรวม > 0)  
  - Option B: Total Chats vs Total Bookings จาก activityByDay  
  Implementation เลือกอย่างใดอย่างหนึ่งหรือทั้งคู่ (หนึ่ง Donut สำหรับ “กิจกรรมวันนี้” อีกหนึ่งสำหรับ “แชท vs จอง 7 วัน”)

### 4.2 Chart UX Standards

- **สี:** โทน neutral + accent เดียว (เช่น slate/gray + teal หรือ primary เบา) ไม่เกิน 2–3 สีต่อชาร์ต
- **Axis:** ไม่วาด axis line; tick เล็ก อ่านง่าย; Y ให้มี tickFormatter (k, M ถ้าเลขใหญ่)
- **Tooltip:**  
  - พื้นหลังขาว/เทาอ่อน, border บาง, shadow นุ่ม  
  - แสดงค่าชัด (หน่วย ฿ หรือ จำนวน)  
  - รองรับ keyboard (focusable)
- **Empty state:** กล่อง dashed, ข้อความสั้น “ยังไม่มีข้อมูล…”, ไม่แสดงกราฟเปล่า
- **Loading:** Skeleton สัดส่วนเท่ากับกราฟ (ความสูงเท่ากัน) หรือ progressive draw (stroke-dashoffset) ถ้าทำได้
- **Responsive:** ResponsiveContainer; ลดจำนวน tick บนแกน X เมื่อแคบ
- **Hover:** เฉพาะ series ที่เกี่ยวข้อง highlight; อื่นลด opacity เล็กน้อย

### 4.3 Accessibility

- **Role + aria-label:** container แต่ละกราฟมี aria-label อธิบายว่าเป็นกราฟอะไร
- **Color:** ไม่ใช้สีเดียวเป็นตัวบอกความหมาย; มี label/legend ชัด
- **Focus:** Tooltip หรือ interactive element รับ focus ได้

---

## 5. Animation & Interaction System

### 5.1 Principles

- **Duration:** 200–400ms สำหรับ micro-interaction; 300–500ms สำหรับ entrance
- **Easing:** ease-out หรือ cubic-bezier(0.16, 1, 0.3, 1) สำหรับ “premium” feel
- **ไม่ flashy:** ไม่มี blink, ไม่มี bounce ที่รุนแรง

### 5.2 Inventory

| Element | Animation | Spec |
|---------|-----------|------|
| **Page load** | Staggered fade-in-up | Section/card ลำดับ: delay 50–80ms ต่ออัน, duration 280–320ms |
| **KPI cards/cells** | ค่าเลขนับ (counter) | 300–400ms ease-out หลัง data ready |
| **Charts** | Progressive draw / fade-in | Recharts มี isAnimationActive; duration 800–1000ms; หรือ skeleton → chart fade 300ms |
| **Card hover** | Elevation + shadow | translateY(-2px) + shadow ใหญ่ขึ้นนิดเดียว, 250ms ease-out |
| **Button hover** | Background / border | 150–200ms transition |
| **Skeleton** | Shimmer (optional) | gradient เคลื่อนที่ช้า ไม่ต้องเด่นมาก |
| **Page transition** | (ถ้ามี) | Fade 200ms หรือใช้ layout animation |

### 5.3 Implementation Notes

- ใช้ CSS transition/transform เป็นหลัก; keyframes สำหรับ counter/shimmer
- ลด motion: `@media (prefers-reduced-motion: reduce)` ให้ลดหรือปิด animation
- Stagger: ใช้ `animation-delay` หรือ `setTimeout` กับ state ตาม index

---

## 6. Visual Hierarchy Strategy

### 6.1 Typography Scale (ตัวอย่าง 8pt-based)

- **Page title:** 20–24px, font-semibold, surface-900  
- **Section title:** 14–16px, font-semibold, surface-800  
- **Card title / Chart title:** 13–14px, font-medium, surface-800  
- **Body / value secondary:** 12–13px, surface-600  
- **Caption / label:** 10–11px, surface-500  
- **KPI value:** 24–28px, font-semibold, tabular-nums

### 6.2 Colour Roles

- **Background page:** surface-50 หรือเทาอ่อนมาก
- **Background card:** white, border surface-200
- **Primary text:** surface-900
- **Secondary text:** surface-500 / surface-600
- **Accent (links, key number):** primary-600 หรือ surface-700
- **Success/positive:** green โทนเดียว (e.g. emerald-600)
- **Warning/negative:** red โทนเดียว (e.g. rose-600)
- **Charts:** 1–2 สีหลัก + โทน neutral

### 6.3 Spacing & Grouping

- กลุ่ม “Overview” (KPI) → ช่องว่างแล้วค่อย “Performance” (Charts) → แล้ว “Activity” (Bookings) → แล้ว “Operations” (Alerts + Quick actions)
- ใช้ระยะห่างเท่ากันระหว่าง section (24 หรือ 32px) เพื่อให้รู้สึกเป็นระบบ

---

## 7. Design System Proposal

### 7.1 Design Tokens (แนะนำ)

```ts
// spacing (8pt)
spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 }

// radius (consistent)
radius: { card: 12, button: 8, badge: 6 }

// shadow (soft, layered)
shadow: {
  card: '0 1px 3px rgba(0,0,0,0.04)',
  cardHover: '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)',
  tooltip: '0 4px 12px rgba(0,0,0,0.08)',
}

// chart palette (neutral + one accent)
chart: {
  primary: '#475569',
  secondary: '#64748b',
  accent: '#0f766e',
  grid: '#e2e8f0',
  text: '#64748b',
}
```

### 7.2 Component Conventions

- **Card:** padding 20–24px, border 1px surface-200, radius 12px, shadow ระดับ card
- **Section:** มีหัวข้อ (title + optional description) แล้วตามด้วย content
- **Buttons (icon):** ขนาด 36–40px tap target, border-radius 8px

### 7.3 WCAG

- Contrast ตัวอักษรกับพื้นหลัง ≥ 4.5:1 (body), ≥ 3:1 (large text)
- Focus visible: ring 2px offset 2px
- ไม่พึ่งพาเพียงสีเดียวในการสื่อความหมาย

---

## 8. Enterprise Enhancements

- **Consistent 8pt grid:** ทุก padding/margin ใช้ค่าจาก 8pt
- **Single-panel KPI:** ลดจำนวน “กล่อง” เพื่อลดความรก
- **Chart variety ครบ:** Area, Bar, Line, Donut/Pie จากข้อมูลเดิม
- **KPI counter animation:** ทำให้ตัวเลขรู้สึกมีชีวิต ไม่ static
- **Staggered load:** section/card โผล่ทีละน้อย ลดความรู้สึกโหลดทีเดียวหนัก
- **Card hover แบบ elevation:** นุ่มนวล ไม่กระโดด
- **Empty/Loading/Error เป็นระบบ:** รูปแบบเดียวกันทั้งหน้า (skeleton สี + ระยะเดียวกับ content, empty มีข้อความ + CTA ถ้ามี, error มีปุ่ม retry)
- **Status strip:** Alerts แสดงเป็น list กะทัดรัด มี left border แยก type (warning/info)
- **Quick actions:** การ์ดเล็ก 4 อัน เรียงเท่า spacing เท่ากัน

---

## 9. Implementation Guidance

### 9.1 Order of Work (ไม่เปลี่ยน Logic/Flow/Feature)

1. **Design tokens & globals**  
   - เพิ่ม/จัด spacing, radius, shadow, chart colors ใน Tailwind หรือ CSS vars

2. **Layout & grid**  
   - ใช้ container + grid คอลัมน์ตาม layout ข้อ 2; ระยะห่าง section 24/32px

3. **KPI section**  
   - เปลี่ยนเป็น single panel + grid ของ cell  
   - เพิ่ม animated counter (ใช้ effect เมื่อ `data` ready)  
   - ลบการ์ดแยก 5 ใบ; เก็บลิงก์และเทรนด์เหมือนเดิม

4. **Charts**  
   - คง Area และ Bar  
   - เพิ่ม **Line:** ใช้ `revenueByDay` เป็น `<Line>` ใน Recharts หรือสร้างชาร์ตแยก  
   - เพิ่ม **Donut/Pie:** ใช้ Recharts Pie; ข้อมูลจาก stats (normalize เป็น %) หรือจากผลรวม activityByDay (chats vs bookings)  
   - ใส่สีจาก design tokens; ปรับ tooltip และ empty/loading ตามข้อ 4.2

5. **Bookings by date**  
   - คงข้อมูลและลิงก์; ปรับเฉพาะ spacing, type scale, border ให้สอดคล้อง 8pt และ card style ใหม่

6. **Alerts & Quick actions**  
   - Alerts: list + left border  
   - Quick actions: การ์ด 4 ช่อง spacing เท่ากัน, hover ตามข้อ 5.2

7. **Animation**  
   - Stagger: เพิ่ม class หรือ state สำหรับ delay ตาม index  
   - KPI counter: ใช้ state + useEffect หรือ small util  
   - Card hover: เพิ่ม transition + shadow/translate ตามตารางข้อ 5.2

8. **Loading / Empty / Error**  
   - Skeleton: ความสูงและ grid ให้ตรงกับ content  
   - Empty: ข้อความ + ปุ่ม/ลิงก์ถ้ามี  
   - Error: เก็บปุ่ม “ลองใหม่” และข้อความเหมือนเดิม แค่จัด style ให้ตรง design system

### 9.2 Data for New Charts (Frontend Only)

- **Line (Trend):**  
  - ใช้ `revenueByDay` เป็น `data` และ `<Line dataKey="revenue" />`  
  - หรือสร้าง array จาก `activityByDay`: `totalActivity = chats + bookings` ต่อวัน แล้ว plot เป็น Line

- **Donut/Pie (Distribution):**  
  - จาก stats:  
    `[{ name: 'แชท', value: chatsToday }, { name: 'ลูกค้าใหม่', value: newCustomers }, ... ]`  
    กรองที่ value > 0 แล้ว normalize เป็น % ถ้าต้องการ  
  - หรือจาก activityByDay:  
    `totalChats = sum(activityByDay.chats)`, `totalBookings = sum(activityByDay.bookings)`  
    แล้วใช้ Pie ด้วย `[{ name: 'แชท', value: totalChats }, { name: 'การจอง', value: totalBookings }]`

### 9.3 Files to Touch (UX/UI Only)

- `src/app/(clinic)/clinic/page.tsx` — layout, KPI, charts, bookings, alerts, quick actions, animation classes
- `tailwind.config.ts` หรือ `globals.css` — tokens, keyframes (counter/shimmer ถ้าใช้ CSS)
- Component ย่อย (ถ้าแยก): e.g. `DashboardKpiPanel`, `DashboardCharts`, `DashboardBookings` — ไม่บังคับ แค่ช่วยให้อ่านง่าย

---

**สรุป:** เอกสารนี้ใช้วิเคราะห์ UX ปัจจุบันและเสนอ layout, KPI, chart system, animation, hierarchy, design system และขั้นตอน implement โดยไม่เปลี่ยน business logic, flow หรือ feature เดิม และเพิ่ม Line + Donut/Pie จากข้อมูลที่มีอยู่แล้วใน API
