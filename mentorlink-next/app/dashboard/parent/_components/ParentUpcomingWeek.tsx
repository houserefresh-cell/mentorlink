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

  const activities = useMemo(() => items.filter((item) => item.kind === "activity"), [items]);
  const meetings = useMemo(() => items.filter((item) => item.kind === "meeting"), [items]);
  return <section aria-labelledby="parent-upcoming-week" className="mt-6 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
    <div><p className="font-black text-teal-700">במבט אחד</p><h2 id="parent-upcoming-week" className="mt-1 text-2xl font-black">השבוע הקרוב</h2></div>
    {loading ? <p className="mt-5 text-slate-600">טוען את השבוע הקרוב...</p> : <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <UpcomingColumn title="פעילויות קרובות" href="/dashboard/parent/activities" empty="אין פעילויות בשבוע הקרוב." items={activities} />
      <UpcomingColumn title="פגישות קרובות" href="/dashboard/parent/requests" empty="אין פגישות בשבוע הקרוב." items={meetings} />
    </div>}
  </section>;
}

function UpcomingColumn({ title, href, empty, items }: { title: string; href: string; empty: string; items: WeekItem[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black">{title}</h3><Link href={href} className="text-sm font-black text-blue-700 underline">לכל הפרטים</Link></div>
    {items.length ? <div className="mt-3 grid gap-3">{items.map((item) => <UpcomingCard key={item.id} item={item} href={href} />)}</div> : <p className="mt-3 rounded-xl bg-white p-4 text-sm font-bold text-slate-600">{empty}</p>}
  </section>;
}

function UpcomingCard({ item, href }: { item: WeekItem; href: string }) {
  const proximity = dayProximity(item.startsAt);
  return <Link href={href} className={`relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${proximity === 0 ? "border-amber-400 bg-amber-100" : proximity === 1 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
    {proximity !== null && <span className="mb-2 inline-flex rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-amber-950">{proximity === 0 ? "היום" : "מחר"}</span>}
    <div className="flex items-start justify-between gap-3"><strong className="text-lg">{item.title}</strong><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-800">עבור {item.child}</span></div>
    <p className="mt-2 font-black text-slate-800">{dateTime(item.startsAt, item.endsAt)}</p><p className="mt-1 text-sm text-slate-600">{item.place}</p>
  </Link>;
}

function dayProximity(value: string) {
  const event = new Date(value), now = new Date();
  const eventDay = new Date(event.getFullYear(), event.getMonth(), event.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const difference = Math.round((eventDay - today) / 86_400_000);
  return difference === 0 || difference === 1 ? difference : null;
}

function dateTime(start: string, end: string | null) {
  const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(start));
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(start));
  const endTime = end ? new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(end)) : null;
  return `${date} · ${time}${endTime ? `–${endTime}` : ""}`;
}
