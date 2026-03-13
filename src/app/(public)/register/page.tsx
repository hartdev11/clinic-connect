"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/layout/AuthLayout";

const fadeSlideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
};

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [clinicName, setClinicName] = useState("");
  const [branches, setBranches] = useState("1");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState<"single" | "franchise">("single");

  const [fullName, setFullName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canProceedStep1 = clinicName.trim().length > 0 && phone.trim().length > 0;
  const canSubmitStep2 =
    licenseKey.trim().length >= 8 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword;

  const handleStep1Next = () => {
    setError("");
    if (!canProceedStep1) {
      setError("กรุณากรอกชื่อคลินิกและเบอร์ติดต่อ");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmitStep2) {
      if (!licenseKey.trim()) setError("กรุณากรอก License Key");
      else if (licenseKey.trim().length < 8) setError("License Key ต้องอย่างน้อย 8 ตัวอักษร");
      else if (!email.trim()) setError("กรุณากรอกอีเมลเจ้าของ");
      else if (password.length < 6) setError("กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัว");
      else if (password !== confirmPassword) setError("รหัสผ่านยืนยันไม่ตรงกัน");
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
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON");
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
    <AuthLayout
      title="เริ่มต้นเส้นทาง ความงาม"
      subtitle="สร้างบัญชีคลินิกของคุณและพบกับประสบการณ์การจัดการที่เหนือระดับ"
      quote="ทุกคลินิกที่ยอดเยี่ยมเริ่มต้นด้วยระบบที่ดี"
      quoteAuthor="— ประสบการณ์จากผู้ใช้จริง"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-semibold text-mauve-800 mb-1">
            สร้างบัญชีใหม่
          </h1>
          <p className="text-sm font-body text-mauve-400">
            กรอกข้อมูลเพื่อเริ่มใช้งาน Clinic Connect
          </p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2" role="status" aria-label={`ขั้นตอนที่ ${step} จาก 2`}>
          <div
            className={`h-2 rounded-full flex-1 transition-all duration-300 ${
              step >= 1 ? "bg-rg-500" : "bg-cream-300"
            }`}
          />
          <div
            className={`h-2 rounded-full flex-1 transition-all duration-300 ${
              step >= 2 ? "bg-rg-500" : "bg-cream-300"
            }`}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              {...fadeSlideUp}
              className="space-y-4"
            >
              <p className="text-xs font-body font-medium text-mauve-500 uppercase tracking-wider">
                ขั้นที่ 1 — ข้อมูลองค์กร
              </p>
              <Input
                label="ชื่อคลินิก *"
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
                min={1}
              />
              <Input
                label="เบอร์ติดต่อ *"
                type="tel"
                placeholder="02-xxx-xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div>
                <label className="block text-sm font-body font-medium text-mauve-700 mb-1.5">
                  ที่อยู่
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="ที่อยู่สำนักงาน/สาขาหลัก"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-cream-300 text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 font-body text-sm resize-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-body font-medium text-mauve-700 mb-1.5">
                  ประเภทธุรกิจ
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as "single" | "franchise")}
                  className="w-full px-4 py-3 rounded-2xl border border-cream-300 text-mauve-800 bg-white focus:outline-none focus:ring-2 focus:ring-rg-300/50 focus:border-rg-400 font-body text-sm"
                >
                  <option value="single">คลินิกเดียว (Single)</option>
                  <option value="franchise">แฟรนไชส์ (Franchise)</option>
                </select>
              </div>
              <Button
                type="button"
                variant="primary"
                size="lg"
                shimmer
                onClick={handleStep1Next}
                disabled={!canProceedStep1}
                className="w-full mt-4"
              >
                ถัดไป — บัญชีผู้ดูแล
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.form
              key="step2"
              {...fadeSlideUp}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <p className="text-xs font-body font-medium text-mauve-500 uppercase tracking-wider">
                ขั้นที่ 2 — บัญชีผู้ดูแลระบบ
              </p>
              <Input
                label="ชื่อ-นามสกุล"
                placeholder="ชื่อเจ้าของคลินิก"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="License Key (คีย์จากแพ็กเกจ) *"
                type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                autoComplete="off"
              />
              <Input
                label="อีเมลเจ้าของ *"
                type="email"
                placeholder="owner@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="รหัสผ่าน *"
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="ยืนยันรหัสผ่าน *"
                type="password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

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

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  ย้อนกลับ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  shimmer
                  loading={loading}
                  disabled={loading || !canSubmitStep2}
                  className="flex-1"
                >
                  สมัครคลินิก
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="divider-rg my-2" aria-hidden />

        <p className="text-center text-sm font-body text-mauve-400">
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href="/login"
            className="text-rg-500 hover:text-rg-600 underline-offset-4 hover:underline font-medium transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
