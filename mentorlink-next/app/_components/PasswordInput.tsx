"use client";

import { useId, useState, type ChangeEventHandler, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  ariaLabel?: string;
  label?: string;
};

export default function PasswordInput({
  value,
  onChange,
  ariaLabel,
  label,
  className = "",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = props.id ?? generatedId;

  return (
    <div className="relative">
      <input
        {...props}
        id={inputId}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel ?? label ?? "סיסמה"}
        className={`min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 pr-12 font-semibold text-slate-950 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 ${className}`}
      />
      <button
        type="button"
        tabIndex={0}
        aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
        aria-pressed={showPassword}
        onClick={() => setShowPassword((current) => !current)}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
      >
        {showPassword ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
            <path d="M2 2l20 20" />
            <path d="M10.5 10.5A2.5 2.5 0 0 0 13.5 13.5" />
            <path d="M9.2 5.3A12.7 12.7 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.4 4.4" />
            <path d="M7.6 7.6A15.8 15.8 0 0 0 2 12s3.5 7 10 7a11.2 11.2 0 0 0 4.4-1" />
          </svg>
        )}
      </button>
    </div>
  );
}
