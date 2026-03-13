"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type PublicPromo = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
};

const publicPromos: PublicPromo[] = [];

export default function PromotionsPage() {
  const loading = false;

  return (
    <div className="min-h-screen bg-cream-100">
      <div
        className="py-16 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, var(--cream-100), var(--cream-200))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-body text-xs text-rg-500 uppercase tracking-widest mb-3">
            โปรโมชันพิเศษ
          </p>
          <h1 className="font-display text-display-md font-semibold text-mauve-900">
            ข้อเสนอสุดพิเศษ
          </h1>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="luxury-card overflow-hidden h-64 animate-pulse"
              >
                <div className="h-48 bg-cream-200" />
                <div className="p-5 space-y-2">
                  <div className="h-5 bg-cream-200 rounded w-3/4" />
                  <div className="h-4 bg-cream-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : publicPromos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card p-12 text-center"
          >
            <p className="font-body text-mauve-500 mb-4">
              ยังไม่มีโปรโมชันที่เผยแพร่
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
            {publicPromos.map((promo, i) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="luxury-card overflow-hidden group"
              >
                <div className="relative h-48 bg-gradient-to-br from-rg-200 to-rg-400 overflow-hidden">
                  {promo.imageUrl ? (
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold text-mauve-800 mb-1">
                    {promo.title}
                  </h3>
                  <p className="font-body text-sm text-mauve-500 line-clamp-2">
                    {promo.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {!loading && publicPromos.length > 0 && (
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
