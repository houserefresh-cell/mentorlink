"use client";

import { useMemo, useState } from "react";
import { findCityMatches } from "@/lib/israeli-cities";

export default function CityAutocomplete({
  value,
  onChange,
  label,
  required = false,
  placeholder = "הקלידו עיר או יישוב",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    if (!value.trim()) return [];
    return findCityMatches(value).slice(0, 8);
  }, [value]);

  return (
    <div className="relative">
      <label className="block text-base font-extrabold text-slate-950">
        {label}
        <input
          required={required}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="mt-2 w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 font-semibold text-slate-950 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          list="city-select"
          autoComplete="off"
        />
      </label>
      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {matches.map((option) => (
            <li key={option}>
              <button
                type="button"
                className="block w-full border-b border-slate-100 px-4 py-3 text-right text-sm font-semibold text-slate-800 transition hover:bg-blue-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
