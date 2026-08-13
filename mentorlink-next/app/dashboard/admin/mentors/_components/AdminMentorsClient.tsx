"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "draft" | "pending_review" | "approved" | "published" | "paused" | "rejected";
type Summary = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  submittedAt: string | null;
  isMinor: boolean | null;
  status: Status;
};
type Registration = Summary & {
  email: string | null; phone: string | null; school: string | null; createdAt: string;
  emailConfirmed: boolean; parentConsentStatus: string | null;
  stage: "blocked_age" | "awaiting_email" | "incomplete" | "awaiting_parent_request" | "awaiting_parent_consent" | "ready_for_review" | "pending_review" | "active" | "inactive";
  stageLabel: string; lastCompletedStep: string; hasPendingSensitiveChanges: boolean;
  accountControlStatus: "active" | "suspended" | "blocked";
};
type Detail = {
  userId: string;
  email: string | null;
  status: Status;
  submittedAt: string | null;
  publishedAt: string | null;
  profile: Record<string, unknown> | null;
  subjects: Array<{
    subjectId: number;
    subjectName: string | null;
    customSubject: string | null;
    ageGroups: string[];
  }>;
  availability: Record<string, unknown> | null;
  locations: Record<string, unknown> | null;
  experience: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  parentConsent: Record<string, unknown> | null;
  isMinor: boolean | null;
  photoUrl: string | null;
  pendingChanges: Array<{ id: string; fieldName: string; currentValue: unknown; requestedValue: unknown; requestedAt: string }>;
  accountControl: { status: "active" | "suspended" | "blocked"; reason: string | null; suspendedUntil: string | null; actedAt: string } | null;
  accountHistory: Array<{ id: string; action: string; reason: string; createdAt: string; metadata: Record<string, unknown> }>;
};

const LABELS: Record<string, string> = {
  first_name: "שם פרטי", last_name: "שם משפחה", birth_date: "תאריך לידה",
  grade: "כיתה", school: "בית ספר", city: "עיר מגורים", phone: "מספר טלפון",
  languages: "שפות", bio: "אודות החונך", weekly_schedule: "זמינות שבועית",
  flexible_availability: "Flexible availability", available_on_holidays: "Available on holidays",
  recurring_meetings: "Recurring meetings", one_time_meetings: "One-time meetings",
  time_preferences: "Preferred times", activity_areas: "Activity areas",
  preferred_schools: "Preferred schools", custom_school: "Other school",
  meeting_places: "Meeting places", has_previous_mentoring: "Previous mentoring experience",
  previous_mentoring_details: "Previous mentoring details", experience_types: "Experience types",
  courses_and_certificates: "Courses and certificates", strengths: "Strengths",
  relationship_values: "Relationship values", motivation: "Motivation",
  mentoring_types: "Mentoring types", preferred_age_groups: "Preferred age groups",
  preferred_gender: "Preferred gender", max_travel_distance_km: "Maximum travel distance (km)",
  meeting_modes: "Meeting modes", session_formats: "Session formats",
  preferred_meetings_per_week: "Preferred meetings per week",
  preferred_session_duration_minutes: "Session duration (minutes)",
  willing_special_needs: "Willing to mentor special needs",
  additional_matching_info: "Additional matching information", status: "Status",
  parent_name: "שם הורה או אפוטרופוס", parent_relationship: "קרבה לחונך",
  parent_phone: "טלפון ההורה", parent_email: "אימייל ההורה",
  details_confirmed: "Details confirmed", participation_confirmed: "Participation confirmed",
  contact_confirmed: "Contact confirmed", consent_requested_at: "Consent requested",
  platform_role_confirmed: "הבנת תפקיד הפלטפורמה",
  profile_photo_visibility: "הרשאת תמונת פרופיל",
  profile_photo_consented_at: "מועד אישור התמונה",
  consented_at: "Consent granted", declined_at: "Consent declined",
  consent_version: "Consent version",
};
const HIDDEN_FIELDS = new Set(["user_id", "created_at", "updated_at", "profile_photo_path"]);

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("AUTHENTICATION_REQUIRED");
  return data.session.access_token;
}
async function authorizedGet(path: string) {
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error ?? "Request failed");
  return body as { mentors?: Summary[]; fieldChangeMentors?: Summary[]; publicationMentors?: Summary[]; registrations?: Registration[]; mentor?: Detail };
}

