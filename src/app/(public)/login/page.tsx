"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!licenseKey.trim()) {
      setError("กรุณากรอก License Key (คีย์จากแพ็กเกจที่ซื้อ)");
      return;
    }
    if (!email.trim()) {
      setError("กรุณากรอกอีเมล");
      return;
    }
    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          email: email.trim(),
          password,
        }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON — ตรวจสอบ Terminal ว่ามี error อะไร");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        setLoading(false);
        return;
      }

      router.push("/clinic");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`เกิดข้อผิดพลาด: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-800">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-surface-600">
            ระบบหลังบ้านคลินิก — ต้องมี License Key จากแพ็กเกจที่ซื้อ
          </p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="License Key (คีย์จากแพ็กเกจ)"
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              autoComplete="off"
            />
            <Input
              label="อีเมล"
              type="email"
              placeholder="email@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="รหัสผ่าน"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={loading}
            >
              เข้าสู่ระบบ
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-surface-500">
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/register"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              สมัครคลินิก
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
