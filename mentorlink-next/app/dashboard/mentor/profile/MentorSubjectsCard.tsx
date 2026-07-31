"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

type CatalogSubject = { id: number; name: string };

export default function MentorSubjectsCard() {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const response = await fetch("/api/mentor-subjects", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const selectedIds = new Set<number>(
        (body.selected ?? []).map((row: { subject_id: number }) => row.subject_id),
      );
      setNames(
        (body.catalog ?? [])
          .filter((subject: CatalogSubject) => selectedIds.has(subject.id))
          .map((subject: CatalogSubject) => subject.name),
      );
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <section className="mb-8 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-bold text-blue-600">המקצועות והתחומים שלי</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
            במה אפשר לקבל ממך חונכות?
          </h2>
        </div>
        <Link
          href="/dashboard/mentor/subjects"
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
        >
          {names.length ? "עריכת מקצועות" : "בחירת מקצועות"}
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {loading ? (
          <span className="text-slate-500">טוען...</span>
        ) : names.length ? (
          names.map((name) => (
            <span key={name} className="rounded-full bg-blue-50 px-4 py-2 font-bold text-blue-800">
              {name}
            </span>
          ))
        ) : (
          <p className="text-slate-600">עדיין לא נבחרו מקצועות או תחומים.</p>
        )}
      </div>
    </section>
  );
}
