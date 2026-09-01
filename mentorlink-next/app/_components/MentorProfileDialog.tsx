"use client";

import { useEffect, useId, useRef } from "react";
import type { PublicMentor } from "@/lib/public-mentor-core";

export type MentorProfileActivity = {
  id: string;
  title: string;
  subjectName: string;
  nextStartAt: string | null;
  registrationOpen: boolean;
};

export default function MentorProfileDialog({
  mentor,
  activities = [],
  onActivities,
  onMeeting,
  onClose,
}: {
  mentor: PublicMentor;
  activities?: MentorProfileActivity[];
  onActivities?: () => void;
  onMeeting?: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const tone = mentorTone(mentor);
  const initial = Array.from(mentor.displayName.trim())[0] || "מ";

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto max-h-[92dvh] w-[min(calc(100%_-_1.5rem),46rem)] overflow-y-auto rounded-[2rem] border-0 bg-white p-0 text-right text-slate-950 shadow-[0_30px_90px_-20px_rgba(15,23,42,.55)] backdrop:bg-slate-950/65"
    >
      <section className={`relative overflow-hidden border-b ${tone.hero}`}>
        <div className={`absolute inset-x-0 top-0 h-2 ${tone.bar}`} />
        <div className="absolute left-4 top-4 rounded-2xl bg-white/90 p-1.5 shadow-sm backdrop-blur">
          <img src="/mentorlink-logo.png" alt="MentorLink" className="h-8 w-auto object-contain" />
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="סגירת פרטי החונך"
          className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl border border-white/70 bg-white/90 text-2xl font-black text-slate-700 shadow-sm"
        >
          ×
        </button>
        <div className="px-5 pb-6 pt-20 sm:px-7">
          <div className="flex flex-wrap items-center gap-5">
            <div className={`grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.75rem] border-4 border-white bg-white text-4xl font-black shadow-xl ${tone.text}`}>
              {mentor.profilePhotoUrl ? (
                <img src={mentor.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-black ${tone.text}`}>חונך/ת ב־MentorLink</p>
              <h2 id={titleId} className="mt-1 break-words text-3xl font-black leading-tight sm:text-4xl">
                {mentor.displayName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-700">
                {mentor.city ? <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-sm">📍 {mentor.city}</span> : null}
                {mentor.age ? <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-sm">גיל {mentor.age}</span> : null}
                {mentor.meetingModes.slice(0, 2).map((mode) => <span key={mode} className="rounded-full bg-white/80 px-3 py-1.5 shadow-sm">{mode}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 p-5 sm:p-7">
        {mentor.introduction ? (
          <ProfileSection title="אודות החונך" accent={tone.accent}>
            <p className="whitespace-pre-wrap leading-7 text-slate-700">{mentor.introduction}</p>
          </ProfileSection>
        ) : null}

        {mentor.subjects.length ? (
          <ProfileSection title="תחומי חונכות" accent={tone.accent}>
            <div className="flex flex-wrap gap-2">
              {mentor.subjects.map((subject) => (
                <span key={subject} className={`rounded-full border px-3 py-1.5 text-sm font-black ${tone.chip}`}>{subject}</span>
              ))}
            </div>
          </ProfileSection>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileValues title="מתאים לגילאים" values={mentor.ageGroups} tone={tone} empty="לא צוינה שכבת גיל" />
          <ProfileValues title="ניסיון וסוגי חונכות" values={mentor.experience} tone={tone} empty="הפרטים יתעדכנו בהמשך" />
          <ProfileValues title="אופן המפגש" values={mentor.meetingModes} tone={tone} empty="אופן המפגש טרם צוין" />
          <ProfileValues title="זמינות" values={mentor.availability} tone={tone} empty="יש לבדוק זמינות בעת בקשת פגישה" />
        </div>

        {mentor.nextAvailability?.length ? (
          <section className={`rounded-3xl border p-5 ${tone.availability}`}>
            <p className={`text-sm font-black ${tone.text}`}>המועדים הקרובים</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {mentor.nextAvailability.slice(0, 4).map((slot) => (
                <div key={`${slot.startAt}-${slot.meetingMode}`} className="rounded-2xl bg-white/90 p-3 shadow-sm">
                  <p className="font-black">{formatAvailability(slot.startAt)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{slot.meetingMode} · {slot.durationMinutes} דקות</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activities.length ? (
          <button type="button" onClick={onActivities} className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-right font-black text-violet-900 transition hover:bg-violet-100">
            {activities.length} פעילויות של {mentor.displayName} — לצפייה ולהרשמה ←
          </button>
        ) : null}
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:px-7">
        {onMeeting ? <button type="button" onClick={onMeeting} className="min-h-12 flex-1 rounded-2xl bg-blue-700 px-6 font-black text-white shadow-lg transition hover:bg-blue-800">בקשת פגישה</button> : null}
        <button type="button" onClick={() => dialogRef.current?.close()} className="min-h-12 rounded-2xl border border-slate-300 bg-white px-6 font-black text-slate-700">סגירה</button>
      </footer>
    </dialog>
  );
}

function ProfileSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`h-8 w-1.5 rounded-full ${accent}`} /><h3 className="text-lg font-black">{title}</h3></div><div className="mt-4">{children}</div></section>;
}

function ProfileValues({ title, values, tone, empty }: { title: string; values: string[]; tone: ReturnType<typeof mentorTone>; empty: string }) {
  return <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"><h3 className="font-black">{title}</h3>{values.length ? <div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <span key={value} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${tone.chip}`}>{value}</span>)}</div> : <p className="mt-2 text-sm text-slate-500">{empty}</p>}</section>;
}

function mentorTone(mentor: PublicMentor) {
  const ageText = mentor.ageGroups.join(" ");
  if (/גן|כיתה א|כיתה ב|א׳|ב׳/.test(ageText)) {
    return {
      hero: "border-amber-200 bg-gradient-to-l from-amber-50 via-yellow-50 to-white",
      bar: "bg-amber-400",
      accent: "bg-amber-400",
      text: "text-amber-800",
      chip: "border-amber-200 bg-amber-50 text-amber-900",
      availability: "border-amber-200 bg-amber-50/70",
    };
  }
  if (/כיתה ג|כיתה ד|כיתה ה|כיתה ו|ג׳|ד׳|ה׳|ו׳/.test(ageText)) {
    return {
      hero: "border-emerald-200 bg-gradient-to-l from-emerald-50 via-green-50 to-white",
      bar: "bg-emerald-500",
      accent: "bg-emerald-500",
      text: "text-emerald-800",
      chip: "border-emerald-200 bg-emerald-50 text-emerald-900",
      availability: "border-emerald-200 bg-emerald-50/70",
    };
  }
  return {
    hero: "border-blue-200 bg-gradient-to-l from-blue-50 via-cyan-50 to-white",
    bar: "bg-blue-600",
    accent: "bg-blue-600",
    text: "text-blue-800",
    chip: "border-blue-200 bg-blue-50 text-blue-900",
    availability: "border-blue-200 bg-blue-50/70",
  };
}

function formatAvailability(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
