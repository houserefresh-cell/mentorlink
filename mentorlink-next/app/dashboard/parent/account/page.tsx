"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const empty = { firstName: "", lastName: "", phone: "", city: "", street: "", wantsHomeMentoring: false, houseNumber: "", entrance: "", apartment: "", addressNotes: "" };
const field = "min-h-12 w-full rounded-xl border-2 border-slate-400 bg-white px-4 py-3 font-semibold text-slate-950 placeholder:text-slate-500 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100";

export default function ParentAccountPage() {
  const [form, setForm] = useState(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function token() { return (await supabase.auth.getSession()).data.session?.access_token ?? ""; }
  useEffect(() => { void (async () => {
    const response = await fetch("/api/parent/profile", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    if (response.ok) { const profile = (await response.json()).profile; setForm({ firstName: profile.first_name ?? "", lastName: profile.last_name ?? "", phone: profile.phone ?? "", city: profile.city ?? "", street: profile.street ?? "", wantsHomeMentoring: profile.wants_home_mentoring ?? false, houseNumber: profile.house_number ?? "", entrance: profile.entrance ?? "", apartment: profile.apartment ?? "", addressNotes: profile.address_notes ?? "" }); }
    else setMessage("לא ניתן לטעון את פרטי החשבון כרגע.");
    setLoading(false);
  })(); }, []);
  async function save() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/parent/profile", { method: "PUT", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "פרטי החשבון נשמרו בהצלחה." : body.error ?? "לא ניתן לשמור את הפרטים."); setBusy(false);
  }
  if (loading) return <p className="rounded-2xl bg-white p-6 font-bold">טוען את פרטי החשבון...</p>;
  return <section className="mx-auto max-w-4xl"><p className="font-black text-blue-700">הפרטים שלי</p><h1 className="mt-2 text-3xl font-black">החשבון שלי</h1><p className="mt-3 text-slate-700">הפרטים אינם ציבוריים. הם נפתחים רק לחונך שאליו פניתם או שאצלו נרשמתם לפעילות.</p>
    <div className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-5 sm:grid-cols-2">
      <Field label="שם פרטי"><input className={field} value={form.firstName} onChange={e => setForm({...form, firstName:e.target.value})} /></Field>
      <Field label="שם משפחה"><input className={field} value={form.lastName} onChange={e => setForm({...form, lastName:e.target.value})} /></Field>
      <Field label="מספר טלפון"><input type="tel" dir="ltr" className={field+" text-left"} value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></Field>
      <Field label="עיר"><input className={field} value={form.city} onChange={e => setForm({...form, city:e.target.value})} /></Field>
      <Field label="רחוב"><input className={field} value={form.street} onChange={e => setForm({...form, street:e.target.value})} /></Field>
    </div>
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 font-black"><input type="checkbox" className="mt-1 size-5 accent-blue-700" checked={form.wantsHomeMentoring} onChange={e => setForm({...form, wantsHomeMentoring:e.target.checked})} /><span>אני מעוניין/ת גם בחונכות בביתנו<span className="mt-1 block text-sm font-medium text-slate-700">רק במקרה זה הכתובת המלאה תוצג לחונך שאליו נשלחה בקשה לחונכות בבית.</span></span></label>
    {form.wantsHomeMentoring && <div className="mt-5 grid gap-5 sm:grid-cols-3"><Field label="מספר בית"><input className={field} value={form.houseNumber} onChange={e => setForm({...form, houseNumber:e.target.value})} /></Field><Field label="כניסה"><input className={field} value={form.entrance} onChange={e => setForm({...form, entrance:e.target.value})} /></Field><Field label="דירה"><input className={field} value={form.apartment} onChange={e => setForm({...form, apartment:e.target.value})} /></Field><Field label="הנחיות הגעה" wide><textarea className={field+" min-h-28"} value={form.addressNotes} onChange={e => setForm({...form, addressNotes:e.target.value})} /></Field></div>}
    <button type="button" onClick={save} disabled={busy || !form.firstName.trim() || !form.lastName.trim() || !form.phone.trim()} className="mt-7 rounded-xl bg-blue-700 px-7 py-4 font-black text-white disabled:bg-slate-300">{busy?"שומר...":"שמירת פרטי החשבון"}</button>{message && <p role="status" className="mt-4 rounded-xl bg-slate-100 p-4 font-bold">{message}</p>}</div>
  </section>;
}

function Field({ label, children, wide=false }: { label:string; children:React.ReactNode; wide?:boolean }) { return <label className={`grid gap-2 text-base font-extrabold text-slate-900 ${wide?"sm:col-span-3":""}`}>{label}{children}</label>; }
