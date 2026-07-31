"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SUBJECT_CATEGORIES, type SubjectCategory } from "@/lib/subject-catalog-core";

type Subject = { id: number; name: string; category: SubjectCategory };
type Session = { date: string; startsAt: string; endsAt: string; allowOverrun: boolean; estimatedOverrun: "none" | "5_10_minutes" | "15_20_minutes" };
type Message = { type: "success" | "error"; text: string } | null;
type FormState = {
  subjectId: string; title: string; description: string; format: "one_time" | "series";
  minParticipants: string; maxParticipants: string; minimumAge: string; maximumAge: string;
  suitableGrades: string[]; isFree: boolean; price: string; registrationDeadline: string;
  equipment: string; accessibility: string; cancellationPolicy: string;
  locationType: string; venueName: string; address: string; locationDetails: string;
  pickupEnabled: boolean; pickupOptions: string[]; pickupDetails: string; sessions: Session[];
};

const GRADES = Array.from({ length: 12 }, (_, index) => ({ value: `grade_${index + 1}`, label: `כיתה ${index + 1}` })).concat({ value: "graduate", label: "בוגר/ת" });
const LOCATIONS = [
  ["mentor_home", "בית החונך"], ["mentee_home", "בית החניך"], ["school", "בית ספר"],
  ["public_place", "מקום ציבורי"], ["sports_park", "ספורטק"], ["community_center", "מתנ״ס/מרכז קהילתי"],
  ["sports_complex", "מתחם ספורט"], ["online", "אונליין"], ["other", "אחר"],
] as const;
const PICKUPS = [["school", "בית ספר"], ["after_school", "צהרון"], ["home", "בית"], ["other", "מקום אחר"]] as const;
const emptySession = (): Session => ({ date: "", startsAt: "", endsAt: "", allowOverrun: false, estimatedOverrun: "none" });
const initialForm: FormState = {
  subjectId: "", title: "", description: "", format: "one_time", minParticipants: "", maxParticipants: "",
  minimumAge: "", maximumAge: "", suitableGrades: [], isFree: true, price: "", registrationDeadline: "",
  equipment: "", accessibility: "", cancellationPolicy: "", locationType: "", venueName: "", address: "",
  locationDetails: "", pickupEnabled: false, pickupOptions: [], pickupDetails: "", sessions: [emptySession()],
};

