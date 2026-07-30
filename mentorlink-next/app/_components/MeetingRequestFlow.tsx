"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Slot = { startAt: string; meetingMode: string; durations: number[] };
type Config = {
  mentor: {
    bookingId: string;
    displayName: string;
    subjects: string[];
    meetingModes: string[];
  };
  slots: Slot[];
  availability: { windowCount: number; emptyReason: "NO_AVAILABILITY" | "NO_OPEN_SLOTS" | null; horizonDays: number };
};

const GRADES = [
  "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
  "כיתה ז׳", "כיתה ח׳", "כיתה ט׳", "כיתה י׳", "כיתה י״א", "כיתה י״ב",
  "בוגר/ת",
];

export default function MeetingRequestFlow({
  mentorBookingId,
  mentorDisplayName,
  open,
  onClose,
}: {
  mentorBookingId: string;
  mentorDisplayName: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [duration, setDuration] = useState(0);
  const [childName, setChildName] = useState("");
  const [grade, setGrade] = useState("");
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loadingLater, setLoadingLater] = useState(false);


  useEffect(() => {
    if (!open) return;
    void Promise.all([
      supabase.auth.getSession(),
      fetch(`/api/meeting-requests/available-slots?mentor=${encodeURIComponent(mentorBookingId)}`).then(async (response) => ({ ok: response.ok, body: await response.json() })),
    ]).then(([session, scheduling]) => {
      setAccessToken(session.data.session?.access_token ?? null);
      setRole(session.data.session?.user.user_metadata?.role ?? null);
      if (scheduling.ok && scheduling.body?.mentor && Array.isArray(scheduling.body?.slots)) {
        setConfig(scheduling.body);
        setConfigError("");
      } else {
        setConfig(null);
        setConfigError(scheduling.body?.error ?? "לא ניתן לטעון את המועדים הזמינים.");
      }
    }).catch(() => setConfigError("לא ניתן לטעון את המועדים הזמינים."));
  }, [mentorBookingId, open]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    queueMicrotask(() => closeButtonRef.current?.focus());
  }, [open]);

  const dates = useMemo(
    () => [...new Set((config?.slots ?? []).filter((item) => !mode || item.meetingMode === mode).map((item) => dateKey(item.startAt)))],
    [config, mode],
  );
  const selectedDate = slot ? dateKey(slot.startAt) : "";
  const dateSlots = (config?.slots ?? []).filter(
    (item) => item.meetingMode === mode && dateKey(item.startAt) === selectedDate,
  );
  const hasSelectableSlots = Boolean(config?.slots.length);
  const missingRequirements = [
    !subject ? "יש לבחור מקצוע." : null,
    !mode ? "יש לבחור אופן פגישה." : null,
    hasSelectableSlots && !slot ? "יש לבחור מועד לפגישה." : null,
    hasSelectableSlots && !duration ? "יש לבחור משך פגישה." : null,
    !childName.trim() ? "יש להזין שם פרטי של הילד/ה." : null,
    !grade ? "יש לבחור כיתה או גיל." : null,
    goal.trim().length < 5 ? "יש לתאר במה נדרשת עזרה, בחמישה תווים לפחות." : null,
  ].filter((value): value is string => Boolean(value));
  const complete = hasSelectableSlots && missingRequirements.length === 0;

  async function loadLaterDates() {
    if (loadingLater) return;
    setLoadingLater(true);
    try {
      const response = await fetch(`/api/meeting-requests/available-slots?mentor=${encodeURIComponent(mentorBookingId)}&days=60`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.code ?? "SLOT_LOAD_FAILED");
      setConfig(body);
    } catch (error) {
      console.info("Meeting slots UI", { stage: "load_later", errorName: error instanceof Error ? error.name : "UnknownError" });
      setConfigError("לא ניתן לטעון מועדים מאוחרים יותר.");
    } finally {
      setLoadingLater(false);
    }
  }

  async function submit() {
    if (busy || submitted || !accessToken || !complete || !slot) return;
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/meeting-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mentorBookingId,
        idempotencyKey,
        subject,
        meetingMode: mode,
        requestedStartAt: slot.startAt,
        durationMinutes: duration,
        childFirstName: childName,
        childGradeOrAge: grade,
        helpGoal: goal,
        parentMessage: message,
      }),
    });
    if (response.ok) {
      setStatus("בקשת הפגישה נשלחה לחונך וממתינה לאישור.");
      setSubmitted(true);
    } else {
      const body = await response.json().catch(() => ({}));
      setStatus(body.error ?? "לא ניתן לשלוח את הבקשה.");
    }
    setBusy(false);
  }

  if (!mentorBookingId || !open) return null;
  return (
        <dialog ref={dialogRef} aria-label="בקשת פגישה" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-visible border-0 bg-transparent p-0 backdrop:bg-slate-950/55 sm:m-auto sm:w-[min(calc(100%_-_2rem),42rem)]">
          <div dir="rtl" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">בקשת פגישה עם {mentorDisplayName}</h2>
              <button ref={closeButtonRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="סגירת בקשת פגישה" className="h-11 w-11 rounded-xl border text-2xl">×</button>
            </div>
            {!accessToken ? (
              <div className="mt-6 rounded-2xl bg-blue-50 p-5">
                <p className="font-bold">כדי לשלוח בקשת פגישה יש להתחבר כהורה.</p>
                <div className="mt-4 flex gap-3">
                  <Link href={`/login?returnTo=${encodeURIComponent(`/?mentor=${mentorBookingId}&action=meeting`)}`} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">כניסה</Link>
                  <Link href={`/register/parent?returnTo=${encodeURIComponent(`/?mentor=${mentorBookingId}&action=meeting`)}`} className="rounded-xl border border-blue-300 px-4 py-3 font-bold text-blue-800">הרשמה כהורה</Link>
                </div>
              </div>
            ) : role !== "parent" ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 font-bold text-red-700">רק חשבון הורה יכול לשלוח בקשת פגישה.</p>
            ) : configError ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 font-bold text-red-700">{configError}</p>
            ) : !config ? (
              <p className="mt-6">טוען מועדים זמינים...</p>
            ) : (
              <div className="mt-6 space-y-6">
                {config.availability.emptyReason === "NO_AVAILABILITY" && <p role="status" className="rounded-xl bg-amber-50 p-4 font-bold text-amber-900">החונך עדיין לא הגדיר מועדים זמינים לפגישה. לא ניתן לקבוע פגישה כרגע.</p>}
                {config.availability.emptyReason === "NO_OPEN_SLOTS" && <div className="rounded-xl bg-amber-50 p-4 text-amber-900"><p className="font-bold">אין כרגע מועדים פנויים בטווח המוצג.</p>{config.availability.horizonDays < 60 && <button type="button" disabled={loadingLater} onClick={loadLaterDates} className="mt-3 min-h-11 rounded-xl border border-amber-700 px-4 py-2 font-bold">{loadingLater ? "טוען..." : "הצגת מועדים מאוחרים יותר"}</button>}</div>}
                <Choice title="א. נושא הפגישה" values={config.mentor.subjects} selected={subject} onSelect={(value) => { setSubject(value); }} />
                <Choice title="ב. אופן הפגישה" values={config.mentor.meetingModes} selected={mode} onSelect={(value) => { setMode(value); setSlot(null); setDuration(0); }} />
                {mode && <Choice title="ג. בחירת יום" values={dates} selected={selectedDate} format={formatDate} onSelect={(value) => { const first = config.slots.find((item) => item.meetingMode === mode && dateKey(item.startAt) === value); setSlot(first ?? null); setDuration(0); }} />}
                {selectedDate && <Choice title="שעה" values={dateSlots.map((item) => item.startAt)} selected={slot?.startAt ?? ""} format={formatTime} onSelect={(value) => { setSlot(dateSlots.find((item) => item.startAt === value) ?? null); setDuration(0); }} />}
                {slot && <Choice title="ד. משך הפגישה" values={slot.durations.map(String)} selected={String(duration || "")} format={(value) => `${value} דקות`} onSelect={(value) => setDuration(Number(value))} />}
                <fieldset><legend className="mb-2 font-black">ה. פרטי הילד/ה</legend><div className="grid gap-4 sm:grid-cols-2">
                  <Field label="שם פרטי של הילד/ה"><input value={childName} onChange={(event) => setChildName(event.target.value)} maxLength={60} /></Field>
                  <Field label="כיתה או גיל"><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">בחירה</option>{GRADES.map((value) => <option key={value}>{value}</option>)}</select></Field>
                </div></fieldset>
                <Field label="ו. במה נדרשת עזרה"><textarea value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} rows={3} /></Field>
                <Field label="ז. הודעה קצרה לחונך (לא חובה)"><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={2} /></Field>
                {complete && slot && <div className="rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-black">סיכום</p><p>{subject} · {mode} · {formatDate(selectedDate)} · {formatTime(slot.startAt)} · {duration} דקות</p><p>{childName} · {grade}</p></div>}
                {hasSelectableSlots && !slot && mode && <p role="status" className="rounded-xl bg-amber-50 p-3 font-bold text-amber-900">יש לבחור מועד לפגישה.</p>}
                {!complete && <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-black">כדי לשלוח את הבקשה:</p><ul className="mt-2 list-inside list-disc text-sm text-slate-700">{missingRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div>}
                <button type="button" disabled={!complete || busy || submitted} onClick={submit} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitted ? "הבקשה נשלחה" : busy ? "שולח..." : "שליחת בקשת פגישה"}</button>
                {status && <p role="status" className="rounded-xl bg-blue-50 p-4 text-center font-bold">{status}</p>}
              </div>
            )}
          </div>
        </dialog>
  );
}

function Choice({ title, values, selected, onSelect, format = (value) => value }: { title: string; values: string[]; selected: string; onSelect: (value: string) => void; format?: (value: string) => string }) {
  return <fieldset><legend className="mb-2 font-black">{title}</legend><div className="flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => onSelect(value)} className={`min-h-11 rounded-xl border px-4 py-2 font-bold ${selected === value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300"}`}>{format(value)}</button>)}</div>{!values.length && <p className="text-sm text-slate-500">אין אפשרויות זמינות.</p>}</fieldset>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 font-bold [&_input]:rounded-xl [&_input]:border [&_input]:p-3 [&_select]:rounded-xl [&_select]:border [&_select]:p-3 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:p-3">{label}{children}</label>;
}

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`));
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
