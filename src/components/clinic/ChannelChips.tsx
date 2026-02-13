"use client";

/**
 * Channel chips for Customer & Chat — LINE, Facebook, Instagram, TikTok, Web
 * Enterprise: aria, keyboard nav, reduced motion
 */
import type { CustomerSource } from "@/types/clinic";

export const CHANNELS: {
  value: "all" | CustomerSource;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "all",
    label: "ทั้งหมด",
    color: "text-surface-600",
    bg: "bg-surface-50",
    border: "border-surface-200",
    icon: <ChannelIconAll />,
  },
  {
    value: "line",
    label: "LINE",
    color: "text-[#06c755]",
    bg: "bg-[#06c755]/8",
    border: "border-[#06c755]/30",
    icon: <ChannelIconLine />,
  },
  {
    value: "facebook",
    label: "Facebook",
    color: "text-[#1877f2]",
    bg: "bg-[#1877f2]/8",
    border: "border-[#1877f2]/30",
    icon: <ChannelIconFacebook />,
  },
  {
    value: "instagram",
    label: "Instagram",
    color: "text-[#e4405f]",
    bg: "bg-gradient-to-br from-[#f9ed32]/20 via-[#e4405f]/15 to-[#833ab4]/20",
    border: "border-[#e4405f]/30",
    icon: <ChannelIconInstagram />,
  },
  {
    value: "tiktok",
    label: "TikTok",
    color: "text-[#000000]",
    bg: "bg-[#00f2ea]/10",
    border: "border-[#ff0050]/20",
    icon: <ChannelIconTikTok />,
  },
  {
    value: "web",
    label: "Web",
    color: "text-surface-600",
    bg: "bg-surface-100",
    border: "border-surface-200",
    icon: <ChannelIconWeb />,
  },
];

function ChannelIconAll() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ChannelIconLine() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

function ChannelIconFacebook() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ChannelIconInstagram() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function ChannelIconTikTok() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

function ChannelIconWeb() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

export function ChannelChips({
  value,
  onChange,
  counts,
  ariaLabel = "เลือกแพลตฟอร์มแชท",
}: {
  value: "all" | CustomerSource;
  onChange: (v: "all" | CustomerSource) => void;
  counts?: Partial<Record<"all" | CustomerSource, number>>;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {CHANNELS.map((ch) => {
        const isActive = value === ch.value;
        const count = counts?.[ch.value];
        return (
          <button
            key={ch.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(ch.value)}
            onKeyDown={(e) => {
              const idx = CHANNELS.findIndex((c) => c.value === ch.value);
              if (e.key === "ArrowRight" && idx < CHANNELS.length - 1) {
                e.preventDefault();
                onChange(CHANNELS[idx + 1].value);
              }
              if (e.key === "ArrowLeft" && idx > 0) {
                e.preventDefault();
                onChange(CHANNELS[idx - 1].value);
              }
            }}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              border transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2
              ${isActive
                ? `${ch.bg} ${ch.color} ${ch.border} border shadow-sm`
                : "bg-surface-50/50 border-surface-200 text-surface-500 hover:bg-surface-100 hover:text-surface-700 hover:border-surface-300"
              }
            `}
          >
            <span className="[&>svg]:flex-shrink-0" aria-hidden>{ch.icon}</span>
            <span>{ch.label}</span>
            {count != null && count > 0 && (
              <span className={isActive ? "opacity-90" : "opacity-70"}>({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function getChannelLabel(source: string): string {
  return CHANNELS.find((c) => c.value === source)?.label ?? source;
}
