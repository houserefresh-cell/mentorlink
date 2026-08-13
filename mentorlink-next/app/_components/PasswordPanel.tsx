"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PasswordPanel({ required = false }: { required?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changePassword() {
    setMessage("");
    if (nextPassword.length < 8) return setMessage("הסיסמה החדשה חייבת להכיל לפחות 8 תווים.");
    if (nextPassword !== confirmation) return setMessage("אימות הסיסמה החדשה אינו תואם.");
    setBusy(true);
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) { setMessage("לא ניתן לזהות את כתובת המייל של החשבון."); setBusy(false); return; }
    const verified = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verified.error) { setMessage("הסיסמה הנוכחית אינה נכונה."); setBusy(false); return; }
    const updated = await supabase.auth.updateUser({ password: nextPassword, data: { must_change_password: false } });
    setMessage(updated.error ? "לא ניתן לשנות את הסיסמה כרגע." : "הסיסמה שונתה בהצלחה.");
    if (!updated.error) { setCurrentPassword(""); setNextPassword(""); setConfirmation(""); }
    setBusy(false);
  }

  const input = "min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100";
  return <section className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${required ? "border-amber-300 bg-amber-50" : "border-violet-200 bg-white"}`}>
    <p className="text-sm font-black text-violet-700">אבטחת החשבון</p>
    <h2 className="mt-1 text-xl font-black">{required ? "יש לבחור סיסמה אישית לפני שממשיכים" : "שינוי סיסמה"}</h2>
    <p className="mt-2 text-sm text-slate-600">הסיסמה החדשה תהיה פרטית ורק אתם תדעו אותה.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="grid gap-2 font-bold">סיסמה נוכחית<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className={input}/></label>
      <label className="grid gap-2 font-bold">סיסמה חדשה<input type="password" autoComplete="new-password" value={nextPassword} onChange={e=>setNextPassword(e.target.value)} className={input}/></label>
      <label className="grid gap-2 font-bold">אימות סיסמה חדשה<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} className={input}/></label>
    </div>
    <button type="button" onClick={changePassword} disabled={busy||!currentPassword||!nextPassword||!confirmation} className="mt-4 min-h-12 rounded-xl bg-violet-700 px-6 font-black text-white disabled:bg-slate-300">{busy?"שומר...":"שמירת הסיסמה החדשה"}</button>
    {message&&<p role="status" className="mt-3 rounded-xl bg-white p-3 font-bold">{message}</p>}
  </section>;
}
