"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ActivityRow = {
  id: string;
  mentor_user_id: string | null;
  title: string | null;
  status: string | null;
  max_participants: number | null;
  updated_at: string | null;
  created_at: string | null;
  published_at: string | null;
  mentorName: string | null;
};

export default function AdminActivitiesPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
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
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), query, status });
        const response = await fetch(`/api/admin/activities?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "לא ניתן לטעון את הפעילויות.");
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
  }, [page, pageSize, query, status]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-black text-blue-700">פעילויות</p>
          <h1 className="mt-2 text-3xl font-black">ניהול פעילויות</h1>
        </header>

        <section className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <input aria-label="חיפוש פעילות" value={query} onChange={(e) => { setPage(1); setQuery(e.target.value); }} placeholder="חיפוש פעילות" className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
            <option value="">כל הסטטוסים</option>
            <option value="draft">טיוטה</option>
            <option value="published">פורסם</option>
            <option value="cancelled">בוטל</option>
          </select>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">סה״כ: {total}</div>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">טוען פעילויות…</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-3 font-black">פעילות</th>
                    <th className="px-3 py-3 font-black">חונך</th>
                    <th className="px-3 py-3 font-black">סטטוס</th>
                    <th className="px-3 py-3 font-black">מקומות</th>
                    <th className="px-3 py-3 font-black">עדכון אחרון</th>
                    <th className="px-3 py-3 font-black">קישור</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-3">{row.title || "—"}</td>
                      <td className="px-3 py-3">{row.mentorName || row.mentor_user_id || "—"}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${row.status === "published" ? "bg-emerald-100 text-emerald-800" : row.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-800"}`}>{row.status || "—"}</span></td>
                      <td className="px-3 py-3">{row.max_participants ? `${row.max_participants}` : "—"}</td>
                      <td className="px-3 py-3">{row.updated_at ? new Date(row.updated_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="px-3 py-3"><Link href={`/dashboard/admin/activities/${row.id}`} className="font-black text-blue-700">פתח</Link></td>
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
