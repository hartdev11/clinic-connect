/**
 * Phase 9 — Admin layout (super_admin only)
 * Protects /admin/* routes
 */
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  const userId = session.user_id ?? session.clinicId;
  if (!userId) {
    redirect("/login");
  }
  const user = await getUserById(userId);
  if (!user || user.role !== "super_admin") {
    redirect("/clinic");
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="border-b border-cream-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="font-display text-lg font-semibold text-mauve-800">
            Admin
          </Link>
          <nav className="flex gap-4">
            <Link href="/admin" className="text-sm text-mauve-600 hover:text-mauve-800">
              Dashboard
            </Link>
            <Link href="/admin/packages" className="text-sm text-mauve-600 hover:text-mauve-800">
              แพ็กเกจ
            </Link>
            <Link href="/admin/coupons" className="text-sm text-mauve-600 hover:text-mauve-800">
              คูปอง
            </Link>
            <Link href="/admin/platform-intelligence" className="text-sm text-mauve-600 hover:text-mauve-800">
              Platform Intelligence
            </Link>
            <Link href="/clinic" className="text-sm text-mauve-500 hover:text-mauve-700">
              ← กลับ
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
