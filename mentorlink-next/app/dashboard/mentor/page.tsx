"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getAgeFromBirthDate } from "../../../lib/mentor-age";
import { getDashboardPath } from "../../../lib/auth-routing";

const CARDS = [
  { key: "onboarding", title: "מסע הרשמה", description: "השלמת הפרופיל בשלבים קצרים ונוחים למובייל.", href: "/dashboard/mentor/onboarding" },
  { key: "profile", title: "פרטים אישיים", description: "שם, לימודים, שפות ותיאור קצר.", href: "/dashboard/mentor/profile" },
  { key: "subjects", title: "מקצועות ותחומים", description: "תחומי החונכות ושכבות הגיל.", href: "/dashboard/mentor/subjects" },
  { key: "availability", title: "זמינות", description: "ימים, שעות וסוגי מפגשים.", href: "/dashboard/mentor/scheduling" },
  { key: "locations", title: "אזורי פעילות ובתי ספר", description: "אזורים, מוסדות ומקומות מפגש.", href: "/dashboard/mentor/locations" },
  { key: "experience", title: "ניסיון ויכולות", description: "רקע, חוזקות וסגנון חונכות.", href: "/dashboard/mentor/experience" },
  { key: "preferences", title: "העדפות התאמה", description: "העדפות שיעזרו ליצור התאמה טובה.", href: "/dashboard/mentor/preferences" },
  { key: "photo", title: "תמונת פרופיל", description: "תמונה ברורה ואמינה למשפחות.", href: "/dashboard/mentor/photo" },
  { key: "parentConsent", title: "אישור הורה", description: "אישור הורה לחונך שטרם מלאו לו 18.", href: "/dashboard/mentor/parent-consent" },
  { key: "preview", title: "תצוגה מקדימה ופרסום", description: "בדיקה ושליחת הפרופיל לאישור.", href: "/dashboard/mentor/preview" },
  { key: "meetingRequests", title: "בקשות לפגישה", description: "בקשות חדשות, פגישות מאושרות והיסטוריה.", href: "/dashboard/mentor/meeting-requests" },
] as const;

type ConsentCardStatus = "הושלם" | "ממתין לאישור" | "חסר" | "לא נדרש";

export default function MentorDashboardPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [complete, setComplete] = useState<Record<string, boolean>>({});
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [consentStatus, setConsentStatus] = useState("missing");
  const [accountOwnerType, setAccountOwnerType] = useState("mentor");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const dashboardPath = await getDashboardPath(auth.user.id);
      if (dashboardPath !== "/dashboard/mentor") {
        return router.replace(dashboardPath);
      }
      setEmail(auth.user.email ?? auth.user.phone ?? "");
      setFirstName(auth.user.user_metadata?.first_name ?? "");
      const id = auth.user.id;
      const [profile, subjects, availability, locations, experience, preferences, consent, ownership] = await Promise.all([
        supabase.from("mentor_profiles").select("first_name, birth_date, bio, profile_photo_path").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_subjects").select("subject_id").eq("user_id", id).limit(1),
        supabase.from("mentor_availability").select("user_id").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_locations").select("user_id").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_experience").select("user_id").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_preferences").select("user_id").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_parent_consents").select("status").eq("user_id", id).maybeSingle(),
        supabase.from("mentor_account_ownership").select("owner_type").eq("user_id", id).maybeSingle(),
      ]);
      const age = profile.data?.birth_date
        ? getAgeFromBirthDate(profile.data.birth_date)
        : null;
      const minor = age === null ? null : age < 18;
      const parentConsentComplete = minor === false || consent.data?.status === "approved";
      const state = {
        profile: Boolean(profile.data?.first_name && profile.data?.birth_date && profile.data?.bio),
        subjects: Boolean(subjects.data?.length),
        availability: Boolean(availability.data),
        locations: Boolean(locations.data),
        experience: Boolean(experience.data),
        preferences: Boolean(preferences.data),
        photo: Boolean(profile.data?.profile_photo_path),
        parentConsent: parentConsentComplete,
      };
      setIsMinor(minor);
      setConsentStatus(consent.data?.status ?? "missing");
      setAccountOwnerType(ownership.data?.owner_type ?? "mentor");
      setComplete({ ...state, preview: Object.values(state).every(Boolean) });
      setLoading(false);
    }
    load();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-lg font-bold text-slate-600">טוען את האזור האישי...</p>
      </main>
    );
  }

  const progressKeys = [
    "profile",
    "subjects",
    "availability",
    "locations",
    "experience",
    "preferences",
    "photo",
    ...(isMinor === false ? [] : ["parentConsent"]),
  ];
  const completed = progressKeys.filter((key) => complete[key]).length;
  const percent = Math.round((completed / progressKeys.length) * 100);

  function getConsentCardStatus(): ConsentCardStatus {
    if (isMinor === false) return "לא נדרש";
    if (consentStatus === "approved") return "הושלם";
    if (consentStatus === "sent") return "ממתין לאישור";
    return "חסר";
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-extrabold text-blue-600">MentorLink</Link>
          <button type="button" onClick={logout} className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">התנתקות</button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-2 font-bold text-blue-600">האזור האישי לחונכים</p>
          <h1 className="text-4xl font-extrabold text-slate-900 md:text-5xl">שלום {firstName || "חונך"} 👋</h1>
          <p className="mt-3 text-lg text-slate-600">בואו נשלים את הפרופיל כדי שמשפחות יוכלו להכיר אתכם.</p>
        </div>
        <div className="mb-8 rounded-3xl border border-blue-100 bg-white p-8 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold">השלמת הפרופיל</h2>
              <p className="mt-1 text-slate-600">{completed} מתוך {progressKeys.length} קטגוריות נדרשות הושלמו</p>
            </div>
            <span className="rounded-full bg-blue-100 px-4 py-2 font-bold text-blue-700">{percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-4 text-sm text-slate-500">מחובר כ־{email}</p>
          {accountOwnerType === "parent_guardian" && (
            <p className="mt-2 font-bold text-blue-700">
              חשבון חונך קטין המנוהל בידי הורה
            </p>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const status = card.key === "parentConsent"
              ? getConsentCardStatus()
              : complete[card.key]
                ? "הושלם"
                : "טרם הושלם";
            const positive = status === "הושלם" || status === "לא נדרש";
            const waiting = status === "ממתין לאישור";
            return (
              <Link key={card.key} href={card.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
                <div className="mb-5 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${positive ? "bg-green-100 text-green-700" : waiting ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {status}
                  </span>
                  <span className="text-2xl text-blue-600">←</span>
                </div>
                <h2 className="text-xl font-extrabold">{card.title}</h2>
                <p className="mt-3 leading-7 text-slate-600">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
