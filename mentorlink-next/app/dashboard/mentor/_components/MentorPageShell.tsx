"use client";

import { ReactNode } from "react";

export type FormMessage = {
  type: "success" | "error";
  text: string;
} | null;

export const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export function MentorPageShell({
  eyebrow = "השלמת הפרופיל",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
      <section dir="rtl" className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 font-bold text-blue-600">{eyebrow}</p>
          <h1 className="text-4xl font-extrabold text-slate-900 md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-lg text-slate-600">{description}</p>
        </div>
        {children}
      </section>

  );
}

export function LoadingPage({ text }: { text: string }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50"
    >
      <p className="text-lg font-bold text-slate-600">{text}</p>
    </main>
  );
}

export function MessageBox({ message }: { message: FormMessage }) {
  if (!message) return null;
  return (
    <p
      role={message.type === "error" ? "alert" : "status"}
      className={`mt-5 rounded-xl p-4 text-center ${
        message.type === "error"
          ? "bg-red-50 text-red-700"
          : "bg-green-50 text-green-700"
      }`}
    >
      {message.text}
    </p>
  );
}

export function SavePanel({
  saving,
  message,
  label = "שמירה",
  disabled = false,
}: {
  saving: boolean;
  message: FormMessage;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
      <button
        type="submit"
        disabled={saving || disabled}
        className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {saving ? "שומר..." : label}
      </button>
      <MessageBox message={message} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-bold text-slate-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function ChoicePills({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <label
            key={option}
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${
              active
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"
            }`}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={() => onToggle(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

export function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
