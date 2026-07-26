"use client";

import { useMemo, useState } from "react";

import type { PublicMentor } from "@/lib/public-mentor-core";
import { ALL_CITIES, filterPublicMentors } from "@/lib/public-mentor-filter";

export default function PublicMentorDirectory({
  mentors,
}: {
  mentors: PublicMentor[];
}) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(ALL_CITIES);
  const cities = useMemo(
    () =>
      [
        ...new Set(
          mentors
            .map((mentor) => mentor.city)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((first, second) => first.localeCompare(second, "he")),
    [mentors],
  );
  const filtered = useMemo(
    () => filterPublicMentors(mentors, search, city),
    [city, mentors, search],
  );

  const resetFilters = () => {
    setSearch("");
    setCity(ALL_CITIES);
  };

  return (
    <section
      aria-label="חיפוש חונכים"
      className="mx-auto w-full max-w-6xl"
    >
      <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.36fr)]">
          <label
            htmlFor="mentor-search"
            className="min-w-0 text-sm font-black text-slate-700"
          >
            חיפוש לפי שם או תחום
            <span className="relative mt-2 block">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                id="mentor-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="לדוגמה: מתמטיקה"
                className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white py-3 pr-12 pl-4 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </span>
          </label>

          <label
            htmlFor="mentor-city"
            className="min-w-0 text-sm font-black text-slate-700"
          >
            עיר
            <select
              id="mentor-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value={ALL_CITIES}>{ALL_CITIES}</option>
              {cities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="text-sm font-bold text-slate-600"
        >
          חונכים נמצאו:{" "}
          <strong className="text-base font-black text-slate-950">
            {filtered.length}
          </strong>
        </p>
        {(search || city !== ALL_CITIES) && (
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-xl px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ניקוי הסינון
          </button>
        )}
      </div>

      {filtered.length ? (
        <div className="mt-5 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((mentor, index) => (
            <MentorCard
              key={`${mentor.displayName}-${mentor.city ?? ""}-${index}`}
              mentor={mentor}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm sm:px-8">
          <div
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700"
          >
           ⌕
          </div>
          <h3 className="mt-4 text-xl font-black text-slate-950">
            {mentors.length
              ? "לא נמצאו חונכים שמתאימים לחיפוש"
              : "עדיין אין חונכים שפורסמו"}
          </h3>
          <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">
            {mentors.length
              ? "אפשר לנסות תחום אחר, לבחור עיר אחרת או לנקות את הסינון."
              : "אנחנו בונים את קהילת החונכים בזהירות. כדאי לחזור אלינו בקרוב."}
          </p>
          {mentors.length > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 min-h-12 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              ניקוי החיפוש
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function MentorCard({ mentor }: { mentor: PublicMentor }) {
  const initial = Array.from(mentor.displayName.trim())[0] || "מ";

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_35px_-22px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_45px_-24px_rgba(37,99,235,0.4)]">
      <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-l from-blue-50/80 via-white to-violet-50/60 p-5">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-2xl font-black text-white shadow-lg shadow-blue-200/70"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <h3 className="break-words text-2xl font-black leading-tight text-slate-950">
            {mentor.displayName}
          </h3>
          {mentor.city && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4 shrink-0"
              >
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="truncate">{mentor.city}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {mentor.subjects.length > 0 && (
          <div>
            <p className="text-xs font-black tracking-wide text-blue-700">
              תחומי חונכות
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="תחומי חונכות">
              {mentor.subjects.map((subject) => (
                <li
                  key={subject}
                  className="max-w-full break-words rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800"
                >
                  {subject}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mentor.introduction && (
          <p className="mt-4 line-clamp-4 break-words leading-7 text-slate-700">
            {mentor.introduction}
          </p>
        )}

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5">
          <CardSection label="מתאים לגילאים" values={mentor.ageGroups} />
          <CardSection label="סוג החונכות" values={mentor.experience} />
          <CardSection label="אופן המפגש" values={mentor.meetingModes} />
          <CardSection label="זמינות כללית" values={mentor.availability} />
        </div>
      </div>
    </article>
  );
}

function CardSection({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;

  return (
    <div className="min-w-0">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-800">
        {values.join(" · ")}
      </p>
    </div>
  );
}
