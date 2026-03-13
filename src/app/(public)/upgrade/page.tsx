"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PACKAGES } from "@/lib/packages-config";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<string, string> = {
  starter: "✦",
  professional: "◈",
  multi_branch: "⬡",
  enterprise: "◇",
};

export default function UpgradePage() {
  const recommendedId = PACKAGES.find((p) => p.selectable)?.id ?? null;

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Hero — same as Packages */}
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
            อัพเกรดแผน
          </h1>
          <p className="font-body text-sm text-rg-300 max-w-md mx-auto leading-relaxed">
            เริ่มต้นฟรี หรืออัพเกรดเมื่อพร้อม — เลือกแผนที่ตรงกับขนาดคลินิกของคุณ
          </p>
        </motion.div>
      </div>

      {/* Pricing cards — same layout as Packages */}
      <div className="max-w-6xl mx-auto px-6 py-16">
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
                pkg.id === recommendedId &&
                  "shimmer-border ring-1 ring-rg-400/30"
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

                {pkg.selectable ? (
                  <Link
                    href="/packages"
                    className={cn(
                      "inline-flex items-center justify-center w-full h-12 px-6 rounded-2xl font-body font-medium transition-all duration-300",
                      pkg.id === recommendedId
                        ? "bg-gradient-to-br from-rg-400 to-rg-600 text-white shadow-luxury hover:shadow-luxury-lg"
                        : "border border-rg-400 text-rg-600 hover:bg-rg-50"
                    )}
                  >
                    เลือกแพ็คเกจ
                  </Link>
                ) : (
                  <p className="text-xs font-body text-mauve-400 mt-auto">
                    อัพเกรดได้จากหน้า Login หลังสมัคร
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
