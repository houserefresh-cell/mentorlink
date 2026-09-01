"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MarketSubject = {
  id: number;
  name: string;
  category: string;
  meetingMentorCount: number;
  activityCount: number;
};

const CATEGORY_STYLE: Record<string, { icon: string; tone: string }> = {
  "ספורט": { icon: "⚽", tone: "from-amber-50 to-yellow-50 border-amber-200" },
  "לימודים": { icon: "📘", tone: "from-blue-50 to-indigo-50 border-blue-200" },
  "שפות": { icon: "💬", tone: "from-rose-50 to-pink-50 border-rose-200" },
  "טכנולוגיה": { icon: "💻", tone: "from-cyan-50 to-sky-50 border-cyan-200" },
  "מוזיקה": { icon: "🎵", tone: "from-violet-50 to-purple-50 border-violet-200" },
  "אומנות ויצירה": { icon: "🎨", tone: "from-orange-50 to-rose-50 border-orange-200" },
  "כישורי חיים והעשרה": { icon: "🌟", tone: "from-emerald-50 to-teal-50 border-emerald-200" },
};

function hrefFor(subjectNames: string[]) {
  const params = new URLSearchParams({ search: "1", discovery: "1" });
  subjectNames.forEach((name) => params.append("subject", name));
  return `/dashboard/parent?${params.toString()}#marketplace`;
}

export default function ParentMarketplaceSubjectDiscovery() {
  const [subjects, setSubjects] = useState<MarketSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) {
        if (active) { setFailed(true); setLoading(false); }
        return;
      }
      const response = await fetch("/api/parent/subjects", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) setFailed(true);
      else setSubjects(body.subjects ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, MarketSubject[]>();
    for (const subject of subjects) {
      map.set(subject.category, [...(map.get(subject.category) ?? []), subject]);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right, "he"));
  }, [subjects]);

  return (
    <section className="mx-auto max-w-7xl px-1 py-12" aria-labelledby="market-subjects-title">
      <div className="mb-7 text-center">
        <p className="font-extrabold text-blue-700">מה באמת זמין עכשיו?</p>
        <h2 id="market-subjects-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">תחומים מהשוק החי של MentorLink</h2>
        <p className="mx-auto mt-3 max-w-2xl font-medium leading-7 text-slate-600">מוצגים כאן רק תחומים שיש עבורם כרגע חונך שמציע פגישה או פעילות פתוחה. תחום חדש יופיע כאן אוטומטית.</p>
      </div>
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="h-48 animate-pulse rounded-3xl bg-slate-100" />)}</div>
        : failed ? <p className="rounded-2xl bg-amber-50 p-5 text-center font-bold text-amber-900">לא ניתן לטעון כרגע את התחומים הפעילים.</p>
        : groups.length === 0 ? <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-600">עדיין אין תחומים עם הצעה פעילה בשוק.</p>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {groups.map(([category, items]) => {
              const style = CATEGORY_STYLE[category] ?? { icon: "✨", tone: "from-slate-50 to-blue-50 border-slate-200" };
              const mentorCount = items.reduce((sum, item) => sum + item.meetingMentorCount, 0);
              const activityCount = items.reduce((sum, item) => sum + item.activityCount, 0);
              return <article key={category} className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${style.tone}`}>
                <Link href={hrefFor(items.map((item) => item.name))} className="group flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm" aria-hidden>{style.icon}</span>
                  <div>
                    <h3 className="text-lg font-black text-slate-950 group-hover:text-blue-700">{category}</h3>
                    <p className="text-xs font-bold text-slate-500">{mentorCount} הצעות לפגישה · {activityCount} פעילויות</p>
                  </div>
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  {items.map((item) => <Link key={item.id} href={hrefFor([item.name])} className="rounded-full border border-white bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm hover:border-blue-300 hover:text-blue-700">{item.name}</Link>)}
                </div>
              </article>;
            })}
          </div>}
    </section>
  );
}