export default function AdminMentorsClient({ userId }: { userId?: string }) {
  const [mentors, setMentors] = useState<Summary[] | null>(null);
  const [fieldChangeMentors, setFieldChangeMentors] = useState<Summary[] | null>(null);
  const [publicationMentors, setPublicationMentors] = useState<Summary[] | null>(null);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [mentor, setMentor] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    authorizedGet(userId ? `/api/admin/mentors/${encodeURIComponent(userId)}` : "/api/admin/mentors")
      .then((body) => {
        if (!active) return;
        if (userId) setMentor(body.mentor ?? null);
        else {
          setMentors(body.mentors ?? []);
          setFieldChangeMentors(body.fieldChangeMentors ?? []);
          setPublicationMentors(body.publicationMentors ?? []);
          setRegistrations(body.registrations ?? []);
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : "Request failed";
        if (message === "AUTHENTICATION_REQUIRED") return window.location.replace("/login");
        setError(message);
      });
    return () => { active = false; };
  }, [userId]);
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Secure administrator area</p>
          <h1 className="mt-2 text-3xl font-extrabold">{userId ? "Mentor profile administration" : "Mentor administration"}</h1>
          <p className="mt-2 text-slate-600">Review applications and separately control public publication.</p>
        </header>
        {error ? <ErrorPanel message={error} /> : null}
        {!error && userId && !mentor ? <Loading /> : null}
        {!error && !userId && (mentors === null || fieldChangeMentors === null || publicationMentors === null || registrations === null) ? <Loading /> : null}
        {!error && mentor ? <DetailView mentor={mentor} /> : null}
        {!error && mentors && fieldChangeMentors && publicationMentors && registrations ? <QueueView registrations={registrations} /> : null}
      </div>
    </main>
  );
}

