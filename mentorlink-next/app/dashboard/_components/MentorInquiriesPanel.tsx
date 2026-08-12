"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MentorSummary = { bookingId: string; displayName: string; city: string | null; subjects: string[] };
type Message = { id: string; sender_role: "parent" | "mentor"; body: string; created_at: string };
type Inquiry = {
  id: string;
  mentor?: MentorSummary | null;
  parent?: { first_name: string | null; last_name: string | null } | null;
  subject: string | null;
  child_grade_or_age: string | null;
  status: string;
  created_at: string;
  messages: Message[];
};
type Tab = "waiting" | "active" | "history";

const tabs: { value: Tab; label: string }[] = [
  { value: "waiting", label: "ממתינות לתשובה" },
  { value: "active", label: "שיחות פעילות" },
  { value: "history", label: "היסטוריה" },
];
const inTab = (item: Inquiry, tab: Tab) => tab === "waiting" ? item.status === "pending" : tab === "active" ? item.status === "responded" : ["closed", "cancelled"].includes(item.status);
const dateTime = (value: string) => new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function MentorInquiriesPanel({ role }: { role: "parent" | "mentor" }) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [tab, setTab] = useState<Tab>("waiting");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/mentor-inquiries", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    setItems(body.inquiries ?? []);
  }, []);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => {
    const accessToken = data.session?.access_token ?? "";
    setToken(accessToken);
    if (accessToken) void load(accessToken);
  }); }, [load]);

  const visible = useMemo(() => items.filter((item) => inTab(item, tab)), [items, tab]);
  async function act(id: string, action: "respond" | "close" | "reopen" | "cancel") {
    if (["close", "cancel"].includes(action) && !confirm(action === "close" ? "להעביר את השיחה להיסטוריה?" : "לבטל את הפנייה?")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/mentor-inquiries/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, response: responses[id] ?? "" }),
      });
      const body = await response.json().catch(() => ({}));
      setNotice(response.ok ? "השיחה עודכנה." : body.error ?? "לא ניתן לעדכן.");
      if (response.ok) { setResponses((current) => ({ ...current, [id]: "" })); await load(token); }
    } finally { setBusyId(""); }
  }

  return <section dir="rtl" className="mt-8">
    <h2 className="text-2xl font-black">{role === "mentor" ? "פניות מהורים" : "הפניות שלי"}</h2>
    <p className="mt-2 text-slate-600">כל שיחה נשמרת לפי הסדר, כדי שאפשר יהיה לחזור אליה ולהמשיך בדיוק מהמקום שבו עצרתם.</p>
    <nav aria-label="סינון פניות" className="mt-5 grid gap-2 rounded-2xl bg-blue-700 p-2 sm:grid-cols-3">
      {tabs.map((entry) => { const count = items.filter((item) => inTab(item, entry.value)).length; return <button key={entry.value} type="button" onClick={() => setTab(entry.value)} className={`min-h-12 rounded-xl px-4 font-black ${tab === entry.value ? "bg-white text-blue-800" : "text-white hover:bg-blue-600"}`}>{entry.label} ({count})</button>; })}
    </nav>
    {!visible.length ? <p className="mt-4 rounded-2xl bg-white p-5 text-slate-600">אין שיחות בקטגוריה הזאת.</p> : <div className="mt-4 grid gap-4">
      {visible.map((item) => {
        const otherName = role === "parent" ? item.mentor?.displayName ?? "חונך/ת" : [item.parent?.first_name, item.parent?.last_name].filter(Boolean).join(" ") || "הורה";
        return <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{otherName}</h3><p className="text-sm text-slate-600">{item.subject || "פנייה כללית"}{item.child_grade_or_age ? ` · ${item.child_grade_or_age}` : ""}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{tab === "waiting" ? "ממתינה" : tab === "active" ? "פעילה" : "בהיסטוריה"}</span></div>
          <ol className="mt-4 grid gap-3" aria-label="היסטוריית השיחה">
            {item.messages.map((message) => { const mine = message.sender_role === role; return <li key={message.id} className={`max-w-[88%] rounded-2xl p-4 ${mine ? "mr-auto bg-blue-700 text-white" : "ml-auto bg-slate-100 text-slate-900"}`}><p className="text-xs font-black opacity-80">{mine ? "אני" : message.sender_role === "parent" ? "הורה" : "חונך/ת"} · {dateTime(message.created_at)}</p><p className="mt-1 whitespace-pre-wrap">{message.body}</p></li>; })}
          </ol>
          {!["closed", "cancelled"].includes(item.status) && <div className="mt-4"><textarea aria-label="הודעה חדשה" value={responses[item.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="כתבו הודעה קצרה וברורה…" maxLength={1000} className="min-h-24 w-full rounded-xl border p-3" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busyId === item.id || (responses[item.id] ?? "").trim().length < 2} onClick={() => act(item.id, "respond")} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">שליחת הודעה</button><button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "close")} className="rounded-xl border px-4 py-2 font-bold">העברה להיסטוריה</button>{role === "parent" && <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "cancel")} className="rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700">ביטול הפנייה</button>}</div></div>}
          {item.status === "closed" && <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "reopen")} className="mt-4 rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">החזרה לשיחות פעילות</button>}
          {role === "parent" && item.mentor?.bookingId && <Link href={`/dashboard/parent?mentor=${encodeURIComponent(item.mentor.bookingId)}&action=details#mentor-search`} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 font-bold text-blue-800">לכרטיס החונך</Link>}
        </article>;
      })}
    </div>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{notice}</p>}
  </section>;
}
