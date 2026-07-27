"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Slot = { startAt: string; meetingMode: string; durations: number[] };
type Meeting = {
  id: string; mentor_display_name?: string; subject: string; child_first_name: string;
  child_grade_or_age: string; help_goal: string; meeting_mode: string;
  requested_start_at: string; requested_duration_minutes: number; parent_message: string | null;
  status: string; mentor_response: string | null; proposed_start_at: string | null;
};
const STATUS: Record<string, string> = {
  pending: "ממתינה", accepted: "אושרה", declined: "נדחתה",
  alternative_proposed: "הוצע מועד חלופי", cancelled: "בוטלה",
};

export default function MeetingRequestsPanel({ role }: { role: "parent" | "mentor" }) {
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<Meeting[]>([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const load = useCallback(async function load(accessToken: string) {
    const response = await fetch("/api/meeting-requests", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    setRequests(body.requests ?? []);
    const nextBookingId = body.schedulingMentorBookingId ?? "";
    if (role === "mentor" && nextBookingId) {
      const slotsResponse = await fetch(`/api/meeting-requests/available-slots?mentor=${nextBookingId}`);
      const slotsBody = await slotsResponse.json();
      setSlots(slotsBody.slots ?? []);
    }
    const notificationResponse = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${accessToken}` } });
    const notificationBody = await notificationResponse.json();
    setUnreadCount(notificationBody.unreadCount ?? 0);
  }, [role]);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => {
    const accessToken = data.session?.access_token ?? "";
    setToken(accessToken);
    if (accessToken) void load(accessToken);
  }); }, [load]);
  async function act(id: string, action: string) {
    if (!confirm("להמשיך בפעולה?")) return;
    setBusyId(id);
    try {
    const response = await fetch(`/api/meeting-requests/${id}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setMessage(response.ok ? "הבקשה עודכנה." : "לא ניתן לעדכן את הבקשה.");
    if (response.ok) await load(token);
    } finally { setBusyId(""); }
  }
  async function proposeNext(item: Meeting) {
    const selection = alternatives[item.id];
    if (!selection) { setMessage("יש לבחור מועד חלופי."); return; }
    const [proposedStartAt, durationText] = selection.split("|");
    if (!confirm(`להציע את המועד ${formatDate(proposedStartAt)}?`)) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/meeting-requests/${item.id}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose_alternative", proposedStartAt, proposedDurationMinutes: Number(durationText) }),
      });
      setMessage(response.ok ? "המועד החלופי הוצע." : "לא ניתן להציע את המועד.");
      if (response.ok) await load(token);
    } finally { setBusyId(""); }
  }
  return (
    <section dir="rtl" className="mt-8">
      <div className="flex items-center gap-3"><h2 className="text-2xl font-black">בקשות לפגישה</h2>{unreadCount > 0 && <button type="button" onClick={async () => { await fetch("/api/notifications", { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); setUnreadCount(0); }} aria-label="סימון ההתראות כנקראו" className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{unreadCount}</button>}</div>
      {!requests.length ? <p className="mt-4 rounded-2xl bg-white p-5 text-slate-600">אין בקשות לפגישה.</p> : <div className="mt-4 grid gap-4">{requests.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-black">{role === "parent" ? item.mentor_display_name : `${item.child_first_name} · ${item.child_grade_or_age}`}</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{STATUS[item.status] ?? item.status}</span></div><p className="mt-2">{item.subject} · {item.meeting_mode} · {formatDate(item.requested_start_at)} · {item.requested_duration_minutes} דקות</p>{role === "mentor" && <><p className="mt-2 text-slate-700">{item.help_goal}</p>{item.parent_message && <p className="mt-2 text-slate-600">{item.parent_message}</p>}</>}{item.mentor_response && <p className="mt-2 rounded-xl bg-slate-50 p-3">{item.mentor_response}</p>}{item.proposed_start_at && <p className="mt-2 font-bold">מועד חלופי: {formatDate(item.proposed_start_at)}</p>}<div className="mt-4 flex flex-wrap gap-2">{role === "mentor" && item.status === "pending" && <><button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "accept")} className="rounded-xl bg-green-700 disabled:opacity-50 px-4 py-2 font-bold text-white">אישור</button><button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "decline")} className="rounded-xl bg-red-700 disabled:opacity-50 px-4 py-2 font-bold text-white">דחייה</button><select aria-label="בחירת מועד חלופי" value={alternatives[item.id] ?? ""} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">בחירת מועד חלופי</option>{slots.filter((slot) => slot.meetingMode === item.meeting_mode && slot.startAt !== item.requested_start_at).flatMap((slot) => slot.durations.map((duration) => <option key={`${slot.startAt}-${duration}`} value={`${slot.startAt}|${duration}`}>{formatDate(slot.startAt)} · {duration} דקות</option>))}</select><button type="button" disabled={busyId === item.id || !alternatives[item.id]} onClick={() => proposeNext(item)} className="rounded-xl border border-blue-300 px-4 py-2 font-bold text-blue-800 disabled:opacity-50">הצעת המועד הזמין הבא</button></>}{role === "parent" && ["pending", "alternative_proposed"].includes(item.status) && <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "cancel")} className="rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700">ביטול</button>}</div></article>)}</div>}
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{message}</p>}
    </section>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
