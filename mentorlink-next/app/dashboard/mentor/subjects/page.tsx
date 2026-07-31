"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import {
  SUBJECT_CATEGORIES,
  type SubjectCategory,
} from "../../../../lib/subject-catalog-core";

const AGE_GROUPS = ["א׳–ב׳", "ג׳–ד׳", "ה׳–ו׳", "חטיבת ביניים", "תיכון"];

type Subject = { id: number; name: string; category: SubjectCategory; canDelete?: boolean };
type Message = { type: "success" | "error"; text: string } | null;

export default function MentorSubjectsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [newCategory, setNewCategory] = useState<SubjectCategory>("לימודים");
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (error || !accessToken) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/mentor-subjects", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) {
        setMessage({ type: "error", text: "לא ניתן לטעון את המקצועות." });
        setLoading(false);
        return;
      }
      setToken(accessToken);
      setCatalog(body.catalog ?? []);
      setSelections(
        Object.fromEntries(
          (body.selected ?? []).map((row: { subject_id: number; age_groups: string[] }) => [
            row.subject_id,
            row.age_groups,
          ]),
        ),
      );
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  const grouped = useMemo(
    () => SUBJECT_CATEGORIES.map((category) => ({
      category,
      subjects: catalog.filter((subject) =>
        subject.category === category &&
        subject.name.toLocaleLowerCase("he").includes(query.trim().toLocaleLowerCase("he")),
      ),
    })),
    [catalog, query],
  );

  function toggleSubject(id: number) {
    setMessage(null);
    setSelections((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = [...AGE_GROUPS];
      return next;
    });
  }

  function toggleAgeGroup(id: number, ageGroup: string) {
    setSelections((current) => ({
      ...current,
      [id]: current[id]?.includes(ageGroup)
        ? current[id].filter((value) => value !== ageGroup)
        : [...(current[id] ?? []), ageGroup],
    }));
  }

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim() || !token) return;
    setAdding(true);
    setMessage(null);
    const response = await fetch("/api/mentor-subjects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName, category: newCategory }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ type: "error", text: body.error ?? "לא ניתן להוסיף את המקצוע." });
      setAdding(false);
      return;
    }
    const subject = { ...(body.subject as Subject), canDelete: true };
    setCatalog((current) => [...current, subject]);
    setSelections((current) => ({ ...current, [subject.id]: [...AGE_GROUPS] }));
    setNewName("");
    setMessage({ type: "success", text: `${subject.name} נוסף מיד למקצועות שלך.` });
    setAdding(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const rows = Object.entries(selections).map(([subjectId, ageGroups]) => ({
      subjectId: Number(subjectId),
      ageGroups,
    }));
    if (!rows.length || rows.some((row) => row.ageGroups.length === 0)) {
      setMessage({
        type: "error",
        text: !rows.length
          ? "יש לבחור לפחות מקצוע אחד."
          : "יש לבחור לפחות שכבת גיל אחת לכל מקצוע.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/mentor-subjects", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ selections: rows }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok
      ? { type: "success", text: "המקצועות והתחומים נשמרו בהצלחה." }
      : { type: "error", text: body.error ?? "לא ניתן לשמור את המקצועות." });
    setSaving(false);
  }

  async function deleteSubject(subject: Subject) {
    if (!subject.canDelete || !token) return;
    if (!window.confirm(`למחוק את ${subject.name} מהמקצועות שלך?`)) return;
    const response = await fetch(`/api/mentor-subjects?subjectId=${subject.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ type: "error", text: body.error ?? "לא ניתן למחוק את המקצוע." });
      return;
    }
    setCatalog((current) => body.removedFromCatalog
      ? current.filter((item) => item.id !== subject.id)
      : current.map((item) => item.id === subject.id ? { ...item, canDelete: false } : item));
    setSelections((current) => {
      const next = { ...current };
      delete next[subject.id];
      return next;
    });
    setMessage({
      type: "success",
      text: body.removedFromCatalog
        ? `${subject.name} נמחק מהמקצועות שלך ומהמאגר.`
        : `${subject.name} הוסר מהמקצועות שלך. הוא נשאר במאגר מפני שחונכים נוספים משתמשים בו.`,
    });
  }

  if (loading) {
    return <main dir="rtl" className="flex min-h-screen items-center justify-center"><p>טוען מקצועות ותחומים...</p></main>;
  }

  return (
    <main dir="rtl" className="mx-auto max-w-5xl">
      <section>
        <p className="font-bold text-blue-600">ניהול שוטף</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900">המקצועות והתחומים שלי</h1>
        <p className="mt-3 text-slate-600">אפשר לבחור כמה תחומים שרוצים. לכל מקצוע סמנו את הגילים המתאימים.</p>
        <label className="mt-6 block font-bold text-slate-800">
          חיפוש מקצוע או תחום
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="לדוגמה: כדורגל, אנגלית או תכנות" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
        </label>

        <form onSubmit={save} className="mt-8 space-y-6">
          {grouped.filter(({ subjects }) => subjects.length).map(({ category, subjects }) => (
            <section key={category} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-extrabold text-slate-900">{category}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {subjects.map((subject) => {
                  const selected = selections[subject.id] !== undefined;
                  return (
                    <div key={subject.id} className={`rounded-2xl border p-4 ${selected ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-3 font-bold">
                          <input type="checkbox" checked={selected} onChange={() => toggleSubject(subject.id)} className="h-5 w-5 accent-blue-600" />
                          {subject.name}
                        </label>
                        {subject.canDelete && <button type="button" onClick={() => deleteSubject(subject)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700">מחיקה</button>}
                      </div>
                      {selected && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {AGE_GROUPS.map((ageGroup) => (
                            <label key={ageGroup} className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-sm">
                              <input type="checkbox" checked={selections[subject.id].includes(ageGroup)} onChange={() => toggleAgeGroup(subject.id, ageGroup)} />
                              {ageGroup}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {message && <p role={message.type === "error" ? "alert" : "status"} className={`rounded-xl p-4 font-bold ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message.text}</p>}
          <button disabled={saving} className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white disabled:bg-slate-400">
            {saving ? "שומר..." : "שמירת המקצועות והתחומים"}
          </button>
        </form>

        <form onSubmit={addSubject} className="mt-8 rounded-3xl border border-dashed border-blue-300 bg-white p-6">
          <h2 className="text-xl font-extrabold">לא מצאת? הוספת מקצוע או תחום חדש</h2>
          <p className="mt-2 text-sm text-slate-600">ערך תקין יתווסף מיד למאגר ולבחירות שלך.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as SubjectCategory)} className="rounded-xl border px-4 py-3">
              {SUBJECT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={50} placeholder="שם המקצוע או התחום" className="rounded-xl border px-4 py-3" />
            <button disabled={adding || !newName.trim()} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:bg-slate-400">
              {adding ? "מוסיף..." : "הוספה"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
