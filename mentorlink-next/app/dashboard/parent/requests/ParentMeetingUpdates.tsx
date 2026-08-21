"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MeetingUpdate = {
  id: string;
  meeting_request_id: string;
  update_type: "cancellation" | "details" | "reschedule" | "approval";
  body: string;
  subject: string;
  childName: string;
  childGrade: string | null;
  mentorName: string;
  meetingMode: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  reason: string | null;
  created_at: string;
  read_at: string | null;
};

const labels = { cancellation: "התראה חשובה — ביטול פגישה", details: "פרטי המפגש עודכנו", reschedule: "הוצע מועד חדש", approval: "הפגישה אושרה" };

export default function ParentMeetingUpdates() {
  const [updates, setUpdates] = useState<MeetingUpdate[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? "";
    const response = await fetch("/api/parent/meeting-updates", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()).updates ?? [];
    setUpdates(next);
    window.dispatchEvent(new CustomEvent("mentorlink:meeting-attention", { detail: { count: next.filter((item: MeetingUpdate) => !item.read_at).length } }));
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function markRead(updateId: string) {
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? "";
    const response = await fetch("/api/parent/meeting-updates", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ updateId, action: "mark_read" }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "העדכון הועבר להיסטוריה." : body.error ?? "לא ניתן לשמור את העדכון.");
    if (response.ok) await load();
  }

  const unread = useMemo(() => updates.filter((item) => !item.read_at), [updates]);
  const history = useMemo(() => updates.filter((item) => item.read_at), [updates]);
  if (!updates.length) return null;
  return <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/60 p-6">
    <div className="flex items-center justify-between gap-4"><div><p className="font-black text-amber-800">חשוב לדעת</p><h2 className="text-2xl font-black">עדכונים מהחונכים</h2></div>{unread.length > 0 && <span className="rounded-full bg-violet-600 px-3 py-1 font-black text-white">{unread.length}</span>}</div>
    {message && <p role="status" className="mt-4 rounded-xl bg-white p-3 font-bold">{message}</p>}
    <UpdateList rows={unread} empty="אין עדכונים חדשים." markRead={markRead} />
    {history.length > 0 && <details className="mt-5 rounded-2xl border bg-white p-4"><summary className="cursor-pointer font-black">עדכונים שקראתי ({history.length})</summary><UpdateList rows={history} markRead={markRead} /></details>}
  </section>;
}

function UpdateList({ rows, empty, markRead }: { rows: MeetingUpdate[]; empty?: string; markRead: (id: string) => Promise<void> }) {
  if (!rows.length) return empty ? <p className="mt-4 rounded-xl bg-white p-4 text-slate-600">{empty}</p> : null;
  return <div className="mt-5 grid gap-4">{rows.map((update) => {
    const cancelled = update.update_type === "cancellation";
    return <article key={update.id} className={`rounded-2xl border p-5 ${cancelled ? "border-red-400 bg-red-50 ring-2 ring-red-100" : "bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><span className={`rounded-full px-3 py-1 text-sm font-black ${cancelled ? "bg-red-600 text-white" : "bg-violet-100 text-violet-800"}`}>{labels[update.update_type]}</span><h3 className="mt-2 text-lg font-black">{update.subject} · עבור {update.childName}</h3></div><time className="text-sm text-slate-500">{new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(update.created_at))}</time></div>
      <p className="mt-3 leading-7">{update.body}</p>
      <dl className={`mt-4 grid gap-2 rounded-2xl border p-4 text-slate-950 sm:grid-cols-2 ${cancelled ? "border-red-200 bg-white" : "border-blue-200 bg-blue-50/60"}`}>
        <div><dt className="font-black">חונך/ת</dt><dd>{update.mentorName}</dd></div>
        <div><dt className="font-black">ילד/ה</dt><dd>{update.childName}{update.childGrade ? ` · ${update.childGrade}` : ""}</dd></div>
        <div><dt className="font-black">נושא ותחום</dt><dd>{update.subject}{update.meetingMode ? ` · ${update.meetingMode}` : ""}</dd></div>
        <div><dt className="font-black">יום, תאריך ושעה</dt><dd>{update.startsAt ? new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "full", timeStyle: "short" }).format(new Date(update.startsAt)) : "לא נקבע"}{update.durationMinutes ? ` · ${update.durationMinutes} דקות` : ""}</dd></div>
        <div><dt className="font-black">מיקום</dt><dd>{update.location || "טרם נקבע"}</dd></div>
        {update.reason ? <div><dt className="font-black">סיבת הביטול</dt><dd>{update.reason}</dd></div> : null}
      </dl>
      {!update.read_at && <button type="button" onClick={() => void markRead(update.id)} className="mt-4 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 font-black text-violet-900">קראתי — העברה להיסטוריה</button>}
    </article>;
  })}</div>;
}
