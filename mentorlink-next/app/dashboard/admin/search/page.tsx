"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ResultSet = {
  mentors: Array<{ user_id: string; first_name?: string | null; last_name?: string | null; city?: string | null }>;
  parents: Array<{ user_id: string; first_name?: string | null; last_name?: string | null; city?: string | null }>;
  children: Array<{ id: string; parent_user_id?: string | null; first_name?: string | null; last_name?: string | null; grade?: string | null }>;
  meetings: Array<{ id: string; subject?: string | null; child_first_name?: string | null; status?: string | null }>;
  activities: Array<{ id: string; title?: string | null; status?: string | null }>;
};

type MentorResult = ResultSet["mentors"][number];
type ParentResult = ResultSet["parents"][number];
type ChildResult = ResultSet["children"][number];
type MeetingResult = ResultSet["meetings"][number];
type ActivityResult = ResultSet["activities"][number];

type SearchResultSectionTitle = "חונכים" | "הורים" | "ילדים" | "פגישות" | "פעילויות";

type SearchResultSection<T> = {
  title: SearchResultSectionTitle;
  items: T[];
  getLabel: (item: T) => string;
  getHref: (item: T) => string;
};

function isPersonResult(item: MentorResult | ParentResult | ChildResult | MeetingResult | ActivityResult): item is MentorResult | ParentResult {
  return "user_id" in item && ("first_name" in item || "last_name" in item || "city" in item);
}

function isChildResult(item: MentorResult | ParentResult | ChildResult | MeetingResult | ActivityResult): item is ChildResult {
  return "parent_user_id" in item && "grade" in item;
}

function isMeetingResult(item: MentorResult | ParentResult | ChildResult | MeetingResult | ActivityResult): item is MeetingResult {
  return "subject" in item && "child_first_name" in item;
}

function isActivityResult(item: MentorResult | ParentResult | ChildResult | MeetingResult | ActivityResult): item is ActivityResult {
  return "title" in item && "status" in item;
}

function formatMentorLabel(item: MentorResult): string {
  const personalName = [item.first_name, item.last_name].filter(Boolean).join(" ") || "לא נמסר";
  return `${personalName}${item.city ? ` · ${item.city}` : ""}`;
}

function formatParentLabel(item: ParentResult): string {
  const personalName = [item.first_name, item.last_name].filter(Boolean).join(" ") || "לא נמסר";
  return `${personalName}${item.city ? ` · ${item.city}` : ""}`;
}

function formatChildLabel(item: ChildResult): string {
  return `${[item.first_name, item.last_name].filter(Boolean).join(" ") || "לא נמסר"}${item.grade ? ` · ${item.grade}` : ""}`;
}

function formatMeetingLabel(item: MeetingResult): string {
  return `${item.subject ?? "לא נמסר"}${item.status ? ` · ${item.status}` : ""}`;
}

function formatActivityLabel(item: ActivityResult): string {
  return `${item.title ?? "לא נמסר"}${item.status ? ` · ${item.status}` : ""}`;
}

function createMentorSection(items: MentorResult[]): SearchResultSection<MentorResult> {
  return {
    title: "חונכים",
    items,
    getLabel: formatMentorLabel,
    getHref: () => "/dashboard/admin/mentors",
  };
}

function createParentSection(items: ParentResult[]): SearchResultSection<ParentResult> {
  return {
    title: "הורים",
    items,
    getLabel: formatParentLabel,
    getHref: () => "/dashboard/admin/parents",
  };
}

function createChildSection(items: ChildResult[]): SearchResultSection<ChildResult> {
  return {
    title: "ילדים",
    items,
    getLabel: formatChildLabel,
    getHref: () => "/dashboard/admin/parents",
  };
}

function createMeetingSection(items: MeetingResult[]): SearchResultSection<MeetingResult> {
  return {
    title: "פגישות",
    items,
    getLabel: formatMeetingLabel,
    getHref: (item: MeetingResult) => `/dashboard/admin/meetings?meeting=${item.id}`,
  };
}

function createActivitySection(items: ActivityResult[]): SearchResultSection<ActivityResult> {
  return {
    title: "פעילויות",
    items,
    getLabel: formatActivityLabel,
    getHref: (item: ActivityResult) => `/dashboard/admin/activities?activity=${item.id}`,
  };
}

function renderSearchSection<T>({ title, items, getLabel, getHref }: SearchResultSection<T>) {
  return (
    <section key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <Link key={`${title}-${index}`} href={getHref(item)} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">
            {getLabel(item)}
          </Link>
        )) : <p className="text-sm font-semibold text-slate-500">אין תוצאות.</p>}
      </div>
    </section>
  );
}

export default function AdminGlobalSearchPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ResultSet>({ mentors: [], parents: [], children: [], meetings: [], activities: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setRows({ mentors: [], parents: [], children: [], meetings: [], activities: [] });
      return;
    }
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}&limit=10`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "חיפוש נכשל.");
        if (!active) return;
        setRows({
          mentors: body.mentors ?? [],
          parents: body.parents ?? [],
          children: body.children ?? [],
          meetings: body.meetings ?? [],
          activities: body.activities ?? [],
        });
      } catch (reason) {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "Request failed";
        if (message === "AUTHENTICATION_REQUIRED") return window.location.replace("/login");
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => { void load(); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-black text-violet-700">חיפוש גלובלי</p>
          <h1 className="mt-2 text-3xl font-black">חיפוש מול כל המודולים</h1>
        </header>

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם, עיר, נושא, ילד, פעילות…" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3" />

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}
        {loading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">מחפש…</div> : null}

        {!loading && query.trim() ? (
          <div className="mt-6 space-y-6">
            {(() => (
              <>
                {renderSearchSection(createMentorSection(rows.mentors))}
                {renderSearchSection(createParentSection(rows.parents))}
                {renderSearchSection(createChildSection(rows.children))}
                {renderSearchSection(createMeetingSection(rows.meetings))}
                {renderSearchSection(createActivitySection(rows.activities))}
              </>
            ))()}
          </div>
        ) : null}
      </div>
    </main>
  );
}
