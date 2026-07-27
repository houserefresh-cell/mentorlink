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
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [duration, setDuration] = useState(0);
  const [childName, setChildName] = useState("");
  const [grade, setGrade] = useState("");
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());


  useEffect(() => {
    if (!open) return;
    void Promise.all([
      supabase.auth.getSession(),
      fetch(`/api/meeting-requests/available-slots?mentor=${encodeURIComponent(mentorBookingId)}`).then((response) => response.json()),
    ]).then(([session, scheduling]) => {
      setAccessToken(session.data.session?.access_token ?? null);
      setRole(session.data.session?.user.user_metadata?.role ?? null);
      setConfig(scheduling);
    });
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
  const complete = subject && mode && slot && duration && childName.trim() && grade && goal.trim().length >= 5;

  async function submit() {
    if (!accessToken || !complete || !slot) return;
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
      setIdempotencyKey(crypto.randomUUID());
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
            ) : !config ? (
              <p className="mt-6">טוען מועדים זמינים...</p>
            ) : (
              <div className="mt-6 space-y-6">
                <Choice title="1. מקצוע" values={config.mentor.subjects} selected={subject} onSelect={(value) => { setSubject(value); }} />
                <Choice title="2. אופן הפגישה" values={config.mentor.meetingModes} selected={mode} onSelect={(value) => { setMode(value); setSlot(null); setDuration(0); }} />
                {mode && <Choice title="3. תאריך" values={dates} selected={selectedDate} format={formatDate} onSelect={(value) => { const first = config.slots.find((item) => item.meetingMode === mode && dateKey(item.startAt) === value); setSlot(first ?? null); setDuration(0); }} />}
                {selectedDate && <Choice title="שעה" values={dateSlots.map((item) => item.startAt)} selected={slot?.startAt ?? ""} format={formatTime} onSelect={(value) => { setSlot(dateSlots.find((item) => item.startAt === value) ?? null); setDuration(0); }} />}
                {slot && <Choice title="4. משך" values={slot.durations.map(String)} selected={String(duration || "")} format={(value) => `${value} דקות`} onSelect={(value) => setDuration(Number(value))} />}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="שם פרטי של הילד/ה"><input value={childName} onChange={(event) => setChildName(event.target.value)} maxLength={60} /></Field>
                  <Field label="כיתה או גיל"><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">בחירה</option>{GRADES.map((value) => <option key={value}>{value}</option>)}</select></Field>
                </div>
                <Field label="במה נדרשת עזרה?"><textarea value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} rows={3} /></Field>
                <Field label="הודעה קצרה לחונך (לא חובה)"><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={2} /></Field>
                {complete && <div className="rounded-2xl bg-slate-50 p-4 text-sm"><p className="font-black">סיכום</p><p>{subject} · {mode} · {formatDate(selectedDate)} · {formatTime(slot.startAt)} · {duration} דקות</p><p>{childName} · {grade}</p></div>}
                <button type="button" disabled={!complete || busy} onClick={submit} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "שולח..." : "שליחת בקשת פגישה"}</button>
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
