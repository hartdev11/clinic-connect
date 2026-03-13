import { ClinicContextProvider } from "@/contexts/ClinicContext";
import { ClinicShell } from "@/components/layout/ClinicShell";
import { ToastProvider } from "@/components/ui/Toast";
import { OnboardingGuard } from "@/components/onboarding/OnboardingGuard";

export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClinicContextProvider>
      <ToastProvider>
        <OnboardingGuard>
          <ClinicShell>{children}</ClinicShell>
        </OnboardingGuard>
      </ToastProvider>
    </ClinicContextProvider>
  );
}
