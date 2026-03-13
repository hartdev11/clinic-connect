"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { PACKAGES } from "@/lib/packages-config";
import { cn } from "@/lib/utils";

/** "main" = คลินิกเดี่ยวหรือสาขาหลัก (ไปเลือกที่ register) | "sub" = สาขาย่อย (กรอกรหัสสาขาหลัก) */
type WhoAreYou = "main" | "sub";

const PLAN_ICONS: Record<string, string> = {
  starter: "✦",
  professional: "◈",
  multi_branch: "⬡",
  enterprise: "◇",
};

export default function PackagesPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [whoAreYou, setWhoAreYou] = useState<WhoAreYou | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const [emailSendError, setEmailSendError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [franchiseSubSuccess, setFranchiseSubSuccess] = useState(false);
  const [mainBranchCode, setMainBranchCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subAddress, setSubAddress] = useState("");
  const [subPhone, setSubPhone] = useState("");

  const selected = selectedPlan ? PACKAGES.find((p) => p.id === selectedPlan) : null;
  const recommendedId = PACKAGES.find((p) => p.selectable)?.id ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selected?.selectable || !email.trim()) return;
    if (whoAreYou === "sub" && (!mainBranchCode.trim() || !subName.trim())) {
      setError("กรุณากรอกรหัสสาขาหลักและชื่อสาขา");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        email: email.trim(),
        plan: selected.id,
      };
      if (whoAreYou === "sub") {
        body.franchiseSub = true;
        body.mainBranchCode = mainBranchCode.trim().toUpperCase();
        body.sub_name = subName.trim();
        body.sub_address = subAddress.trim() || undefined;
        body.sub_phone = subPhone.trim() || undefined;
      }
      const res = await fetch("/api/public/purchase-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }
      const key = data.license_key ?? "";
      const isFranchiseSub = Boolean(data.franchiseSub);
      setLicenseKey(key);
      setEmailSent(data.emailSent !== false);
      setEmailSendError(data.error ?? "");
      setSuccessMessage((data.message as string) ?? "");
      setFranchiseSubSuccess(isFranchiseSub);
      setSuccess(true);
      const params = new URLSearchParams();
      params.set("email", email.trim());
      if (isFranchiseSub) {
        params.set("from", "franchise_sub");
      } else if (key) {
        params.set("license_key", key);
      }
      router.push(`/register?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Hero header */}
      <div
        className="relative overflow-hidden py-20 px-6 text-center"
        style={{
          background:
            "linear-gradient(145deg, var(--mauve-800) 0%, var(--mauve-600) 60%, var(--rg-500) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(201,149,108,0.5), transparent 60%)",
          }}
        />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-white/5" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full border border-rg-400/10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10"
        >
          <p className="font-body text-xs text-rg-300 tracking-widest uppercase mb-4">
            เลือกแผนที่เหมาะกับคุณ
          </p>
          <h1 className="font-display text-5xl font-light text-cream-100 mb-4">
            แพ็คเกจของเรา
          </h1>
          <p className="font-body text-sm text-rg-300 max-w-md mx-auto leading-relaxed">
            เริ่มต้นฟรี หรือเลือกแผนที่ตรงกับขนาดคลินิกของคุณ
          </p>
        </motion.div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {success ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card padding="lg" className="max-w-md mx-auto text-center">
              <h2 className="font-display text-xl font-semibold text-mauve-800">
                บันทึกสำเร็จ
              </h2>
              <p className="mt-2 font-body text-sm text-mauve-500">
                {franchiseSubSuccess && successMessage
                  ? successMessage
                  : "กำลังนำคุณไปลงทะเบียนคลินิก..."}
              </p>
              {franchiseSubSuccess && (
                <p className="mt-2 text-sm font-body text-mauve-400">
                  เจ้าของสาขาหลักจะได้รับอีเมล — หลังอนุมัติคุณจะได้รับอีเมลพร้อม
                  License Key
                </p>
              )}
              <p className="mt-6">
                <Link
                  href="/register"
                  className="text-rg-500 hover:text-rg-600 underline-offset-4 hover:underline font-medium transition-colors"
                >
                  ไปลงทะเบียนเลย →
                </Link>
              </p>
            </Card>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {PACKAGES.map((pkg, i) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.1 + 0.2,
                    duration: 0.5,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={cn(
                    "relative luxury-card p-8 flex flex-col h-full",
                    pkg.id === recommendedId && "shimmer-border ring-1 ring-rg-400/30"
                  )}
                >
                  {pkg.id === recommendedId && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-rg-500 to-rg-400 text-white text-xs font-body font-medium px-4 py-1 rounded-full shadow-luxury">
                        แนะนำ
                      </span>
                    </div>
                  )}

                  {pkg.id === recommendedId && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rg-50/50 to-transparent pointer-events-none" />
                  )}

                  <div className="relative z-10 flex flex-col h-full">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-5 text-xl",
                        pkg.id === recommendedId
                          ? "bg-rg-500 text-white"
                          : "bg-cream-200 text-mauve-500"
                      )}
                    >
                      {PLAN_ICONS[pkg.id] ?? "✦"}
                    </div>

                    <h3 className="font-display text-xl font-semibold text-mauve-800 mb-1">
                      {pkg.name}
                    </h3>
                    <p className="font-body text-sm text-mauve-400 mb-6 leading-relaxed">
                      {pkg.description}
                    </p>

                    <div className="mb-6">
                      {pkg.priceBaht === 0 || pkg.priceBaht == null ? (
                        <p className="font-display text-2xl font-semibold text-mauve-800">
                          {pkg.priceLabel}
                        </p>
                      ) : (
                        <div className="flex items-end gap-1">
                          <p className="font-display text-2xl font-semibold text-mauve-800">
                            ฿{pkg.priceBaht.toLocaleString()}
                          </p>
                          <p className="font-body text-sm text-mauve-400 mb-1">
                            /เดือน
                          </p>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-3 flex-1 mb-8">
                      {pkg.features.map((f, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2.5 text-sm font-body"
                        >
                          <span className="text-rg-500 flex-shrink-0 mt-0.5">
                            ✓
                          </span>
                          <span className="text-mauve-600">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {!pkg.selectable ? (
                      <p className="text-xs font-body text-mauve-400 mt-auto">
                        อัพเกรดได้จากหน้า Login หลังสมัคร
                      </p>
                    ) : (
                      <Button
                        variant={pkg.id === recommendedId ? "primary" : "outline"}
                        size="lg"
                        shimmer={pkg.id === recommendedId}
                        className="w-full"
                        onClick={() => setSelectedPlan(pkg.id)}
                      >
                        เลือกแพ็คเกจ
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {selected != null && selected.selectable && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card padding="lg" className="max-w-lg mx-auto">
                  <h3 className="font-display text-xl font-semibold text-mauve-800">
                    เลือกแพ็คเกจ {selected.name}
                  </h3>
                  <p className="font-body text-sm text-mauve-400 mt-1">
                    บันทึกอีเมลเพื่อรับลิงก์ยืนยัน — เลือกก่อนว่าคุณเป็นแบบไหน
                  </p>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-mauve-600 mb-3">
                      คุณเป็นแบบไหน?
                    </p>
                    <div className="space-y-3">
                      <label
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                          whoAreYou === "main"
                            ? "border-rg-400 bg-rg-50 shadow-luxury"
                            : "border-cream-300 hover:border-rg-200 bg-white/80"
                        )}
                      >
                        <input
                          type="radio"
                          name="who"
                          checked={whoAreYou === "main"}
                          onChange={() => setWhoAreYou("main")}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            whoAreYou === "main"
                              ? "bg-rg-500 text-white"
                              : "bg-cream-200 text-mauve-500"
                          )}
                        >
                          ◈
                        </div>
                        <div>
                          <p className="font-body font-medium text-mauve-700 text-sm">
                            คลินิกเดี่ยว หรือ สาขาหลัก
                          </p>
                          <p className="font-body text-xs text-mauve-400 mt-0.5">
                            ซื้อเพื่อตัวเอง — หลังบันทึกไปลงทะเบียน
                            แล้วเลือกได้ว่าจะเป็นคลินิกเดี่ยวหรือสาขาหลักแฟรนไชส์
                          </p>
                        </div>
                      </label>
                      <label
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                          whoAreYou === "sub"
                            ? "border-rg-400 bg-rg-50 shadow-luxury"
                            : "border-cream-300 hover:border-rg-200 bg-white/80"
                        )}
                      >
                        <input
                          type="radio"
                          name="who"
                          checked={whoAreYou === "sub"}
                          onChange={() => setWhoAreYou("sub")}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                            whoAreYou === "sub"
                              ? "bg-rg-500 text-white"
                              : "bg-cream-200 text-mauve-500"
                          )}
                        >
                          ⬡
                        </div>
                        <div>
                          <p className="font-body font-medium text-mauve-700 text-sm">
                            สาขาย่อย
                          </p>
                          <p className="font-body text-xs text-mauve-400 mt-0.5">
                            มีรหัสจากสาขาหลักแล้ว — ระบบจะส่งคำขอให้สาขาหลักอนุมัติ
                            หลังอนุมัติจะได้ License Key ทางอีเมล
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {whoAreYou === "sub" && (
                      <>
                        <div className="animate-fade-slide-up stagger-1">
                          <Input
                            label="รหัสสาขาหลัก"
                            value={mainBranchCode}
                            onChange={(e) =>
                              setMainBranchCode(e.target.value.toUpperCase())
                            }
                            placeholder="INV-XXXXXX-XXXXXX (ขอจากเจ้าของสาขาหลัก)"
                            autoComplete="off"
                          />
                        </div>
                        <div className="animate-fade-slide-up stagger-2">
                          <Input
                            label="ชื่อสาขา"
                            value={subName}
                            onChange={(e) => setSubName(e.target.value)}
                            placeholder="ชื่อสาขาย่อย"
                          />
                        </div>
                        <div className="animate-fade-slide-up stagger-3">
                          <Input
                            label="ที่อยู่สาขา (ถ้ามี)"
                            value={subAddress}
                            onChange={(e) => setSubAddress(e.target.value)}
                            placeholder="ที่อยู่"
                          />
                        </div>
                        <div className="animate-fade-slide-up stagger-4">
                          <Input
                            label="เบอร์โทรสาขา (ถ้ามี)"
                            value={subPhone}
                            onChange={(e) => setSubPhone(e.target.value)}
                            placeholder="02-xxx-xxxx"
                          />
                        </div>
                      </>
                    )}

                    <div className="animate-fade-slide-up stagger-5">
                      <Input
                        type="email"
                        label="อีเมล"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@clinic.com"
                        required
                        autoComplete="email"
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

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      shimmer
                      loading={loading}
                      disabled={loading || whoAreYou === null}
                      className="w-full"
                    >
                      {loading ? "กำลังบันทึก..." : "ยืนยันและรับอีเมล"}
                    </Button>

                    {whoAreYou === null && (
                      <p className="text-sm font-body text-mauve-400 text-center">
                        กรุณาเลือกว่าคุณเป็นคลินิกเดี่ยว/สาขาหลัก หรือสาขาย่อยด้านบน
                      </p>
                    )}
                  </form>
                </Card>
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center text-sm font-body text-mauve-400 mt-12"
            >
              <Link
                href="/"
                className="text-rg-500 hover:text-rg-600 underline-offset-4 hover:underline transition-colors"
              >
                ← กลับหน้าหลัก
              </Link>
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}
