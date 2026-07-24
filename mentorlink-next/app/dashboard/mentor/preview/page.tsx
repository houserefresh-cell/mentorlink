"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { getAgeFromBirthDate } from "../../../../lib/mentor-age";
import { FormMessage, LoadingPage, MentorPageShell, MessageBox } from "../_components/MentorPageShell";

const SECTIONS = [
  ["פרטים אישיים", "/dashboard/mentor/profile", "profile"],
  ["מקצועות ותחומים", "/dashboard/mentor/subjects", "subjects"],
  ["זמינות", "/dashboard/mentor/availability", "availability"],
  ["אזורי פעילות ובתי ספר", "/dashboard/mentor/locations", "locations"],
  ["ניסיון ויכולות", "/dashboard/mentor/experience", "experience"],
  ["העדפות התאמה", "/dashboard/mentor/preferences", "preferences"],
  ["תמונת פרופיל", "/dashboard/mentor/photo", "photo"],
  ["אישור הורה", "/dashboard/mentor/parent-consent", "parentConsent"],
] as const;

type PreviewData = Record<string, unknown> & {
  profile?: Record<string, unknown>;
  subjects?: { subjects?: { name?: string }; custom_subject?: string; age_groups?: string[] }[];
  availability?: Record<string, unknown>;
  locations?: Record<string, unknown>;
  experience?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  parentConsent?: Record<string, unknown>;
};

