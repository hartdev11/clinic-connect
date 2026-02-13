import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({ children, padding = "md", hover, className = "", ...props }: CardProps) {
  const paddings = {
    none: "",
    sm: "p-5",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`
        bg-white rounded-2xl border border-primary-100/80 shadow-card
        ${hover ? "transition-all duration-300 hover:shadow-card-hover hover:border-primary-200/60" : ""}
        ${paddings[padding]} ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-lg font-semibold text-surface-800">{title}</h3>
        {subtitle && <p className="text-sm text-surface-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
