"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import MentorOnboardingPage from "../../dashboard/mentor/onboarding/page";
import { resolveMentorRegistrationView } from "../../../lib/mentor-register-view";

type OwnerType = "mentor" | "parent_guardian";

export default function MentorRegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerType, setOwnerType] = useState<OwnerType>("mentor");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"loading" | "signup" | "onboarding">(
    "loading",
  );

  useEffect(() => {
    async function protectRegistration() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setView("signup");
        return;
      }

      const { data: profile } = await supabase
        .from("mentor_profiles")
        .select("first_name, birth_date, bio")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const resolution = resolveMentorRegistrationView({
        isAuthenticated: true,
        role: data.user.user_metadata?.role,
        hasCompletedMentorProfile: Boolean(
          profile?.first_name && profile?.birth_date && profile?.bio,
        ),
      });

      if (resolution.view === "redirect") {
        router.replace(resolution.destination);
        return;
      }

      setView(resolution.view);
    }

    void protectRegistration();
  }, [router]);

  const metadata = {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    role: "mentor",
    account_owner_type: ownerType,
  };

  async function registerWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback?flow=mentor_register&owner_type=${ownerType}`,
      },
    });
    if (error) {
      console.error("Email registration failed", error);
      setMessage(`שגיאה: ${error.message}`);
    } else {
      setMessage(data.user?.email_confirmed_at
        ? "החשבון נוצר וכתובת האימייל אומתה בהצלחה."
        : "החשבון נוצר במצב הרשמה בתהליך. נשלח אליך מייל אימות; יש לפתוח אותו לפני שליחת הפרופיל לבדיקה.");
    }
    setLoading(false);
  }

  async function continueWithGoogle() {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({
      flow: "mentor_register",
      owner_type: ownerType,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params}`,
      },
    });
    if (error) {
      console.error("Google registration failed", error);
      setMessage(`שגיאה: ${error.message}`);
      setLoading(false);
    }
  }

  if (view === "loading") {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <p className="text-lg font-bold text-slate-600">טוען...</p>
      </main>
    );
  }

  if (view === "onboarding") {
    return <MentorOnboardingPage />;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-indigo-50 px-6 py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <p className="mb-3 font-bold text-blue-600">שלב 1</p>
          <h1 className="mb-3 text-4xl font-extrabold text-slate-900">הצטרפות כחונכים</h1>
          <p className="text-lg text-slate-600">חשבון אחד מנהל פרופיל חונך אחד.</p>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl md:p-10">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="font-bold">שם פרטי<input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="font-bold">שם משפחה<input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-3 font-extrabold">למי שייכת כתובת המייל?</legend>
            <div className="space-y-3">
              <OwnerChoice checked={ownerType === "mentor"} onChange={() => setOwnerType("mentor")} label="לחונך" />
              <OwnerChoice checked={ownerType === "parent_guardian"} onChange={() => setOwnerType("parent_guardian")} label="להורה או לאפוטרופוס שמנהל את החשבון" />
            </div>
          </fieldset>

          {ownerType === "parent_guardian" && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <p className="font-bold">חשבון חונך קטין המנוהל בידי הורה</p>
              <p className="mt-2 text-sm">פרופיל החונך עדיין שייך לחונך עצמו. בשלב הפיילוט כל כתובת מייל יכולה לנהל חשבון חונך אחד בלבד.</p>
            </div>
          )}

          <form onSubmit={registerWithEmail} className="mt-6">
            <label className="font-bold">אימייל<input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-left font-normal" /></label>
            <label className="mt-5 block font-bold">סיסמה<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <button disabled={loading} className="mt-7 w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white disabled:bg-slate-400">{loading ? "ממשיך..." : "הרשמה עם מייל"}</button>
          </form>

          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-sm text-slate-500">או</span><div className="h-px flex-1 bg-slate-200" /></div>
          <button type="button" onClick={continueWithGoogle} disabled={loading || !firstName.trim() || !lastName.trim()} className="w-full rounded-xl border border-slate-300 bg-white py-4 font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">המשך עם Google</button>
          {message && <p className={`mt-5 rounded-xl p-4 text-center ${message.startsWith("שגיאה") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</p>}
        </div>
        <p className="mt-7 text-center text-slate-600">כבר יש לכם חשבון? <Link href="/login" className="font-bold text-blue-600">התחברו כאן</Link></p>
      </div>
    </main>
  );
}

function OwnerChoice({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 font-bold ${checked ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input type="radio" name="ownerType" checked={checked} onChange={onChange} className="h-5 w-5 accent-blue-600" />{label}</label>;
}
