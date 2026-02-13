import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-primary-100/60 bg-[#fefbfb]/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold text-sm shadow-md shadow-primary-400/25">
              ✦
            </span>
            <span className="font-bold text-surface-800">Clinic Connect</span>
            <span className="text-xs font-medium text-surface-400 hidden sm:inline">
              ระบบหลังบ้านคลินิก
            </span>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link
              href="/login"
              className="text-surface-600 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="text-surface-600 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              สมัครคลินิก
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-surface-500 border-t border-primary-100/50 pt-6">
          © {new Date().getFullYear()} Clinic Connect. ระบบหลังบ้านสำหรับคลินิกความงาม
        </p>
      </div>
    </footer>
  );
}
