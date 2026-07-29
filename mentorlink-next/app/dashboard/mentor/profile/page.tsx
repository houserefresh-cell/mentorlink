"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Message = {
  type: "success" | "error";
  text: string;
} | null;

type MentorProfile = {
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  grade: string | null;
  school: string | null;
  city: string | null;
  phone: string | null;
  languages: string[] | null;
  bio: string | null;
};

type PendingChange = {
  id: string;
  field_name: string;
  current_value: unknown;
  requested_value: unknown;
  requested_at: string;
};

const PENDING_FIELD_LABELS: Record<string, string> = {
  first_name: "שם פרטי",
  last_name: "שם משפחה",
  birth_date: "תאריך לידה",
  bio: "תיאור קצר על עצמי",
};

export default function MentorProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pendingFields, setPendingFields] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [initialValues, setInitialValues] = useState<MentorProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [languages, setLanguages] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      const user = session.session?.user;
      const token = session.session?.access_token;
      if (!active) return;
      if (sessionError || !user || !token) { router.replace("/login"); return; }
      setUserId(user.id); setAccessToken(token);
      const response = await fetch("/api/mentor-profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) { setMessage({ type: "error", text: "לא ניתן לטעון את הפרופיל." }); setLoading(false); return; }
      const data = body.profile as MentorProfile | null;
      setFirstName(data?.first_name ?? user.user_metadata?.first_name ?? "");
      setLastName(data?.last_name ?? user.user_metadata?.last_name ?? "");
      setBirthDate(data?.birth_date ?? ""); setGrade(data?.grade ?? ""); setSchool(data?.school ?? "");
      setCity(data?.city ?? ""); setPhone(data?.phone ?? ""); setLanguages(data?.languages?.join(", ") ?? ""); setBio(data?.bio ?? "");
      setInitialValues({
        first_name: data?.first_name ?? user.user_metadata?.first_name ?? "",
        last_name: data?.last_name ?? user.user_metadata?.last_name ?? "",
        birth_date: data?.birth_date ?? "",
        grade: data?.grade ?? "",
        school: data?.school ?? "",
        city: data?.city ?? "",
        phone: data?.phone ?? "",
        languages: data?.languages ?? [],
        bio: data?.bio ?? "",
      });
      const loadedPendingChanges: PendingChange[] = Array.isArray(body.pendingChanges)
        ? body.pendingChanges
        : [];
      setPendingChanges(loadedPendingChanges);
      setPendingFields(loadedPendingChanges.map((change) => change.field_name));
      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const currentValues: MentorProfile = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    birth_date: birthDate,
    grade: grade.trim(),
    school: school.trim(),
    city: city.trim(),
    phone: phone.trim(),
    languages: languages.split(",").map((language) => language.trim()).filter(Boolean),
    bio: bio.trim(),
  };

  const hasChanges =
    initialValues !== null &&
    JSON.stringify(currentValues) !== JSON.stringify(initialValues);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setMessage({
        type: "error",
        text: "לא ניתן לזהות את המשתמש המחובר. יש להתחבר מחדש.",
      });
      return;
    }

    const normalizedLanguages = languages
      .split(",")
      .map((language) => language.trim())
      .filter(Boolean);

    if (normalizedLanguages.length === 0) {
      setMessage({
        type: "error",
        text: "יש להזין לפחות שפה אחת.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const response = await fetch("/api/mentor-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: normalizedFirstName, last_name: normalizedLastName, birth_date: birthDate,
        grade: grade.trim(), school: school.trim(), city: city.trim(), phone: phone.trim(),
        languages: normalizedLanguages, bio: bio.trim(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ type: "error", text: `${result.error ?? "לא ניתן לשמור את הפרופיל."} (${result.code ?? "PROFILE_SAVE_FAILED"})` });
      setSaving(false); return;
    }
    const nextPendingChanges: PendingChange[] = Array.isArray(result.pendingChanges)
      ? result.pendingChanges
      : [];
    const nextPending: string[] = Array.isArray(result.pendingFields)
      ? result.pendingFields
      : nextPendingChanges.map((change) => change.field_name);

    setPendingChanges(nextPendingChanges);
    setPendingFields(nextPending);
    const namePending = nextPending.includes("first_name") || nextPending.includes("last_name");
    const { error: metadataError } = namePending ? { error: null } : await supabase.auth.updateUser({ data: { first_name: normalizedFirstName, last_name: normalizedLastName } });

    setFirstName(normalizedFirstName);
    setLastName(normalizedLastName);
    setGrade(grade.trim());
    setSchool(school.trim());
    setCity(city.trim());
    setPhone(phone.trim());
    setLanguages(normalizedLanguages.join(", "));
    setBio(bio.trim());
    setInitialValues({
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      birth_date: birthDate,
      grade: grade.trim(),
      school: school.trim(),
      city: city.trim(),
      phone: phone.trim(),
      languages: normalizedLanguages,
      bio: bio.trim(),
    });

    if (metadataError) {
      setMessage({
        type: "error",
        text: `הפרופיל נשמר, אך לא ניתן לסנכרן את השם לאזור האישי: ${metadataError.message}`,
      });
    } else {
      setMessage({
        type: "success",
        text: nextPending.length ? "השינוי ממתין לאישור." : "השינויים נשמרו.",
      });
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <p className="text-lg font-bold text-slate-600">טוען את הפרטים...</p>
      </main>
    );
  }

  const inputClassName =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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

      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="mb-8">
          <p className="mb-2 font-bold text-blue-600">השלמת הפרופיל</p>
          <h1 className="text-4xl font-extrabold text-slate-900 md:text-5xl">
            פרטים אישיים
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            הפרטים יעזרו למשפחות להכיר אותך ולבחור את החונך המתאים.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl md:p-10"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="שם פרטי" htmlFor="firstName">{pendingFields.includes("first_name") && <PendingLabel />}
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
                className={inputClassName}
              />
            </FormField>

            <FormField label="שם משפחה" htmlFor="lastName">{pendingFields.includes("last_name") && <PendingLabel />}
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
                className={inputClassName}
              />
            </FormField>

            <FormField label="תאריך לידה" htmlFor="birthDate">{pendingFields.includes("birth_date") && <PendingLabel />}
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
                max={new Date().toISOString().split("T")[0]}
                className={inputClassName}
              />
            </FormField>

            <FormField label="כיתה" htmlFor="grade">
              <input
                id="grade"
                type="text"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                required
                className={inputClassName}
              />
            </FormField>

            <FormField label="בית ספר" htmlFor="school">
              <input
                id="school"
                type="text"
                value={school}
                onChange={(event) => setSchool(event.target.value)}
                required
                className={inputClassName}
              />
            </FormField>

            <FormField label="עיר מגורים" htmlFor="city">
              <input
                id="city"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                autoComplete="address-level2"
                className={inputClassName}
              />
            </FormField>

            <FormField label="טלפון" htmlFor="phone">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                autoComplete="tel"
                dir="ltr"
                className={`${inputClassName} text-left`}
              />
            </FormField>

            <FormField label="שפות" htmlFor="languages">
              <input
                id="languages"
                type="text"
                value={languages}
                onChange={(event) => setLanguages(event.target.value)}
                required
                placeholder="עברית, אנגלית"
                className={inputClassName}
              />
              <p className="mt-2 text-sm text-slate-500">
                יש להפריד בין שפות באמצעות פסיק.
              </p>
            </FormField>
          </div>

          <div className="mt-5">
            <FormField label="תיאור קצר על עצמי" htmlFor="bio">{pendingFields.includes("bio") && <PendingLabel />}
              <textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                required
                rows={5}
                className={`${inputClassName} resize-y`}
              />
            </FormField>
          </div>

          {pendingChanges.length > 0 && (
            <section
              aria-labelledby="pending-changes-title"
              className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
            >
              <h2
                id="pending-changes-title"
                className="text-lg font-extrabold text-amber-950"
              >
                שינויים שממתינים לאישור
              </h2>

              <p className="mt-2 text-sm leading-6 text-amber-900">
                הפרטים החדשים נשמרו ונשלחו לבדיקה. עד לאישור, הפרופיל הציבורי
                ממשיך להציג את הערכים המאושרים.
              </p>

              <div className="mt-4 space-y-4">
                {pendingChanges.map((change) => (
                  <article
                    key={change.id}
                    className="rounded-xl border border-amber-200 bg-white p-4"
                  >
                    <h3 className="font-bold text-slate-900">
                      {PENDING_FIELD_LABELS[change.field_name] ??
                        change.field_name}
                    </h3>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">
                          הערך המאושר כרגע
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-slate-800">
                          {formatPendingValue(change.current_value)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="text-xs font-bold text-blue-700">
                          הערך שביקשת
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-blue-950">
                          {formatPendingValue(change.requested_value)}
                        </p>
                      </div>
                    </div>

                    {change.requested_at && (
                      <p className="mt-3 text-xs text-slate-500">
                        נשלח לבדיקה: {formatPendingDate(change.requested_at)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="mt-7 w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "שומר..." : "שמירת פרטים"}
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
        </form>
      </section>
    </main>
  );
}

function formatPendingValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "לא הוגדר";
  }

  if (Array.isArray(value)) {
    return value.length ? value.map(String).join(", ") : "לא הוגדר";
  }

  if (typeof value === "boolean") {
    return value ? "כן" : "לא";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatPendingDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("he-IL");
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-bold text-slate-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function PendingLabel() { return <span className="mb-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">ממתין לאישור</span>; }
