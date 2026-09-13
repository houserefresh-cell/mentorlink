"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MeetingRow = {
  id: string;
  mentor_user_id: string | null;
  parent_user_id: string | null;
  status: string | null;
  subject: string | null;
  requested_start_at: string | null;
  confirmed_start_at: string | null;
  proposed_start_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  child_first_name: string | null;
  mentorName: string | null;
  parentName: string | null;
};

export default function AdminMeetingsPage() {
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [range, setRange] = useState("week");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(40);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const session = (await supabase.auth.getSession()).data.session;
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), query, status, subject });
        if (range === "today") {
          const start = new Date(); start.setHours(0, 0, 0, 0);
          const end = new Date(); end.setHours(23, 59, 59, 999);
          params.set("from", start.toISOString());
          params.set("to", end.toISOString());
        }
        if (range === "week") {
          const start = new Date(); start.setDate(start.getDate() - 7);
          params.set("from", start.toISOString());
        }
        if (range === "month") {
          const start = new Date(); start.setMonth(start.getMonth() - 1);
          params.set("from", start.toISOString());
        }
        const response = await fetch(`/api/admin/meetings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error ?? "לא ניתן לטעון את רשימת הפגישות.");
        }
        if (!active) return;
        setRows(body.rows ?? []);
        setTotal(body.total ?? 0);
        setHasMore(Boolean(body.hasMore));
      } catch (reason) {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "Request failed";
        if (message === "AUTHENTICATION_REQUIRED") return window.location.replace("/login");
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [page, pageSize, query, status, subject, range]);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    alternative_proposed: "bg-violet-100 text-violet-800",
    accepted: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-slate-200 text-slate-800",
  };

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-black text-violet-700">פגישות</p>
          <h1 className="mt-2 text-3xl font-black">ניהול פגישות</h1>
        </header>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <input aria-label="חיפוש" value={query} onChange={(e) => { setPage(1); setQuery(e.target.value); }} placeholder="חיפוש" className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="accepted">אושר</option>
              <option value="alternative_proposed">הצעה חלופית</option>
              <option value="cancelled">בוטל</option>
            </select>
            <input aria-label="נושא" value={subject} onChange={(e) => { setPage(1); setSubject(e.target.value); }} placeholder="נושא" className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
            <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="week">שבוע</option>
              <option value="month">חודש</option>
              <option value="today">היום</option>
              <option value="all">הכל</option>
            </select>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">סה״כ: {total}</div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">טוען פגישות…</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-3 font-black">תאריך</th>
                    <th className="px-3 py-3 font-black">חונך</th>
                    <th className="px-3 py-3 font-black">הורה / ילד</th>
                    <th className="px-3 py-3 font-black">נושא</th>
                    <th className="px-3 py-3 font-black">סטטוס</th>
                    <th className="px-3 py-3 font-black">עדכון אחרון</th>
                    <th className="px-3 py-3 font-black">התראה</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-3 whitespace-nowrap">{row.confirmed_start_at ? new Date(row.confirmed_start_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : row.requested_start_at ? new Date(row.requested_start_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.mentorName || row.mentor_user_id || "—"}</td>
                      <td className="px-3 py-3">{row.parentName || row.parent_user_id || "—"}{row.child_first_name ? ` / ${row.child_first_name}` : ""}</td>
                      <td className="px-3 py-3">{row.subject || "—"}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${statusColors[row.status ?? ""] ?? "bg-slate-100 text-slate-800"}`}>{row.status ?? "—"}</span></td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="px-3 py-3"><Link href={`/dashboard/admin/meetings/${row.id}`} className="font-black text-blue-700">פתח</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold disabled:opacity-50">הקודם</button>
          <span className="font-bold text-slate-700">עמוד {page}</span>
          <button disabled={!hasMore} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold disabled:opacity-50">הבא</button>
        </div>
      </div>
    </main>
  );
}
