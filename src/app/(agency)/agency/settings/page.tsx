"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export default function AgencySettingsPage() {
  const { data, error, mutate } = useSWR<{
    id: string;
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string | null;
    customDomain?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    commissionRate: number;
    status: string;
  }>("/api/agency/settings", fetcher);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setLogoUrl(data.logoUrl ?? "");
      setPrimaryColor(data.primaryColor ?? "");
      setCustomDomain(data.customDomain ?? "");
    }
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/agency/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || null,
          customDomain: customDomain || null,
        }),
      });
      if (res.ok) {
        mutate();
      }
    } finally {
      setSaving(false);
    }
  };

  if (error || !data) {
    return (
      <div className="luxury-card p-6">
        <p className="text-sm text-red-600">โหลดไม่สำเร็จ</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl"
    >
      <h2 className="font-display text-xl font-semibold text-mauve-800 mb-6">
        ตั้งค่า Agency
      </h2>
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="ชื่อ Agency"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อ Agency"
        />
        <Input
          label="Logo URL"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
        />
        <Input
          label="สีหลัก (hex)"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          placeholder="#0c7a6f"
        />
        <Input
          label="Custom Domain"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="app.yourdomain.com"
        />
        <p className="text-xs text-mauve-500">
          ตั้งค่า CNAME ของโดเมนชี้มาที่แอปนี้ เพื่อใช้ White Label
        </p>
        <Button type="submit" loading={saving} disabled={saving}>
          บันทึก
        </Button>
      </form>
    </motion.div>
  );
}
