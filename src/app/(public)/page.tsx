"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PARTICLE_STYLES = [
  { w: 5, h: 5, top: 18, left: 22, opacity: 0.35, delay: 0 },
  { w: 4, h: 4, top: 72, left: 15, opacity: 0.25, delay: 0.7 },
  { w: 6, h: 6, top: 45, left: 78, opacity: 0.3, delay: 1.4 },
  { w: 3, h: 3, top: 25, left: 65, opacity: 0.2, delay: 2.1 },
  { w: 5, h: 5, top: 68, left: 82, opacity: 0.28, delay: 2.8 },
  { w: 4, h: 4, top: 12, left: 48, opacity: 0.22, delay: 3.5 },
  { w: 5, h: 5, top: 55, left: 35, opacity: 0.32, delay: 4.2 },
  { w: 4, h: 4, top: 38, left: 88, opacity: 0.26, delay: 4.9 },
];

const FEATURES = [
  { icon: "◎", title: "จัดการลูกค้า", desc: "ระบบ CRM ครบครัน พร้อมประวัติแชท LINE" },
  { icon: "⬡", title: "ระบบจอง", desc: "จองออนไลน์ได้ตลอด 24 ชั่วโมง" },
  { icon: "✦", title: "AI ตอบแชท", desc: "บอท AI ตอบลูกค้าอัตโนมัติผ่าน LINE" },
  { icon: "△", title: "Insights", desc: "วิเคราะห์ข้อมูลเชิงลึกแบบ Real-time" },
  { icon: "◻", title: "การเงิน", desc: "ติดตามรายรับและใบแจ้งหนี้" },
  { icon: "⬢", title: "Knowledge AI", desc: "ฝึก AI ด้วยข้อมูลของคลินิกคุณเอง" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream-100 overflow-hidden">
      {/* ── HERO SECTION ── */}
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(145deg, var(--cream-100) 0%, var(--cream-200) 40%, var(--cream-300) 100%)",
            }}
          />
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-rg-200/30 blur-3xl" />
          <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full bg-mauve-100/25 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-rg-100/20 blur-3xl animate-float" />
          {PARTICLE_STYLES.map((p, i) => (
            <div
              key={i}
              className="particle absolute"
              style={{
                width: `${p.w}px`,
                height: `${p.h}px`,
                top: `${p.top}%`,
                left: `${p.left}%`,
                background: `rgba(201, 149, 108, ${p.opacity})`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rg-100 border border-rg-200 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-rg-500 animate-glow-pulse" />
              <span className="font-body text-sm text-rg-700 font-medium">
                Beauty Clinic Management Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="font-display text-display-lg font-semibold text-mauve-900 leading-tight mb-6"
            >
              จัดการคลินิกความงาม
              <br />
              <span className="shimmer-text">อย่างมืออาชีพ</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="font-body text-lg text-mauve-500 leading-relaxed mb-10 max-w-lg"
            >
              ระบบจัดการคลินิกความงามครบวงจร — จองคิว ลูกค้าสัมพันธ์ แชท AI
              และรายงานเชิงลึก ในที่เดียว
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link
                href="/login"
                className={cn(
                  "relative inline-flex items-center justify-center font-body font-medium tracking-wide h-14 px-8 text-base rounded-3xl overflow-hidden",
                  "bg-gradient-to-br from-rg-400 to-rg-600 text-white shadow-luxury hover:shadow-luxury-lg hover:from-rg-300 hover:to-rg-500 transition-all duration-300"
                )}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_ease_infinite]" style={{ backgroundSize: "200% 100%" }} aria-hidden />
                เริ่มใช้งานฟรี →
              </Link>
              <Link
                href="/packages"
                className={cn(
                  "inline-flex items-center justify-center font-body font-medium tracking-wide h-14 px-8 text-base rounded-3xl",
                  "glass border border-rg-300/60 text-mauve-600 hover:bg-rg-100 hover:border-rg-400 hover:text-mauve-700 transition-all duration-300"
                )}
              >
                ดูแพ็คเกจ
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-4 mt-10"
            >
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-rg-200 to-rg-400 flex-shrink-0"
                  />
                ))}
              </div>
              <p className="font-body text-sm text-mauve-500">
                <span className="font-semibold text-mauve-700">100+</span>{" "}
                คลินิกไว้วางใจแล้ว
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{
              delay: 0.3,
              duration: 0.7,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="hidden lg:block"
          >
            <div className="luxury-card p-6 shimmer-border animate-float">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rg-300 to-rg-500 flex items-center justify-center text-white text-sm">
                  ✦
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-mauve-800">
                    Clinic Connect
                  </p>
                  <p className="font-body text-[10px] text-mauve-400">
                    Dashboard
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-glow-pulse" />
                  <span className="font-body text-[10px] text-emerald-600">
                    Online
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "การจองวันนี้", value: "24" },
                  { label: "ลูกค้าใหม่", value: "8" },
                  { label: "แชท AI", value: "47" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="p-3 rounded-xl bg-cream-100 text-center"
                  >
                    <p className="font-display text-xl font-semibold text-mauve-800">
                      {s.value}
                    </p>
                    <p className="font-body text-[9px] text-mauve-400">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="h-24 rounded-xl bg-gradient-to-br from-rg-50 to-cream-200 flex items-end justify-around px-3 pb-3 gap-1.5">
                {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{
                      delay: 0.6 + i * 0.1,
                      duration: 0.5,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-rg-500 to-rg-300 opacity-80"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="font-body text-xs text-rg-500 uppercase tracking-widest mb-3">
              ฟีเจอร์หลัก
            </p>
            <h2 className="font-display text-display-md font-semibold text-mauve-900 mb-4">
              ทุกอย่างที่คลินิกต้องการ
            </h2>
            <p className="font-body text-mauve-500 max-w-xl mx-auto">
              จัดการลูกค้า จองคิว แชท AI และรายงาน — ในแพลตฟอร์มเดียว
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="luxury-card p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rg-100 to-rg-200 flex items-center justify-center text-rg-500 text-xl mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-display text-lg font-semibold text-mauve-800 mb-2">
                  {feature.title}
                </h3>
                <p className="font-body text-sm text-mauve-500 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl p-12"
            style={{
              background:
                "linear-gradient(135deg, var(--mauve-800) 0%, var(--mauve-600) 50%, var(--rg-500) 100%)",
            }}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-white/10" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full border border-rg-400/20" />

            <div className="relative z-10">
              <p className="font-body text-xs text-rg-300 uppercase tracking-widest mb-4">
                เริ่มต้นวันนี้
              </p>
              <h2 className="font-display text-display-sm font-semibold text-cream-100 mb-4">
                พร้อมยกระดับคลินิกของคุณ?
              </h2>
              <p className="font-body text-rg-300 mb-8 max-w-md mx-auto">
                เริ่มใช้งานฟรี ไม่ต้องผูกบัตรเครดิต — อัพเกรดเมื่อพร้อม
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/login"
                  className={cn(
                    "relative inline-flex items-center justify-center font-body font-medium h-12 px-6 text-base rounded-2xl overflow-hidden",
                    "bg-white text-mauve-800 hover:bg-rg-50/80 shadow-soft border border-cream-300 hover:border-rg-200 transition-all duration-300"
                  )}
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_ease_infinite]" style={{ backgroundSize: "200% 100%" }} aria-hidden />
                  เริ่มใช้งานฟรี
                </Link>
                <Link
                  href="/packages"
                  className="inline-flex items-center justify-center font-body font-medium h-12 px-6 text-base rounded-2xl text-cream-200 hover:bg-white/10 transition-all duration-300"
                >
                  ติดต่อเรา →
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-cream-300">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="font-body text-sm text-mauve-500">
            © Clinic Connect — Beauty Clinic Management
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/about"
              className="font-body text-sm text-mauve-500 hover:text-rg-600 transition-colors"
            >
              เกี่ยวกับเรา
            </Link>
            <Link
              href="/packages"
              className="font-body text-sm text-mauve-500 hover:text-rg-600 transition-colors"
            >
              แพ็คเกจ
            </Link>
            <Link
              href="/login"
              className="font-body text-sm text-mauve-500 hover:text-rg-600 transition-colors"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
