"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const GRADES = [
  "גן", "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
  "כיתה ז׳", "כיתה ח׳", "כיתה ט׳", "כיתה י׳", "כיתה י״א", "כיתה י״ב",
];

export default function MentorInquiryFlow({
  mentorBookingId,
  mentorDisplayName,
  subjects,
  open,
  onClose,
}: {
  mentorBookingId: string;
  mentorDisplayName: string;
  subjects: string[];
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? "");
      setRole(data.session?.user.user_metadata?.role ?? "");
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    queueMicrotask(() => closeButtonRef.current?.focus());
  }, [open]);

  const trimmedMessageLength = message.trim().length;
  const messageIsValid = trimmedMessageLength >= 5 && trimmedMessageLength <= 1000;
  const messageGuidance = trimmedMessageLength === 0
    ? "יש לכתוב הודעה לחונך."
    : trimmedMessageLength < 5
      ? `יש לכתוב לפחות 5 תווים. חסרים ${5 - trimmedMessageLength}.`
      : "ההודעה מוכנה לשליחה.";

  async function submit() {
    const trimmedMessage = message.trim();
    if (busy || !token || trimmedMessage.length < 5 || trimmedMessage.length > 1000) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/mentor-inquiries", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorBookingId,
          idempotencyKey,
          subject: subject || null,
          childGradeOrAge: grade || null,
          message: trimmedMessage,
        }),
      });
      if (response.ok) {
        setStatus("הפנייה נשלחה לחונך.");
        setIdempotencyKey(crypto.randomUUID());
      } else {
        const body = await response.json().catch(() => ({}));
        setStatus(body.error ?? "לא ניתן לשלוח את הפנייה.");
      }
    } catch {
      setStatus("לא ניתן לשלוח את הפנייה.");
    } finally {
      setBusy(false);
    }
  }

  const returnTo = encodeURIComponent(`/?mentor=${mentorBookingId}&action=inquiry`);
  if (!open) return null;
  return (
    <dialog ref={dialogRef} aria-label="פנייה לחונך" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-visible border-0 bg-transparent p-0 backdrop:bg-slate-950/55 sm:m-auto sm:w-[min(calc(100%_-_2rem),36rem)]">
      <div dir="rtl" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black">פנייה אל {mentorDisplayName}</h2>
          <button ref={closeButtonRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="סגירת הפנייה" className="h-11 w-11 rounded-xl border text-xl">×</button>
        </div>
        {!token ? (
          <div className="mt-6 rounded-2xl bg-blue-50 p-5">
            <p className="font-bold">כדי לשלוח פנייה יש להתחבר כחשבון הורה.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/login?returnTo=${returnTo}`} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">כניסה</Link>
              <Link href={`/register/parent?returnTo=${returnTo}`} className="rounded-xl border border-blue-300 px-4 py-3 font-bold text-blue-800">הרשמה כהורה</Link>
            </div>
          </div>
        ) : role !== "parent" ? (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 font-bold text-red-700">רק חשבון הורה יכול לשלוח פנייה.</p>
        ) : (
          <div className="mt-6 space-y-5">
            <label className="grid gap-2 font-bold">תחום (לא חובה)
              <select value={subject} onChange={(event) => setSubject(event.target.value)} className="min-h-12 rounded-xl border p-3">
                <option value="">ללא תחום מסוים</option>
                {subjects.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-2 font-bold">כיתה או גיל (לא חובה)
              <select value={grade} onChange={(event) => setGrade(event.target.value)} className="min-h-12 rounded-xl border p-3">
                <option value="">ללא בחירה</option>
                {GRADES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-2 font-bold">הודעה
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={1000} rows={5} aria-describedby="inquiry-message-guidance" aria-invalid={!messageIsValid} className="rounded-xl border p-3" />
            </label>
            <p id="inquiry-message-guidance" className={`text-sm font-bold ${messageIsValid ? "text-green-700" : "text-amber-700"}`}>{messageGuidance}</p>
            <button type="button" disabled={busy || !messageIsValid} onClick={submit} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:bg-slate-400">
              {busy ? "שולח..." : "שליחת פנייה"}
            </button>
            {status && <p role="status" className="rounded-xl bg-blue-50 p-4 text-center font-bold">{status}</p>}
          </div>
        )}
      </div>
    </dialog>
  );
}