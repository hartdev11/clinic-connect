"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/layout/AuthLayout";

type AgencyBrand = { id: string; name: string; logoUrl?: string | null; primaryColor?: string | null };

export default function LoginPage() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agency, setAgency] = useState<AgencyBrand | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.host;
    fetch(`/api/public/agency-by-domain?host=${encodeURIComponent(host)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.agency) setAgency(data.agency);
      })
      .catch(() => {});
  }, []);

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
    <AuthLayout
      title={agency?.name ? `เข้าสู่ระบบ ${agency.name}` : "ยินดีต้อนรับกลับ"}
      subtitle="เข้าสู่ระบบเพื่อจัดการคลินิกของคุณด้วยระบบ AI อัจฉริยะ"
      quote="ความงามที่แท้จริงเริ่มต้นจากการดูแลที่ใส่ใจ"
      quoteAuthor="— Clinic Connect Philosophy"
      logoUrl={agency?.logoUrl ?? undefined}
      primaryColor={agency?.primaryColor ?? undefined}
      brandName={agency?.name ?? undefined}
    >
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-semibold text-mauve-800 mb-1">
            เข้าสู่ระบบ
          </h1>
          <p className="text-sm font-body text-mauve-400">
            ยินดีต้อนรับกลับสู่ Clinic Connect
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="animate-fade-slide-up stagger-1">
            <Input
              label="License Key (คีย์จากแพ็กเกจ)"
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="animate-fade-slide-up stagger-2">
            <Input
              label="อีเมล"
              type="email"
              placeholder="email@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="animate-fade-slide-up stagger-3">
            <Input
              label="รหัสผ่าน"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-body"
              role="alert"
            >
              <span>⚠</span> {error}
            </motion.div>
          )}

          <div className="animate-fade-slide-up stagger-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              shimmer
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              เข้าสู่ระบบ
            </Button>
          </div>
        </form>

        <div className="divider-rg my-2" aria-hidden />

        <p className="text-center text-sm font-body text-mauve-400">
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/register"
            className="text-rg-500 hover:text-rg-600 underline-offset-4 hover:underline font-medium transition-colors"
          >
            สมัครคลินิก
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
