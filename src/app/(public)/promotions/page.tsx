"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type PublicPromo = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
};

export default function PromotionsPage() {
  const [publicPromos, setPublicPromos] = useState<PublicPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("host", window.location.host);
    if (process.env.NODE_ENV === "development") {
      const oid = new URLSearchParams(window.location.search).get("org_id");
      if (oid) params.set("org_id", oid);
    }
    setLoading(true);
    setFetchError(null);
    fetch(`/api/public/promotions?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { items?: PublicPromo[]; error?: string }) => {
        if (data?.error) setFetchError(data.error);
        setPublicPromos(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((e) => {
        setFetchError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setPublicPromos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-cream-100">
      <div
        className="py-16 px-4 sm:px-6 text-center"
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {fetchError && process.env.NODE_ENV === "development" && (
          <p className="font-body text-sm text-red-600 mb-6 text-center">{fetchError}</p>
        )}
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
            <p className="font-body text-mauve-500 mb-2">
              ยังไม่มีโปรโมชันที่เผยแพร่
            </p>
            {process.env.NODE_ENV === "development" && (
              <p className="font-body text-xs text-mauve-400 mb-4 max-w-lg mx-auto">
                ตั้งค่า <code className="text-mauve-600">PROMOTIONS_PUBLIC_ORG_ID</code> ใน{" "}
                <code className="text-mauve-600">.env.local</code> หรือเปิด{" "}
                <code className="text-mauve-600">/promotions?org_id=YOUR_ORG_ID</code> เพื่อทดสอบ
              </p>
            )}
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
                    <Image
                      src={promo.imageUrl}
                      alt={promo.title}
                      fill
                      unoptimized
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
