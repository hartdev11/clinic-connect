# Enterprise Standard Audit — Hex & Spinner

รายงานก่อนแก้ไข + สถานะหลังแก้ไข

---

## 1. HEX COLORS ใน Components

### ต้องแก้ไข

| ไฟล์ | บรรทัด | รายละเอียด |
|------|--------|-------------|
| `src/components/clinic/ChannelChips.tsx` | 26-32 | LINE (#06c755), Facebook (#1877f2), Instagram (#e4405f, #f9ed32, #833ab4), TikTok (#000000, #00f2ea, #ff0050) |
| `src/components/clinic/AiConfigSettings.tsx` | 586 | LINE header bar `bg-[#06C755]` |
| `src/components/public/ArchitectureDiagram.tsx` | 31-32, 36-37, 47, 57, 71, 74, 77, 80, 101-102, 105, 108, 114, 124, 128, 148, 151, 154, 160, 169, 180, 183, 188, 206, 209, 212, 215 | #0c7a6f, #ffffff, #f0fdfa, #94a3b8, #0f172a, #64748b, #f8fafc, #475569, #cbd5e1 |
| `src/app/(public)/about/page.tsx` | 12 | gradient `#FAF7F4`, `#F5EDE8`, `#EDE0D8` |
| `src/app/(public)/clinics/page.tsx` | 24 | gradient เหมือน about |
| `src/app/(public)/reviews/page.tsx` | 25 | gradient เหมือน about |
| `src/app/(public)/promotions/page.tsx` | 23 | gradient `#FAF7F4`, `#F5EDE8` |
| `src/app/(public)/upgrade/page.tsx` | 25 | gradient `#3D2235`, `#6B3F52`, `#C9956C` |
| `src/app/(public)/page.tsx` | 37, 269 | gradient backgrounds |
| `src/app/(public)/packages/page.tsx` | 106 | gradient เหมือน upgrade |
| `src/app/(agency)/agency/settings/page.tsx` | 98 | `placeholder="#0c7a6f"` (input type color) |

### ไม่แก้ (มีเหตุผล)

| ไฟล์ | เหตุผล |
|------|--------|
| `src/app/globals.css` | กำหนด CSS variables — hex ใช้เป็นค่าของ var() |
| `src/app/ent-tokens.css` | เหมือนกัน |
| `src/app/manifest.ts` | PWA spec ต้องใช้ hex สำหรับ theme_color, background_color |
| `src/lib/email.ts` | HTML email ต้อง inline hex เพื่อความ compatible |
| `src/app/(clinic)/clinic/booking/page.tsx` L87 | เป็น comment เท่านั้น |

---

## 2. SPINNER / animate-spin

### ต้องแก้ไข

| ไฟล์ | บรรทัด | รายละเอียด |
|------|--------|-------------|
| `src/components/ui/Button.tsx` | 89 | `animate-spin` ตอน loading |
| `src/components/clinic/NotificationBell.tsx` | 100 | `animate-spin` ใน RefreshIcon เมื่อ refreshing |
| `src/components/ui/LoadingSpinner.tsx` | 36 | `animate-spin` ใน spinner วงกลม |

### การใช้งาน

- **LoadingSpinner / PageLoader:** export ใน index แต่ไม่มีการ import ใช้ใน pages อื่น (อาจใช้ผ่าน dynamic import หรือ deprecated)
- **Button loading:** ใช้ทั่วทั้งแอป — เปลี่ยนเป็น skeleton-like (pulse bar) หรือแค่ text "กำลังดำเนินการ..."
- **NotificationBell RefreshIcon:** เปลี่ยนเป็น animate-pulse แทน spin

---

## 3. แผนการแก้ไข

1. **Button.tsx** — เปลี่ยน loading spinner เป็น div pulse/skeleton bar
2. **NotificationBell.tsx** — RefreshIcon: เปลี่ยน animate-spin เป็น animate-pulse
3. **LoadingSpinner.tsx** — เปลี่ยนเป็น SkeletonLoader (สี่เหลี่ยม pulse) แทน spinner วงกลม
4. **ChannelChips.tsx** — เพิ่ม CSS vars สำหรับ brand colors ใน globals.css แล้วใช้ var()
5. **AiConfigSettings.tsx** — ใช้ var(--line-green) สำหรับ LINE header
6. **ArchitectureDiagram.tsx** — ใช้ semantic tokens / var()
7. **Public pages (about, clinics, reviews, promotions, upgrade, page, packages)** — ใช้ var(--cream-100), var(--cream-200) แทน hex
8. **agency/settings** — placeholder "#0c7a6f" เป็นข้อความตัวอย่างสำหรับ color input (ไม่ใช่ style) → ไม่แก้

---

## 4. สถานะหลังแก้ไข (Done)

| รายการ | สถานะ |
|--------|--------|
| Button loading | ✅ เปลี่ยนเป็น pulse dots |
| NotificationBell RefreshIcon | ✅ เปลี่ยน animate-spin → animate-pulse |
| LoadingSpinner | ✅ เปลี่ยนเป็น skeleton |
| PageLoader | ✅ เปลี่ยนเป็น skeleton + text |
| ChannelChips | ✅ ใช้ Tailwind theme (line-500, facebook-500, etc.) |
| AiConfigSettings | ✅ ใช้ bg-line-500 |
| ArchitectureDiagram | ✅ ใช้ var(--teal-primary), var(--diagram-slate-*), var(--cream-50) |
| Public pages (about, clinics, reviews, promotions, upgrade, packages, page) | ✅ ใช้ var(--cream-*), var(--mauve-*), var(--rg-500) |
| globals.css | ✅ เพิ่ม --cream-50, --teal-primary, --diagram-slate-* |
| tailwind.config | ✅ เพิ่ม brand colors (line, facebook, instagram, tiktok, teal) |
| npm run build | ✅ ผ่าน
