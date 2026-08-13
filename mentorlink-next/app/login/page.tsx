"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getDashboardPath } from "../../lib/auth-routing";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      console.error("Email login failed", error);
      setMessage("אימייל או סיסמה שגויים.");
      setLoading(false);
      return;
    }
    if (data.user.user_metadata?.must_change_password) { router.push("/account/change-password"); return; }
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    router.push(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : await getDashboardPath(data.user.id));
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 shadow-xl md:p-10">
        <h1 className="mb-3 text-center text-4xl font-extrabold">התחברות</h1>
        <p className="mb-8 text-center text-slate-500">ברוכים הבאים ל־MentorLink</p>
        <form onSubmit={loginWithEmail}>
          <input type="email" dir="ltr" placeholder="אימייל" required value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4 w-full rounded-xl border border-slate-300 p-3 text-left" />
          <input type="password" placeholder="סיסמה" required value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6 w-full rounded-xl border border-slate-300 p-3" />
          <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:bg-slate-400">{loading ? "מתחבר..." : "התחברות עם מייל"}</button>
        </form>
        {message && <p className="mt-5 rounded-xl bg-red-50 p-4 text-center text-red-700">{message}</p>}
        <p className="mt-7 text-center text-slate-600">עדיין אין חשבון? <Link href="/register/mentor" className="font-bold text-blue-600">הרשמה כחונך</Link></p>
      </div>
    </main>
  );
}
