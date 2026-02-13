"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [branches, setBranches] = useState("");
  const [phone, setPhone] = useState("");
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
    if (licenseKey.trim().length < 8) {
      setError("License Key ต้องอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (!clinicName.trim()) {
      setError("กรุณากรอกชื่อคลินิก");
      return;
    }
    if (!email.trim()) {
      setError("กรุณากรอกอีเมลเจ้าของ");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัว");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          clinicName: clinicName.trim(),
          branches: branches ? Number(branches) || 1 : 1,
          phone: phone.trim(),
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
        setError(data.error || "สมัครไม่สำเร็จ");
        setLoading(false);
        return;
      }

      router.push("/login");
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
          <h1 className="text-2xl font-bold text-surface-800">สมัครคลินิก</h1>
          <p className="mt-2 text-surface-600">
            ระบบหลังบ้านสำหรับคลินิกเท่านั้น — ต้องมี License Key จากแพ็กเกจที่ซื้อ
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
              label="ชื่อคลินิก"
              placeholder="คลินิกความงาม สวยใส"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
            <Input
              label="จำนวนสาขา"
              type="number"
              placeholder="1"
              value={branches}
              onChange={(e) => setBranches(e.target.value)}
            />
            <Input
              label="เบอร์ติดต่อ"
              placeholder="02-xxx-xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="อีเมลเจ้าของ"
              type="email"
              placeholder="owner@clinic.com"
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
              สมัครคลินิก
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-surface-500">
            มีบัญชีอยู่แล้ว?{" "}
            <Link
              href="/login"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
