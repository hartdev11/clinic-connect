"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Onboarding layout — Guard: redirect to /clinic if already onboarded
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/onboarding/status", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { needsOnboarding: true })
      .then((data) => {
        if (!data.needsOnboarding) {
          router.replace("/clinic");
        }
      })
      .catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen bg-cream-100 ent-theme-luxury-bg">
      {children}
    </div>
  );
}
