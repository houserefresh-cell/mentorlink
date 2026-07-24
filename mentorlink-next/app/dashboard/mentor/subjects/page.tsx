"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const AGE_GROUPS = [
  "א׳–ב׳",
  "ג׳–ד׳",
  "ה׳–ו׳",
  "חטיבת ביניים",
  "תיכון",
] as const;

type Subject = {
  id: number;
  name: string;
};

type MentorSubject = {
  subject_id: number;
  age_groups: string[];
  custom_subject: string | null;
};

type Message = {
  type: "success" | "error";
  text: string;
} | null;

export default function MentorSubjectsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [customSubject, setCustomSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;

    async function loadSubjects() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const [subjectsResult, choicesResult] = await Promise.all([
        supabase.from("subjects").select("id, name").order("id"),
        supabase
          .from("mentor_subjects")
          .select("subject_id, age_groups, custom_subject")
          .eq("user_id", user.id),
      ]);

      if (!active) {
        return;
      }

      if (subjectsResult.error || choicesResult.error) {
        const error = subjectsResult.error ?? choicesResult.error;

        setMessage({
          type: "error",
          text: `לא ניתן לטעון את תחומי החונכות: ${error?.message}`,
        });
        setLoading(false);
        return;
      }

      const savedChoices = (choicesResult.data ?? []) as MentorSubject[];
      const loadedSelections = savedChoices.reduce<Record<number, string[]>>(
        (result, choice) => {
          result[choice.subject_id] = choice.age_groups;
          return result;
        },
        {},
      );
      const otherSubject = (subjectsResult.data ?? []).find(
        (subject) => subject.name === "אחר",
      );
      const savedOtherChoice = otherSubject
        ? savedChoices.find((choice) => choice.subject_id === otherSubject.id)
        : undefined;

      setUserId(user.id);
      setSubjects((subjectsResult.data ?? []) as Subject[]);
      setSelections(loadedSelections);
      setCustomSubject(savedOtherChoice?.custom_subject ?? "");
      setLoading(false);
    }

    loadSubjects();

    return () => {
      active = false;
    };
  }, [router]);

  function toggleSubject(subjectId: number) {
    setMessage(null);
    setSelections((current) => {
      if (current[subjectId]) {
        const next = { ...current };
        delete next[subjectId];
        return next;
      }

      return { ...current, [subjectId]: [] };
    });
  }

  function toggleAgeGroup(subjectId: number, ageGroup: string) {
    setMessage(null);
    setSelections((current) => {
      const selectedGroups = current[subjectId] ?? [];
      const nextGroups = selectedGroups.includes(ageGroup)
        ? selectedGroups.filter((group) => group !== ageGroup)
        : [...selectedGroups, ageGroup];

      return { ...current, [subjectId]: nextGroups };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!userId) {
      setMessage({
        type: "error",
        text: "לא ניתן לזהות את המשתמש המחובר. יש להתחבר מחדש.",
      });
      return;
    }

    const selectedSubjectIds = Object.keys(selections).map(Number);

    if (selectedSubjectIds.length === 0) {
      setMessage({
        type: "error",
        text: "יש לבחור לפחות תחום חונכות אחד.",
      });
      return;
    }

    const subjectWithoutAgeGroup = selectedSubjectIds.find(
      (subjectId) => selections[subjectId].length === 0,
    );

    if (subjectWithoutAgeGroup) {
      const subjectName =
        subjects.find((subject) => subject.id === subjectWithoutAgeGroup)
          ?.name ?? "";
      setMessage({
        type: "error",
        text: `יש לבחור לפחות שכבת גיל אחת עבור ${subjectName}.`,
      });
      return;
    }

    const otherSubject = subjects.find((subject) => subject.name === "אחר");
    const otherIsSelected =
      otherSubject !== undefined && selections[otherSubject.id] !== undefined;

    if (otherIsSelected && !customSubject.trim()) {
      setMessage({
        type: "error",
        text: "יש לפרט את תחום החונכות האחר.",
      });
      return;
    }

    setSaving(true);

    const rows = selectedSubjectIds.map((subjectId) => ({
      user_id: userId,
      subject_id: subjectId,
      age_groups: selections[subjectId],
      custom_subject:
        subjectId === otherSubject?.id ? customSubject.trim() : null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("mentor_subjects")
      .upsert(rows, { onConflict: "user_id,subject_id" });

    if (upsertError) {
      setMessage({
        type: "error",
        text: `לא ניתן לשמור את תחומי החונכות: ${upsertError.message}`,
      });
      setSaving(false);
      return;
    }

    const { data: savedChoices, error: loadError } = await supabase
      .from("mentor_subjects")
      .select("subject_id")
      .eq("user_id", userId);

    if (loadError) {
      setMessage({
        type: "error",
        text: `הבחירות נשמרו, אך לא ניתן היה להשלים את הסנכרון: ${loadError.message}`,
      });
      setSaving(false);
      return;
    }

    const removedSubjectIds = (savedChoices ?? [])
      .map((choice) => choice.subject_id as number)
      .filter((subjectId) => !selectedSubjectIds.includes(subjectId));

    if (removedSubjectIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("mentor_subjects")
        .delete()
        .eq("user_id", userId)
        .in("subject_id", removedSubjectIds);

      if (deleteError) {
        setMessage({
          type: "error",
          text: `הבחירות החדשות נשמרו, אך לא ניתן למחוק בחירות שהוסרו: ${deleteError.message}`,
        });
        setSaving(false);
        return;
      }
    }

    setCustomSubject(customSubject.trim());
    setMessage({
      type: "success",
      text: "תחומי החונכות נשמרו בהצלחה.",
    });
    setSaving(false);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <p className="text-lg font-bold text-slate-600">
          טוען את תחומי החונכות...
        </p>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-extrabold text-blue-600">
            MentorLink
          </Link>

          <Link
            href="/dashboard/mentor"
            className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-100"
          >
            חזרה לאזור האישי
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-8">
          <p className="mb-2 font-bold text-blue-600">השלמת הפרופיל</p>
          <h1 className="text-4xl font-extrabold text-slate-900 md:text-5xl">
            מקצועות ותחומי חונכות
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            בחרו את התחומים שבהם תוכלו לעזור ואת שכבות הגיל המתאימות.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 lg:grid-cols-2">
            {subjects.map((subject) => {
              const isSelected = selections[subject.id] !== undefined;

              return (
                <fieldset
                  key={subject.id}
                  className={`rounded-3xl border bg-white p-6 shadow-sm transition ${
                    isSelected
                      ? "border-blue-400 ring-4 ring-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSubject(subject.id)}
                      className="h-5 w-5 accent-blue-600"
                    />
                    <span className="text-xl font-extrabold text-slate-900">
                      {subject.name}
                    </span>
                  </label>

                  {isSelected && (
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      {subject.name === "אחר" && (
                        <div className="mb-5">
                          <label
                            htmlFor="customSubject"
                            className="mb-2 block font-bold text-slate-800"
                          >
                            מהו התחום?
                          </label>
                          <input
                            id="customSubject"
                            type="text"
                            value={customSubject}
                            onChange={(event) =>
                              setCustomSubject(event.target.value)
                            }
                            required
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          />
                        </div>
                      )}

                      <p className="mb-3 font-bold text-slate-700">
                        שכבות גיל
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {AGE_GROUPS.map((ageGroup) => {
                          const ageGroupSelected =
                            selections[subject.id]?.includes(ageGroup) ?? false;

                          return (
                            <label
                              key={ageGroup}
                              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition ${
                                ageGroupSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={ageGroupSelected}
                                onChange={() =>
                                  toggleAgeGroup(subject.id, ageGroup)
                                }
                                className="sr-only"
                              />
                              {ageGroup}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "שומר..." : "שמירת תחומי חונכות"}
            </button>

            {message && (
              <p
                role={message.type === "error" ? "alert" : "status"}
                className={`mt-5 rounded-xl p-4 text-center ${
                  message.type === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {message.text}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
