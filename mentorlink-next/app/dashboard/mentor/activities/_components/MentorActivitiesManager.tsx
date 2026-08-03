"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ActivityInfoGrid, type ActivityInfoItem } from "./ActivityInfoGrid";

type Status = "draft" | "published" | "cancelled" | "completed";
type Session = { id: string; starts_at: string; ends_at: string; estimated_overrun: "none" | "5_10_minutes" | "15_20_minutes" };
type Activity = {
  id: string;
  title: string | null;
  description: string | null;
  status: Status;
  subject_name: string | null;
  location_type: string | null;
  venue_name: string | null;
  is_free: boolean;
  price: number | string | null;
  min_participants: number | null;
  max_participants: number | null;
  minimum_age: number | null;
  maximum_age: number | null;
  suitable_grades: string[];
  equipment: string | null;
  cancellation_policy: string | null;
  pickup_options: string[];
  pickup_details: string | null;
  accessibility_options: string[];
  accessibility_other: string | null;
  address: string | null;
  location_details: string | null;
  image_path: string | null;
  image_url: string | null;
  image_alt: string | null;
  sessions: Session[];
  registration_counts: { registered: number; waitlisted: number; total: number };
  contact_phone_visibility: "public" | "registered_parents" | "mentor_approved";
};
type ConfirmAction = { kind: "publish" | "cancel" | "delete"; activity: Activity } | null;
type Notice = { type: "success" | "error"; text: string } | null;
type Recipient = { parentUserId: string; childFirstNames: string[] };
type ActivityUpdate = { id: string; recipient_scope: "all_active" | "parent"; recipient_parent_user_id: string | null; update_type: string; body: string; delay_minutes: number | null; proposed_start_at: string | null; proposed_end_at: string | null; created_at: string };
type ActivityRegistration = { id: string; parentUserId: string | null; parentName: string | null; parentPhone: string | null; childName: string; status: "registered" | "waitlisted"; registeredAt: string; contactApproved: boolean };

const STATUS: Record<Status, { label: string; badge: string; card: string }> = {
  draft: { label: "טיוטה", badge: "bg-amber-100 text-amber-900", card: "border-amber-200 bg-amber-50/70" },
  published: { label: "פורסמה", badge: "bg-emerald-100 text-emerald-900", card: "border-emerald-200 bg-emerald-50/70" },
  cancelled: { label: "בוטלה", badge: "bg-rose-100 text-rose-900", card: "border-rose-200 bg-rose-50/70" },
  completed: { label: "הסתיימה", badge: "bg-slate-200 text-slate-800", card: "border-slate-300 bg-slate-50" },
};

const LOCATION: Record<string, string> = {
  mentor_home: "בית החונך", mentee_home: "בית החניך", school: "בית ספר",
  public_place: "מקום ציבורי", sports_park: "ספורטק", community_center: "מתנ״ס/מרכז קהילתי",
  sports_complex: "מתחם ספורט", online: "אונליין", other: "אחר",
};

