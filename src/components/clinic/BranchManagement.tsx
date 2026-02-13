"use client";

/**
 * FE-3 — Branch Management Component
 * List, Create, Edit branches
 */
import { useState, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { RequireRole } from "@/components/rbac/RequireRole";
import { useClinicContext } from "@/contexts/ClinicContext";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

interface Branch {
  id: string;
  name: string;
  address?: string;
}

export function BranchManagement() {
  const { currentOrg, subscriptionPlan } = useClinicContext();
  const { data, mutate } = useSWR<{ items: Branch[] }>("/api/clinic/branches", fetcher);
  const branches = data?.items ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const maxBranches = subscriptionPlan?.maxBranches ?? currentOrg?.branchesCount ?? 1;
  const canAddMore = branches.length < maxBranches;

  function resetForm() {
    setForm({ name: "", address: "" });
    setError(null);
  }

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setForm({ name: branch.name, address: branch.address ?? "" });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    resetForm();
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setError("กรุณากรอกชื่อสาขา");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "เพิ่มสาขาไม่สำเร็จ");
        if (json.warning) setWarning(json.warning);
        return;
      }
      if (json.warning) setWarning(json.warning);
      resetForm();
      setShowCreate(false);
      mutate();
    } catch (err) {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingId || !form.name.trim()) {
      setError("กรุณากรอกชื่อสาขา");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/branches/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "แก้ไขไม่สำเร็จ");
        return;
      }
      cancelEdit();
      mutate();
    } catch (err) {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireRole allowed={["owner", "manager"]}>
      <section>
        <SectionHeader
          title="Branch Management"
          description={`จัดการสาขา — ${branches.length}/${maxBranches} สาขา`}
        />
        <Card padding="lg">
          <CardHeader
            title="Branch Management"
            subtitle="จัดการสาขา"
            action={
              canAddMore ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(true);
                    setWarning(null);
                  }}
                >
                  + เพิ่มสาขา
                </Button>
              ) : (
                <p className="text-sm text-surface-500">ถึงขีดจำกัดสาขาแล้ว</p>
              )
            }
          />

          {warning && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {warning}
            </div>
          )}

          {showCreate && (
            <div className="mb-6 p-6 rounded-xl bg-surface-50 border border-surface-100 space-y-4">
              <h3 className="font-semibold text-surface-900 text-sm">เพิ่มสาขาใหม่</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="ชื่อสาขา"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="สาขาสุขุมวิท"
                />
                <Input
                  label="ที่อยู่ (ไม่บังคับ)"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="สุขุมวิท 21"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={handleCreate} loading={loading} disabled={loading}>
                  เพิ่มสาขา
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                    setWarning(null);
                  }}
                >
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {branches.length === 0 ? (
              <p className="text-sm text-surface-500 py-4">ยังไม่มีสาขา</p>
            ) : (
              branches.map((branch) => (
                <div
                  key={branch.id}
                  className="p-5 rounded-xl border border-surface-200/80 flex justify-between items-center"
                >
                  {editingId === branch.id ? (
                    <div className="flex-1 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Input
                          label="ชื่อสาขา"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                        <Input
                          label="ที่อยู่"
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                      </div>
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdate} loading={loading} disabled={loading}>
                          บันทึก
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium text-surface-900">{branch.name}</p>
                        {branch.address && <p className="text-sm text-surface-500">{branch.address}</p>}
                      </div>
                      <RequireRole allowed={["owner", "manager"]}>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(branch)}>
                          แก้ไข
                        </Button>
                      </RequireRole>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </RequireRole>
  );
}
