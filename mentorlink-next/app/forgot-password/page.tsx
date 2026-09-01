"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(body.message ?? "אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס הסיסמה.");
    setBusy(false);
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-gradient-to-b from-blue-50 via-white to-violet-50 p-5">
    <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 shadow-xl">
      <p className="font-black text-blue-700">אבטחת החשבון</p>
      <h1 className="mt-2 text-3xl font-black">שכחתי סיסמה</h1>
      <p className="mt-3 leading-7 text-slate-600">הזינו את כתובת המייל של חשבון ההורה או החונך. אם החשבון קיים, נשלח קישור לבחירת סיסמה חדשה.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        <label className="grid gap-2 font-bold">אימייל<input required type="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 rounded-xl border-2 border-slate-300 px-4 text-left outline-none focus:border-blue-600" /></label>
        <button disabled={busy} className="min-h-12 rounded-xl bg-blue-700 px-5 font-black text-white disabled:bg-slate-300">{busy ? "שולח..." : "שליחת קישור לאיפוס"}</button>
      </form>
      {message ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">{message}</p> : null}
      <Link href="/login" className="mt-5 block text-center font-black text-blue-700 underline">חזרה להתחברות</Link>
    </section>
  </main>;
}
