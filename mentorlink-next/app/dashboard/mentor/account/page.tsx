"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAgeFromBirthDate } from "@/lib/mentor-age";
import AccountEmailPanel from "@/app/_components/AccountEmailPanel";
import PasswordPanel from "@/app/_components/PasswordPanel";

type Completion = Record<string, boolean | null>;

const cards = [
  { key: "profile", title: "פרטים אישיים", description: "שם, לימודים, שפות ותיאור קצר.", href: "/dashboard/mentor/profile" },
  { key: "subjects", title: "מקצועות ותחומים", description: "תחומי החונכות ושכבות הגיל.", href: "/dashboard/mentor/subjects" },
  { key: "availability", title: "זמינות", description: "ימים, שעות, מקצועות ואופן מפגש.", href: "/dashboard/mentor/scheduling" },
  { key: "locations", title: "אזורי פעילות ובתי ספר", description: "אזורים, מוסדות ומקומות מפגש.", href: "/dashboard/mentor/locations" },
  { key: "experience", title: "ניסיון ויכולות", description: "רקע, חוזקות וסגנון חונכות.", href: "/dashboard/mentor/experience" },
  { key: "preferences", title: "העדפות התאמה", description: "העדפות שיעזרו ליצור התאמה טובה.", href: "/dashboard/mentor/preferences" },
  { key: "photo", title: "תמונת פרופיל", description: "התמונה שמוצגת למשפחות.", href: "/dashboard/mentor/photo" },
  { key: "parentConsent", title: "אישור הורה", description: "לחונכים שטרם מלאו להם 18: שליחת בקשה ומעקב אחר אישור ההורה.", href: "/dashboard/mentor/parent-consent" },
] as const;

export default function MentorAccountPage() {
  const [completion, setCompletion] = useState<Completion>({});

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token;
      if (!token || !session) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [profile, subjects, availability, consent] = await Promise.all([
        fetch("/api/mentor-profile", { headers, cache: "no-store" }),
        fetch("/api/mentor-subjects", { headers, cache: "no-store" }),
        fetch("/api/mentor-availability", { headers, cache: "no-store" }),
        supabase.from("mentor_parent_consents").select("status").eq("user_id", session.user.id).maybeSingle(),
      ]);
      const [profileBody, subjectBody, availabilityBody] = await Promise.all([
        profile.ok ? profile.json() : {},
        subjects.ok ? subjects.json() : {},
        availability.ok ? availability.json() : {},
      ]) as [
        { profile?: { first_name?: string | null; bio?: string | null; birth_date?: string | null } },
        { selected?: unknown[] },
        { windows?: unknown[] },
      ];
      const age = profileBody.profile?.birth_date ? getAgeFromBirthDate(profileBody.profile.birth_date) : null;
      if (!active) return;
      setCompletion({
        profile: profile.ok ? Boolean(profileBody.profile?.first_name && profileBody.profile?.bio) : null,
        subjects: subjects.ok ? (subjectBody.selected ?? []).length > 0 : null,
        availability: availability.ok ? (availabilityBody.windows ?? []).length > 0 : null,
        parentConsent: age === null ? null : age >= 18 ? true : consent.data?.status === "approved",
      });
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="font-black text-blue-700">ניהול החשבון</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">החשבון שלי</h1>
      <p className="mt-3 text-slate-600">כאן אפשר לעדכן בכל עת את הפרטים שמילאתם בהרשמה.</p>
      <div className="mt-7"><AccountEmailPanel /></div>
      <div className="mt-7"><PasswordPanel /></div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const state = completion[card.key];
          return (
            <Link key={card.key} href={card.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${state === true ? "bg-emerald-100 text-emerald-800" : state === false ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                  {state === true ? "הושלם" : state === false ? "דורש השלמה" : "לעריכה"}
                </span>
                <span className="text-2xl text-blue-600 transition group-hover:-translate-x-1">←</span>
              </div>
              <h2 className="mt-5 text-xl font-black">{card.title}</h2>
              <p className="mt-2 text-slate-600">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