export function MentorActivityForm({ activityId }: { activityId?: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [ownSubjectIds, setOwnSubjectIds] = useState<number[]>([]);
  const [subjectMode, setSubjectMode] = useState<"mine" | "other">("mine");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCategory, setNewSubjectCategory] = useState<SubjectCategory>(SUBJECT_CATEGORIES[0]);
  const [addToProfile, setAddToProfile] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (error || !accessToken) { router.replace("/login"); return; }
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [subjectsResponse, activityResponse] = await Promise.all([
        fetch("/api/mentor-subjects", { headers, cache: "no-store" }),
        activityId ? fetch(`/api/mentor-activities/${activityId}`, { headers, cache: "no-store" }) : Promise.resolve(null),
      ]);
      const subjectsBody = await subjectsResponse.json().catch(() => ({}));
      const activityBody = activityResponse ? await activityResponse.json().catch(() => ({})) : null;
      if (!active) return;
      if (!subjectsResponse.ok || (activityResponse && !activityResponse.ok)) {
        setMessage({ type: "error", text: activityBody?.error ?? subjectsBody.error ?? "לא ניתן לטעון את טופס הפעילות." });
        setLoading(false); return;
      }
      const ownIds = (subjectsBody.selected ?? []).map((row: { subject_id: number }) => row.subject_id);
      setToken(accessToken); setCatalog(subjectsBody.catalog ?? []); setOwnSubjectIds(ownIds);
      if (activityBody?.activity) {
        const activity = activityBody.activity;
        setStatus(activity.status);
        setSubjectMode(ownIds.includes(activity.subject_id) ? "mine" : "other");
        setForm(fromActivity(activity));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [activityId, router]);

  const mySubjects = useMemo(() => catalog.filter((subject) => ownSubjectIds.includes(subject.id)), [catalog, ownSubjectIds]);
  const selectedSubject = catalog.find((subject) => String(subject.id) === form.subjectId);
  const editable = status === "draft";

  async function createSubject() {
    if (addingSubject || !newSubjectName.trim() || !token) return;
    setAddingSubject(true); setMessage(null);
    const response = await fetch("/api/mentor-subjects", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubjectName, category: newSubjectCategory, addToProfile }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage({ type: "error", text: body.error ?? "לא ניתן להוסיף את המקצוע." });
    else {
      const subject = body.subject as Subject;
      setCatalog((current) => [...current, subject]);
      if (body.addedToProfile) setOwnSubjectIds((current) => [...current, subject.id]);
      setForm((current) => ({ ...current, subjectId: String(subject.id) }));
      setNewSubjectName("");
      setMessage({ type: "success", text: body.addedToProfile ? "המקצוע נוסף לפעילות ולפרופיל שלך." : "המקצוע נוסף לפעילות הזאת בלבד." });
    }
    setAddingSubject(false);
  }

  async function save(action: "draft" | "publish") {
    if (busy || !token || !editable) return;
    setBusy(true); setMessage(null);
    try {
      const payload = toPayload(form);
      const response = await fetch(activityId ? `/api/mentor-activities/${activityId}` : "/api/mentor-activities", {
        method: activityId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(activityId ? { action: action === "publish" ? "publish" : "edit" } : { status: action === "publish" ? "published" : "draft" }) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage({ type: "error", text: hebrewError(body.code, body.error) }); return; }
      if (action === "publish") {
        setStatus("published"); setMessage({ type: "success", text: "הפעילות פורסמה בהצלחה." });
      } else if (!activityId && body.activity?.id) {
        router.replace(`/dashboard/mentor/activities/${body.activity.id}/edit`);
      } else setMessage({ type: "success", text: "הטיוטה נשמרה בהצלחה." });
    } catch { setMessage({ type: "error", text: "לא ניתן לשמור את הפעילות כרגע." }); }
    finally { setBusy(false); }
  }

  function updateSession(index: number, changes: Partial<Session>) {
    setForm((current) => ({ ...current, sessions: current.sessions.map((session, position) => position === index ? { ...session, ...changes } : session) }));
  }

  if (loading) return <p dir="rtl" role="status" className="rounded-2xl bg-white p-6 font-bold">טוען את טופס הפעילות...</p>;
  return <section dir="rtl" className="mx-auto max-w-5xl pb-16">
    <header className="mb-7"><p className="font-bold text-violet-700">מערכת הפעילויות</p><h1 className="mt-2 text-4xl font-black">{activityId ? "עריכת פעילות" : "פתיחת פעילות חדשה"}</h1><p className="mt-2 text-slate-600">אפשר לשמור טיוטה חלקית ולהשלים אותה לפני הפרסום.</p></header>
    {!editable && <Message text="הפעילות כבר פורסמה ואינה ניתנת לעריכה במסך זה." type="success" />}
    {message && <Message {...message} />}
    <div className="space-y-6" aria-busy={busy}>
      <Card color="blue" title="1. מקצוע הפעילות">
        <div className="flex flex-wrap gap-3"><Radio checked={subjectMode === "mine"} onChange={() => setSubjectMode("mine")} label="המקצועות שלי" /><Radio checked={subjectMode === "other"} onChange={() => setSubjectMode("other")} label="מקצוע אחר לפעילות הזאת" /></div>
        {subjectMode === "mine" ? <label className="mt-4 grid gap-2 font-bold">בחירת מקצוע<select disabled={!editable} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={input}><option value="">בחירה</option>{mySubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label> : <div className="mt-4 space-y-4"><label className="grid gap-2 font-bold">מקצוע מהמאגר המשותף<select disabled={!editable} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={input}><option value="">בחירה או הוספה חדשה</option>{catalog.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.category}</option>)}</select></label><div className="grid gap-3 rounded-2xl border border-dashed border-blue-300 bg-white p-4 md:grid-cols-[1fr_2fr]"><select disabled={!editable} value={newSubjectCategory} onChange={(event) => setNewSubjectCategory(event.target.value as SubjectCategory)} className={input}>{SUBJECT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><input disabled={!editable} value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="שם מקצוע חדש" maxLength={50} className={input} /><label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" disabled={!editable} checked={addToProfile} onChange={(event) => setAddToProfile(event.target.checked)} />הוסף את המקצוע גם לפרופיל שלי</label><button type="button" disabled={!editable || addingSubject || !newSubjectName.trim()} onClick={createSubject} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:bg-slate-400 md:col-span-2">{addingSubject ? "מוסיף..." : "הוספת המקצוע ובחירתו"}</button></div></div>}
      </Card>
      <Card color="violet" title="2. פרטי הפעילות">
        <div className="grid gap-4 md:grid-cols-2"><Field label="כותרת"><input disabled={!editable} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} className={input} /></Field><Field label="מבנה"><select disabled={!editable} value={form.format} onChange={(e) => { const format = e.target.value as FormState["format"]; setForm({ ...form, format, sessions: format === "one_time" ? [form.sessions[0] ?? emptySession()] : form.sessions }); }} className={input}><option value="one_time">פעילות חד־פעמית</option><option value="series">סדרת מפגשים</option></select></Field><Field label="תיאור" wide><textarea disabled={!editable} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} maxLength={4000} className={input} /></Field><Field label="מינימום משתתפים"><input disabled={!editable} type="number" min="1" max="500" value={form.minParticipants} onChange={(e) => setForm({ ...form, minParticipants: e.target.value })} className={input} /></Field><Field label="מקסימום משתתפים"><input disabled={!editable} type="number" min="1" max="500" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} className={input} /></Field></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="גיל מינימלי"><input disabled={!editable} type="number" min="3" max="120" value={form.minimumAge} onChange={(e) => setForm({ ...form, minimumAge: e.target.value })} className={input} /></Field><Field label="גיל מקסימלי"><input disabled={!editable} type="number" min="3" max="120" value={form.maximumAge} onChange={(e) => setForm({ ...form, maximumAge: e.target.value })} className={input} /></Field><Field label="כיתות מתאימות" wide><div className="flex flex-wrap gap-2">{GRADES.map((grade) => <CheckPill key={grade.value} disabled={!editable} checked={form.suitableGrades.includes(grade.value)} label={grade.label} onChange={() => setForm({ ...form, suitableGrades: toggle(form.suitableGrades, grade.value) })} />)}</div></Field></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" disabled={!editable} checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked, price: e.target.checked ? "" : form.price })} />פעילות ללא עלות</label>{!form.isFree && <Field label="מחיר בש״ח"><input disabled={!editable} type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={input} /></Field>}<Field label="מועד אחרון להרשמה" wide><input disabled={!editable} type="datetime-local" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} className={input} /></Field><Field label="ציוד"><textarea disabled={!editable} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} className={input} /></Field><Field label="נגישות"><textarea disabled={!editable} value={form.accessibility} onChange={(e) => setForm({ ...form, accessibility: e.target.value })} className={input} /></Field><Field label="מדיניות ביטול" wide><textarea disabled={!editable} value={form.cancellationPolicy} onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })} className={input} /></Field></div>
      </Card>
      <Card color="amber" title="3. מועדים">
        <div className="space-y-4">{form.sessions.map((session, index) => <div key={index} className="rounded-2xl border border-amber-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-3"><Field label="תאריך"><input disabled={!editable} type="date" value={session.date} onChange={(e) => updateSession(index, { date: e.target.value })} className={input} /></Field><Field label="שעת התחלה"><input disabled={!editable} type="time" value={session.startsAt} onChange={(e) => updateSession(index, { startsAt: e.target.value })} className={input} /></Field><Field label="שעת סיום מתוכננת"><input disabled={!editable} type="time" value={session.endsAt} onChange={(e) => updateSession(index, { endsAt: e.target.value })} className={input} /></Field></div><label className="mt-3 flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={session.allowOverrun} onChange={(e) => updateSession(index, { allowOverrun: e.target.checked, estimatedOverrun: e.target.checked ? "5_10_minutes" : "none" })} />ייתכן שהפעילות תסתיים מעט מאוחר יותר</label>{session.allowOverrun && <select disabled={!editable} value={session.estimatedOverrun} onChange={(e) => updateSession(index, { estimatedOverrun: e.target.value as Session["estimatedOverrun"] })} className={`${input} mt-3`}><option value="5_10_minutes">עד 5–10 דקות נוספות</option><option value="15_20_minutes">עד 15–20 דקות נוספות</option></select>}{form.format === "series" && form.sessions.length > 1 && <button type="button" disabled={!editable} onClick={() => setForm({ ...form, sessions: form.sessions.filter((_, position) => position !== index) })} className="mt-3 font-bold text-red-700">הסרת מפגש</button>}</div>)}</div>{form.format === "series" && <button type="button" disabled={!editable} onClick={() => setForm({ ...form, sessions: [...form.sessions, emptySession()] })} className="mt-4 rounded-xl border border-amber-500 bg-white px-5 py-3 font-bold text-amber-900">הוספת מפגש</button>}
      </Card>
      <Card color="emerald" title="4. מיקום ואיסוף">
        <Field label="סוג מיקום"><select disabled={!editable} value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value, address: e.target.value === "online" ? "" : form.address })} className={input}><option value="">בחירה</option>{LOCATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{form.locationType && form.locationType !== "online" && <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="שם המקום"><input disabled={!editable} value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} className={input} /></Field><Field label="כתובת"><input disabled={!editable} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} /></Field></div>}{form.locationType && <Field label="פירוט נוסף"><textarea disabled={!editable} value={form.locationDetails} onChange={(e) => setForm({ ...form, locationDetails: e.target.value })} className={`${input} mt-4`} /></Field>}
        <label className="mt-6 flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" disabled={!editable} checked={form.pickupEnabled} onChange={(e) => setForm({ ...form, pickupEnabled: e.target.checked, pickupOptions: e.target.checked ? form.pickupOptions : [], pickupDetails: e.target.checked ? form.pickupDetails : "" })} />אפשרות לאיסוף</label>{form.pickupEnabled && <div className="mt-4"><div className="flex flex-wrap gap-2">{PICKUPS.map(([value, label]) => <CheckPill key={value} disabled={!editable} checked={form.pickupOptions.includes(value)} label={label} onChange={() => setForm({ ...form, pickupOptions: toggle(form.pickupOptions, value), pickupDetails: value === "other" && form.pickupOptions.includes(value) ? "" : form.pickupDetails })} />)}</div>{form.pickupOptions.includes("other") && <Field label="פירוט מקום האיסוף האחר"><input disabled={!editable} value={form.pickupDetails} onChange={(e) => setForm({ ...form, pickupDetails: e.target.value })} maxLength={500} className={`${input} mt-3`} /></Field>}</div>}
      </Card>
      {preview && <Card color="slate" title="תצוגה מקדימה"><h3 className="text-2xl font-black">{form.title || "כותרת הפעילות"}</h3><p className="mt-2 whitespace-pre-wrap text-slate-700">{form.description || "תיאור הפעילות יופיע כאן."}</p><p className="mt-4 font-bold">{selectedSubject?.name ?? "טרם נבחר מקצוע"} · {form.format === "series" ? `${form.sessions.length} מפגשים` : "מפגש אחד"}</p><p className="mt-2">{form.isFree ? "ללא עלות" : `${form.price || "0"} ₪`}</p></Card>}
      <div className="sticky bottom-3 z-10 flex flex-wrap gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur"><button type="button" disabled={busy || !editable} onClick={() => save("draft")} className="rounded-xl bg-slate-800 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "שומר..." : "שמירת טיוטה"}</button><button type="button" onClick={() => setPreview((current) => !current)} className="rounded-xl border border-violet-400 px-5 py-3 font-black text-violet-800">{preview ? "סגירת תצוגה מקדימה" : "תצוגה מקדימה"}</button><button type="button" disabled={busy || !editable} onClick={() => save("publish")} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "מפרסם..." : "פרסום פעילות"}</button></div>
    </div>
  </section>;
}

