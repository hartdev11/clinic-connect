"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/clinic", label: "หน้าหลัก", icon: "◈" },
  { href: "/clinic/customers", label: "ลูกค้า", icon: "◎" },
  { href: "/clinic/booking", label: "จอง", icon: "⬡" },
  { href: "/clinic/insights", label: "Insights", icon: "△" },
  { href: "/clinic/settings", label: "ตั้งค่า", icon: "⊙" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-40",
        "glass-frosted border-t border-cream-300/60",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/clinic" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl relative",
                "transition-all duration-200 min-w-[56px]",
                isActive ? "text-rg-600" : "text-mauve-400 hover:text-mauve-600"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl text-base",
                  "transition-all duration-200",
                  isActive
                    ? "bg-rg-100 text-rg-600 shadow-luxury"
                    : "text-mauve-400"
                )}
              >
                {item.icon}
              </span>
              <span
                className={cn(
                  "text-[10px] font-body font-medium tracking-wide",
                  isActive ? "text-rg-600" : "text-mauve-400"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobileActiveNav"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-rg-500"
                  transition={{ duration: 0.25 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
