import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "white";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

  const variants = {
    primary:
      "bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400 shadow-md shadow-primary-400/25 hover:shadow-lg hover:shadow-primary-400/30",
    secondary:
      "bg-surface-100 text-surface-800 hover:bg-primary-50 hover:text-primary-700 focus:ring-primary-200",
    outline:
      "border-2 border-primary-400 text-primary-600 hover:bg-primary-50 focus:ring-primary-300",
    ghost:
      "text-surface-700 hover:bg-primary-50 hover:text-primary-600 focus:ring-primary-200",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400",
    white:
      "bg-white text-surface-800 hover:bg-primary-50/80 focus:ring-primary-200 shadow-soft",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          กำลังดำเนินการ...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