const input = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100";
function Card({ title, color, children }: { title: string; color: "blue" | "violet" | "amber" | "emerald" | "slate"; children: React.ReactNode }) { const colors = { blue: "border-blue-200 bg-blue-50/70", violet: "border-violet-200 bg-violet-50/70", amber: "border-amber-200 bg-amber-50/70", emerald: "border-emerald-200 bg-emerald-50/70", slate: "border-slate-300 bg-slate-50" }; return <section className={`rounded-3xl border p-5 shadow-sm md:p-7 ${colors[color]}`}><h2 className="mb-5 text-2xl font-black">{title}</h2>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid gap-2 font-bold ${wide ? "md:col-span-2" : ""}`}>{label}{children}</label>; }
function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <label className={`cursor-pointer rounded-xl border px-4 py-3 font-bold ${checked ? "border-blue-600 bg-blue-700 text-white" : "bg-white"}`}><input type="radio" checked={checked} onChange={onChange} className="sr-only" />{label}</label>; }
function CheckPill({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) { return <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${checked ? "bg-slate-800 text-white" : "bg-white"}`}><input type="checkbox" disabled={disabled} checked={checked} onChange={onChange} className="sr-only" />{label}</label>; }
function Message({ type, text }: { type: "success" | "error"; text: string }) { return <p role={type === "error" ? "alert" : "status"} className={`mb-5 rounded-xl p-4 font-bold ${type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{text}</p>; }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function toPayload(value: FormState) { return { subjectId: value.subjectId ? Number(value.subjectId) : null, title: value.title || null, description: value.description || null, format: value.format, minParticipants: value.minParticipants ? Number(value.minParticipants) : null, maxParticipants: value.maxParticipants ? Number(value.maxParticipants) : null, minimumAge: value.minimumAge ? Number(value.minimumAge) : null, maximumAge: value.maximumAge ? Number(value.maximumAge) : null, suitableGrades: value.suitableGrades, isFree: value.isFree, price: value.isFree ? 0 : Number(value.price), registrationDeadline: value.registrationDeadline ? new Date(value.registrationDeadline).toISOString() : null, equipment: value.equipment || null, accessibility: value.accessibility || null, cancellationPolicy: value.cancellationPolicy || null, locationType: value.locationType || null, venueName: value.venueName || null, address: value.locationType === "online" ? null : value.address || null, locationDetails: value.locationDetails || null, pickupOptions: value.pickupEnabled ? value.pickupOptions : [], pickupDetails: value.pickupEnabled && value.pickupOptions.includes("other") ? value.pickupDetails || null : null, sessions: value.sessions.filter((session) => session.date && session.startsAt && session.endsAt).map((session) => ({ startsAt: new Date(`${session.date}T${session.startsAt}`).toISOString(), endsAt: new Date(`${session.date}T${session.endsAt}`).toISOString(), estimatedOverrun: session.allowOverrun ? session.estimatedOverrun : "none" })) }; }
function fromActivity(activity: Record<string, any>): FormState { return { subjectId: activity.subject_id ? String(activity.subject_id) : "", title: activity.title ?? "", description: activity.description ?? "", format: activity.format ?? "one_time", minParticipants: activity.min_participants ? String(activity.min_participants) : "", maxParticipants: activity.max_participants ? String(activity.max_participants) : "", minimumAge: activity.minimum_age ? String(activity.minimum_age) : "", maximumAge: activity.maximum_age ? String(activity.maximum_age) : "", suitableGrades: activity.suitable_grades ?? [], isFree: activity.is_free ?? true, price: activity.price ? String(activity.price) : "", registrationDeadline: localDateTime(activity.registration_deadline), equipment: activity.equipment ?? "", accessibility: activity.accessibility ?? "", cancellationPolicy: activity.cancellation_policy ?? "", locationType: activity.location_type ?? "", venueName: activity.venue_name ?? "", address: activity.address ?? "", locationDetails: activity.location_details ?? "", pickupEnabled: Boolean(activity.pickup_options?.length), pickupOptions: activity.pickup_options ?? [], pickupDetails: activity.pickup_details ?? "", sessions: activity.sessions?.length ? activity.sessions.map((session: Record<string, string>) => { const start = localParts(session.starts_at); const end = localParts(session.ends_at); return { date: start.date, startsAt: start.time, endsAt: end.time, allowOverrun: session.estimated_overrun !== "none", estimatedOverrun: session.estimated_overrun ?? "none" }; }) : [emptySession()] }; }
function localDateTime(value?: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function localParts(value: string) { const local = localDateTime(value); return { date: local.slice(0, 10), time: local.slice(11, 16) }; }
function hebrewError(code?: string, fallback?: string) { const messages: Record<string, string> = { PUBLISH_INCOMPLETE: "יש להשלים את כל שדות החובה לפני הפרסום.", NO_FUTURE_SESSION: "יש להוסיף לפחות מפגש עתידי אחד.", INVALID_DEADLINE: "מועד ההרשמה חייב להיות לפני המפגש הראשון.", ACTIVITY_CONFLICT: "המועד מתנגש בפעילות אחרת שלך.", MEETING_CONFLICT: "המועד מתנגש בפגישה מאושרת.", INVALID_PICKUP: "יש להשלים את פרטי האיסוף האחר.", SUBJECT_NOT_ACTIVE: "המקצוע שנבחר אינו זמין." }; return (code && messages[code]) || fallback || "לא ניתן לשמור את הפעילות."; }
