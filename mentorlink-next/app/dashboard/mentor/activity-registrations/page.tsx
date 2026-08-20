"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MentorImportantUpdates } from "@/app/dashboard/mentor/_components/MentorDashboardShell";

type Registration = {
  id: string; activityId: string; activityTitle: string; status: "registered" | "waitlisted"; registeredAt: string;
  nextSession: { starts_at: string; ends_at: string } | null;
  child: { first_name: string; last_name: string | null; grade: string | null; school_name: string | null; gender: "boy" | "girl" | null; display_color: string };
  interests: string[];
  parent: { first_name: string; last_name: string; phone: string | null; email: string | null; city?: string | null; street?: string | null };
};

export default function MentorActivityRegistrationsPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"all" | "registered" | "waitlisted">("all");
  useEffect(() => { let active = true; (async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch("/api/mentor-activity-registrations", { headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!active) return;
    if (response.ok) {
      setRows(body.registrations ?? []);
      await fetch("/api/notifications", { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ registrationOnly: true }) });
    } else setError(body.error ?? "לא ניתן לטעון את ההרשמות.");
    setLoading(false);
  })(); return () => { active = false; }; }, []);
  const shown = rows.filter((row) => view === "all" || row.status === view);
  return <section dir="rtl" className="mx-auto max-w-6xl">
    <MentorImportantUpdates scope="activities" />
    <p className="font-black text-violet-700">הקהילה בפעילויות שלי</p>
    <h1 className="mt-2 text-3xl font-black">הרשמות חדשות לפעילויות</h1>
    <p className="mt-3 text-slate-600">כל ילד שנרשם או הצטרף לרשימת המתנה, עם פרטי ההורה והמפגש.</p>
    <nav className="mt-6 grid gap-2 rounded-2xl bg-blue-700 p-2 sm:grid-cols-3" aria-label="סינון הרשמות">
      {([['all','הכול'],['registered','רשומים'],['waitlisted','רשימת המתנה']] as const).map(([key,label]) => <button key={key} onClick={() => setView(key)} className={`min-h-12 rounded-xl px-5 py-2 font-black ${view === key ? "bg-white text-blue-800" : "text-white hover:bg-blue-600"}`}>{label} ({key === 'all' ? rows.length : rows.filter(row => row.status === key).length})</button>)}
    </nav>
    {loading ? <p className="mt-8">טוען הרשמות...</p> : error ? <p role="alert" className="mt-8 rounded-2xl bg-red-50 p-5 font-bold text-red-800">{error}</p> : <div className="mt-7 grid gap-5 md:grid-cols-2">{shown.map((row) => {
      const childName = [row.child.first_name, row.child.last_name].filter(Boolean).join(" ");
      const parentName = [row.parent.first_name, row.parent.last_name].filter(Boolean).join(" ");
      return <article key={row.id} className="rounded-3xl border-2 border-violet-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-xs font-black ${row.status === 'registered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{row.status === 'registered' ? 'רשום/ה' : 'רשימת המתנה'}</span><h2 className="mt-3 text-xl font-black">{childName}</h2><p className="font-bold text-violet-700">{row.activityTitle}</p></div><time className="text-xs text-slate-500">{new Date(row.registeredAt).toLocaleDateString('he-IL')}</time></div>
        {row.nextSession && <p className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">המפגש: {new Date(row.nextSession.starts_at).toLocaleString('he-IL')}</p>}
        <dl className="mt-4 grid gap-2 text-sm"><div><dt className="font-black">הורה</dt><dd>{parentName}</dd></div><div><dt className="font-black">ילד/ה, כיתה ובית ספר</dt><dd>{row.child.gender === "girl" ? "בת" : row.child.gender === "boy" ? "בן" : "לא צוין"} · {row.child.grade || 'לא צוין'}{row.child.school_name ? ` · ${row.child.school_name}` : ''}</dd></div>{row.interests.length > 0 && <div><dt className="font-black">תחומי עניין</dt><dd>{row.interests.join(' · ')}</dd></div>}</dl>
        <div className="mt-5 flex flex-wrap gap-2">{row.parent.phone && <a href={`tel:${row.parent.phone}`} className="rounded-xl bg-emerald-600 px-4 py-2 font-black text-white">חיוג להורה</a>}{row.parent.phone && <a href={`https://wa.me/972${row.parent.phone.replace(/\D/g,'').replace(/^0/,'')}`} className="rounded-xl border border-emerald-600 px-4 py-2 font-black text-emerald-800">WhatsApp</a>}<Link href={`/dashboard/mentor/activities?activity=${row.activityId}`} className="rounded-xl border px-4 py-2 font-black">פרטי הפעילות</Link></div>
      </article>;
    })}{!shown.length && <p className="rounded-2xl bg-white p-8 text-center font-bold text-slate-600 md:col-span-2">אין הרשמות בקטגוריה זו.</p>}</div>}
  </section>;
}