export function MentorActivitiesManager() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [preview, setPreview] = useState<Activity | null>(null);
  const [updatesActivity, setUpdatesActivity] = useState<Activity | null>(null);
  const [registrationsActivity, setRegistrationsActivity] = useState<Activity | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (error || !accessToken) { router.replace("/login"); return; }
      setToken(accessToken);
      if (new URLSearchParams(window.location.search).get("published") === "1") {
        setNotice({ type: "success", text: "הפעילות פורסמה בהצלחה והיא פתוחה להרשמה." });
        router.replace("/dashboard/mentor/activities", { scroll: false });
      }
      await loadActivities(accessToken, active);
    });
    return () => { active = false; };
  }, [router]);

  async function loadActivities(accessToken = token, active = true) {
    setLoading(true);
    try {
      const response = await fetch("/api/mentor-activities", {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) throw new Error(body.error);
      setActivities(body.activities ?? []);
    } catch {
      if (active) setNotice({ type: "error", text: "לא ניתן לטעון את הפעילויות כרגע." });
    } finally {
      if (active) setLoading(false);
    }
  }

  const visible = useMemo(
    () => filter === "all" ? activities : activities.filter((activity) => activity.status === filter),
    [activities, filter],
  );

  async function executeConfirmed(reason = "") {
    if (!confirmAction || busyId) return;
    const { kind, activity } = confirmAction;
    setBusyId(activity.id); setNotice(null);
    try {
      const response = await fetch(`/api/mentor-activities/${activity.id}`, {
        method: kind === "delete" ? "DELETE" : "PATCH",
        headers: { Authorization: `Bearer ${token}`, ...(kind === "delete" ? {} : { "Content-Type": "application/json" }) },
        ...(kind === "delete" ? {} : { body: JSON.stringify({ action: kind, ...(kind === "cancel" ? { reason } : {}) }) }),
      });
      const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setConfirmAction(null);
      setNotice({ type: "success", text: kind === "publish" ? "הפעילות פורסמה בהצלחה." : kind === "cancel" ? "הפעילות בוטלה." : "הטיוטה נמחקה." });
      await loadActivities(token);
    } catch {
      setNotice({ type: "error", text: kind === "publish" ? "לא ניתן לפרסם את הפעילות. בדקו שכל הפרטים הושלמו ושהמועד פנוי." : kind === "cancel" ? "לא ניתן לבטל את הפעילות כרגע." : "לא ניתן למחוק את הטיוטה כרגע." });
    } finally { setBusyId(null); }
  }

  async function duplicate(activity: Activity) {
    if (busyId) return;
    setBusyId(activity.id); setNotice(null);
    try {
      const response = await fetch(`/api/mentor-activities/${activity.id}/duplicate`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.activity?.id) throw new Error(body.error);
      router.push(`/dashboard/mentor/activities/${body.activity.id}/edit?duplicated=1`);
    } catch {
      setNotice({ type: "error", text: "לא ניתן לשכפל את הפעילות כרגע." });
      setBusyId(null);
    }
  }

  async function uploadImage(activity: Activity, file: File) {
    if (busyId) return;
    setBusyId(activity.id); setNotice(null);
    const form = new FormData(); form.set("image", file); form.set("alt", activity.title || "תמונת הפעילות");
    try {
      const response = await fetch(`/api/mentor-activities/${activity.id}/image`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setNotice({ type: "success", text: "תמונת הפעילות נשמרה." }); await loadActivities(token);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "לא ניתן להעלות את התמונה." }); }
    finally { setBusyId(null); }
  }

  return <section dir="rtl" className="mx-auto max-w-7xl pb-16">
    <header className="flex flex-col gap-5 rounded-3xl bg-gradient-to-l from-violet-700 via-blue-700 to-cyan-600 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between md:p-8">
      <div><p className="font-bold text-cyan-100">מרכז הפעילויות</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">הפעילויות שלי</h1><p className="mt-2 max-w-2xl text-blue-50">ניהול טיוטות, מועדים והרשמות במקום אחד.</p></div>
      <Link href="/dashboard/mentor/activities/new" className="rounded-2xl bg-white px-6 py-4 text-center font-black text-blue-800 shadow-md transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">פתיחת פעילות חדשה</Link>
    </header>
    {notice && <p role={notice.type === "error" ? "alert" : "status"} className={`mt-5 rounded-2xl p-4 font-bold ${notice.type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{notice.text}</p>}
    <div className="mt-7 flex flex-wrap gap-2" aria-label="סינון לפי סטטוס">
      {(["all", "draft", "published", "cancelled", "completed"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${filter === value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400"}`}>{value === "all" ? "הכול" : STATUS[value].label}</button>)}
    </div>
    {loading ? <div role="status" className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />)}</div>
      : visible.length === 0 ? <div className="mt-8 rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50 p-10 text-center"><h2 className="text-2xl font-black">{activities.length ? "אין פעילויות בסינון הזה" : "עוד לא פתחת פעילות"}</h2><p className="mt-2 text-slate-600">אפשר להתחיל מטיוטה ולפרסם כשהכול מוכן.</p><Link href="/dashboard/mentor/activities/new" className="mt-6 inline-block rounded-2xl bg-blue-700 px-7 py-4 font-black text-white shadow-md">פתיחת פעילות חדשה</Link></div>
      : <div className="mt-8 grid auto-rows-fr items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map((activity) => <ActivityCard key={activity.id} activity={activity} busy={busyId === activity.id} onPreview={(trigger) => { previewTrigger.current = trigger; setPreview(activity); }} onConfirm={(kind) => setConfirmAction({ kind, activity })} onDuplicate={() => duplicate(activity)} onUpdates={() => setUpdatesActivity(activity)} onRegistrations={() => setRegistrationsActivity(activity)} onImage={(file) => uploadImage(activity, file)} />)}</div>}
    {preview && <PreviewDialog activity={preview} onClose={() => { setPreview(null); requestAnimationFrame(() => previewTrigger.current?.focus()); }} />}
    {updatesActivity && <UpdatesDialog activity={updatesActivity} token={token} onClose={() => setUpdatesActivity(null)} />}
    {registrationsActivity && <RegistrationsDialog activity={registrationsActivity} token={token} onClose={() => setRegistrationsActivity(null)} />}
    {confirmAction && <ConfirmDialog action={confirmAction} busy={busyId === confirmAction.activity.id} onClose={() => !busyId && setConfirmAction(null)} onConfirm={executeConfirmed} />}
  </section>;
}

