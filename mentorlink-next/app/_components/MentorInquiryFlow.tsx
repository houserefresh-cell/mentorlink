"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const GRADES = [
  "גן", "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
  "כיתה ז׳", "כיתה ח׳", "כיתה ט׳", "כיתה י׳", "כיתה י״א", "כיתה י״ב",
];

export default function MentorInquiryFlow({
  mentorBookingId,
  mentorDisplayName,
  subjects,
}: {
  mentorBookingId: string;
  mentorDisplayName: string;
  subjects: string[];
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mentor") === mentorBookingId && params.get("action") === "inquiry") {
      queueMicrotask(() => setOpen(true));
    }
  }, [mentorBookingId]);
  useEffect(() => {
    if (!open) return;
    void supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? "");
      setRole(data.session?.user.user_metadata?.role ?? "");
    });
  }, [open]);

  async function submit() {
    if (!token || message.trim().length < 5) return;
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/mentor-inquiries", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mentorBookingId,
        idempotencyKey,
        subject: subject || null,
        childGradeOrAge: grade || null,
        message,
      }),
    });
    if (response.ok) {
      setStatus("הפנייה נשלחה לחונך.");
      setIdempotencyKey(crypto.randomUUID());
    } else {
      const body = await response.json().catch(() => ({}));
      setStatus(body.error ?? "לא ניתן לשלוח את הפנייה.");
    }
    setBusy(false);
  }

  const returnTo = encodeURIComponent(`/?mentor=${mentorBookingId}&action=inquiry`);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-12 w-full rounded-xl border border-blue-700 px-5 py-3 font-black text-blue-800">
        פנייה לחונך
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="פנייה לחונך" className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-5">
          <div dir="rtl" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black">פנייה אל {mentorDisplayName}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="סגירת הפנייה" className="h-11 w-11 rounded-xl border text-xl">×</button>
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
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={1000} rows={5} className="rounded-xl border p-3" />
                </label>
                <button type="button" disabled={busy || message.trim().length < 5} onClick={submit} className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:bg-slate-400">
                  {busy ? "שולח..." : "שליחת פנייה"}
                </button>
                {status && <p role="status" className="rounded-xl bg-blue-50 p-4 text-center font-bold">{status}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
