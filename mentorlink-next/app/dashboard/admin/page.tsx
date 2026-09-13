"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Summary = {
  mentorProfiles: number;
  publishedMentors: number;
  pendingMentors: number;
  pausedMentors: number;
  mentorActivities: number;
  publishedActivities: number;
  meetingRequests: number;
  pendingMeetings: number;
  acceptedMeetings: number;
  unresolvedFeedback: number;
  suspendedAccounts: number;
  blockedAccounts: number;
};

type AttentionCard = {
  title: string;
  value: number;
  detail: string;
};

export default function AdminControlCenterPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attention, setAttention] = useState<AttentionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const response = await fetch("/api/admin/control-center", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error ?? "לא ניתן לטעון את לוח הבקרה.");
        }
        if (!active) return;
        setSummary(body.summary ?? null);
        setAttention(body.attention ?? []);
      } catch (reason) {
        if (active) {
          const message = reason instanceof Error ? reason.message : "Request failed";
          if (message === "AUTHENTICATION_REQUIRED") return window.location.replace("/login");
          setError(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-gradient-to-l from-violet-100 via-white to-cyan-100 p-6 shadow-sm">
          <p className="text-sm font-black text-violet-700">לוח בקרה</p>
          <h1 className="mt-2 text-3xl font-black">בקרת מערכת V1</h1>
          <p className="mt-2 max-w-3xl text-slate-700">
            סקירה מהירה של מצב המערכת, עומסים, משובים וחשבונות שהדורשים תשומת לב.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">טוען נתונים…</div>
        ) : summary ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "חונכים פורסמו", value: summary.publishedMentors, accent: "emerald" },
                { label: "חונכים ממתינים", value: summary.pendingMentors, accent: "amber" },
                { label: "פעילויות פורסמו", value: summary.publishedActivities, accent: "sky" },
                { label: "פגישות ממתינות", value: summary.pendingMeetings, accent: "violet" },
              ].map((item) => (
                <Link key={item.label} href={item.label === "חונכים ממתינים" ? "/dashboard/admin/mentors" : item.label === "פגישות ממתינות" ? "/dashboard/admin/meetings" : item.label === "משובים פתוחים" ? "/dashboard/admin/feedback" : "/dashboard/admin/activities"} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300">
                  <p className="text-sm font-bold text-slate-600">{item.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
                </Link>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {attention.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-slate-600">{item.title}</p>
                  <p className="mt-4 text-4xl font-black text-slate-900">{item.value}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{item.detail}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">אזורי פעילות</h2>
                <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
                  <li>חונכים רשומים: {summary.mentorProfiles}</li>
                  <li>חונכים מושעים: {summary.suspendedAccounts}</li>
                  <li>חסומים: {summary.blockedAccounts}</li>
                  <li>פעילויות בסך הכל: {summary.mentorActivities}</li>
                  <li>פגישות בסך הכל: {summary.meetingRequests}</li>
                  <li>פגישות אושרו: {summary.acceptedMeetings}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">צירי גישה מהירים</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/dashboard/admin/mentors" className="rounded-xl bg-violet-700 px-4 py-2 font-black text-white">חונכים</Link>
                  <Link href="/dashboard/admin/parents" className="rounded-xl bg-blue-700 px-4 py-2 font-black text-white">הורים</Link>
                  <Link href="/dashboard/admin/feedback" className="rounded-xl bg-amber-600 px-4 py-2 font-black text-white">משובים</Link>
                  <Link href="/dashboard/admin/deleted-accounts" className="rounded-xl bg-slate-700 px-4 py-2 font-black text-white">חשבונות</Link>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-600">
                  משובים פתוחים: {summary.unresolvedFeedback}
                </p>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