export default function PreviewPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<PreviewData>({});
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      setUserId(auth.user.id);
      const [profile, subjects, availability, locations, experience, preferences, parentConsent, publication] = await Promise.all([
        supabase.from("mentor_profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_subjects").select("age_groups, custom_subject, subjects(name)").eq("user_id", auth.user.id),
        supabase.from("mentor_availability").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_locations").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_experience").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_parent_consents").select("status").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_publication").select("status").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      const error = [profile, subjects, availability, locations, experience, preferences, parentConsent, publication].find((result) => result.error)?.error;
      if (error) { console.error(error); setMessage({ type: "error", text: `שגיאה בטעינת התצוגה: ${error.message}` }); }
      const profileData = profile.data as Record<string, unknown> | null;
      setData({ profile: profileData ?? undefined, subjects: (subjects.data ?? []) as PreviewData["subjects"], availability: availability.data ?? undefined, locations: locations.data ?? undefined, experience: experience.data ?? undefined, preferences: preferences.data ?? undefined, parentConsent: parentConsent.data ?? undefined });
      setStatus(publication.data?.status ?? "draft");
      const path = profileData?.profile_photo_path as string | undefined;
      if (path) { const { data: signed } = await supabase.storage.from("mentor-profile-photos").createSignedUrl(path, 3600); setPhotoUrl(signed?.signedUrl ?? ""); }
      setLoading(false);
    }
    load();
  }, [router]);

  const age = data.profile?.birth_date
    ? getAgeFromBirthDate(String(data.profile.birth_date))
    : null;
  const isMinor = age === null ? null : age < 18;
  const complete = {
    profile: Boolean(data.profile?.first_name && data.profile?.birth_date && data.profile?.bio),
    subjects: Boolean(data.subjects?.length),
    availability: Boolean(data.availability),
    locations: Boolean(data.locations),
    experience: Boolean(data.experience),
    preferences: Boolean(data.preferences),
    photo: Boolean(data.profile?.profile_photo_path),
    parentConsent:
      isMinor === false || data.parentConsent?.status === "approved",
  };
  const requiredSections = SECTIONS.filter(
    ([, , key]) => key !== "parentConsent" || isMinor !== false,
  );
  const completedCount = requiredSections.filter(
    ([, , key]) => complete[key],
  ).length;
  const allComplete = completedCount === requiredSections.length;

  async function submit() {
    if (!allComplete) return setMessage({ type: "error", text: "יש להשלים את כל שדות החובה לפני שליחה לאישור." });
    if (isMinor && data.parentConsent?.status !== "approved") {
      return setMessage({
        type: "error",
        text: "לא ניתן לשלוח פרופיל של חונך קטין ללא אישור הורה מאומת.",
      });
    }
    setSubmitting(true); setMessage(null);
    const { error } = await supabase.from("mentor_publication").upsert({ user_id: userId, status: "pending_review", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (error) console.error(error);
    if (!error) setStatus("pending_review");
    setMessage(error ? { type: "error", text: `שגיאה בשליחה: ${error.message}` } : { type: "success", text: "הפרופיל נשלח לאישור." });
    setSubmitting(false);
  }

  if (loading) return <LoadingPage text="מכין תצוגה מקדימה..." />;
  const profile = data.profile;
  const locations = data.locations;
  const experience = data.experience;
  return <MentorPageShell eyebrow="לפני פרסום" title="תצוגה מקדימה ופרסום" description="כך הפרופיל שלך עשוי להיראות למשפחות. פרטים פרטיים אינם מוצגים.">
    <div className="mb-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
      <div className="mb-3 flex items-center justify-between"><span className="font-bold">השלמת פרופיל</span><span className="font-extrabold text-blue-700">{Math.round(completedCount / requiredSections.length * 100)}%</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${completedCount / requiredSections.length * 100}%` }} /></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {SECTIONS.map(([label, href, key]) => <Link key={key} href={href} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 font-bold"><span>{complete[key] ? "✓" : "○"} {label}{key === "parentConsent" && isMinor === false ? " — לא נדרש" : ""}</span><span className="text-blue-600">עריכה</span></Link>)}
      </div>
    </div>
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="bg-gradient-to-l from-blue-600 to-indigo-600 p-8 text-white">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          {photoUrl ? <Image src={photoUrl} alt="תמונת החונך" width={144} height={144} unoptimized className="h-36 w-36 rounded-full border-4 border-white object-cover" /> : <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white/20 font-bold">ללא תמונה</div>}
          <div><h2 className="text-4xl font-extrabold">{String(profile?.first_name ?? "")} {String(profile?.last_name ?? "")}</h2><p className="mt-2 text-blue-100">{String(locations?.city ?? "")}</p></div>
        </div>
      </div>
      <div className="grid gap-6 p-8 md:grid-cols-2">
        <PreviewSection title="קצת עליי"><p>{String(profile?.bio ?? "טרם נוסף תיאור")}</p></PreviewSection>
        <PreviewSection title="תחומי חונכות"><p>{data.subjects?.map((item) => item.custom_subject || item.subjects?.name).filter(Boolean).join(", ") || "טרם נבחרו תחומים"}</p></PreviewSection>
        <PreviewSection title="שכבות גיל"><p>{Array.from(new Set(data.subjects?.flatMap((item) => item.age_groups ?? []) ?? [])).join(", ") || "טרם נבחרו"}</p></PreviewSection>
        <PreviewSection title="אזורי פעילות"><p>{(locations?.activity_areas as string[] | undefined)?.join(", ") || String(locations?.city ?? "טרם הוגדר")}</p></PreviewSection>
        <PreviewSection title="זמינות כללית"><p>{data.availability ? "הזמינות הוגדרה בפרופיל" : "טרם הוגדרה"}</p></PreviewSection>
        <PreviewSection title="ניסיון וסגנון חונכות"><p>{String(experience?.motivation ?? "טרם נוסף מידע")}</p><p className="mt-2 font-bold">{(experience?.mentoring_types as string[] | undefined)?.join(", ")}</p></PreviewSection>
      </div>
    </article>
    <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
      <p className="mb-4 text-center font-bold">סטטוס: {status}</p>
      <button type="button" onClick={submit} disabled={!allComplete || submitting || status === "pending_review"} className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{submitting ? "שולח..." : status === "pending_review" ? "הפרופיל ממתין לבדיקה" : "שליחה לאישור"}</button>
      <MessageBox message={message} />
    </div>
  </MentorPageShell>;
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-slate-50 p-5"><h3 className="mb-3 text-xl font-extrabold text-slate-900">{title}</h3><div className="leading-7 text-slate-600">{children}</div></section>;
}
