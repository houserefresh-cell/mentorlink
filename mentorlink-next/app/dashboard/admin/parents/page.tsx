"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Child = { id: string; firstName: string; lastName: string | null; grade: string | null; schoolName: string | null; interests: string[] };
type ParentAccount = {
  userId: string; email: string | null; emailConfirmed: boolean; createdAt: string; lastSignInAt: string | null;
  firstName: string | null; lastName: string | null; phone: string | null; city: string | null; street: string | null;
  wantsHomeMentoring: boolean; houseNumber: string | null; entrance: string | null; apartment: string | null;
  addressNotes: string | null; profileComplete: boolean; children: Child[];
  accountDisabled: boolean;
};

const gradeLabels: Record<string, string> = {
  kindergarten: "גן", grade_1: "כיתה א׳", grade_2: "כיתה ב׳", grade_3: "כיתה ג׳", grade_4: "כיתה ד׳",
  grade_5: "כיתה ה׳", grade_6: "כיתה ו׳", grade_7: "כיתה ז׳", grade_8: "כיתה ח׳", grade_9: "כיתה ט׳",
  grade_10: "כיתה י׳", grade_11: "כיתה י״א", grade_12: "כיתה י״ב",
};

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("he-IL") : "לא בוצעה כניסה";
}

export default function AdminParentsPage() {
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newParent, setNewParent] = useState({ firstName: "", lastName: "", email: "", password: "111111" });
  const [busy, setBusy] = useState(false);

  async function createParent() {
    setBusy(true); setMessage("");
    const session = (await supabase.auth.getSession()).data.session;
    const response = await fetch("/api/admin/parents", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify(newParent) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setMessage(`חשבון ההורה נוצר. אימייל: ${body.email} · סיסמה זמנית: ${body.temporaryPassword}`); setNewParent({ firstName: "", lastName: "", email: "", password: "111111" }); window.location.reload(); }
    else setMessage(body.error ?? "לא ניתן ליצור את החשבון.");
    setBusy(false);
  }

  useEffect(() => {
    async function load() {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch("/api/admin/parents", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        cache: "no-store",
      });
      if (response.ok) setParents((await response.json()).parents ?? []);
      else setMessage("לא ניתן לטעון את חשבונות ההורים.");
      setLoading(false);
    }
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("he");
    if (!needle) return parents;
    return parents.filter((parent) => [parent.firstName, parent.lastName, parent.email, parent.phone, parent.city, ...parent.children.flatMap((child) => [child.firstName, child.lastName])]
      .filter(Boolean).join(" ").toLocaleLowerCase("he").includes(needle));
  }, [parents, query]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-black text-blue-700">ניהול חשבונות</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-black">הורים</h1><p className="mt-2 font-semibold text-slate-700">חשבונות הורים, פרטי קשר והילדים המשויכים אליהם.</p></div>
          <span className="rounded-full bg-blue-100 px-4 py-2 font-black text-blue-900">{parents.length} חשבונות</span>
        </div>
        <section className="mt-6 rounded-3xl border-2 border-violet-200 bg-gradient-to-l from-violet-50 to-cyan-50 p-5"><h2 className="text-xl font-black">פתיחת חשבון הורה מהירה</h2><p className="mt-1 text-sm font-semibold text-slate-700">הסיסמה הזמנית היא 111111 כברירת מחדל, וניתן להחליף אותה.</p><div className="mt-4 grid gap-3 md:grid-cols-4"><input aria-label="שם פרטי" placeholder="שם פרטי" value={newParent.firstName} onChange={(e)=>setNewParent({...newParent,firstName:e.target.value})} className="rounded-xl border bg-white p-3"/><input aria-label="שם משפחה" placeholder="שם משפחה" value={newParent.lastName} onChange={(e)=>setNewParent({...newParent,lastName:e.target.value})} className="rounded-xl border bg-white p-3"/><input aria-label="אימייל" type="email" placeholder="אימייל" value={newParent.email} onChange={(e)=>setNewParent({...newParent,email:e.target.value})} className="rounded-xl border bg-white p-3"/><input aria-label="סיסמה זמנית" value={newParent.password} onChange={(e)=>setNewParent({...newParent,password:e.target.value})} className="rounded-xl border bg-white p-3"/></div><button disabled={busy||!newParent.firstName||!newParent.lastName||!newParent.email||newParent.password.length<6} onClick={()=>void createParent()} className="mt-3 rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy?"פותח חשבון…":"פתיחת חשבון הורה"}</button></section>
        <label className="mt-6 block font-black">חיפוש לפי שם, אימייל, טלפון, עיר או שם ילד
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600" placeholder="חיפוש הורה..." />
        </label>
        {message && <p className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 font-bold text-red-800">{message}</p>}
        {loading ? <p className="mt-8 font-bold">טוען חשבונות הורים...</p> : (
          <div className="mt-7 grid gap-5">
            {visible.map((parent) => <ParentCard key={parent.userId} parent={parent} onChanged={()=>window.location.reload()} />)}
            {!visible.length && <p className="rounded-2xl bg-white p-6 font-bold">לא נמצאו חשבונות מתאימים.</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function ParentCard({ parent, onChanged }: { parent: ParentAccount; onChanged: () => void }) {
  const name = [parent.firstName, parent.lastName].filter(Boolean).join(" ") || "הורה ללא פרופיל מלא";
  const address = parent.wantsHomeMentoring
    ? [parent.city, parent.street, parent.houseNumber && `מס׳ ${parent.houseNumber}`, parent.entrance && `כניסה ${parent.entrance}`, parent.apartment && `דירה ${parent.apartment}`].filter(Boolean).join(", ")
    : [parent.city, parent.street].filter(Boolean).join(", ");
  async function accountAction(action: "suspend"|"restore"|"delete") {
    if (action === "delete" && !window.confirm("מחיקת חשבון היא סופית. להמשיך?")) return;
    const session=(await supabase.auth.getSession()).data.session;
    const response=await fetch("/api/admin/parents",{method:"PATCH",headers:{Authorization:`Bearer ${session?.access_token??""}`,"Content-Type":"application/json"},body:JSON.stringify({userId:parent.userId,action})});
    if(response.ok) onChanged(); else alert((await response.json().catch(()=>({}))).error??"הפעולה נכשלה.");
  }
  return (
    <details className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none marker:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-black">{name}</h2><p className="mt-1 font-semibold text-slate-700">{parent.email ?? "אין אימייל"} · {parent.phone ?? "אין טלפון"}</p></div>
          <div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-sm font-black ${parent.profileComplete ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{parent.profileComplete ? "פרופיל הושלם" : "פרופיל חלקי"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black">{parent.children.length} ילדים</span></div>
        </div>
      </summary>
      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black">חשבון ופרטי קשר</h3><p className="mt-2">אימייל: {parent.email ?? "לא נמסר"} ({parent.emailConfirmed ? "מאומת" : "לא אומת"})</p><p>טלפון: {parent.phone ?? "לא נמסר"}</p><p>נוצר: {displayDate(parent.createdAt)}</p><p>כניסה אחרונה: {displayDate(parent.lastSignInAt)}</p></section>
        <section className="rounded-2xl bg-blue-50 p-4"><h3 className="font-black">כתובת</h3><p className="mt-2">{address || "לא נמסרה כתובת"}</p><p className="mt-1 text-sm font-bold text-blue-900">{parent.wantsHomeMentoring ? "ההורה ביקש אפשרות לחונכות בבית" : "לא סומנה חונכות בבית"}</p>{parent.addressNotes && <p className="mt-2 whitespace-pre-wrap">הערות: {parent.addressNotes}</p>}</section>
      </div>
      <section className="mt-4"><h3 className="font-black">ילדים בפרופיל</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{parent.children.map((child) => <article key={child.id} className="rounded-2xl border border-slate-200 p-4"><h4 className="font-black">{[child.firstName, child.lastName].filter(Boolean).join(" ")}</h4><p className="mt-1 text-slate-700">{child.grade ? gradeLabels[child.grade] ?? child.grade : "כיתה לא צוינה"}{child.schoolName ? ` · ${child.schoolName}` : ""}</p><p className="mt-2 text-sm font-semibold">תחומי עניין: {child.interests.join(", ") || "לא נבחרו"}</p></article>)}{!parent.children.length && <p className="rounded-2xl bg-slate-50 p-4">לא נוספו ילדים לחשבון.</p>}</div></section>
      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4"><button onClick={()=>void accountAction(parent.accountDisabled?"restore":"suspend")} className="rounded-xl border border-amber-400 px-4 py-2 font-black">{parent.accountDisabled?"הפעלת החשבון":"השבתת החשבון"}</button><button onClick={()=>void accountAction("delete")} className="rounded-xl border border-red-400 px-4 py-2 font-black text-red-700">מחיקת החשבון</button></div>
    </details>
  );
}
