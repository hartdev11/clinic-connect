# FE-1 — App Initialization & Context

## สรุป

- **Global Context**: `currentOrg`, `currentBranch`, `currentUser`, `subscriptionPlan`
- **org_id / branch_id**: มาจาก backend token (session) — ไม่ hardcode
- **branch_id**: เลือกได้ผ่าน dropdown เมื่อ org มีหลายสาขา; branch เดียว → auto-select

## Implementation

| ไฟล์ | บทบาท |
|------|--------|
| `src/app/api/clinic/context/route.ts` | GET /api/clinic/context — คืน org, branch, user, subscription |
| `src/contexts/ClinicContext.tsx` | Provider + useClinicContext hook |
| `src/app/(clinic)/layout.tsx` | Wrap ด้วย ClinicContextProvider |
| `src/components/layout/ClinicTopbar.tsx` | ใช้ context + branch switcher |
| `src/app/(clinic)/clinic/page.tsx` | Dashboard ส่ง branch_id ไป API |

## การใช้

```tsx
const { org_id, branch_id, currentOrg, currentBranch, currentUser, subscriptionPlan, setSelectedBranchId } = useClinicContext();
```

- เรียก API ที่ต้องการ branch: `fetch(\`/api/clinic/xxx?branchId=${branch_id}\`)`
- Switch สาขา: `setSelectedBranchId(branchId)`
