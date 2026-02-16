# Enterprise Audit — Checklist

สรุปตรง: สิ่งที่ Enterprise ต้องมี vs สถานะปัจจุบัน

---

## 1️⃣ Single Source of Truth (สำคัญมาก)

| ข้อ | สถานะ | รายละเอียด |
|-----|--------|------------|
| KPI ทุกตัวคำนวณจาก utility กลาง | ✅ | **Revenue**: Dashboard + Insights ใช้ `financial-data` (getRevenueFromPaidInvoices, getRevenueByDayFromPaidInvoices*) — สูตรเดียวกัน |
| Dashboard กับ Insights ไม่ใช้สูตรคนละแบบ | ✅ | Revenue = financial-data เท่านั้น. Conversion / AI Close มีแค่ใน Insights (analytics-data) — Dashboard ไม่แสดงตัวนี้ จึงไม่ขัด |
| Metric definition ชัดในโค้ด | ✅ | **เพิ่มแล้ว** `src/lib/metric-definitions.ts` — กำหนด source และสูตร (revenue, conversionRate, aiCloseRate) |

**สรุป 1:** มีไฟล์ metrics กลางแล้ว → Enterprise เต็มในข้อนี้

---

## 2️⃣ Deterministic Analytics

| ข้อ | สถานะ | รายละเอียด |
|-----|--------|------------|
| Query เดิม → ผลลัพธ์เดิม | ✅ | ไม่มี AI แก้ตัวเลข; ตัวเลขมาจาก Firestore + financial-data/analytics-data เท่านั้น |
| Executive summary ใช้ metric snapshot ไม่ query ซ้ำเอง | ✅ | Route เรียก getAnalyticsOverview + getAnalyticsConversation + getAnalyticsAIPerformance ครั้งเดียว แล้วส่ง snapshot เป็นข้อความให้ Gemini |
| ตัวเลข audit ได้ | ✅ | **เพิ่มแล้ว** Executive summary API return `metricsSnapshot` (revenue, totalChats, conversionRate, aiCloseRate, accuracyScore, …) — เก็บ/เปรียบเทียบได้ |

**หมายเหตุ:** ข้อความสรุป (summary) ยัง generate จาก AI (temperature 0.3) จึงอาจต่างกันเมื่อเรียกซ้ำ; **ตัวเลข** ใน `metricsSnapshot` เป็น deterministic จาก snapshot เดียวกัน

**สรุป 2:** ตัวเลข deterministic + audit ได้

---

## 3️⃣ Observability

| ข้อ | สถานะ | รายละเอียด |
|-----|--------|------------|
| API ไหนช้าที่สุด | ⚠️ | มีแค่ `recordDashboardLatency` (clinic-data getDashboardStats). **ยังไม่มี** per-route latency (เช่น /api/clinic/analytics/overview) |
| Firestore query ไหนแพงสุด | ❌ | ยังไม่มีการวัด read/cost ต่อ query |
| Cache hit rate | ❌ | Redis ใช้ใน overview + branch-performance แต่ **ยังไม่มี** counter hit/miss |
| Error rate กี่ % | ❌ | ยังไม่มี error rate aggregation ต่อ API |

**สรุป 3:** ยังไม่ครบ Enterprise — ต้องเพิ่ม instrumentation (per-API latency, cache hit/miss, error count) แล้วส่งไป OpenTelemetry/Cloud Monitoring ถ้าต้องการระดับ Production

---

## 4️⃣ Data Isolation มั่นใจ 100%

| ข้อ | สถานะ | รายละเอียด |
|-----|--------|------------|
| ไม่มี query ลืม org_id | ✅ | ตรวจแล้ว: analytics-data + clinic-data (conversation_feedback, bookings, invoices) ใช้ `org_id` ในทุก query |
| RBAC ตรวจ branch ทุก endpoint | ✅ | Dashboard: `requireBranchAccess(user, branchId)`. Analytics: `getAnalyticsContext` ใช้ `requireBranchAccess`; branch-performance กรองผลตาม role (owner เห็นทุกสาขา, manager เฉพาะ branch_ids/branch_roles) |
| Test ว่า manager ไม่เห็น branch อื่น | ⚠️ | **ยังไม่มี** test อัตโนมัติที่ยืนยันว่า manager ส่ง branchId อื่นแล้วได้ 403 |

**สรุป 4:** Isolation ในโค้ดแน่น; เพื่อ 100% ควรเพิ่ม test (requireBranchAccess + integration ที่ manager ไม่เห็น branch อื่น)

---

## 5️⃣ UX Stability

| ข้อ | สถานะ | รายละเอียด |
|-----|--------|------------|
| ไม่มี layout shift ตอนโหลด | ✅ | Dashboard ใช้ KpiPanelSkeleton, ChartSkeleton, PieSkeleton; Insights ใช้ SkeletonCard — reserve พื้นที่ |
| Skeleton consistent | ✅ | Dashboard มี component แยก (KpiPanel, Chart, Pie); Insights ใช้ SkeletonCard สำหรับ KPI strip |
| Loading ไม่กระตุก | ✅ | SWR + dedupingInterval; ปุ่ม refresh disable ตอน isValidating |
| Chart re-render แปลก ๆ | ✅ | ใช้ Recharts + data จาก API; ไม่มี random key ที่ทำให้ re-mount บ่อย |

**สรุป 5:** ครบตามที่ตรวจ

---

## สรุปแบบตรง

| หัวข้อ | ครบไหม |
|--------|---------|
| Metric unified | ✅ มี metric-definitions.ts + revenue จาก financial-data เท่านั้น |
| Performance วัดได้ | ⚠️ วัดได้แค่ dashboard latency; ยังไม่มี per-API, Firestore cost, cache hit |
| Data isolation แน่น | ✅ ทุก query มี org_id; RBAC ตรวจ branch |
| Cache ถูกต้อง | ✅ Redis TTL 5 min สำหรับ overview/branch-performance; ยังไม่มี hit rate |
| Error handling ครบ | ✅ API return 500 + log; ยังไม่มี error rate รวม |
| Executive summary deterministic | ✅ ตัวเลขจาก snapshot เดียว; return metricsSnapshot ให้ audit |

**ถ้าต้องการ "ครบ 100%":**
- เพิ่ม test: manager ขอ branch อื่น → 403
- เพิ่ม observability: per-API latency, cache hit/miss, error rate (และส่งไป monitoring จริง)

**หน้า Insights ไม่ต้องแก้อะไรแล้ว** ในแง่ flow และ data; การปรับเป็นเพียงการเพิ่ม SSOT (metric-definitions), metricsSnapshot ใน executive-summary และ checklist นี้
