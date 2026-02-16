import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-surface-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3 rounded-xl border bg-white
            placeholder:text-surface-400 text-surface-800
            focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400
            transition-colors duration-200
            disabled:bg-surface-50 disabled:cursor-not-allowed
            ${error ? "border-red-400" : "border-primary-200/70"}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-surface-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
