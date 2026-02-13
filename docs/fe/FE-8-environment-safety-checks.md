# FE-8 — Environment & Safety Checks

## วัตถุประสงค์
- ทุก API call ส่ง org_id / branch_id ครบ
- ไม่มี clinic_id หลงเหลือใน FE
- Error จาก RBAC แสดง message ชัดเจน

## สิ่งที่ทำ

### 1. API calls ส่ง branch_id
**Branch-scoped APIs** — FE ส่ง `branchId` ใน query string จาก `useClinicContext().branch_id`:
- Dashboard: `/api/clinic/dashboard?branchId=xxx`
- Finance: `/api/clinic/finance?branchId=xxx`
- Customers: `/api/clinic/customers?branchId=xxx&limit=30`
- Bookings: `/api/clinic/bookings?branchId=xxx&limit=20`
- Promotions: `/api/clinic/promotions?branchId=xxx`

**org_id** — มาจาก session/token ที่ backend (FE ไม่ส่ง — backend resolve จาก auth)

### 2. ไม่มี clinic_id ใน FE
- ตรวจสอบแล้ว: ไม่พบ `clinic_id` หรือ `clinicId` ใน `src/app`, `src/components`
- Backend ยังใช้ `session.clinicId` เป็น legacy fallback สำหรับ `getOrgIdFromClinicId` — นี่เป็น backend internal ไม่ใช่ FE

### 3. RBAC Error Messages — Backend
**File**: API routes ต่างๆ

เปลี่ยนจาก `"Forbidden"` เป็นข้อความไทยที่ชัดเจน:
- `จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่เพิ่มสาขาได้`
- `จำกัดสิทธิ์: เฉพาะ Owner หรือ Manager เท่านั้นที่แก้ไขสาขาได้`
- `จำกัดสิทธิ์: เฉพาะ Owner เท่านั้นที่แก้ไขข้อมูลองค์กรได้`
- `จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Knowledge / Feedback / Finance / ... ของสาขานี้`
- `ถึงขีดจำกัดสาขาแล้ว กรุณาอัปเกรด plan`
- `ไม่พบสาขานี้ หรือสาขาไม่สังกัดองค์กรของคุณ`

### 4. RBAC Error Messages — Frontend
**File**: `src/lib/api-fetcher.ts`

- fetcher ใหม่ที่อ่าน `json.error` จาก API response
- throw `Error(msg)` โดยใช้ข้อความจาก backend
- SWR จะได้ `error.message` สำหรับแสดงใน UI

**Files ที่ใช้ apiFetcher**:
- page.tsx (dashboard)
- finance, customers, booking, promotions, feedback, users
- แสดง `error.message` แทน "โหลดข้อมูลไม่สำเร็จ"

## Checklist

✅ ทุก API call branch-scoped ส่ง branchId  
✅ ไม่มี clinic_id ใน FE  
✅ Backend RBAC คืนข้อความไทยชัดเจน  
✅ Frontend แสดง error.message จาก API
