"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/public/accept-invite/validate?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setStatus("valid");
          setEmail(d.email ?? "");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim() || null, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/login?invite=success");
      } else {
        setError(data.error ?? "เกิดข้อผิดพลาด");
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") router.push("/login");
  };

  if (status === "loading") {
    return (
      <div className="luxury-card p-12 text-center">
        <div className="h-8 w-48 bg-cream-200 animate-pulse rounded-lg mx-auto mb-4" />
        <div className="h-4 w-64 bg-cream-100 animate-pulse rounded mx-auto" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="luxury-card p-8 text-center">
        <h1 className="font-display text-xl font-semibold text-mauve-800">ลิงก์ไม่ถูกต้อง</h1>
        <p className="font-body text-mauve-600 mt-2">
          ลิงก์อาจหมดอายุหรือใช้ไปแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อขอคำเชิญใหม่
        </p>
        <Link href="/login">
          <Button variant="primary" className="mt-6">ไปหน้าเข้าสู่ระบบ</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="luxury-card p-8 max-w-md mx-auto">
      <h1 className="font-display text-xl font-semibold text-mauve-800">ยอมรับคำเชิญ</h1>
      <p className="font-body text-sm text-mauve-600 mt-1 mb-6">
        ตั้งรหัสผ่านสำหรับ {email}
      </p>
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
        <Input
          label="ชื่อ-นามสกุล"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="(ถัดไป)"
        />
        <Input
          label="รหัสผ่าน"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="อย่างน้อย 6 ตัวอักษร"
          required
        />
        <Input
          label="ยืนยันรหัสผ่าน"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder=""
          required
        />
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="primary" loading={submitting}>
            ยืนยัน
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/login")}>
            ยกเลิก
          </Button>
        </div>
      </form>
      <p className="font-body text-xs text-mauve-400 mt-4">
        กด Escape เพื่อยกเลิก
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-cream-100">
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-rg-100/80 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-rg-200/60 blur-3xl" />
      <Suspense fallback={<div className="luxury-card p-12 h-64 animate-pulse" />}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
