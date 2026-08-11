"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WeekItem = { id: string; kind: "activity" | "meeting"; title: string; child: string; startsAt: string; endsAt: string | null; place: string };
type Registration = { id: string; child_first_name: string; status: string; activity: { title?: string; venue_name?: string | null; location_details?: string | null } | null; sessions: Array<{ starts_at: string; ends_at: string }> };
type Meeting = { id: string; status: string; subject: string; child_first_name: string; confirmed_start_at: string | null; confirmed_end_at: string | null; meeting_mode: string };

export default function ParentUpcomingWeek() {
  const [items, setItems] = useState<WeekItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) { if (active) setLoading(false); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const [activitiesResponse, meetingsResponse] = await Promise.all([
        fetch("/api/parent/activity-registrations", { headers, cache: "no-store" }),
        fetch("/api/meeting-requests", { headers, cache: "no-store" }),
      ]);
      const activitiesBody = activitiesResponse.ok ? await activitiesResponse.json() : { registrations: [] };
      const meetingsBody = meetingsResponse.ok ? await meetingsResponse.json() : { requests: [] };
      const now = Date.now();
      const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
      const activityItems = (activitiesBody.registrations ?? []).flatMap((row: Registration) => row.status === "registered" ? row.sessions
        .filter((session) => Date.parse(session.starts_at) >= now && Date.parse(session.starts_at) <= weekEnd)
        .map((session) => ({ id: `${row.id}-${session.starts_at}`, kind: "activity" as const, title: row.activity?.title ?? "פעילות", child: row.child_first_name, startsAt: session.starts_at, endsAt: session.ends_at, place: row.activity?.venue_name || row.activity?.location_details || "המיקום מופיע בפרטי הפעילות" })) : []);
      const meetingItems = (meetingsBody.requests ?? []).flatMap((meeting: Meeting) => meeting.status === "accepted" && meeting.confirmed_start_at && Date.parse(meeting.confirmed_start_at) >= now && Date.parse(meeting.confirmed_start_at) <= weekEnd
        ? [{ id: meeting.id, kind: "meeting" as const, title: meeting.subject || "פגישה עם חונך", child: meeting.child_first_name, startsAt: meeting.confirmed_start_at, endsAt: meeting.confirmed_end_at, place: meeting.meeting_mode === "online" ? "מפגש מקוון" : "המיקום מופיע בפרטי הפגישה" }] : []);
      if (active) { setItems([...activityItems, ...meetingItems].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => items, [items]);
  return <section aria-labelledby="parent-upcoming-week" className="mt-6 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-black text-teal-700">במבט אחד</p><h2 id="parent-upcoming-week" className="mt-1 text-2xl font-black">השבוע הקרוב</h2></div><Link href="/dashboard/parent/activities" className="font-black text-blue-700 underline">לכל הפעילויות</Link></div>
    {loading ? <p className="mt-5 text-slate-600">טוען את השבוע הקרוב...</p> : grouped.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{grouped.map((item) => <Link key={item.id} href={item.kind === "activity" ? "/dashboard/parent/activities" : "/dashboard/parent/requests"} className="rounded-2xl border border-slate-200 bg-gradient-to-l from-teal-50 to-amber-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><strong className="text-lg">{item.title}</strong><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-800">עבור {item.child}</span></div><p className="mt-2 font-black text-slate-800">{dateTime(item.startsAt, item.endsAt)}</p><p className="mt-1 text-sm text-slate-600">{item.place}</p></Link>)}</div> : <div className="mt-5 rounded-2xl bg-teal-50 p-5"><p className="font-black text-teal-950">השבוע עדיין פתוח להזדמנויות חדשות.</p><p className="mt-1 text-teal-900">כשתיקבע פעילות או פגישה, היא תופיע כאן באופן מסודר.</p></div>}
  </section>;
}

function dateTime(start: string, end: string | null) {
  const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(start));
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(start));
  const endTime = end ? new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(end)) : null;
  return `${date} · ${time}${endTime ? `–${endTime}` : ""}`;
}