function ActivityCard({ activity, busy, onPreview, onConfirm, onDuplicate, onUpdates, onRegistrations, onImage }: { activity: Activity; busy: boolean; onPreview: (trigger: HTMLButtonElement) => void; onConfirm: (kind: "publish" | "cancel" | "delete") => void; onDuplicate: () => void; onUpdates: () => void; onRegistrations: () => void; onImage: (file: File) => void }) {
  const next = nextSession(activity.sessions);
  const registered = activity.registration_counts?.registered ?? 0;
  const waitlisted = activity.registration_counts?.waitlisted ?? 0;
  const available = activity.max_participants == null ? null : Math.max(0, activity.max_participants - registered);
  return <article tabIndex={0} className={`relative z-0 flex h-full flex-col rounded-3xl border p-5 shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.025] hover:-translate-y-1 hover:shadow-xl focus-visible:z-10 focus-visible:scale-[1.025] focus-visible:-translate-y-1 focus-visible:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 motion-reduce:transform-none motion-reduce:transition-none ${STATUS[activity.status].card}`}>
    <div className="flex items-start justify-between gap-3"><span className={`rounded-full px-3 py-1 text-sm font-black ${STATUS[activity.status].badge}`}>{STATUS[activity.status].label}</span><span className="text-sm font-bold text-slate-600">{activity.subject_name ?? "מקצוע לא זמין"}</span></div>
    <h2 className="mt-4 line-clamp-2 text-2xl font-black text-slate-950">{activity.title || "פעילות ללא כותרת"}</h2>
    {activity.image_url && <img src={activity.image_url} alt={activity.image_alt || activity.title || "תמונת הפעילות"} className="mt-3 h-36 w-full rounded-2xl object-cover" />}
    {(activity.status === "draft" || (activity.status === "published" && registered + waitlisted === 0)) && <label className="mt-3 cursor-pointer rounded-xl border border-violet-300 bg-white/80 px-4 py-2 text-center text-sm font-black text-violet-800">{activity.image_path ? "החלפת תמונת הפעילות" : "הוספת תמונת פעילות"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImage(file); event.currentTarget.value = ""; }} /></label>}
    <DateHighlight activity={activity} session={next} />
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Metric label="מיקום" value={location(activity)} /><Metric label="מחיר" value={activity.is_free ? "ללא עלות" : `${activity.price ?? 0} ₪`} /><Metric label="רשומים" value={String(registered)} /><Metric label="רשימת המתנה" value={String(waitlisted)} /><Metric label="מקומות פנויים" value={available == null ? "—" : String(available)} /><Metric label="מכסה" value={activity.max_participants == null ? "—" : String(activity.max_participants)} /></dl>
    <div className="mt-auto flex flex-wrap gap-2 border-t border-black/10 pt-4" aria-label={`פעולות עבור ${activity.title ?? "הפעילות"}`}>
      {(activity.status === "draft" || (activity.status === "published" && registered + waitlisted === 0)) && <Link href={`/dashboard/mentor/activities/${activity.id}/edit`} className="rounded-xl bg-blue-700 px-4 py-2 font-black text-white">עריכת הפעילות</Link>}
      <button type="button" onClick={(event) => onPreview(event.currentTarget)} className={secondary}>פרטים נוספים</button>
      {activity.status === "draft" && <button type="button" disabled={busy} onClick={() => onConfirm("publish")} className="rounded-xl bg-emerald-700 px-4 py-2 font-black text-white disabled:opacity-50">פרסום הפעילות</button>}
      {activity.status === "published" && registered + waitlisted > 0 && <button type="button" disabled={busy} onClick={onUpdates} className={primary}>עדכונים לנרשמים</button>}
      {activity.status === "published" && registered + waitlisted > 0 && <button type="button" disabled={busy} onClick={onRegistrations} className={secondary}>ניהול הרשמות</button>}
      {activity.status === "published" && <button type="button" disabled={busy} onClick={() => onConfirm("cancel")} className={danger}>ביטול</button>}
      <div className="w-full rounded-xl bg-white/70 p-3"><button type="button" disabled={busy} onClick={onDuplicate} className="rounded-xl bg-violet-700 px-4 py-2 font-black text-white disabled:opacity-50">יצירת פעילות חדשה על בסיס זו</button><p className="mt-2 text-xs leading-5 text-slate-600">תיווצר טיוטה חדשה. הפעילות המקורית לא תשתנה, ויש לבחור תאריך ושעות חדשים.</p></div>
      {(activity.status === "draft" || (activity.status === "cancelled" && (activity.registration_counts?.total ?? 0) === 0)) && <div className="w-full border-t border-red-200 pt-3"><button type="button" disabled={busy} onClick={() => onConfirm("delete")} className={danger}>{activity.status === "draft" ? "מחיקת טיוטה" : "מחיקת פעילות מבוטלת"}</button></div>}
    </div>
  </article>;
}

