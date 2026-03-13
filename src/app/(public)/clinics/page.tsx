"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Clinic = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  imageUrl?: string;
};

const clinics: Clinic[] = [];

export default function ClinicsPage() {
  const loading = false;

  return (
    <div className="min-h-screen bg-cream-100">
      <div
        className="relative overflow-hidden py-16 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, var(--cream-100) 0%, var(--cream-200) 50%, var(--cream-300) 100%)",
        }}
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-rg-200/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <p className="font-body text-xs text-rg-500 uppercase tracking-widest mb-3">
            คลินิกที่ใช้ Clinic Connect
          </p>
          <h1 className="font-display text-display-md font-semibold text-mauve-900">
            ไดเรกทอรีคลินิก
          </h1>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="luxury-card overflow-hidden h-56 animate-pulse"
              >
                <div className="h-32 bg-cream-200" />
                <div className="p-5 space-y-2">
                  <div className="h-5 bg-cream-200 rounded w-2/3" />
                  <div className="h-4 bg-cream-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card p-12 text-center"
          >
            <p className="font-body text-mauve-500 mb-4">
              ยังไม่มีคลินิกในรายการ
            </p>
            <Link
              href="/"
              className="font-body text-sm font-medium text-rg-600 hover:text-rg-700 transition-colors"
            >
              ← กลับหน้าหลัก
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics.map((clinic, i) => (
              <motion.div
                key={clinic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="luxury-card overflow-hidden group"
              >
                <div className="relative h-40 bg-gradient-to-br from-rg-200 to-rg-400 overflow-hidden">
                  {clinic.imageUrl ? (
                    <img
                      src={clinic.imageUrl}
                      alt={clinic.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold text-mauve-800 mb-1">
                    {clinic.name}
                  </h3>
                  {clinic.description && (
                    <p className="font-body text-sm text-mauve-500 line-clamp-2 mb-2">
                      {clinic.description}
                    </p>
                  )}
                  {clinic.address && (
                    <p className="font-body text-xs text-mauve-400">
                      {clinic.address}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {!loading && (
          <p className="text-center mt-8">
            <Link
              href="/"
              className="font-body text-sm text-mauve-500 hover:text-rg-600 transition-colors"
            >
              ← กลับหน้าหลัก
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
