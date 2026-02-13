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
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.06), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        "card-hover":
          "0 20px 50px -15px rgba(192, 68, 98, 0.12), 0 4px 15px -4px rgba(0, 0, 0, 0.06)",
        glow: "0 0 40px -10px rgba(224, 92, 118, 0.3)",
        "glow-soft": "0 0 60px -20px rgba(224, 92, 118, 0.15)",
        "inner-soft": "inset 0 1px 0 0 rgba(255,255,255,0.08)",
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
      },
      animationDelay: {
        100: "100ms",
        200: "200ms",
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
