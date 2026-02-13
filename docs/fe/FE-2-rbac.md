# FE-2 — Auth & RBAC Enforcement

## สรุป

- **Permission Hooks**: `useRequireRole`, `useRequireBranchAccess`, `useEffectiveRoleAtBranch`
- **Permission Components**: `<RequireRole>`, `<RequireBranchAccess>`
- **UI Control**: ซ่อนเมนู/ปุ่มตาม role; ไม่ให้กด action ที่ backend จะ deny

## Implementation

| ไฟล์ | บทบาท |
|------|--------|
| `src/hooks/usePermissions.ts` | Permission hooks — logic เดียวกับ backend |
| `src/components/rbac/RequireRole.tsx` | Component ซ่อน UI ตาม org-level role |
| `src/components/rbac/RequireBranchAccess.tsx` | Component ซ่อน UI ตาม branch access |
| `src/components/layout/ClinicSidebar.tsx` | ซ่อนเมนู Finance, User & Roles |
| `src/app/(clinic)/clinic/settings/page.tsx` | ซ่อน Billing, Branch Management, Edit buttons |
| `src/app/(clinic)/clinic/users/page.tsx` | ซ่อน Invite, Edit buttons |
| `src/app/(clinic)/clinic/finance/page.tsx` | ซ่อนทั้งหน้า (owner/manager only) |

## Permission Matrix (Frontend)

| Resource | owner | manager | staff |
|----------|-------|---------|-------|
| Finance | ✅ | ✅ | ❌ |
| User & Roles | ✅ | ✅ | ❌ |
| Billing/Subscription | ✅ | ❌ | ❌ |
| Branch Management | ✅ | ✅ | ❌ |
| Settings (Edit) | ✅ | ❌ | ❌ |

## การใช้

```tsx
// Hook
const isOwner = useIsOwner();
const canManage = useRequireRole(["owner", "manager"]);

// Component
<RequireRole allowed={["owner", "manager"]}>
  <Button>จัดการ</Button>
</RequireRole>
```
