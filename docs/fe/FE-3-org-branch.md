# FE-3 — Org & Branch Management UI

## สรุป

- **Organization Settings**: แสดง/แก้ไข org info (org_id, plan readonly)
- **Branch Management**: List, Create, Edit branches
- **Constraints**: org_id แก้ไม่ได้, branch ผูก org_id เสมอ

## Implementation

| ไฟล์ | บทบาท |
|------|--------|
| `src/app/api/clinic/organization/route.ts` | PATCH — อัปเดต org (name, phone, email) |
| `src/app/api/clinic/branches/[id]/route.ts` | PATCH — อัปเดต branch (name, address) |
| `src/components/clinic/OrganizationSettings.tsx` | Organization Settings UI |
| `src/components/clinic/BranchManagement.tsx` | Branch List + Create/Edit UI |
| `src/app/(clinic)/clinic/settings/page.tsx` | ใช้ OrganizationSettings + BranchManagement |

## Fields

### Organization (Readonly)
- `org_id` — แก้ไม่ได้
- `plan` — แก้ไม่ได้ (ดูที่ Billing)

### Organization (Editable - Owner only)
- `name` — ชื่อองค์กร
- `phone` — เบอร์ติดต่อ
- `email` — อีเมล

### Branch (Editable - Owner/Manager)
- `name` — ชื่อสาขา
- `address` — ที่อยู่ (optional)

### Hidden (Phase 2)
- `affiliate_id` — ซ่อนไว้
- `white_label_config` — ซ่อนไว้

## API Endpoints

- **PATCH** `/api/clinic/organization` — body: `{ name?, phone?, email? }`
- **PATCH** `/api/clinic/branches/[id]` — body: `{ name?, address? }`
- **GET** `/api/clinic/branches` — list branches (มีอยู่แล้ว)
- **POST** `/api/clinic/branches` — create branch (มีอยู่แล้ว)
