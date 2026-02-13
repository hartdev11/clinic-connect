"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";

import { apiFetcher } from "@/lib/api-fetcher";

type UserRole = "owner" | "manager" | "staff";
type BranchRole = "manager" | "staff";

interface User {
  id: string;
  email: string;
  role: UserRole;
  branch_ids: string[] | null;
  branch_roles: Record<string, BranchRole> | null;
  default_branch_id: string | null;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
}

const roleLabel: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};
const branchRoleLabel: Record<BranchRole, string> = {
  manager: "Manager",
  staff: "Staff",
};

export default function UsersPage() {
  const { data: usersData, error: usersError, mutate: mutateUsers } = useSWR<{ items: User[] }>(
    "/api/clinic/users",
    apiFetcher
  );
  const { data: branchesData } = useSWR<{ items: Branch[] }>("/api/clinic/branches", apiFetcher);

  const users = usersData?.items ?? [];
  const branches = branchesData?.items ?? [];

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("staff");
  const [inviteBranchRoles, setInviteBranchRoles] = useState<Record<string, BranchRole>>({});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("staff");
  const [editBranchRoles, setEditBranchRoles] = useState<Record<string, BranchRole>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const setBranchRole = (
    branchId: string,
    role: BranchRole | null,
    roles: Record<string, BranchRole>,
    setter: (v: Record<string, BranchRole>) => void
  ) => {
    if (role === null) {
      const next = { ...roles };
      delete next[branchId];
      setter(next);
    } else {
      setter({ ...roles, [branchId]: role });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setTempPassword(null);
    if (!inviteEmail.trim()) {
      setInviteError("กรุณากรอกอีเมล");
      return;
    }
    setInviteLoading(true);
    try {
      const branch_roles =
        Object.keys(inviteBranchRoles).length > 0 ? inviteBranchRoles : null;
      const res = await fetch("/api/clinic/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          branch_roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "เชิญไม่สำเร็จ");
        return;
      }
      setTempPassword(data.tempPassword);
      setInviteEmail("");
      setInviteRole("staff");
      setInviteBranchRoles({});
      mutateUsers();
    } catch {
      setInviteError("เกิดข้อผิดพลาด");
    } finally {
      setInviteLoading(false);
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditBranchRoles(u.branch_roles ?? {});
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditError("");
    setEditLoading(true);
    try {
      const branch_roles =
        Object.keys(editBranchRoles).length > 0 ? editBranchRoles : null;
      const res = await fetch(`/api/clinic/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: editRole,
          branch_roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "แก้ไขไม่สำเร็จ");
        return;
      }
      setEditingId(null);
      mutateUsers();
    } catch {
      setEditError("เกิดข้อผิดพลาด");
    } finally {
      setEditLoading(false);
    }
  };

  const editingUser = editingId ? users.find((u) => u.id === editingId) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="User & Roles"
        description="Owner • Manager • Staff — จัดการสิทธิ์การเข้าถึง"
      />

      <section>
        <SectionHeader
          title="สมาชิกในระบบ"
          description="จัดการสิทธิ์การเข้าถึง — เชิญผู้ใช้และกำหนด role, สาขา"
        />
        <Card padding="lg">
          <CardHeader
            title="สมาชิกในระบบ"
            subtitle="เชิญผู้ใช้และกำหนด role, สาขา"
            action={
              <RequireRole allowed={["owner", "manager"]}>
                <Button onClick={() => setShowInvite(!showInvite)}>
                  {showInvite ? "ปิดฟอร์ม" : "+ เพิ่มผู้ใช้"}
                </Button>
              </RequireRole>
            }
          />

          {showInvite && (
            <form onSubmit={handleInvite} className="mb-8 p-6 rounded-xl bg-surface-50 border border-surface-100 space-y-4">
              <h3 className="font-semibold text-surface-900 text-sm">เชิญผู้ใช้ใหม่</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="อีเมล"
                  type="email"
                  placeholder="user@clinic.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 rounded-xl border border-primary-100 bg-white"
                  >
                    {(["owner", "manager", "staff"] as const).map((r) => (
                      <option key={r} value={r}>{roleLabel[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {branches.length > 0 && inviteRole !== "owner" && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Role ต่อสาขา (E2.9 — แยก org vs branch)
                  </label>
                  <div className="space-y-2">
                    {branches.map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <span className="text-sm text-surface-700 w-32">{b.name}</span>
                        <select
                          value={inviteBranchRoles[b.id] ?? ""}
                          onChange={(e) =>
                            setBranchRole(
                              b.id,
                              (e.target.value || null) as BranchRole | null,
                              inviteBranchRoles,
                              setInviteBranchRoles
                            )
                          }
                          className="px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm"
                        >
                          <option value="">— ไม่กำหนด</option>
                          <option value="manager">{branchRoleLabel.manager}</option>
                          <option value="staff">{branchRoleLabel.staff}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tempPassword && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm font-medium text-amber-900">รหัสชั่วคราว (แสดงครั้งเดียว)</p>
                  <p className="text-lg font-mono mt-1">{tempPassword}</p>
                  <p className="text-xs text-amber-700 mt-1">กรุณาแจ้งให้ผู้ใช้ทราบ</p>
                </div>
              )}
              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              <Button type="submit" loading={inviteLoading} disabled={inviteLoading}>เชิญผู้ใช้</Button>
            </form>
          )}

          {editingUser && (
            <form onSubmit={handleEdit} className="mb-8 p-6 rounded-xl bg-primary-50/50 border border-primary-100 space-y-4">
              <h3 className="font-semibold text-surface-900 text-sm">แก้ไข {editingUser.email}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 rounded-xl border border-primary-100 bg-white"
                  >
                    {(["owner", "manager", "staff"] as const).map((r) => (
                      <option key={r} value={r}>{roleLabel[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {branches.length > 0 && editRole !== "owner" && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Role ต่อสาขา
                  </label>
                  <div className="space-y-2">
                    {branches.map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <span className="text-sm text-surface-700 w-32">{b.name}</span>
                        <select
                          value={editBranchRoles[b.id] ?? ""}
                          onChange={(e) =>
                            setBranchRole(
                              b.id,
                              (e.target.value || null) as BranchRole | null,
                              editBranchRoles,
                              setEditBranchRoles
                            )
                          }
                          className="px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm"
                        >
                          <option value="">— ไม่กำหนด</option>
                          <option value="manager">{branchRoleLabel.manager}</option>
                          <option value="staff">{branchRoleLabel.staff}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <Button type="submit" loading={editLoading} disabled={editLoading}>บันทึก</Button>
                <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>ยกเลิก</Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto -mx-6 -mb-6">
            {usersError && (
              <p className="px-6 py-4 text-sm text-red-600">{usersError.message}</p>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-4 px-6 font-medium text-surface-700 text-sm">อีเมล</th>
                  <th className="text-left py-4 px-6 font-medium text-surface-700 text-sm">Role</th>
                  <th className="text-left py-4 px-6 font-medium text-surface-700 text-sm">สาขา</th>
                  <th className="text-right py-4 px-6 font-medium text-surface-700 text-sm">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-surface-900 text-sm">{u.email}</td>
                    <td className="py-4 px-6">
                      <Badge variant={u.role === "owner" ? "info" : "default"}>{roleLabel[u.role]}</Badge>
                    </td>
                    <td className="py-4 px-6 text-surface-600 text-sm">
                      {u.role === "owner"
                        ? "ทั้ง org"
                        : u.branch_roles && Object.keys(u.branch_roles).length > 0
                          ? Object.entries(u.branch_roles)
                              .map(
                                ([id, r]) =>
                                  `${branches.find((b) => b.id === id)?.name ?? id} (${branchRoleLabel[r]})`
                              )
                              .join(", ")
                          : u.branch_ids && u.branch_ids.length > 0
                            ? u.branch_ids
                                .map((id) => branches.find((b) => b.id === id)?.name ?? id)
                                .join(", ")
                            : "ทั้ง org"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <RequireRole allowed={["owner", "manager"]}>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(u)}>
                          แก้ไข
                        </Button>
                      </RequireRole>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && !usersError && (
              <p className="px-6 py-8 text-center text-surface-500 text-sm">ยังไม่มีสมาชิก</p>
            )}
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="Permission Overview" description="สรุปสิทธิ์ตาม Role" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-surface-50 border border-surface-100">
            <p className="font-semibold text-surface-900 text-sm">Owner</p>
            <p className="text-sm text-surface-600 mt-1">ทุกอย่าง • ตั้งค่า • Finance • User</p>
          </div>
          <div className="p-5 rounded-xl bg-surface-50 border border-surface-100">
            <p className="font-semibold text-surface-900 text-sm">Manager</p>
            <p className="text-sm text-surface-600 mt-1">Dashboard • Chat • Booking • AI • จัดการ User</p>
          </div>
          <div className="p-5 rounded-xl bg-surface-50 border border-surface-100">
            <p className="font-semibold text-surface-900 text-sm">Staff</p>
            <p className="text-sm text-surface-600 mt-1">Chat • Booking เท่านั้น (ตาม branch_ids)</p>
          </div>
        </div>
      </section>
    </div>
  );
}
