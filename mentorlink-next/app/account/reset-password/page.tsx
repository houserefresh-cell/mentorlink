"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setMessage("קישור האיפוס אינו תקף או שפג תוקפו. אפשר לבקש קישור חדש.");
    });
  }, []);

  async function save() {
    setMessage("");
    if (password.length < 8) return setMessage("הסיסמה החדשה חייבת להכיל לפחות 8 תווים.");
    if (password !== confirmation) return setMessage("אימות הסיסמה אינו תואם.");
    setBusy(true);
    const updated = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    if (updated.error) {
      setMessage("לא ניתן לשנות את הסיסמה. ייתכן שקישור האיפוס פג.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    setMessage("הסיסמה שונתה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.");
    setBusy(false);
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-50 via-white to-blue-50 p-5">
    <section className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-7 shadow-xl">
      <p className="font-black text-violet-700">MentorLink</p>
      <h1 className="mt-2 text-3xl font-black">בחירת סיסמה חדשה</h1>
      {ready && !done ? <div className="mt-6 grid gap-4">
        <label className="grid gap-2 font-bold">סיסמה חדשה<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 rounded-xl border-2 border-slate-300 px-4 outline-none focus:border-violet-600" /></label>
        <label className="grid gap-2 font-bold">אימות סיסמה<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-h-12 rounded-xl border-2 border-slate-300 px-4 outline-none focus:border-violet-600" /></label>
        <button type="button" onClick={() => void save()} disabled={busy || !password || !confirmation} className="min-h-12 rounded-xl bg-violet-700 px-5 font-black text-white disabled:bg-slate-300">{busy ? "שומר..." : "שמירת הסיסמה החדשה"}</button>
      </div> : null}
      {message ? <p role="status" className={`mt-5 rounded-xl p-4 font-bold ${done ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{message}</p> : null}
      {done || !ready ? <Link href={done ? "/login" : "/forgot-password"} className="mt-5 block rounded-xl bg-blue-700 p-3 text-center font-black text-white">{done ? "מעבר להתחברות" : "בקשת קישור חדש"}</Link> : null}
    </section>
  </main>;
}
