"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream-100">
      <div
        className="relative overflow-hidden py-16 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, var(--cream-100) 0%, var(--cream-200) 50%, var(--cream-300) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-rg-200/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-48 h-48 rounded-full bg-mauve-100/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <p className="font-body text-xs text-rg-500 uppercase tracking-widest mb-3">
            เกี่ยวกับเรา
          </p>
          <h1 className="font-display text-display-md font-semibold text-mauve-900">
            Clinic Connect
          </h1>
          <p className="font-body text-mauve-500 mt-2 max-w-lg mx-auto">
            แพลตฟอร์มจัดการคลินิกความงามอย่างมืออาชีพ
          </p>
        </motion.div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="luxury-card p-8"
        >
          <h2 className="font-display text-xl font-semibold text-mauve-800 mb-4">
            พันธกิจของเรา
          </h2>
          <p className="font-body text-mauve-600 leading-relaxed mb-6">
            เราออกแบบ Clinic Connect เพื่อให้คลินิกความงามสามารถจัดการการจอง
            ลูกค้าสัมพันธ์ แชท AI และรายงานได้ในที่เดียว
            ลดงานซ้ำและยกระดับประสบการณ์ลูกค้า
          </p>
          <h2 className="font-display text-lg font-semibold text-mauve-800 mb-3">
            สิ่งที่เราให้
          </h2>
          <ul className="font-body text-mauve-600 space-y-2 mb-8">
            <li className="flex items-start gap-2">
              <span className="text-rg-500 flex-shrink-0">✓</span>
              ระบบจองออนไลน์ 24 ชั่วโมง
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rg-500 flex-shrink-0">✓</span>
              CRM และประวัติแชท LINE
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rg-500 flex-shrink-0">✓</span>
              AI ตอบแชทอัตโนมัติ
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rg-500 flex-shrink-0">✓</span>
              รายงานและ Insights แบบ Real-time
            </li>
          </ul>
          <Link
            href="/"
            className="inline-flex items-center font-body text-sm font-medium text-rg-600 hover:text-rg-700 transition-colors"
          >
            ← กลับหน้าหลัก
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
