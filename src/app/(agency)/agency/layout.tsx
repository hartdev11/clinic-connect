/**
 * Phase 20 — Agency layout
 */
import Link from "next/link";

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-40 border-b border-cream-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/agency" className="font-display text-lg font-semibold text-mauve-800">
            Agency Dashboard
          </Link>
          <nav className="flex gap-4">
            <Link
              href="/agency"
              className="text-sm font-medium text-mauve-600 hover:text-mauve-800"
            >
              ภาพรวม
            </Link>
            <Link
              href="/agency/settings"
              className="text-sm font-medium text-mauve-600 hover:text-mauve-800"
            >
              ตั้งค่า
            </Link>
            <Link
              href="/clinic"
              className="text-sm font-medium text-rg-600 hover:text-rg-700"
            >
              กลับไป Clinic
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