function RegistrationsDialog({ activity, token, onClose }: { activity: Activity; token: string; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    const response = await fetch(`/api/mentor-activities/${activity.id}/registrations`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setRows(response.ok ? body.registrations ?? [] : []);
    setNotice(response.ok ? "" : body.error ?? "לא ניתן לטעון את ההרשמות.");
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  async function setApproval(row: ActivityRegistration, approved: boolean) {
    if (!row.parentUserId) return;
    const response = await fetch(`/api/mentor-activities/${activity.id}/registrations`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ parentUserId: row.parentUserId, approved }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(body.error ?? "לא ניתן לעדכן את הרשאת הקשר.");
    setRows((current) => current.map((item) => item.parentUserId === row.parentUserId ? { ...item, contactApproved: approved } : item));
    setNotice(approved ? "הטלפון זמין כעת להורה הרשום." : "הרשאת הצגת הטלפון בוטלה.");
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label="ניהול הרשמות" className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><p className="font-bold text-blue-700">ניהול הרשמות</p><h2 className="text-2xl font-black">{activity.title}</h2></div><button type="button" onClick={onClose} aria-label="סגירת חלון ההרשמות" className="grid size-11 place-items-center rounded-full bg-slate-100 text-2xl font-black">×</button></header><div className="space-y-4 p-5">{notice && <p role="status" className="rounded-xl bg-blue-50 p-3 font-bold text-blue-900">{notice}</p>}{loading ? <p>טוען הרשמות...</p> : rows.length ? rows.map((row) => <article key={row.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-3 py-1 text-sm font-black ${row.status === "registered" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{row.status === "registered" ? "רשום/ה" : "רשימת המתנה"}</span><h3 className="mt-3 text-xl font-black">{row.childName}</h3>{row.status === "registered" && <><p className="mt-1">הורה: {row.parentName}</p>{row.parentPhone ? <a dir="ltr" href={`tel:${row.parentPhone}`} className="font-black text-blue-700 underline">{row.parentPhone}</a> : <p className="text-slate-500">לא נשמר מספר טלפון</p>}</>}</div>{activity.contact_phone_visibility === "mentor_approved" && row.status === "registered" && <button type="button" onClick={() => setApproval(row, !row.contactApproved)} className={row.contactApproved ? danger : primary}>{row.contactApproved ? "ביטול הצגת הטלפון" : "אישור הצגת הטלפון להורה"}</button>}</div>{row.status === "waitlisted" && <p className="mt-3 text-sm text-slate-600">פרטי ההורה ייחשפו רק לאחר מעבר להרשמה מאושרת.</p>}</article>) : <p className="rounded-xl bg-slate-50 p-4">אין כרגע הרשמות פעילות.</p>}<button type="button" onClick={onClose} className={primary}>סגירה</button></div></section></div>;
}

function ConfirmDialog({ action, busy, onClose, onConfirm }: { action: NonNullable<ConfirmAction>; busy: boolean; onClose: () => void; onConfirm: (reason?: string) => void }) {
  const [reason, setReason] = useState("");
  const copy = action.kind === "publish" ? { title: "פרסום הפעילות", text: "הפעילות תופיע למשפחות ותהיה פתוחה להרשמה. לפרסם עכשיו?", confirm: "אישור ופרסום" } : action.kind === "cancel" ? { title: "ביטול הפעילות", text: "הפעילות תיסגר להרשמה ותסומן כמבוטלת. לבטל עכשיו?", confirm: "אישור ביטול" } : { title: "מחיקת הטיוטה", text: "הטיוטה וכל המפגשים שלה יימחקו לצמיתות. למחוק עכשיו?", confirm: "אישור מחיקה" };
  return <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="alertdialog" aria-modal="true" aria-labelledby="activity-confirm-title" className="w-full max-w-lg rounded-3xl bg-white p-6 text-right shadow-2xl"><h2 id="activity-confirm-title" className="text-2xl font-black">{copy.title}</h2><p className="mt-3 leading-7 text-slate-700">{copy.text}</p>{action.kind === "cancel" && <label className="mt-4 grid gap-2 font-bold">סיבת הביטול לנרשמים<textarea required minLength={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28 rounded-xl border border-slate-300 p-3" /></label>}<div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={onClose} className={secondary}>חזרה</button><button type="button" onClick={() => onConfirm(reason)} disabled={busy || (action.kind === "cancel" && reason.trim().length < 3)} className={action.kind === "publish" ? primary : danger}>{busy ? "מבצע..." : copy.confirm}</button></div></div></div>;
}

function UpdatesDialog({ activity, token, onClose }: { activity: Activity; token: string; onClose: () => void }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [updates, setUpdates] = useState<ActivityUpdate[]>([]);
  const [scope, setScope] = useState<"all_active" | "parent">("all_active");
  const [recipient, setRecipient] = useState("");
  const [updateType, setUpdateType] = useState("operational");
  const [message, setMessage] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("15");
  const [proposedStartAt, setProposedStartAt] = useState("");
  const [proposedEndAt, setProposedEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function load() {
    const response = await fetch(`/api/mentor-activities/${activity.id}/updates`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error);
    setRecipients(body.recipients ?? []);
    setUpdates(body.updates ?? []);
  }

  useEffect(() => { void load().catch(() => setNotice({ type: "error", text: "לא ניתן לטעון את העדכונים כרגע." })); }, []); // activity is fixed for this dialog

  async function sendUpdate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/mentor-activities/${activity.id}/updates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientScope: scope,
          recipientParentUserId: scope === "parent" ? recipient : null,
          updateType,
          message,
          delayMinutes: updateType === "delay" ? Number(delayMinutes) : null,
          proposedStartAt: updateType === "postponement" ? new Date(proposedStartAt).toISOString() : null,
          proposedEndAt: updateType === "postponement" ? new Date(proposedEndAt).toISOString() : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      setMessage("");
      setNotice({ type: "success", text: "העדכון נשלח לנמענים." });
      await load();
    } catch {
      setNotice({ type: "error", text: "לא ניתן לשלוח את העדכון. בדקו את הפרטים ונסו שוב." });
    } finally { setBusy(false); }
  }

  return <div role="presentation" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="activity-updates-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 text-right shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><h2 id="activity-updates-title" className="text-2xl font-black">עדכונים לנרשמים</h2><p className="mt-1 text-slate-600">{activity.title}</p></div><button type="button" onClick={onClose} className={secondary}>סגירה</button></div>
    {notice && <p role={notice.type === "error" ? "alert" : "status"} className={`mt-4 rounded-xl p-3 font-bold ${notice.type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{notice.text}</p>}
    <form onSubmit={sendUpdate} className="mt-6 grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 font-bold">נמענים<select value={scope} onChange={(event) => setScope(event.target.value as "all_active" | "parent")} className="min-h-12 rounded-xl border bg-white p-3"><option value="all_active">כל הרשומים ורשימת ההמתנה</option><option value="parent">הורה מסוים</option></select></label>{scope === "parent" && <label className="grid gap-1 font-bold">בחירת הורה<select required value={recipient} onChange={(event) => setRecipient(event.target.value)} className="min-h-12 rounded-xl border bg-white p-3"><option value="">בחרו לפי שם הילד</option>{recipients.map((item) => <option key={item.parentUserId} value={item.parentUserId}>{item.childFirstNames.join(", ")}</option>)}</select></label>}</div>
      <label className="grid gap-1 font-bold">סוג העדכון<select value={updateType} onChange={(event) => setUpdateType(event.target.value)} className="min-h-12 rounded-xl border bg-white p-3"><option value="operational">עדכון תפעולי</option><option value="reminder">תזכורת</option><option value="equipment">ציוד נדרש</option><option value="meeting_point">נקודת מפגש</option><option value="delay">עיכוב</option><option value="postponement">הצעת דחייה</option><option value="general">הודעה כללית</option></select></label>
      {updateType === "delay" && <label className="grid gap-1 font-bold">משך העיכוב בדקות<input type="number" min={1} max={240} required value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value)} className="min-h-12 rounded-xl border bg-white p-3" /></label>}
      {updateType === "postponement" && <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 font-bold">מועד התחלה מוצע<input type="datetime-local" required value={proposedStartAt} onChange={(event) => setProposedStartAt(event.target.value)} className="min-h-12 rounded-xl border bg-white p-3" /></label><label className="grid gap-1 font-bold">מועד סיום מוצע<input type="datetime-local" required value={proposedEndAt} onChange={(event) => setProposedEndAt(event.target.value)} className="min-h-12 rounded-xl border bg-white p-3" /></label></div>}
      <label className="grid gap-1 font-bold">תוכן ההודעה<textarea required minLength={1} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-28 rounded-xl border bg-white p-3" /></label>
      <button type="submit" disabled={busy || !message.trim() || (scope === "parent" && !recipient)} className={primary}>{busy ? "שולח..." : "שליחת העדכון"}</button>
    </form>
    <section className="mt-6"><h3 className="text-xl font-black">עדכונים שנשלחו</h3><div className="mt-3 grid gap-3">{updates.length ? updates.map((update) => <article key={update.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm font-bold text-slate-500"><span>{update.recipient_scope === "all_active" ? "לכל הנרשמים" : "להורה מסוים"}</span><time>{new Date(update.created_at).toLocaleString("he-IL")}</time></div><p className="mt-2 whitespace-pre-wrap text-slate-800">{update.body}</p></article>) : <p className="rounded-xl bg-slate-50 p-4 text-slate-600">טרם נשלחו עדכונים.</p>}</div></section>
  </section></div>;
}
function PreviewDialog({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const audience = audienceText(activity);
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  const items: ActivityInfoItem[] = [
    { kind: "subject", title: "מקצוע", content: activity.subject_name ?? "מקצוע לא זמין" }, { kind: "location", title: "מיקום", content: location(activity) },
    { kind: "audience", title: "קהל מתאים", content: audience }, { kind: "participants", title: "מספר משתתפים", content: `${activity.min_participants ?? "—"}–${activity.max_participants ?? "—"}` },
    { kind: "equipment", title: "ציוד", content: activity.equipment || "לא נדרש להביא ציוד." }, { kind: "pickup", title: "איסוף", content: pickupText(activity) },
    { kind: "accessibility", title: "נגישות והתאמות", content: accessibilityText(activity) }, { kind: "cancellation", title: "מדיניות ביטול", content: activity.cancellation_policy || "לא צוינה מדיניות ביטול" },
    { kind: "price", title: "מחיר", content: activity.is_free ? "ללא עלות" : `${activity.price ?? 0} ₪` }, { kind: "date", title: "מועד", content: nextSession(activity.sessions) ? fullSession(nextSession(activity.sessions)!) : "טרם נקבע מועד עתידי" },
    { kind: "description", title: "תיאור", content: activity.description || "טרם נוסף תיאור" },
  ];
  return <div role="presentation" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article role="dialog" aria-modal="true" aria-labelledby="activity-preview-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white text-right shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white p-5"><div><span className={"rounded-full px-3 py-1 text-sm font-black " + STATUS[activity.status].badge}>{STATUS[activity.status].label}</span><h2 id="activity-preview-title" className="mt-3 text-3xl font-black">{activity.title || "פעילות ללא כותרת"}</h2></div><button type="button" autoFocus onClick={onClose} aria-label="סגירת חלון פרטי הפעילות" className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-3xl leading-none text-slate-700 hover:bg-slate-100">×</button></header><div className="p-5"><DateHighlight activity={activity} session={nextSession(activity.sessions)} /><div className="mt-6"><ActivityInfoGrid items={items} /></div><section className="mt-6 rounded-2xl bg-slate-50 p-4"><h3 className="text-xl font-black">כל מועדי הפעילות</h3><div className="mt-3 space-y-2">{activity.sessions.length ? activity.sessions.map((session, index) => <p key={session.id} className="rounded-xl bg-white p-3 font-bold">{index + 1}. {fullSession(session)}</p>) : <p>טרם נקבעו מועדים.</p>}</div></section><button type="button" onClick={onClose} className={primary + " mt-7"}>סגירת הפרטים</button></div></article></div>;
}
function audienceText(activity: Activity) { const ages = activity.minimum_age || activity.maximum_age ? "גיל " + String(activity.minimum_age ?? "ללא מינימום") + "–" + String(activity.maximum_age ?? "ללא מקסימום") : ""; const grades = (activity.suitable_grades ?? []).map((grade) => GRADE_NAMES[grade] ?? grade).join(", "); return [ages, grades].filter(Boolean).join(" · ") || "מתאים לכל הגילים."; }
function pickupText(activity: Activity) { if (!(activity.pickup_options ?? []).length) return "אין אפשרות איסוף."; return activity.pickup_options.map((option) => PICKUP_NAMES[option] ?? option).join(", ") + (activity.pickup_details ? " · " + activity.pickup_details : ""); }
function accessibilityText(activity: Activity) { if (!(activity.accessibility_options ?? []).length) return "לא סומנו התאמות נגישות."; return activity.accessibility_options.map((option) => ACCESSIBILITY_NAMES[option] ?? option).join(", ") + (activity.accessibility_other ? " · " + activity.accessibility_other : ""); }
function fullSession(session: Session) { const start = new Date(session.starts_at); const end = new Date(session.ends_at); const base = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(start) + "–" + new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(end); return session.estimated_overrun === "none" ? base : base + (session.estimated_overrun === "5_10_minutes" ? " · סיום משוער עד 5–10 דקות נוספות" : " · סיום משוער עד 15–20 דקות נוספות"); }
const GRADE_NAMES: Record<string, string> = Object.fromEntries(["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳", "י״א", "י״ב"].map((label, index) => ["grade_" + (index + 1), label]));
const PICKUP_NAMES: Record<string, string> = { school: "בית ספר", after_school: "צהרון", home: "בית", other: "מקום אחר" };
const ACCESSIBILITY_NAMES: Record<string, string> = { wheelchair: "נגישות לכיסא גלגלים", accessible_restrooms: "שירותים נגישים", accessible_parking: "חניה נגישה", visual_impairment: "התאמה ללקות ראייה", hearing_impairment: "התאמה ללקות שמיעה", written_visual_instructions: "הוראות כתובות או חזותיות", sensory_friendly: "סביבה מותאמת לרגישות חושית", companion_allowed: "השתתפות עם מלווה", other: "התאמות אחרות", unknown: "לא ידוע – מומלץ ליצור קשר לפני ההרשמה" };
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/75 p-3"><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-black text-slate-900">{value}</dd></div>; }
function DateHighlight({ activity, session }: { activity: Activity; session: Session | null }) {
  if (!session) return <div className="mt-4 rounded-2xl border border-slate-300 bg-white p-4 font-bold text-slate-600">אין מפגש עתידי מתוכנן</div>;
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(start);
  const date = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(start);
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(start) + "–" + new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(end);
  const overrun = session.estimated_overrun === "5_10_minutes" ? "סיום משוער: עד 5–10 דקות נוספות" : session.estimated_overrun === "15_20_minutes" ? "סיום משוער: עד 15–20 דקות נוספות" : null;
  return <div className="mt-4 rounded-2xl border border-blue-300 bg-blue-700 p-4 text-white shadow-md">{activity.sessions.length > 1 && <p className="text-sm font-black text-blue-100">המפגש הקרוב · {activity.sessions.length} מפגשים בסדרה</p>}<p className="mt-1 text-2xl font-black">{weekday}</p><p className="text-base font-bold text-blue-100">{date}</p><p className="mt-2 text-3xl font-black tracking-tight" dir="ltr">{time}</p>{overrun && <p className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold">{overrun}</p>}</div>;
}
function nextSession(sessions: Session[]) { const now = Date.now(); return [...(sessions ?? [])].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).find((session) => Date.parse(session.ends_at) >= now) ?? null; }function location(activity: Activity) { const base = activity.location_type ? LOCATION[activity.location_type] ?? "מיקום אחר" : "טרם נקבע"; return activity.venue_name ? `${base} · ${activity.venue_name}` : base; }
const primary = "rounded-xl bg-blue-700 px-4 py-2 font-black text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-800 transition hover:border-blue-400 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const danger = "rounded-xl border border-red-300 bg-white px-4 py-2 font-black text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50";
