"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import RegistrationSupport from "@/app/_components/RegistrationSupport";
import RegistrationIntro from "@/app/_components/RegistrationIntro";
import { supabase } from "@/lib/supabase";

export default function ParentRegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?flow=parent_register&returnTo=${encodeURIComponent(new URLSearchParams(window.location.search).get("returnTo") ?? "")}`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          role: "parent",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setMessage(
        "ההרשמה הושלמה. שלחנו אליך הודעת אימות למייל. לאחר האימות ניתן להתחבר."
      );

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setPassword("");
    }

    setLoading(false);
  }

  async function continueWithGoogle() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      flow: "parent_register",
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      returnTo: new URLSearchParams(window.location.search).get("returnTo") ?? "",
    });
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params}`,
      },
    });
    if (oauthError) {
      console.error("Parent Google registration failed", oauthError);
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <main className="registration-surface min-h-screen px-4 py-12" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/register"
          className="mb-6 inline-block text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← חזרה לבחירת סוג ההרשמה
        </Link>

        <div className="grid items-start gap-7 lg:grid-cols-[0.9fr_1.1fr]">
        <RegistrationIntro role="parent" />
        <div className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-cyan-100 sm:p-8">
          <div className="mb-8 text-center">

            <h1 className="text-3xl font-bold text-slate-900">
              הרשמת הורה
            </h1>

            <p className="mt-3 text-slate-600">
              הצטרפו לקהילת MentorLink ומצאו חונך שמתאים לילד שלכם.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="phone" className="mb-2 block text-base font-extrabold text-slate-900">מספר טלפון</label>
              <input id="phone" type="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" placeholder="050-0000000" className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 text-left text-base font-semibold text-slate-950 placeholder:text-slate-500 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
              <p className="mt-2 text-sm font-medium text-slate-700">המספר יוצג רק לחונך שאליו פניתם או לפעילות שאליה נרשמתם.</p>
            </div>

            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                שם פרטי
              </label>

              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
                className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 font-semibold text-slate-950 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                שם משפחה
              </label>

              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
                className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 font-semibold text-slate-950 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                כתובת אימייל
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 font-semibold text-slate-950 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                סיסמה
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 font-semibold text-slate-950 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                הסיסמה חייבת להכיל לפחות 6 תווים.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "מבצע הרשמה..." : "הצטרפו לקהילת MentorLink"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-sm text-slate-500">או</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={loading}
            className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
          >
            המשך עם Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            כבר רשומים?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              התחברו כאן
            </Link>
          </p>
        </div></div>
      </div>
      <div id="registration-help"><RegistrationSupport compact /></div>
    </main>
  );
}
