import { ClinicSidebar } from "@/components/layout/ClinicSidebar";
import { ClinicTopbar } from "@/components/layout/ClinicTopbar";
import { ClinicContextProvider } from "@/contexts/ClinicContext";

export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClinicContextProvider>
      <div className="min-h-screen flex bg-surface-50">
        <ClinicSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <ClinicTopbar />
          <main className="flex-1 p-6 md:p-8 overflow-auto max-w-[1600px]">{children}</main>
        </div>
      </div>
    </ClinicContextProvider>
  );
}
