"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import PasswordInput from "@/app/_components/PasswordInput";
import { PASSWORD_CONFIRMATION_MESSAGE, PASSWORD_MIN_LENGTH_MESSAGE, PASSWORD_SAME_MESSAGE, validatePasswordChange } from "@/lib/password-policy";

export default function PasswordPanel({ required = false }: { required?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changePassword() {
    setMessage("");
    const validationMessage = validatePasswordChange(nextPassword, confirmation);
    if (validationMessage) return setMessage(validationMessage);
    setBusy(true);
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) { setMessage("לא ניתן לזהות את כתובת המייל של החשבון."); setBusy(false); return; }
    const verified = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verified.error) { setMessage("הסיסמה הנוכחית אינה נכונה."); setBusy(false); return; }
    const updated = await supabase.auth.updateUser({ password: nextPassword, data: { must_change_password: false } });
    if (updated.error) {
      const samePasswordMessage = updated.error.message.toLowerCase().includes("same_password") || updated.error.message.toLowerCase().includes("current password")
        ? PASSWORD_SAME_MESSAGE
        : "לא ניתן לשנות את הסיסמה כרגע.";
      setMessage(samePasswordMessage);
      setBusy(false);
      return;
    }
    setMessage("הסיסמה שונתה בהצלחה.");
    setCurrentPassword(""); setNextPassword(""); setConfirmation("");
    setBusy(false);
  }

  return <section className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${required ? "border-amber-300 bg-amber-50" : "border-violet-200 bg-white"}`}>
    <p className="text-sm font-black text-violet-700">אבטחת החשבון</p>
    <h2 className="mt-1 text-xl font-black">{required ? "יש לבחור סיסמה אישית לפני שממשיכים" : "שינוי סיסמה"}</h2>
    <p className="mt-2 text-sm text-slate-600">הסיסמה החדשה תהיה פרטית ורק אתם תדעו אותה.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="grid gap-2 font-bold">סיסמה נוכחית<PasswordInput ariaLabel="סיסמה נוכחית" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" /></label>
      <label className="grid gap-2 font-bold">סיסמה חדשה<PasswordInput ariaLabel="סיסמה חדשה" value={nextPassword} onChange={e=>setNextPassword(e.target.value)} autoComplete="new-password" /></label>
      <label className="grid gap-2 font-bold">אימות סיסמה חדשה<PasswordInput ariaLabel="אימות סיסמה חדשה" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" /></label>
    </div>
    <button type="button" onClick={changePassword} disabled={busy||!currentPassword||!nextPassword||!confirmation} className="mt-4 min-h-12 rounded-xl bg-violet-700 px-6 font-black text-white disabled:bg-slate-300">{busy?"שומר...":"שמירת הסיסמה החדשה"}</button>
    {message&&<p role="status" className="mt-3 rounded-xl bg-white p-3 font-bold">{message}</p>}
  </section>;
}
