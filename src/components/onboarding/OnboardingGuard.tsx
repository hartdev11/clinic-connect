"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClinicContext } from "@/contexts/ClinicContext";

/**
 * When needsOnboarding is true, redirect to /onboarding
 * Used in clinic layout
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { needsOnboarding, isLoading } = useClinicContext();

  useEffect(() => {
    if (isLoading) return;
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="luxury-card p-8 animate-pulse w-64 h-32 rounded-2xl" />
      </div>
    );
  }
  if (needsOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="luxury-card p-8 text-center">
          <p className="font-body text-mauve-600">กำลังนำคุณไปสู่ขั้นตอนตั้งค่า...</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
