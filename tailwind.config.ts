import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Phase 0 — Rose Gold × Cream
        rg: {
          50: "#FDF9F7",
          100: "#FAF4F0",
          200: "#F5E8E0",
          300: "#E8B4A0",
          400: "#D4957A",
          500: "#C9956C",
          600: "#B07A54",
          700: "#8B5E3C",
          800: "#6B3F52",
          900: "#3D2235",
        },
        cream: {
          50: "#FFFFFF",
          100: "#FAF7F4",
          200: "#F5EDE8",
          300: "#EDE0D8",
          400: "#D9C4B8",
          500: "#B8A098",
        },
        mauve: {
          50: "#FAF5F7",
          100: "#F0E6EC",
          200: "#E0C8D4",
          300: "#C4879F",
          400: "#A8607E",
          500: "#8B5270",
          600: "#6B3F52",
          700: "#52303F",
          800: "#3D2235",
          900: "#2A1525",
        },
        // โทนคลินิกความงาม: โรส บลัช ครีม
        primary: {
          50: "#fef7f8",
          100: "#fdedef",
          200: "#fad5da",
          300: "#f5b0bb",
          400: "#ec8295",
          500: "#e05c76",
          600: "#c94462",
          700: "#a83752",
          800: "#8c3047",
          900: "#772d40",
          950: "#451a25",
        },
        // โรสโกลด์ / วอร์ม
        accent: {
          50: "#fdf8f3",
          100: "#f9ede0",
          200: "#f2d9c2",
          300: "#e8be96",
          400: "#d99a6a",
          500: "#c97d47",
          600: "#b86a3a",
        },
        clinic: {
          50: "#fdf4f7",
          100: "#fae8ef",
          200: "#f5d0df",
          300: "#eca8c4",
          400: "#e07aa3",
          500: "#c95c8a",
        },
        // Brand colors (semantic — ChannelChips, LINE mock)
        line: { 500: "#06c755" },
        facebook: { 500: "#1877f2" },
        instagram: { 500: "#e4405f", yellow: "#f9ed32", purple: "#833ab4" },
        tiktok: { black: "#000000", cyan: "#00f2ea", pink: "#ff0050" },
        teal: { 600: "#0c7a6f" },
        // วอร์มนิวทรัล (ครีม โทนอุ่น)
        surface: {
          50: "#faf9f8",
          100: "#f5f3f1",
          200: "#e8e4e0",
          300: "#d4cec8",
          400: "#9c958d",
          500: "#6b6560",
          600: "#534e4a",
          700: "#3d3936",
          800: "#2a2725",
          900: "#1c1a19",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        display: ["Cormorant Garamond", "Georgia", "serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-2xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "display-md": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "display-sm": ["1.875rem", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "display-xs": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.005em" }],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.06), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        "card-hover":
          "0 20px 50px -15px rgba(192, 68, 98, 0.12), 0 4px 15px -4px rgba(0, 0, 0, 0.06)",
        "elevation-1": "0 1px 3px rgba(0,0,0,0.05)",
        "elevation-2": "0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)",
        glow: "0 0 40px -10px rgba(224, 92, 118, 0.3)",
        "glow-soft": "0 0 60px -20px rgba(224, 92, 118, 0.15)",
        "inner-soft": "inset 0 1px 0 0 rgba(255,255,255,0.08)",
        luxury:
          "0 4px 24px rgba(201,149,108,0.12), 0 1px 4px rgba(201,149,108,0.08)",
        "luxury-lg":
          "0 8px 48px rgba(201,149,108,0.18), 0 2px 8px rgba(201,149,108,0.10)",
        "luxury-xl":
          "0 16px 64px rgba(201,149,108,0.22), 0 4px 16px rgba(201,149,108,0.12)",
        glass:
          "0 8px 32px rgba(201,149,108,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
        "inner-soft-rg":
          "inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(201,149,108,0.08)",
        mauve: "0 4px 24px rgba(107,63,82,0.15)",
        none: "none",
      },
      backgroundImage: {
        "rg-gradient":
          "linear-gradient(135deg, #E8B4A0 0%, #C9956C 50%, #B07A54 100%)",
        "rg-gradient-soft":
          "linear-gradient(135deg, #FAF4F0 0%, #F5E8E0 50%, #EDE0D8 100%)",
        "mauve-gradient":
          "linear-gradient(135deg, #8B5270 0%, #6B3F52 100%)",
        "glass-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(250,247,244,0.72) 100%)",
        shimmer:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        glass: "20px",
        heavy: "40px",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out forwards",
        "fade-in-up": "fadeInUp 0.3s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "gradient-x": "gradientX 8s ease infinite",
        "fade-slide-up":
          "fadeSlideUp 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both",
        "fade-slide-in":
          "fadeSlideIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both",
        "fade-in-phase0": "fadeIn 0.3s ease both",
        "shimmer-phase0": "shimmerBg 2.5s linear infinite",
        "shimmer-text": "shimmerText 4s linear infinite",
        "glow-pulse": "glowPulse 2.5s ease-in-out infinite",
        "scale-in-phase0": "scaleIn 0.3s cubic-bezier(0.4,0,0.2,1) both",
        "slide-down": "slideDown 0.3s cubic-bezier(0.25,0.46,0.45,0.94) both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmerBg: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        shimmerText: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201,149,108,0)" },
          "50%": { boxShadow: "0 0 0 8px rgba(201,149,108,0.12)" },
        },
        particleDrift: {
          "0%": {
            transform: "translateY(0) scale(1)",
            opacity: "0.7",
          },
          "50%": {
            transform: "translateY(-15px) scale(1.05)",
            opacity: "0.4",
          },
          "100%": {
            transform: "translateY(-30px) scale(0.9)",
            opacity: "0",
          },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      transitionTimingFunction: {
        luxury: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        bounce: "cubic-bezier(0.4, 0, 0.2, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animationDelay: {
        50: "50ms",
        100: "100ms",
        150: "150ms",
        200: "200ms",
        250: "250ms",
        300: "300ms",
        400: "400ms",
        500: "500ms",
        600: "600ms",
        700: "700ms",
        800: "800ms",
      },
      backgroundSize: {
        "300%": "300%",
      },
    },
  },
  plugins: [],
};

export default config;
