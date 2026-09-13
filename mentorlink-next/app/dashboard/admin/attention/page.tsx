"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type AttentionItem = {
  id: string;
  entityType: "meeting" | "activity" | "feedback" | "mentor";
  title: string;
  reason: string;
  severity: "critical" | "warning" | "normal";
  href: string;
  createdAt: string;
  contextLabel?: string;
};

export default function AdminAttentionPage() {
  const [rows, setRows] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const response = await fetch("/api/admin/attention", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error ?? "לא ניתן לטעון את רשימת הדורש טיפול.");
        }
        if (!active) return;
        setRows(body.attention ?? []);
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
  }, []);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-black text-red-700">דורש טיפול</p>
          <h1 className="mt-2 text-3xl font-black">רשימת הפעולות המומלצות</h1>
          <p className="mt-2 text-slate-700">הפריטים מופיעים רק על בסיס כללים ברורים מתוך הנתונים הקיימים.</p>
        </header>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">טוען רשימת מטלות…</div> : null}

        {!loading && !error ? (
          <div className="space-y-3">
            {rows.length ? rows.map((row) => (
              <Link key={row.id} href={row.href} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{row.entityType}</p>
                    <h2 className="mt-1 text-xl font-black">{row.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{row.contextLabel ? `${row.contextLabel} • ` : ""}{row.reason}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${row.severity === "critical" ? "bg-red-100 text-red-800" : row.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {row.severity === "critical" ? "קריטי" : row.severity === "warning" ? "אזהרה" : "תקין"}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">עודכן: {new Date(row.createdAt).toLocaleString("he-IL")}</p>
              </Link>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 font-bold text-slate-700">אין פריטים שמחייבים טיפול כרגע.</div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