function QueueView({ registrations }: { registrations: Registration[] }) {
  const [tab, setTab] = useState<"new" | "review" | "changes" | "active" | "inactive">("new");
  const [query, setQuery] = useState("");
  const [showCreate,setShowCreate]=useState(false);
  const groups = {
    new: registrations.filter((mentor) => ["blocked_age", "awaiting_email", "incomplete", "awaiting_parent_request", "awaiting_parent_consent", "ready_for_review"].includes(mentor.stage)),
    review: registrations.filter((mentor) => mentor.stage === "pending_review"),
    changes: registrations.filter((mentor) => mentor.hasPendingSensitiveChanges),
    active: registrations.filter((mentor) => mentor.stage === "active" && !mentor.hasPendingSensitiveChanges && mentor.accountControlStatus === "active"),
    inactive: registrations.filter((mentor) => mentor.stage === "inactive" || mentor.accountControlStatus !== "active"),
  };
  const tabs = [
    ["new", "נרשמים חדשים"], ["review", "חונכים חדשים לאישור"], ["changes", "שינויים רגישים לאישור"], ["active", "חונכים פעילים"], ["inactive", "חשבונות לא פעילים"],
  ] as const;
  const normalized = query.trim().toLocaleLowerCase("he");
  const visible = groups[tab].filter((mentor) => !normalized || [mentor.firstName, mentor.lastName, mentor.email, mentor.phone, mentor.school, mentor.city, mentor.stageLabel].some((value) => value?.toLocaleLowerCase("he").includes(normalized)));
  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-l from-violet-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-black text-violet-700">צירוף מהיר</p><h2 className="mt-1 text-xl font-black">פתיחת חשבון לחונך מוכר</h2><p className="mt-1 text-sm text-slate-600">החשבון יהיה מאומת ופעיל להתחלת מילוי הפרופיל. בכניסה הראשונה החונך יידרש לבחור סיסמה אישית.</p></div><button type="button" onClick={()=>setShowCreate(value=>!value)} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white">{showCreate?"סגירה":"פתיחת חשבון חדש"}</button></div>
        {showCreate&&<QuickMentorAccount onCreated={()=>window.location.reload()}/>}
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-2xl border p-4 text-right font-extrabold ${tab === key ? "border-blue-700 bg-blue-700 text-white" : "bg-white text-slate-800"}`}><span className="block text-2xl">{groups[key].length}</span>{label}</button>)}</div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם, טלפון, דוא״ל, בית ספר או סטטוס" className="w-full rounded-2xl border bg-white px-5 py-4" />
      {!visible.length ? <div className="rounded-2xl border bg-white p-6 text-slate-600">אין חשבונות בקטגוריה זו.</div> : <div className="grid gap-4">{visible.map((mentor) => <RegistrationCard key={mentor.userId} mentor={mentor} />)}</div>}
    </div>
  );
}
function QuickMentorAccount({onCreated}:{onCreated:()=>void}){
  const[firstName,setFirstName]=useState(""),[lastName,setLastName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(()=>temporaryPassword()),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function create(){setBusy(true);setMessage("");const response=await fetch("/api/admin/mentors",{method:"POST",headers:{Authorization:`Bearer ${await token()}`,"Content-Type":"application/json"},body:JSON.stringify({firstName,lastName,email,password})});const body=await response.json();if(!response.ok){setMessage(body.error??"לא ניתן ליצור את החשבון.");setBusy(false);return}setMessage(`החשבון נוצר. שם המשתמש: ${email.trim().toLowerCase()} | סיסמה זמנית: ${password}`);setBusy(false);setTimeout(onCreated,8000)}
  const input="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 outline-none focus:border-violet-700";
  return <div className="mt-5 border-t border-violet-200 pt-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 font-bold">שם פרטי<input value={firstName} onChange={e=>setFirstName(e.target.value)} className={input}/></label><label className="grid gap-1 font-bold">שם משפחה<input value={lastName} onChange={e=>setLastName(e.target.value)} className={input}/></label><label className="grid gap-1 font-bold">אימייל<input type="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} className={input+" text-left"}/></label><label className="grid gap-1 font-bold">סיסמה זמנית<input dir="ltr" value={password} onChange={e=>setPassword(e.target.value)} className={input+" text-left"}/></label></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={create} disabled={busy||!firstName.trim()||!email.trim()||password.length<8} className="rounded-xl bg-blue-700 px-6 py-3 font-black text-white disabled:bg-slate-300">{busy?"יוצר...":"יצירת החשבון"}</button><button type="button" onClick={()=>setPassword(temporaryPassword())} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">יצירת סיסמה אחרת</button></div>{message&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold [overflow-wrap:anywhere]">{message}</p>}</div>
}
function temporaryPassword(){const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@";return Array.from({length:12},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join("")}
function RegistrationCard({ mentor }: { mentor: Registration }) {
  const canOpen = true;
  const content = <>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{[mentor.firstName, mentor.lastName].filter(Boolean).join(" ") || "שם טרם הוזן"}</h3><p className="mt-1 text-slate-600">{mentor.email ?? "אין דוא״ל"} · {mentor.phone ?? "אין טלפון"}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-sm font-bold ${mentor.stage === "active" ? "bg-emerald-100 text-emerald-800" : mentor.stage === "blocked_age" || mentor.stage === "inactive" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{mentor.stageLabel}</span>{mentor.accountControlStatus !== "active" ? <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{mentor.accountControlStatus === "blocked" ? "חסום" : "מושבת זמנית"}</span> : null}</div></div>
    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p><b>נוצר:</b> {formatDate(mentor.createdAt)}</p><p><b>מייל:</b> {mentor.emailConfirmed ? "אומת" : "טרם אומת"}</p><p><b>אישור הורה:</b> {mentor.parentConsentStatus ?? "טרם נפתח"}</p><p><b>שלב אחרון:</b> {mentor.lastCompletedStep}</p><p><b>בית ספר:</b> {mentor.school ?? "טרם הוזן"}</p><p><b>עיר:</b> {mentor.city ?? "טרם הוזנה"}</p></div>
  </>;
  return canOpen ? <Link href={`/dashboard/admin/mentors/${mentor.userId}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400">{content}</Link> : <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{content}<p className="mt-4 text-xs text-slate-500">החשבון גלוי למנהל כבר עכשיו; בדיקת החונך תיפתח לאחר השלמת ההרשמה ושליחה לבדיקה.</p></article>;
}
function QueueSection({ title, empty, mentors }: { title: string; empty: string; mentors: Summary[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-extrabold">{title}</h2>
      {!mentors.length ? <div className="rounded-2xl border bg-white p-6 text-slate-600">{empty}</div> : (
        <div className="grid gap-4">
          {mentors.map((mentor) => (
            <Link key={mentor.userId} href={`/dashboard/admin/mentors/${mentor.userId}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-xl font-bold">{[mentor.firstName, mentor.lastName].filter(Boolean).join(" ") || "Unnamed mentor"}</h3><p className="mt-1 text-slate-600">{mentor.city || "City not saved"} · {mentor.isMinor === true ? "Minor" : mentor.isMinor === false ? "Adult" : "Age unavailable"}</p></div>
                <StatusBadge status={mentor.status} />
              </div>
              <p className="mt-4 text-sm text-slate-500">Submitted {formatDate(mentor.submittedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailView({ mentor }: { mentor: Detail }) {
  const [status, setStatus] = useState<Status>(mentor.status);
  const [confirmation, setConfirmation] = useState<"approve" | "reject" | "publish" | "pause" | "republish" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingChanges, setPendingChanges] = useState(mentor.pendingChanges ?? []);
  const [accountControl, setAccountControl] = useState(mentor.accountControl);
  const [accountAction, setAccountAction] = useState<"suspend" | "block" | "restore" | "permanently_delete" | null>(null);
  const [accountReason, setAccountReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  async function controlAccount() {
    if (!accountAction) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/mentors/${mentor.userId}/account`, {
        method: "PATCH", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: accountAction, reason: accountReason, suspendedUntil, confirmation: deleteConfirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "לא ניתן לעדכן את החשבון.");
      if (accountAction === "permanently_delete") return window.location.replace("/dashboard/admin/mentors");
      const next = body.account?.status as "active" | "suspended" | "blocked" | undefined;
      setAccountControl(next === "active" ? null : { status: next ?? "active", reason: accountReason, suspendedUntil: next === "suspended" ? suspendedUntil : null, actedAt: new Date().toISOString() });
      setAccountAction(null); setAccountReason(""); setSuspendedUntil("");
      setMessage({ type: "success", text: next === "blocked" ? "החונך נחסם והוסר מהפרסום." : next === "suspended" ? "החשבון הושבת זמנית." : "החשבון שוחזר והחסימה הוסרה." });
    } catch (reason) { setMessage({ type: "error", text: reason instanceof Error ? reason.message : "לא ניתן לעדכן את החשבון." }); }
    finally { setBusy(false); }
  }

async function reviewField(changeId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Rejection reason")?.trim() ?? "" : "";
    if (action === "reject" && reason.length < 3) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/mentors/${mentor.userId}/fields/${changeId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to review field");
      setPendingChanges((current) => current.filter((change) => change.id !== changeId));
      setMessage({ type: "success", text: action === "approve" ? "The field change was approved." : "The field change was rejected; the approved value remains public." });
    } catch (reason) { setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Unable to review field" }); }
    finally { setBusy(false); }
  }
  async function review(action: "approve" | "reject") {
    await submit(
      `/api/admin/mentors/${mentor.userId}`,
      action === "approve" ? { action } : { action, reason },
      (body) => body.review?.status,
    );
  }
  async function publication(action: "publish" | "pause" | "republish") {
    await submit(
      `/api/admin/mentors/${mentor.userId}/publication`,
      { action },
      (body) => body.publication?.status,
    );
  }
  async function submit(
    path: string,
    payload: object,
    resultStatus: (body: { review?: { status?: Status }; publication?: { status?: Status }; error?: string }) => Status | undefined,
  ) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      const nextStatus = resultStatus(body);
      if (!response.ok || !nextStatus) throw new Error(body.error ?? "Unable to save the change");
      setStatus(nextStatus); setConfirmation(null);
      setMessage({ type: "success", text: statusMessage(nextStatus) });
    } catch (reason) {
      setMessage({ type: "error", text: reason instanceof Error ? reason.message : "Unable to save the change" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/mentors" className="font-bold text-blue-700">← Back to mentor administration</Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <StatusBadge status={status} />
        <p className="mt-3 text-sm text-slate-600">{statusDescription(status)}</p>
        <p className="mt-2 text-sm">Submitted {formatDate(mentor.submittedAt)}</p>
      </section>
      {message ? <div role="status" className={`rounded-xl p-4 ${message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message.text}</div> : null}
      <ReviewSection title="ניהול החשבון">
        <div dir="rtl" className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4"><p><b>דוא״ל:</b> {mentor.email ?? "לא זמין"}</p><p className="mt-1"><b>מצב החשבון:</b> {accountControl?.status === "blocked" ? "חסום" : accountControl?.status === "suspended" ? "מושבת זמנית" : "פעיל"}</p>{accountControl?.reason ? <p className="mt-1"><b>סיבה:</b> {accountControl.reason}</p> : null}{accountControl?.suspendedUntil ? <p className="mt-1"><b>עד:</b> {formatDate(accountControl.suspendedUntil)}</p> : null}</div>
          {!accountAction ? <div className="flex flex-wrap gap-3">
            {accountControl?.status !== "suspended" ? <button onClick={() => setAccountAction("suspend")} className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-white">השבתה זמנית</button> : null}
            {accountControl?.status !== "blocked" ? <button onClick={() => setAccountAction("block")} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white">חסימת חונך</button> : null}
            {accountControl && accountControl.status !== "active" ? <button onClick={() => setAccountAction("restore")} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">שחזור והסרת חסימה</button> : null}
            <button onClick={() => setAccountAction("permanently_delete")} className="rounded-xl border-2 border-red-600 bg-white px-5 py-3 font-bold text-red-700">מחיקה לצמיתות</button>
          </div> : <form onSubmit={(event) => { event.preventDefault(); void controlAccount(); }} className={`rounded-xl border p-4 ${accountAction === "permanently_delete" ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50"}`}>
            <h3 className="font-black">{accountAction === "suspend" ? "השבתה זמנית" : accountAction === "block" ? "חסימת חונך" : accountAction === "restore" ? "שחזור החשבון" : "מחיקה סופית ובלתי הפיכה"}</h3>
            <label className="mt-4 block font-bold">סיבה *</label><textarea required minLength={3} maxLength={1000} value={accountReason} onChange={(event) => setAccountReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border bg-white p-3" />
            {accountAction === "suspend" ? <><label className="mt-4 block font-bold">מושבת עד *</label><input required type="datetime-local" value={suspendedUntil} onChange={(event) => setSuspendedUntil(event.target.value)} className="mt-2 rounded-xl border bg-white p-3" /></> : null}
            {accountAction === "permanently_delete" ? <div className="mt-4"><p className="font-bold text-red-800">הפעולה מוחקת את ההתחברות ואת נתוני החשבון, ומשחררת את כתובת המייל לרישום מחדש. היא תיחסם אם קיימים נרשמים פעילים.</p><label className="mt-3 block font-bold">הקלד: מחיקה לצמיתות</label><input required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-red-300 bg-white p-3" /></div> : null}
            <div className="mt-4 flex gap-3"><button disabled={busy || accountReason.trim().length < 3 || (accountAction === "permanently_delete" && deleteConfirmation !== "מחיקה לצמיתות")} className={`rounded-xl px-5 py-3 font-bold text-white disabled:opacity-50 ${accountAction === "permanently_delete" || accountAction === "block" ? "bg-red-600" : "bg-blue-600"}`}>{busy ? "שומר…" : "אישור הפעולה"}</button><button type="button" disabled={busy} onClick={() => setAccountAction(null)} className="rounded-xl border bg-white px-5 py-3 font-bold">ביטול</button></div>
          </form>}
          {mentor.accountHistory.length ? <div><h3 className="font-black">היסטוריית ניהול</h3><div className="mt-3 grid gap-2">{mentor.accountHistory.map((event) => <div key={event.id} className="rounded-xl border bg-white p-3"><b>{accountActionLabel(event.action)}</b> · {formatDate(event.createdAt)}<p className="mt-1 text-sm text-slate-600">{event.reason}</p></div>)}</div></div> : null}
        </div>
      </ReviewSection>
      {status === "pending_review" ? (
        <ReviewSection title="Review decision">
          {confirmation === "approve" ? <Confirm title="Approve this application?" text="Approval does not make the mentor public." busy={busy} confirmLabel="Confirm approval" onConfirm={() => void review("approve")} onCancel={() => setConfirmation(null)} /> :
          confirmation === "reject" ? (
            <form onSubmit={(event) => { event.preventDefault(); void review("reject"); }} className="rounded-xl border border-red-200 bg-red-50 p-4">
              <label className="font-bold" htmlFor="rejection-reason">Rejection reason</label>
              <textarea id="rejection-reason" required minLength={3} maxLength={1000} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-32 w-full rounded-xl border bg-white p-3" />
              <div className="mt-4 flex gap-3"><button disabled={busy || reason.trim().length < 3} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50">Confirm rejection</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)} className="rounded-xl border bg-white px-5 py-3 font-bold">Cancel</button></div>
            </form>
          ) : <div className="flex gap-3"><button onClick={() => setConfirmation("approve")} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Approve</button><button onClick={() => setConfirmation("reject")} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white">Reject</button></div>}
        </ReviewSection>
      ) : null}
      {status === "approved" || status === "published" || status === "paused" ? (
        <ReviewSection title="Public publication">
          {confirmation && ["publish", "pause", "republish"].includes(confirmation) ? (
            <Confirm title={confirmation === "pause" ? "Pause this public profile?" : "Make this mentor visible on the homepage?"} text={confirmation === "pause" ? "The mentor will disappear from public results." : "Only the safe public card fields will be visible."} busy={busy} confirmLabel={confirmation === "pause" ? "Confirm pause" : "Confirm publication"} onConfirm={() => void publication(confirmation as "publish" | "pause" | "republish")} onCancel={() => setConfirmation(null)} />
          ) : (
            <button disabled={busy} onClick={() => setConfirmation(status === "approved" ? "publish" : status === "published" ? "pause" : "republish")} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">
              {status === "approved" ? "Publish mentor" : status === "published" ? "Pause publication" : "Republish mentor"}
            </button>
          )}
        </ReviewSection>
      ) : null}
      {pendingChanges.length ? <ReviewSection title="שינויים הממתינים לאישור">
        <div className="grid gap-4">{pendingChanges.map((change) => <article key={change.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold">{LABELS[change.fieldName] ?? change.fieldName}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-500">הערך המאושר כעת</p>
              <p className="mt-1 break-words">{formatValue(change.currentValue)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">הערך החדש שהתבקש</p>
              <p className="mt-1 break-words">{formatValue(change.requestedValue)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">הבקשה נשלחה: {formatDate(change.requestedAt)}</p>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => void reviewField(change.id, "approve")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">אישור השינוי</button>
            <button disabled={busy} onClick={() => void reviewField(change.id, "reject")} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50">דחיית השינוי</button>
          </div>
        </article>)}</div>
      </ReviewSection> : null}
      <ReviewSection title="Personal profile"><RecordFields value={mentor.profile} /></ReviewSection>
      <ReviewSection title="Mentoring subjects">{mentor.subjects.length ? <div className="grid gap-3">{mentor.subjects.map((subject) => <div key={subject.subjectId} className="rounded-xl bg-slate-50 p-4"><p className="font-bold">{subject.customSubject || subject.subjectName || "Unnamed subject"}</p><p className="mt-1 text-sm text-slate-600">Age groups: {subject.ageGroups.join(", ") || "Not saved"}</p></div>)}</div> : <EmptyValue />}</ReviewSection>
      <ReviewSection title="Availability"><RecordFields value={mentor.availability} /></ReviewSection>
      <ReviewSection title="Locations and schools"><RecordFields value={mentor.locations} /></ReviewSection>
      <ReviewSection title="Experience and mentoring approach"><RecordFields value={mentor.experience} /></ReviewSection>
      <ReviewSection title="Matching preferences"><RecordFields value={mentor.preferences} /></ReviewSection>
      <ReviewSection title="Profile photo">{mentor.photoUrl ? <Image src={mentor.photoUrl} alt="Saved mentor profile" width={192} height={192} unoptimized className="h-48 w-48 rounded-2xl object-cover" /> : <EmptyValue />}</ReviewSection>
      <ReviewSection title="Parent consent"><p className="mb-4 font-bold">{mentor.isMinor === true ? `Minor — consent status: ${String(mentor.parentConsent?.status ?? "missing")}` : mentor.isMinor === false ? "Adult — parent consent not required" : "Age unavailable"}</p>{mentor.isMinor === true ? <RecordFields value={mentor.parentConsent} /> : null}</ReviewSection>
    </div>
  );
}

function Confirm({ title, text, busy, confirmLabel, onConfirm, onCancel }: { title: string; text: string; busy: boolean; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-slate-700">{text}</p><div className="mt-4 flex gap-3"><button disabled={busy} onClick={onConfirm} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : confirmLabel}</button><button disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">Cancel</button></div></div>;
}
function StatusBadge({ status }: { status: Status }) {
  const style = status === "published" ? "bg-emerald-100 text-emerald-800" : status === "paused" ? "bg-slate-200 text-slate-800" : status === "approved" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${style}`}>{status.replace("_", " ")}</span>;
}
function statusDescription(status: Status) {
  if (status === "approved") return "Approved but hidden from the public homepage.";
  if (status === "published") return "Visible in public mentor results.";
  if (status === "paused") return "Temporarily hidden from public results.";
  return "Awaiting administrator approval or rejection.";
}
function statusMessage(status: Status) {
  if (status === "approved") return "The application was approved. It is still hidden publicly.";
  if (status === "published") return "The mentor is now visible on the homepage.";
  if (status === "paused") return "The mentor is now hidden from the homepage.";
  return "The mentor status was updated.";
}
function accountActionLabel(action: string) {
  if (action === "blocked") return "החשבון נחסם";
  if (action === "suspended") return "החשבון הושבת זמנית";
  if (action === "restored") return "החשבון שוחזר";
  if (action === "permanently_deleted") return "החשבון נמחק לצמיתות";
  return action;
}
function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-xl font-extrabold">{title}</h2>{children}</section>;
}
function RecordFields({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <EmptyValue />;
  const fields = Object.entries(value).filter(([key]) => !HIDDEN_FIELDS.has(key));
  if (!fields.length) return <EmptyValue />;
  return <dl className="grid gap-4 sm:grid-cols-2">{fields.map(([key, fieldValue]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm font-bold text-slate-500">{LABELS[key] ?? key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words text-slate-900">{formatValue(fieldValue)}</dd></div>)}</dl>;
}
function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not saved";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not saved";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function formatDate(value: string | null) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
}
function Loading() { return <p className="rounded-2xl bg-white p-8 text-slate-600">Loading…</p>; }
function EmptyValue() { return <p className="text-slate-500">No saved information.</p>; }
function ErrorPanel({ message }: { message: string }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p className="font-bold">Access denied</p><p className="mt-1">{message}</p></div>; }
