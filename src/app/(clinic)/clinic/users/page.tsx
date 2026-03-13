"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRole } from "@/components/rbac/RequireRole";

import { apiFetcher } from "@/lib/api-fetcher";

type UserRole = "owner" | "manager" | "staff";
type BranchRole = "manager" | "staff";

interface User {
  id: string;
  email: string;
  name?: string | null;
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
  const [inviteSuccess, setInviteSuccess] = useState("");
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
    setInviteSuccess("");
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
      setInviteSuccess(data.message || "ส่งลิงก์เชิญทางอีเมลแล้ว");
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

  const branchDisplay = (u: User) =>
    u.role === "owner"
      ? "ทั้ง org"
      : u.branch_roles && Object.keys(u.branch_roles).length > 0
        ? Object.entries(u.branch_roles)
            .map(([id, r]) => `${branches.find((b) => b.id === id)?.name ?? id} (${branchRoleLabel[r]})`)
            .join(", ")
        : u.branch_ids && u.branch_ids.length > 0
          ? u.branch_ids.map((id) => branches.find((b) => b.id === id)?.name ?? id).join(", ")
          : "ทั้ง org";

  return (
    <div className="space-y-6">
      <PageHeader
        title="ผู้ใช้งาน"
        subtitle="จัดการสมาชิกและสิทธิ์การเข้าถึง"
        actions={
          <RequireRole allowed={["owner", "manager"]}>
            <Button variant="primary" size="sm" shimmer onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? "ปิดฟอร์ม" : "+ เพิ่มผู้ใช้"}
            </Button>
          </RequireRole>
        }
      />

      {showInvite && (
        <div className="luxury-card p-6">
          <form onSubmit={handleInvite} className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-mauve-800">เชิญผู้ใช้ใหม่</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="อีเมล"
                type="email"
                placeholder="user@clinic.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 rounded-xl border border-cream-200 bg-white font-body text-mauve-800 focus:border-rg-400 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
                >
                  {(["owner", "manager", "staff"] as const).map((r) => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            {branches.length > 0 && inviteRole !== "owner" && (
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1.5">
                  Role ต่อสาขา (E2.9 — แยก org vs branch)
                </label>
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="font-body text-sm text-mauve-700 w-32">{b.name}</span>
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
                        className="px-3 py-2 rounded-xl border border-cream-200 bg-white font-body text-sm text-mauve-800"
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
            {inviteSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <p className="font-body text-sm font-medium text-emerald-900">{inviteSuccess}</p>
                <p className="font-body text-xs text-emerald-700 mt-1">ผู้ใช้จะได้รับลิงก์ทางอีเมล — หมดอายุใน 48 ชม.</p>
              </div>
            )}
            {inviteError && <p className="font-body text-sm text-red-600">{inviteError}</p>}
            <Button type="submit" loading={inviteLoading} disabled={inviteLoading}>เชิญผู้ใช้</Button>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="luxury-card p-6">
          <form onSubmit={handleEdit} className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-mauve-800">แก้ไข {editingUser.email}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1.5">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 rounded-xl border border-cream-200 bg-white font-body text-mauve-800 focus:border-rg-400 focus:outline-none focus:ring-2 focus:ring-rg-300/50"
                >
                  {(["owner", "manager", "staff"] as const).map((r) => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            {branches.length > 0 && editRole !== "owner" && (
              <div>
                <label className="block font-body text-sm font-medium text-mauve-700 mb-1.5">Role ต่อสาขา</label>
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="font-body text-sm text-mauve-700 w-32">{b.name}</span>
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
                        className="px-3 py-2 rounded-xl border border-cream-200 bg-white font-body text-sm text-mauve-800"
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
            {editError && <p className="font-body text-sm text-red-600">{editError}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={editLoading} disabled={editLoading}>บันทึก</Button>
              <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>ยกเลิก</Button>
            </div>
          </form>
        </div>
      )}

      <div className="luxury-card overflow-hidden">
        {usersError && (
          <p className="px-6 py-4 font-body text-sm text-red-600">{usersError.message}</p>
        )}
        <div className="divide-y divide-cream-200">
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-cream-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rg-200 to-rg-400 flex items-center justify-center text-white font-display font-semibold flex-shrink-0">
                {u.name?.[0] ?? u.email?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-mauve-800 truncate">{u.name ?? u.email}</p>
                <p className="font-body text-xs text-mauve-400 truncate">{u.email}</p>
              </div>
              <Badge
                variant={
                  u.role === "owner" ? "premium" : u.role === "manager" ? "info" : "default"
                }
              >
                {u.role === "owner" ? "Owner" : u.role === "manager" ? "Manager" : "Staff"}
              </Badge>
              <p className="font-body text-xs text-mauve-400 hidden sm:block max-w-[120px] truncate">
                {branchDisplay(u)}
              </p>
              <RequireRole allowed={["owner", "manager"]}>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => startEdit(u)}
                    className="w-8 h-8 rounded-xl hover:bg-rg-100 text-mauve-400 hover:text-rg-600 flex items-center justify-center transition-all text-sm"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="w-8 h-8 rounded-xl hover:bg-red-50 text-mauve-400 hover:text-red-500 flex items-center justify-center transition-all text-sm"
                    title="ลบ (ยังไม่เปิดใช้)"
                  >
                    ✕
                  </button>
                </div>
              </RequireRole>
            </motion.div>
          ))}
        </div>
        {(!users || users.length === 0) && !usersError && (
          <EmptyState
            icon={<span className="text-2xl">○</span>}
            title="ยังไม่มีผู้ใช้"
            description="เพิ่มสมาชิกเพื่อเริ่มใช้งาน"
            action={
              <RequireRole allowed={["owner", "manager"]}>
                <Button variant="primary" shimmer onClick={() => setShowInvite(true)}>
                  + เพิ่มผู้ใช้
                </Button>
              </RequireRole>
            }
          />
        )}
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold text-mauve-800 mb-4">Permission Overview</h2>
        <p className="font-body text-sm text-mauve-500 mb-4">สรุปสิทธิ์ตาม Role</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="luxury-card p-5">
            <p className="font-display font-semibold text-mauve-800 text-sm">Owner</p>
            <p className="font-body text-sm text-mauve-600 mt-1">ทุกอย่าง • ตั้งค่า • Finance • User</p>
          </div>
          <div className="luxury-card p-5">
            <p className="font-display font-semibold text-mauve-800 text-sm">Manager</p>
            <p className="font-body text-sm text-mauve-600 mt-1">Dashboard • Chat • Booking • AI • จัดการ User</p>
          </div>
          <div className="luxury-card p-5">
            <p className="font-display font-semibold text-mauve-800 text-sm">Staff</p>
            <p className="font-body text-sm text-mauve-600 mt-1">Chat • Booking เท่านั้น (ตาม branch_ids)</p>
          </div>
        </div>
      </section>
    </div>
  );
}
