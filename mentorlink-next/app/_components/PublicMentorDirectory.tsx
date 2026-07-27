"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { PublicMentor } from "@/lib/public-mentor-core";
import MeetingRequestFlow from "./MeetingRequestFlow";
import MentorInquiryFlow from "./MentorInquiryFlow";
import { ALL_CITIES, filterPublicMentors } from "@/lib/public-mentor-filter";

export default function PublicMentorDirectory({ mentors }: { mentors: PublicMentor[] }) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(ALL_CITIES);
  const cities = useMemo(
    () => [...new Set(mentors.map((mentor) => mentor.city).filter((value): value is string => Boolean(value)))]
      .sort((first, second) => first.localeCompare(second, "he")),
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
    <section dir="rtl" aria-label="חיפוש חונכים" className="mx-auto w-full max-w-7xl overflow-x-clip">
      <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.36fr)]">
          <label htmlFor="mentor-search" className="min-w-0 text-sm font-black text-slate-700">
            חיפוש לפי שם או תחום
            <span className="relative mt-2 block">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
              </svg>
              <input id="mentor-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="לדוגמה: מתמטיקה" className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white py-3 pr-12 pl-4 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </span>
          </label>
          <label htmlFor="mentor-city" className="min-w-0 text-sm font-black text-slate-700">
            עיר
            <select id="mentor-city" value={city} onChange={(event) => setCity(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              <option value={ALL_CITIES}>{ALL_CITIES}</option>
              {cities.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm font-bold text-slate-600">
          חונכים נמצאו: <strong className="text-base font-black text-slate-950">{filtered.length}</strong>
        </p>
        {(search || city !== ALL_CITIES) && (
          <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            ניקוי הסינון
          </button>
        )}
      </div>

      {filtered.length ? (
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),17.5rem))] justify-center gap-4">
          {filtered.map((mentor, index) => (
            <MentorCard key={`${mentor.displayName}-${mentor.city ?? ""}-${index}`} mentor={mentor} />
          ))}
        </div>
      ) : (
        <EmptyState hasMentors={mentors.length > 0} onReset={resetFilters} />
      )}
    </section>
  );
}

function MentorCard({ mentor }: { mentor: PublicMentor }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const initial = Array.from(mentor.displayName.trim())[0] || "מ";
  const shortIntroduction = mentor.introduction && mentor.introduction.length > 90
    ? `${mentor.introduction.slice(0, 87).trimEnd()}…`
    : mentor.introduction;

  return (
    <>
      <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initial={initial} large={false} />
          <div className="min-w-0">
            <h3 className="break-words text-xl font-black leading-tight text-slate-950">{mentor.displayName}</h3>
            {mentor.city && <City city={mentor.city} />}
          </div>
        </div>

        {mentor.subjects.length > 0 && (
          <ul aria-label="תחומי חונכות" className="mt-3 flex min-w-0 flex-wrap gap-1.5">
            {mentor.subjects.map((subject) => (
              <li key={subject} className="max-w-full break-words rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold leading-5 text-blue-800 [overflow-wrap:anywhere]">
                {subject}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 grid gap-2">
          <CompactLine label="מתאים לגילאים" values={mentor.ageGroups} />
          <CompactLine label="אופן המפגש" values={mentor.meetingModes} />
        </div>
        {shortIntroduction && <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-slate-600">{shortIntroduction}</p>}

        <button ref={triggerRef} type="button" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog" className="mt-auto min-h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          לפרטים
        </button>
      </article>

      <MentorDetailsDialog
        dialogRef={dialogRef}
        titleId={titleId}
        mentor={mentor}
        initial={initial}
        onClose={() => dialogRef.current?.close()}
        onClosed={() => triggerRef.current?.focus()}
      />
    </>
  );
}

function MentorDetailsDialog({
  dialogRef, titleId, mentor, initial, onClose, onClosed,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleId: string;
  mentor: PublicMentor;
  initial: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby={titleId}
      onClose={onClosed}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[90dvh] w-[min(calc(100%_-_2rem),34rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-right text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        <h2 id={titleId} className="text-lg font-black">פרטי החונך</h2>
        <button type="button" onClick={onClose} aria-label="סגירת פרטי החונך" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-2xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">×</button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-gradient-to-l from-blue-50 to-violet-50 p-4">
          <Avatar initial={initial} large />
          <div className="min-w-0">
            <p className="break-words text-2xl font-black">{mentor.displayName}</p>
            {mentor.city && <City city={mentor.city} />}
          </div>
        </div>
        {mentor.subjects.length > 0 && (
          <DetailsSection title="תחומי חונכות">
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {mentor.subjects.map((subject) => (
                <li key={subject} className="max-w-full break-words rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800 [overflow-wrap:anywhere]">{subject}</li>
              ))}
            </ul>
          </DetailsSection>
        )}
        {mentor.introduction && <DetailsSection title="קצת עליי"><p className="whitespace-pre-wrap break-words leading-7 text-slate-700">{mentor.introduction}</p></DetailsSection>}
        <DetailsValues title="מתאים לגילאים" values={mentor.ageGroups} />
        <DetailsValues title="ניסיון וסוגי חונכות" values={mentor.experience} />
        <DetailsValues title="אופן המפגש" values={mentor.meetingModes} />
        <DetailsValues title="זמינות כללית" values={mentor.availability} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <MentorInquiryFlow mentorBookingId={mentor.bookingId} mentorDisplayName={mentor.displayName} subjects={mentor.subjects} />
          <MeetingRequestFlow mentorBookingId={mentor.bookingId} mentorDisplayName={mentor.displayName} />
        </div>
      </div>
    </dialog>
  );
}

function Avatar({ initial, large }: { initial: string; large: boolean }) {
  return <div aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-600 to-violet-600 font-black text-white shadow-md shadow-blue-200/70 ${large ? "h-16 w-16 rounded-2xl text-2xl" : "h-12 w-12 rounded-xl text-lg"}`}>{initial}</div>;
}

function City({ city }: { city: string }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1 text-sm font-bold text-slate-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
      <span className="truncate">{city}</span>
    </p>
  );
}

function CompactLine({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return <p className="min-w-0 break-words text-sm leading-6 text-slate-700"><span className="font-black text-slate-500">{label}: </span><span className="font-bold">{values.join(" · ")}</span></p>;
}

function DetailsValues({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <DetailsSection title={title}><p className="break-words leading-7 text-slate-700">{values.join(" · ")}</p></DetailsSection>;
}

function DetailsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 border-t border-slate-100 pt-5"><h3 className="mb-2 text-sm font-black text-slate-950">{title}</h3>{children}</section>;
}

function EmptyState({ hasMentors, onReset }: { hasMentors: boolean; onReset: () => void }) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm sm:px-8">
      <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">⌕</div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{hasMentors ? "לא נמצאו חונכים שמתאימים לחיפוש" : "עדיין אין חונכים שפורסמו"}</h3>
      <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">{hasMentors ? "אפשר לנסות תחום אחר, לבחור עיר אחרת או לנקות את הסינון." : "אנחנו בונים את קהילת החונכים בזהירות. כדאי לחזור אלינו בקרוב."}</p>
      {hasMentors && <button type="button" onClick={onReset} className="mt-5 min-h-12 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">ניקוי החיפוש</button>}
    </div>
  );
}
