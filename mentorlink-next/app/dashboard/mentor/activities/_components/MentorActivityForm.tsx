"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SUBJECT_CATEGORIES, type SubjectCategory } from "@/lib/subject-catalog-core";
import { ActivityInfoGrid, type ActivityInfoItem } from "./ActivityInfoGrid";

type Subject = { id: number; name: string; category: SubjectCategory };
type Session = { date: string; startsAt: string; endsAt: string; allowOverrun: boolean; estimatedOverrun: "none" | "5_10_minutes" | "15_20_minutes" };
type Message = { type: "success" | "error"; text: string } | null;
type FormState = {
  subjectId: string; title: string; description: string; format: "one_time" | "series";
  minParticipants: string; maxParticipants: string; minimumAge: string; maximumAge: string;
  suitableGrades: string[]; isFree: boolean; price: string; registrationDeadline: string;
  equipment: string; accessibilityOptions: string[]; accessibilityOther: string; cancellationPolicy: string;
  contactPhoneVisibility: "public" | "registered_parents" | "mentor_approved";
  locationType: string; venueName: string; address: string; locationDetails: string;
  pickupEnabled: boolean; pickupOptions: string[]; pickupDetails: string; sessions: Session[];
};

const GRADE_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳", "י״א", "י״ב"];
const GRADES = GRADE_LABELS.map((label, index) => ({ value: "grade_" + (index + 1), label }));
const LOCATIONS = [
  ["mentor_home", "בית החונך"], ["mentee_home", "בית החניך"], ["school", "בית ספר"],
  ["public_place", "מקום ציבורי"], ["sports_park", "ספורטק"], ["community_center", "מתנ״ס/מרכז קהילתי"],
  ["sports_complex", "מתחם ספורט"], ["online", "אונליין"], ["other", "אחר"],
] as const;
const ACCESSIBILITY = [
  ["wheelchair", "נגישות לכיסא גלגלים"], ["accessible_restrooms", "שירותים נגישים"],
  ["accessible_parking", "חניה נגישה"], ["visual_impairment", "התאמה לילדים עם לקות ראייה"],
  ["hearing_impairment", "התאמה לילדים עם לקות שמיעה"], ["written_visual_instructions", "הוראות כתובות או חזותיות"],
  ["sensory_friendly", "סביבה שקטה או מותאמת לרגישות חושית"], ["companion_allowed", "אפשרות להשתתפות עם מלווה"],
  ["other", "התאמות אחרות"], ["unknown", "לא ידוע – מומלץ ליצור קשר לפני ההרשמה"],
] as const;
const PICKUPS = [["school", "בית ספר"], ["after_school", "צהרון"], ["home", "בית"], ["other", "מקום אחר"]] as const;
const CONTACT_VISIBILITY_OPTIONS = [
  ["public", "לכל הצופים"],
  ["registered_parents", "רק להורים עם הרשמה פעילה"],
  ["mentor_approved", "רק לאחר אישור החונך"],
] as const;
const emptySession = (): Session => ({ date: "", startsAt: "", endsAt: "", allowOverrun: false, estimatedOverrun: "none" });
const initialForm: FormState = {
  subjectId: "", title: "", description: "", format: "one_time", minParticipants: "", maxParticipants: "",
  minimumAge: "", maximumAge: "", suitableGrades: [], isFree: true, price: "", registrationDeadline: "",
  equipment: "", accessibilityOptions: [], accessibilityOther: "", cancellationPolicy: "", contactPhoneVisibility: "registered_parents",
  locationType: "", venueName: "", address: "", locationDetails: "", pickupEnabled: false, pickupOptions: [], pickupDetails: "", sessions: [emptySession()],
};

export function MentorActivityForm({ activityId, needsNewDate = false }: { activityId?: string; needsNewDate?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<Subject[]>([]);
  const [ownSubjectIds, setOwnSubjectIds] = useState<number[]>([]);
  const [subjectMode, setSubjectMode] = useState<"mine" | "other">("mine");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCategory, setNewSubjectCategory] = useState<SubjectCategory>(SUBJECT_CATEGORIES[0]);
  const [addToProfile, setAddToProfile] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(4);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState("draft");
  const [editLocked, setEditLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [publishConfirmation, setPublishConfirmation] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

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
        setEditLocked(Boolean(activity.edit_locked));
        setSubjectMode(ownIds.includes(activity.subject_id) ? "mine" : "other");
        setForm(fromActivity(activity));
        if (new URLSearchParams(window.location.search).get("duplicated") === "1") {
          setMessage({ type: "success", text: "נוצרה טיוטה חדשה על בסיס הפעילות. יש לבחור תאריך ושעות לפני הפרסום." });
          router.replace("/dashboard/mentor/activities/" + activityId + "/edit", { scroll: false });
        }
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [activityId, router]);

  const mySubjects = useMemo(() => catalog.filter((subject) => ownSubjectIds.includes(subject.id)), [catalog, ownSubjectIds]);
  const selectedSubject = catalog.find((subject) => String(subject.id) === form.subjectId);
  const editable = (status === "draft" || status === "published") && !editLocked;
  const missingForPublication = publicationMissing(form);
  const previewItems: ActivityInfoItem[] = [
    { kind: "subject", title: "מקצוע", content: selectedSubject?.name ?? "טרם נבחר מקצוע" },
    { kind: "location", title: "מיקום", content: form.locationType ? (LOCATIONS.find(([value]) => value === form.locationType)?.[1] ?? "מיקום אחר") : "טרם נקבע" },
    { kind: "audience", title: "קהל מתאים", content: form.minimumAge || form.maximumAge ? `גיל ${form.minimumAge || "—"}–${form.maximumAge || "—"}` : "מתאים לכל הגילים" },
    { kind: "participants", title: "מספר משתתפים", content: `${form.minParticipants || "—"}–${form.maxParticipants || "—"}` },
    { kind: "equipment", title: "ציוד", content: form.equipment || "לא נדרש להביא ציוד" },
    { kind: "pickup", title: "איסוף", content: form.pickupEnabled ? "קיימת אפשרות איסוף" : "אין אפשרות איסוף" },
    { kind: "accessibility", title: "נגישות והתאמות", content: form.accessibilityOptions.length ? form.accessibilityOptions.map((value) => ACCESSIBILITY.find(([key]) => key === value)?.[1] ?? value).join(", ") : "לא סומנו התאמות" },
    { kind: "cancellation", title: "מדיניות ביטול", content: form.cancellationPolicy || "לא צוינה מדיניות ביטול" },
    { kind: "phone", title: "חשיפת פרטי קשר", content: CONTACT_VISIBILITY_OPTIONS.find(([value]) => value === form.contactPhoneVisibility)?.[1] ?? "רק להורים עם הרשמה פעילה" },
    { kind: "price", title: "מחיר", content: form.isFree ? "ללא עלות" : `${form.price || "0"} ₪` },
    { kind: "date", title: "מועד", content: form.sessions[0]?.date ? `${form.sessions[0].date} · ${form.sessions[0].startsAt || "—"}` : "טרם נקבע מועד" },
    { kind: "description", title: "תיאור", content: form.description || "תיאור הפעילות יופיע כאן" },
  ];

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
      const savedActivityId = activityId ?? body.activity?.id;
      if (imageFile && savedActivityId) {
        const imageForm = new FormData();
        imageForm.set("image", imageFile);
        imageForm.set("alt", form.title.trim() || "תמונת הפעילות");
        const imageResponse = await fetch(`/api/mentor-activities/${savedActivityId}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: imageForm,
        });
        const imageBody = await imageResponse.json().catch(() => ({}));
        if (!imageResponse.ok) {
          setMessage({ type: "error", text: `פרטי הפעילות נשמרו, אך התמונה לא הועלתה: ${imageBody.error ?? "יש לנסות שוב."}` });
          return;
        }
        setImageFile(null);
      }
      if (action === "publish") {
        setStatus("published");
        setPublishConfirmation(false);
        router.replace("/dashboard/mentor/activities?published=1");
      } else if (!activityId && body.activity?.id) {
        router.replace(`/dashboard/mentor/activities/${body.activity.id}/edit`);
      } else setMessage({ type: "success", text: status === "published" ? "השינויים בפעילות נשמרו בהצלחה." : "הטיוטה נשמרה בהצלחה." });
    } catch { setMessage({ type: "error", text: "לא ניתן לשמור את הפעילות כרגע." }); }
    finally { setBusy(false); }
  }

  function generateWeeklySessions() {
    const first = form.sessions[0];
    if (!first?.date || !first.startsAt || !first.endsAt) {
      setMessage({ type: "error", text: "יש למלא תאריך ושעות במפגש הראשון לפני יצירת סדרה שבועית." });
      return;
    }
    const sessions = Array.from({ length: weeklyCount }, (_, index) => {
      const date = new Date(first.date + "T12:00:00");
      date.setDate(date.getDate() + index * 7);
      return { ...first, date: localDate(date) };
    });
    setForm({ ...form, sessions });
    setMessage({ type: "success", text: "המועדים השבועיים נוצרו. אפשר לערוך כל מפגש בנפרד." });
  }
  function updateSession(index: number, changes: Partial<Session>) {
    setForm((current) => ({ ...current, sessions: current.sessions.map((session, position) => position === index ? { ...session, ...changes } : session) }));
  }

  if (loading) return <p dir="rtl" role="status" className="rounded-2xl bg-white p-6 font-bold">טוען את טופס הפעילות...</p>;
  if (editLocked) return <section dir="rtl" className="mx-auto max-w-3xl"><h1 className="text-4xl font-black">עריכת פעילות</h1><div role="alert" className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-950">לפעילות זו כבר קיימות הרשמות ולכן פרטיה המרכזיים נעולים. ניתן לשלוח עדכון לנרשמים או לבטל את הפעילות.</div><div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard/mentor/activities" className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white">שליחת עדכון או ביטול</Link><Link href="/dashboard/mentor/activities" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700">חזרה לפעילויות</Link></div></section>;
  return <section dir="rtl" className="mx-auto max-w-5xl pb-16">
    {needsNewDate && <div role="alert" className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950"><h2 className="text-xl font-black">דרוש שינוי תאריך — המועד המקורי של הפעילות עבר</h2><p className="mt-2 leading-7">הפעילות הוחזרה כטיוטה. יש לקבוע מועד עתידי תקין לפני שניתן יהיה לפרסם אותה מחדש.</p></div>}
    <header className="mb-7"><p className="font-bold text-violet-700">מערכת הפעילויות</p><h1 className="mt-2 text-4xl font-black">{activityId ? "עריכת פעילות" : "פתיחת פעילות חדשה"}</h1><p className="mt-2 text-slate-600">אפשר לשמור טיוטה חלקית ולהשלים אותה לפני הפרסום.</p><p className="mt-2 text-sm font-bold text-slate-700">* שדה חובה לפרסום הפעילות</p></header>
    {message && <Message {...message} />}
    <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="פעולות טופס עליונות"><button type="button" disabled={busy || !editable} onClick={() => save("draft")} className="rounded-xl bg-slate-800 px-4 py-2 font-black text-white disabled:bg-slate-400">{busy ? "שומר..." : status === "published" ? "שמירת שינויים" : "שמירת טיוטה"}</button><button type="button" disabled={busy} onClick={() => setPreview((current) => !current)} className="rounded-xl border border-violet-400 px-4 py-2 font-black text-violet-800 disabled:opacity-50">{preview ? "סגירת תצוגה מקדימה" : "תצוגה מקדימה"}</button>{status === "draft" && <button type="button" disabled={busy || !editable || missingForPublication.length > 0} onClick={() => setPublishConfirmation(true)} className="rounded-xl bg-violet-700 px-4 py-2 font-black text-white disabled:bg-slate-400">{busy ? "מפרסם..." : "פרסום הפעילות"}</button>}<Link aria-disabled={busy} href="/dashboard/mentor/activities" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-700">ביטול וחזרה</Link></div>
    <div className="space-y-6" aria-busy={busy}>
      <Card color="blue" title="1. מקצוע הפעילות">
        <div className="flex flex-wrap gap-3"><Radio checked={subjectMode === "mine"} onChange={() => setSubjectMode("mine")} label="המקצועות שלי" /><Radio checked={subjectMode === "other"} onChange={() => setSubjectMode("other")} label="מקצוע אחר לפעילות הזאת" /></div>
        {subjectMode === "mine" ? <label className="mt-4 grid gap-2 font-bold">בחירת מקצוע *<select disabled={!editable} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={input}><option value="">בחירה</option>{mySubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label> : <div className="mt-4 space-y-4"><label className="grid gap-2 font-bold">מקצוע מהמאגר המשותף *<select disabled={!editable} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={input}><option value="">בחירה או הוספה חדשה</option>{catalog.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.category}</option>)}</select></label><div className="grid gap-3 rounded-2xl border border-dashed border-blue-300 bg-white p-4 md:grid-cols-[1fr_2fr]"><select disabled={!editable} value={newSubjectCategory} onChange={(event) => setNewSubjectCategory(event.target.value as SubjectCategory)} className={input}>{SUBJECT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><input disabled={!editable} value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="שם מקצוע חדש" maxLength={50} className={input} /><label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" disabled={!editable} checked={addToProfile} onChange={(event) => setAddToProfile(event.target.checked)} />הוסף את המקצוע גם לפרופיל שלי</label><button type="button" disabled={!editable || addingSubject || !newSubjectName.trim()} onClick={createSubject} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:bg-slate-400 md:col-span-2">{addingSubject ? "מוסיף..." : "הוספת המקצוע ובחירתו"}</button></div></div>}
      </Card>
      <Card color="violet" title="2. פרטי הפעילות">
        <div className="grid gap-4 md:grid-cols-2"><Field label="כותרת *"><input disabled={!editable} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} className={input} /></Field><Field label="מבנה"><select disabled={!editable} value={form.format} onChange={(e) => { const format = e.target.value as FormState["format"]; setForm({ ...form, format, sessions: format === "one_time" ? [form.sessions[0] ?? emptySession()] : form.sessions }); }} className={input}><option value="one_time">פעילות חד־פעמית</option><option value="series">סדרת מפגשים</option></select></Field><Field label="תיאור *" wide><textarea disabled={!editable} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} maxLength={4000} className={input} /></Field><Field label="תמונה לפעילות (לא חובה)" wide><div className="rounded-2xl border border-blue-200 bg-white p-4"><input disabled={!editable} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="w-full text-sm file:ml-3 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-black file:text-white"/><p className="mt-3 text-sm font-bold leading-6 text-blue-950">מומלץ מאוד להוסיף תמונה מתאימה — תמונה טובה מבליטה את הפעילות ועוזרת להורים להבין במה מדובר.</p><p className="mt-1 text-xs text-slate-500">JPG, PNG או WebP, עד 5MB.</p></div></Field><Field label="מינימום משתתפים *"><input disabled={!editable} type="number" min="1" max="500" value={form.minParticipants} onChange={(e) => setForm({ ...form, minParticipants: e.target.value })} className={input} /></Field><Field label="מקסימום משתתפים *"><input disabled={!editable} type="number" min="1" max="500" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} className={input} /></Field></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="גיל מינימלי (לא חובה)"><input disabled={!editable} type="number" min="3" max="120" value={form.minimumAge} onChange={(e) => setForm({ ...form, minimumAge: e.target.value })} className={input} /></Field><Field label="גיל מקסימלי (לא חובה)"><input disabled={!editable} type="number" min="3" max="120" value={form.maximumAge} onChange={(e) => setForm({ ...form, maximumAge: e.target.value })} className={input} /></Field><Field label="כיתות מתאימות (לא חובה)" wide><div className="flex flex-wrap gap-2">{GRADES.map((grade) => <CheckPill key={grade.value} disabled={!editable} checked={form.suitableGrades.includes(grade.value)} label={grade.label} onChange={() => setForm({ ...form, suitableGrades: toggle(form.suitableGrades, grade.value) })} />)}</div></Field></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="מדיניות חשיפת מספר החונך"><select disabled={!editable} value={form.contactPhoneVisibility} onChange={(event) => setForm({ ...form, contactPhoneVisibility: event.target.value as FormState["contactPhoneVisibility"] })} className={input}>{CONTACT_VISIBILITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
        <p className="mt-2 rounded-xl bg-fuchsia-50 p-3 text-sm leading-6 text-fuchsia-950">ברירת המחדל המומלצת היא הצגה רק להורים עם הרשמה פעילה. הורים ברשימת המתנה אינם רואים את המספר. הצגה פומבית של מספר חונך קטין מחייבת אישור הורה מפורש.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" disabled={!editable} checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked, price: e.target.checked ? "" : form.price })} />פעילות ללא עלות</label>{!form.isFree && <Field label="מחיר בש״ח"><input disabled={!editable} type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={input} /></Field>}<Field label="מועד אחרון להרשמה *" wide><input disabled={!editable} type="datetime-local" value={form.registrationDeadline} onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })} className={input} /></Field><Field label="ציוד (לא חובה)"><textarea disabled={!editable} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} className={input} /></Field><Field label="נגישות והתאמות (לא חובה)" wide><div className="flex flex-wrap gap-2">{ACCESSIBILITY.map(([value, label]) => <CheckPill key={value} disabled={!editable} checked={form.accessibilityOptions.includes(value)} label={label} onChange={() => { const options = value === "unknown" ? (form.accessibilityOptions.includes("unknown") ? [] : ["unknown"]) : toggle(form.accessibilityOptions.filter((item) => item !== "unknown"), value); setForm({ ...form, accessibilityOptions: options, accessibilityOther: value === "other" && form.accessibilityOptions.includes("other") ? "" : form.accessibilityOther }); }} />)}</div>{form.accessibilityOptions.includes("other") && <input disabled={!editable} value={form.accessibilityOther} onChange={(e) => setForm({ ...form, accessibilityOther: e.target.value })} maxLength={1000} placeholder="פירוט ההתאמות האחרות" className={input} />}</Field><Field label="מדיניות ביטול (לא חובה)" wide><textarea disabled={!editable} value={form.cancellationPolicy} onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })} className={input} /></Field></div>
      </Card>
      <Card color="amber" title="3. מועדים">
        <div className="space-y-4">{form.sessions.map((session, index) => <div key={index} className="rounded-2xl border border-amber-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-3"><Field label="תאריך *"><input disabled={!editable} type="date" value={session.date} onChange={(e) => updateSession(index, { date: e.target.value })} className={input} /></Field><Field label="שעת התחלה *"><input disabled={!editable} type="time" value={session.startsAt} onChange={(e) => updateSession(index, { startsAt: e.target.value })} className={input} /></Field><Field label="שעת סיום מתוכננת *"><input disabled={!editable} type="time" value={session.endsAt} onChange={(e) => updateSession(index, { endsAt: e.target.value })} className={input} /></Field></div><label className="mt-3 flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={session.allowOverrun} onChange={(e) => updateSession(index, { allowOverrun: e.target.checked, estimatedOverrun: e.target.checked ? "5_10_minutes" : "none" })} />ייתכן שהפעילות תסתיים מעט מאוחר יותר</label>{session.allowOverrun && <select disabled={!editable} value={session.estimatedOverrun} onChange={(e) => updateSession(index, { estimatedOverrun: e.target.value as Session["estimatedOverrun"] })} className={`${input} mt-3`}><option value="5_10_minutes">עד 5–10 דקות נוספות</option><option value="15_20_minutes">עד 15–20 דקות נוספות</option></select>}{form.format === "series" && form.sessions.length > 1 && <button type="button" disabled={!editable} onClick={() => setForm({ ...form, sessions: form.sessions.filter((_, position) => position !== index) })} className="mt-3 font-bold text-red-700">הסרת מפגש</button>}</div>)}</div>{form.format === "series" && <button type="button" disabled={!editable} onClick={() => setForm({ ...form, sessions: [...form.sessions, emptySession()] })} className="mt-4 rounded-xl border border-amber-500 bg-white px-5 py-3 font-bold text-amber-900">הוספת מפגש</button>}
        {form.format === "series" && <div className="mt-5 rounded-2xl border border-amber-300 bg-white p-4"><h3 className="font-black">יצירת סדרה שבועית</h3><p className="mt-1 text-sm text-slate-600">המפגשים ייווצרו פעם בשבוע לפי התאריך והשעות של המפגש הראשון, ואפשר יהיה לערוך כל אחד בנפרד.</p><div className="mt-3 flex flex-wrap items-end gap-3"><Field label="מספר מפגשים"><input type="number" min="2" max="52" disabled={!editable} value={weeklyCount} onChange={(event) => setWeeklyCount(Math.min(52, Math.max(2, Number(event.target.value) || 2)))} className={input} /></Field><button type="button" disabled={!editable} onClick={generateWeeklySessions} className="rounded-xl bg-amber-700 px-5 py-3 font-black text-white">יצירת המועדים השבועיים</button></div></div>}
      </Card>
      <Card color="emerald" title="4. מיקום ואיסוף">
        <Field label="סוג מיקום *"><select disabled={!editable} value={form.locationType} onChange={(e) => setForm({ ...form, locationType: e.target.value, address: e.target.value === "online" ? "" : form.address })} className={input}><option value="">בחירה</option>{LOCATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{form.locationType && form.locationType !== "online" && <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="שם המקום (לא חובה)"><input disabled={!editable} value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} className={input} /></Field><Field label="כתובת (לא חובה)"><input disabled={!editable} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} /></Field></div>}{form.locationType && <Field label="פירוט נוסף (לא חובה)"><textarea disabled={!editable} value={form.locationDetails} onChange={(e) => setForm({ ...form, locationDetails: e.target.value })} className={`${input} mt-4`} /></Field>}
        <label className="mt-6 flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" disabled={!editable} checked={form.pickupEnabled} onChange={(e) => setForm({ ...form, pickupEnabled: e.target.checked, pickupOptions: e.target.checked ? form.pickupOptions : [], pickupDetails: e.target.checked ? form.pickupDetails : "" })} />אפשרות לאיסוף</label>{form.pickupEnabled && <div className="mt-4"><div className="flex flex-wrap gap-2">{PICKUPS.map(([value, label]) => <CheckPill key={value} disabled={!editable} checked={form.pickupOptions.includes(value)} label={label} onChange={() => setForm({ ...form, pickupOptions: toggle(form.pickupOptions, value), pickupDetails: value === "other" && form.pickupOptions.includes(value) ? "" : form.pickupDetails })} />)}</div>{form.pickupOptions.includes("other") && <Field label="פירוט מקום האיסוף האחר"><input disabled={!editable} value={form.pickupDetails} onChange={(e) => setForm({ ...form, pickupDetails: e.target.value })} maxLength={500} className={`${input} mt-3`} /></Field>}</div>}
      </Card>
      {preview && <Card color="slate" title="תצוגה מקדימה"><h3 className="mb-5 text-2xl font-black">{form.title || "כותרת הפעילות"}</h3><ActivityInfoGrid items={previewItems} /></Card>}
      {missingForPublication.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-black text-amber-950">כדי לפרסם יש להשלים:</h2><ul className="mt-2 list-inside list-disc text-sm text-amber-900">{missingForPublication.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      <div className="sticky bottom-3 z-10 flex flex-wrap gap-3 rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur"><button type="button" disabled={busy || !editable} onClick={() => save("draft")} className="rounded-xl bg-slate-800 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "שומר..." : status === "published" ? "שמירת שינויים" : "שמירת טיוטה"}</button><button type="button" onClick={() => setPreview((current) => !current)} className="rounded-xl border border-violet-400 px-5 py-3 font-black text-violet-800">{preview ? "סגירת תצוגה מקדימה" : "תצוגה מקדימה"}</button>{status === "draft" && <button type="button" disabled={busy || !editable || missingForPublication.length > 0} onClick={() => setPublishConfirmation(true)} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "מפרסם..." : "פרסום פעילות"}</button>}<Link href="/dashboard/mentor/activities" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700">ביטול וחזרה</Link></div>
    </div>
    {publishConfirmation && <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && setPublishConfirmation(false)}><div role="alertdialog" aria-modal="true" aria-labelledby="publish-confirm-title" className="w-full max-w-lg rounded-3xl bg-white p-6 text-right shadow-2xl"><h2 id="publish-confirm-title" className="text-2xl font-black">פרסום הפעילות</h2><p className="mt-3 leading-7 text-slate-700">הפעילות תופיע למשפחות ותהיה פתוחה להרשמה. לפרסם עכשיו?</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => setPublishConfirmation(false)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 disabled:opacity-50">חזרה לעריכה</button><button type="button" autoFocus disabled={busy} onClick={() => save("publish")} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:bg-slate-400">{busy ? "מפרסם..." : "אישור ופרסום"}</button></div></div></div>}
  </section>;
}

const input = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100";
function Card({ title, color, children }: { title: string; color: "blue" | "violet" | "amber" | "emerald" | "slate"; children: React.ReactNode }) { const colors = { blue: "border-blue-200 bg-blue-50/70", violet: "border-violet-200 bg-violet-50/70", amber: "border-amber-200 bg-amber-50/70", emerald: "border-emerald-200 bg-emerald-50/70", slate: "border-slate-300 bg-slate-50" }; return <section className={`rounded-3xl border p-5 shadow-sm md:p-7 ${colors[color]}`}><h2 className="mb-5 text-2xl font-black">{title}</h2>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid gap-2 font-bold ${wide ? "md:col-span-2" : ""}`}>{label}{children}</label>; }
function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <label className={`cursor-pointer rounded-xl border px-4 py-3 font-bold ${checked ? "border-blue-600 bg-blue-700 text-white" : "bg-white"}`}><input type="radio" checked={checked} onChange={onChange} className="sr-only" />{label}</label>; }
function CheckPill({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) { return <label className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${checked ? "bg-slate-800 text-white" : "bg-white"}`}><input type="checkbox" disabled={disabled} checked={checked} onChange={onChange} className="sr-only" />{label}</label>; }
function Message({ type, text }: { type: "success" | "error"; text: string }) { return <p role={type === "error" ? "alert" : "status"} className={`mb-5 rounded-xl p-4 font-bold ${type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{text}</p>; }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function toPayload(value: FormState) { return { subjectId: value.subjectId ? Number(value.subjectId) : null, title: value.title || null, description: value.description || null, format: value.format, minParticipants: value.minParticipants ? Number(value.minParticipants) : null, maxParticipants: value.maxParticipants ? Number(value.maxParticipants) : null, minimumAge: value.minimumAge ? Number(value.minimumAge) : null, maximumAge: value.maximumAge ? Number(value.maximumAge) : null, suitableGrades: value.suitableGrades, isFree: value.isFree, price: value.isFree ? 0 : Number(value.price), registrationDeadline: value.registrationDeadline ? new Date(value.registrationDeadline).toISOString() : null, equipment: value.equipment || null, accessibilityOptions: value.accessibilityOptions, accessibilityOther: value.accessibilityOptions.includes("other") ? value.accessibilityOther || null : null, cancellationPolicy: value.cancellationPolicy || null, contactPhoneVisibility: value.contactPhoneVisibility, locationType: value.locationType || null, venueName: value.venueName || null, address: value.locationType === "online" ? null : value.address || null, locationDetails: value.locationDetails || null, pickupOptions: value.pickupEnabled ? value.pickupOptions : [], pickupDetails: value.pickupEnabled && value.pickupOptions.includes("other") ? value.pickupDetails || null : null, sessions: value.sessions.filter((session) => session.date && session.startsAt && session.endsAt).map((session) => ({ startsAt: new Date(`${session.date}T${session.startsAt}`).toISOString(), endsAt: new Date(`${session.date}T${session.endsAt}`).toISOString(), estimatedOverrun: session.allowOverrun ? session.estimatedOverrun : "none" })) }; }
function fromActivity(activity: Record<string, any>): FormState { return { subjectId: activity.subject_id ? String(activity.subject_id) : "", title: activity.title ?? "", description: activity.description ?? "", format: activity.format ?? "one_time", minParticipants: activity.min_participants ? String(activity.min_participants) : "", maxParticipants: activity.max_participants ? String(activity.max_participants) : "", minimumAge: activity.minimum_age ? String(activity.minimum_age) : "", maximumAge: activity.maximum_age ? String(activity.maximum_age) : "", suitableGrades: activity.suitable_grades ?? [], isFree: activity.is_free ?? true, price: activity.price ? String(activity.price) : "", registrationDeadline: localDateTime(activity.registration_deadline), equipment: activity.equipment ?? "", accessibilityOptions: activity.accessibility_options ?? [], accessibilityOther: activity.accessibility_other ?? "", cancellationPolicy: activity.cancellation_policy ?? "", contactPhoneVisibility: activity.contact_phone_visibility ?? "registered_parents", locationType: activity.location_type ?? "", venueName: activity.venue_name ?? "", address: activity.address ?? "", locationDetails: activity.location_details ?? "", pickupEnabled: Boolean(activity.pickup_options?.length), pickupOptions: activity.pickup_options ?? [], pickupDetails: activity.pickup_details ?? "", sessions: activity.sessions?.length ? activity.sessions.map((session: Record<string, string>) => { const start = localParts(session.starts_at); const end = localParts(session.ends_at); return { date: start.date, startsAt: start.time, endsAt: end.time, allowOverrun: session.estimated_overrun !== "none", estimatedOverrun: session.estimated_overrun ?? "none" }; }) : [emptySession()] }; }
function publicationMissing(value: FormState) {
  const missing: string[] = [];
  if (!value.subjectId) missing.push("מקצוע או תחום");
  if (value.title.trim().length < 3) missing.push("כותרת תקינה");
  if (value.description.trim().length < 10) missing.push("תיאור של 10 תווים לפחות");
  const minimum = Number(value.minParticipants);
  const maximum = Number(value.maxParticipants);
  if (!value.minParticipants || minimum < 1) missing.push("מינימום משתתפים");
  if (!value.maxParticipants || maximum < minimum || maximum > 500) missing.push("מקסימום משתתפים תקין");
  if (!value.locationType) missing.push("סוג מיקום");
  const validSessions = value.sessions.filter((session) => session.date && session.startsAt && session.endsAt && session.endsAt > session.startsAt && new Date(session.date + "T" + session.startsAt) > new Date());
  if (!validSessions.length) missing.push("לפחות מפגש עתידי אחד עם שעות תקינות");
  if (!value.registrationDeadline) missing.push("מועד אחרון להרשמה");
  else if (validSessions.length && new Date(value.registrationDeadline) >= new Date(validSessions[0].date + "T" + validSessions[0].startsAt)) missing.push("מועד הרשמה לפני המפגש הראשון");
  if (value.accessibilityOptions.includes("other") && !value.accessibilityOther.trim()) missing.push("פירוט התאמות נגישות אחרות");
  return missing;
}
function localDate(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}function localDateTime(value?: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function localParts(value: string) { const local = localDateTime(value); return { date: local.slice(0, 10), time: local.slice(11, 16) }; }
function hebrewError(code?: string, _fallback?: string) { const messages: Record<string, string> = { PUBLISH_INCOMPLETE: "יש להשלים את כל שדות החובה לפני הפרסום.", NO_FUTURE_SESSION: "יש להוסיף לפחות מפגש עתידי אחד.", INVALID_DEADLINE: "מועד ההרשמה חייב להיות לפני המפגש הראשון.", ACTIVITY_CONFLICT: "המועד מתנגש בפעילות אחרת שלך.", MEETING_CONFLICT: "המועד מתנגש בפגישה מאושרת.", INVALID_PICKUP: "יש להשלים את פרטי האיסוף האחר.", SUBJECT_NOT_ACTIVE: "המקצוע שנבחר אינו זמין.", ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS: "לפעילות זו כבר קיימות הרשמות ולכן פרטיה המרכזיים נעולים. ניתן לשלוח עדכון לנרשמים או לבטל את הפעילות.", ACTIVITY_NOT_EDITABLE: "לא ניתן לערוך פעילות במצב הנוכחי." }; return (code && messages[code]) || "לא ניתן לשמור את הפעילות כרגע."; }
