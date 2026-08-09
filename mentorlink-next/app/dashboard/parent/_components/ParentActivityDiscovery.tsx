"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PublicMentorDirectory from "@/app/_components/PublicMentorDirectory";
import type { PublicMentor } from "@/lib/public-mentor-core";

type Child = { id: string; first_name: string; grade: string | null; birth_date: string | null; school_name: string | null; accommodation_notes: string | null; interests: { subjectId: number; name?: string; category?: string }[] };
type RegistrationStatus = { id: string; activity_id: string; child_id: string; child_first_name: string; status: string };
type Session = { starts_at: string; ends_at: string; estimated_overrun: string };
type Activity = {
  id: string; title: string; description: string; subjectId: number | null; subjectName: string; mentorName: string; mentorBookingId: string | null; city: string | null;
  locationType: string; venueName: string | null; locationDetails: string | null; minParticipants: number; maxParticipants: number;
  minimumAge: number | null; maximumAge: number | null; suitableGrades: string[]; isFree: boolean; price: number;
  equipment: string | null; accessibilityOptions: string[]; accessibilityOther: string | null; pickupOptions: string[];
  pickupDetails: string | null; cancellationPolicy: string | null; registrationDeadline: string; sessions: Session[];
  imageUrl: string | null; imageAlt: string | null;
  registrationOpen: boolean;
  allChildrenRegistered: boolean; registeredChildNames: string[];
  registeredCount: number; waitlistedCount: number; availablePlaces: number;
  contactPhoneVisibility: string; mentorPhone: string | null;
};

const gradeLabels: Record<string, string> = { kindergarten: "גן חובה", ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`grade_${index + 1}`, index < 9 ? `${String.fromCharCode(1488 + index)}׳` : ["י׳", "י״א", "י״ב"][index - 9]])) };
const locationLabels: Record<string, string> = { mentor_home: "בית החונך", mentee_home: "בית החניך", school: "בית ספר", public_place: "מקום ציבורי", sports_park: "ספורטק", community_center: "מרכז קהילתי", sports_complex: "מתחם ספורט", online: "מקוון", other: "מקום אחר" };
const accessibilityLabels: Record<string, string> = { wheelchair: "נגישות לכיסא גלגלים", accessible_restroom: "שירותים נגישים", accessible_parking: "חניה נגישה", visual_impairment: "התאמה ללקות ראייה", hearing_impairment: "התאמה ללקות שמיעה", written_visual_instructions: "הוראות כתובות או חזותיות", sensory_friendly: "סביבה מותאמת לרגישות חושית", companion_allowed: "אפשרות למלווה", unknown: "מומלץ ליצור קשר לפני ההרשמה" };
const OPEN_ACTIVITY_EVENT = "mentorlink:open-activity";

export default function ParentActivityDiscovery({ mentors }: { mentors: PublicMentor[] }) {
  const [activities, setActivities] = useState<Activity[]>([]), [children, setChildren] = useState<Child[]>([]), [registrations, setRegistrations] = useState<RegistrationStatus[]>([]);
  const [selectedChild, setSelectedChild] = useState("all"), [details, setDetails] = useState<Activity | null>(null), [registering, setRegistering] = useState<Activity | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [showAddChild, setShowAddChild] = useState(false), [newChild, setNewChild] = useState({ firstName: "", grade: "" });

  async function token() { return (await supabase.auth.getSession()).data.session?.access_token ?? ""; }
  async function load() {
    setLoading(true); const accessToken = await token();
    const [activityResponse, childResponse, registrationResponse] = await Promise.all([
      fetch("/api/parent/activities", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
      fetch("/api/parent/children", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
      fetch("/api/parent/activity-registrations", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }),
    ]);
    if (activityResponse.ok) setActivities((await activityResponse.json()).activities ?? []); else { const body = await activityResponse.json().catch(() => ({})); setMessage(body.error ?? "לא ניתן לטעון את הפעילויות כרגע."); }
    if (childResponse.ok) setChildren((await childResponse.json()).children ?? []);
    if (registrationResponse.ok) setRegistrations((await registrationResponse.json()).registrations ?? []); else setRegistrations([]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    function openActivity(activityId: string | null) {
      if (!activityId) return;
      const activity = activities.find((item) => item.id === activityId);
      if (activity) setDetails(activity);
    }
    function openFromHash() {
      const match = window.location.hash.match(/^#activity-(.+)$/);
      openActivity(match?.[1] ?? null);
    }
    function openFromEvent(event: Event) {
      openActivity((event as CustomEvent<{ activityId?: string }>).detail?.activityId ?? null);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener(OPEN_ACTIVITY_EVENT, openFromEvent);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener(OPEN_ACTIVITY_EVENT, openFromEvent);
    };
  }, [activities]);
  const registrationState = useMemo(() => {
    return registrations.reduce<Map<string, Map<string, string>>>((map, row) => {
      const activityMap = map.get(row.activity_id) ?? new Map<string, string>();
      activityMap.set(row.child_id, row.status);
      map.set(row.activity_id, activityMap);
      return map;
    }, new Map());
  }, [registrations]);
  const visible = useMemo(() => { const child = children.find((item) => item.id === selectedChild); if (!child) return activities; const interestIds = new Set(child.interests?.map((interest) => interest.subjectId) ?? []); const score = (activity: Activity) => Number(interestIds.has(activity.subjectId ?? -1)) * 4 + Number(Boolean(child.grade && activity.suitableGrades?.includes(child.grade))) * 2 + Number(!activity.suitableGrades?.length); return [...activities].sort((left, right) => score(right) - score(left)); }, [activities, children, selectedChild]);
  const recommendedMentors = useMemo(() => { const child = children.find((item) => item.id === selectedChild); if (!child?.grade) return mentors; const label = gradeLabels[child.grade]; return [...mentors].sort((left, right) => Number(right.ageGroups.some((value) => value.includes(label))) - Number(left.ageGroups.some((value) => value.includes(label)))); }, [children, mentors, selectedChild]);
  const mentorActivities = useMemo(() => activities.reduce<Record<string, {id:string;title:string;subjectName:string;nextStartAt:string|null;registrationOpen:boolean}[]>>((groups, activity) => { if (!activity.mentorBookingId) return groups; (groups[activity.mentorBookingId] ??= []).push({ id: activity.id, title: activity.title, subjectName: activity.subjectName, nextStartAt: activity.sessions[0]?.starts_at ?? null, registrationOpen: activity.registrationOpen }); return groups; }, {}), [activities]);
  const activityChildStatus = (activityId: string, childId: string) => registrationState.get(activityId)?.get(childId) ?? null;

  async function addChild() {
    setBusy(true); setMessage(""); const accessToken = await token();
    const response = await fetch("/api/parent/children", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(newChild) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(body.error ?? "לא ניתן לשמור את פרטי הילד/ה.");
    setChildren((current) => [...current, body.child]); setNewChild({ firstName: "", grade: "" }); setShowAddChild(false); setSelectedIds([body.child.id]);
  }
  async function register() {
    if (!registering || !selectedIds.length) return setMessage("יש לבחור לפחות ילד אחד.");
    setBusy(true); setMessage(""); const accessToken = await token();
    const response = await fetch("/api/parent/activity-registrations", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ activityId: registering.id, childIds: selectedIds, idempotencyKeys: selectedIds.map(() => crypto.randomUUID()) }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(body.error ?? "לא ניתן להשלים את ההרשמה.");
    const waiting = (body.registrations ?? []).filter((item: { status: string }) => item.status === "waitlisted").length;
    setMessage(waiting ? `ההרשמה הושלמה. ${waiting} מהילדים נוספו לרשימת ההמתנה.` : "ההרשמה הושלמה בהצלחה!");
    setRegistering(null); setSelectedIds([]); await load();
  }

  return <section aria-labelledby="activities-title" className="mt-8">
    <div className="overflow-hidden rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-700 via-blue-700 to-cyan-600 p-6 text-white shadow-xl sm:p-9">
      <div className="grid items-center gap-7 md:grid-cols-[1fr_auto]"><div><p className="font-black text-cyan-100">הבמה המרכזית</p><h1 id="activities-title" className="mt-2 text-3xl font-black sm:text-5xl">פעילויות חדשות וקרובות</h1><p className="mt-3 max-w-2xl text-lg leading-8 text-blue-50">מגלים, מתנסים ונפגשים. בחרו ילד כדי לראות פעילויות שמתאימות במיוחד עבורו.</p></div><ActivityIllustration /></div>
      <div className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur"><strong>עבור מי מחפשים?</strong><button onClick={() => setSelectedChild("all")} className={selector(selectedChild === "all")}>כל הילדים</button>{children.map((child) => <button key={child.id} onClick={() => setSelectedChild(child.id)} className={selector(selectedChild === child.id)}>{child.first_name}</button>)}<button onClick={() => setShowAddChild(true)} className="rounded-xl border border-white/60 px-4 py-2 font-bold hover:bg-white/15">+ הוספת ילד/ה</button></div>
    </div>
    {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-4 font-bold text-blue-900">{message}</p>}
    {loading ? <p className="py-12 text-center font-bold text-slate-500">טוען פעילויות...</p> : visible.length ? <div className="mt-7 grid auto-rows-fr gap-6 md:grid-cols-2 xl:grid-cols-3">{visible.map((activity) => <ActivityCard key={activity.id} activity={activity} onDetails={() => setDetails(activity)} onRegister={() => { setRegistering(activity); setSelectedIds(selectedChild === "all" ? [] : [selectedChild]); setMessage(""); }} />)}</div> : <div className="mt-7 rounded-3xl border border-dashed border-blue-300 bg-white p-10 text-center"><p className="text-xl font-black">עדיין אין פעילות מתאימה להצגה</p><p className="mt-2 text-slate-600">אפשר לבחור ילד אחר או לחזור בקרוב לפעילויות חדשות.</p></div>}
    <div className="mt-6 flex justify-end"><Link href="/dashboard/parent/activities" className="font-black text-blue-700 underline">הפעילויות וההרשמות שלי</Link></div>
    {details && <Modal title={details.title} onClose={() => setDetails(null)}><ActivityDetails activity={details} />{details.registeredChildNames.length>0&&<p className="mt-5 rounded-xl bg-green-50 p-4 font-black text-green-900">{registeredChildrenLabel(details.registeredChildNames)}</p>}<button disabled={!details.registrationOpen||details.allChildrenRegistered} onClick={() => { setDetails(null); setRegistering(details); }} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white disabled:bg-slate-300">{!details.registrationOpen?"ההרשמה לפעילות נסגרה":details.allChildrenRegistered?"כל הילדים כבר רשומים לפעילות":"רישום ילד/ה נוסף/ת"}</button></Modal>}
    {registering && <Modal title="את מי תרצו לרשום?" onClose={() => setRegistering(null)}><p className="mb-4 text-slate-600">כל ילד תופס מקום נפרד. ניתן לבחור ילד אחד או כמה ילדים.</p>{children.length ? <div className="grid gap-3">{children.map((child) => {
      const status = activityChildStatus(registering.id, child.id);
      const locked = status === "registered" || status === "waitlisted";
      const disableReason = status === "registered" ? "כבר רשום/ה" : status === "waitlisted" ? "כבר ברשימת ההמתנה" : null;
      return <label key={child.id} className={`flex items-center gap-3 rounded-xl border p-4 ${locked ? "bg-slate-100 opacity-70" : "cursor-pointer"}`}>
        <input type="checkbox" disabled={locked} checked={selectedIds.includes(child.id)} onChange={() => setSelectedIds((current) => current.includes(child.id) ? current.filter((id) => id !== child.id) : [...current, child.id])} />
        <span className="font-black">{child.first_name}</span>
        <span className="text-sm text-slate-500">{child.grade ? `כיתה ${gradeLabels[child.grade]}` : "ללא כיתה"}</span>
        {disableReason && <span className="text-sm font-black text-slate-700">{disableReason}</span>}
      </label>;
    })}</div> : <p className="rounded-xl bg-amber-50 p-4">לפני ההרשמה יש להוסיף ילד/ה לחשבון.</p>}<button onClick={() => setShowAddChild(true)} className="mt-4 font-bold text-blue-700 underline">+ הוספת ילד/ה</button>{(() => {
      const selectableIds = selectedIds.filter((id) => {
        const status = activityChildStatus(registering.id, id);
        return status !== "registered" && status !== "waitlisted";
      });
      const canSubmit = selectableIds.length > 0;
      return <>
        <button disabled={busy || !canSubmit} onClick={register} className="mt-5 w-full rounded-xl bg-green-600 px-5 py-3 font-black text-white disabled:bg-slate-300">{busy ? "מבצע הרשמה..." : "אישור הרשמה"}</button>
        {registering && !canSubmit && <p className="mt-3 text-sm font-bold text-slate-700">הילדים כבר רשומים לפעילות זו.</p>}
      </>;
    })()}</Modal>}
    {showAddChild && <Modal title="הוספת ילד/ה" onClose={() => setShowAddChild(false)}><div className="grid gap-4"><label className="grid gap-2 font-bold">שם פרטי<input value={newChild.firstName} onChange={(event) => setNewChild({ ...newChild, firstName: event.target.value })} maxLength={60} className="rounded-xl border p-3" /></label><label className="grid gap-2 font-bold">כיתה (לא חובה)<select value={newChild.grade} onChange={(event) => setNewChild({ ...newChild, grade: event.target.value })} className="rounded-xl border bg-white p-3"><option value="">לא צוינה</option>{Object.entries(gradeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={busy || !newChild.firstName.trim()} onClick={addChild} className="rounded-xl bg-blue-700 p-3 font-black text-white disabled:bg-slate-300">שמירת הילד/ה</button></div></Modal>}
    <section id="mentor-search" className="mt-14 scroll-mt-24 rounded-[2rem] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-6 shadow-sm sm:p-9"><p className="font-black text-cyan-700">ליווי אישי</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">חונכים מומלצים{selectedChild !== "all" ? ` עבור ${children.find((child) => child.id === selectedChild)?.first_name ?? "הילד/ה"}` : ""}</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">מחפשים עזרה קבועה או מפגש אישי? אפשר לבחור חונך לפי תחום, עיר, גיל החונך ואופן המפגש.</p><div className="mt-7"><PublicMentorDirectory mentors={recommendedMentors} mentorActivities={mentorActivities} expandableFilters/></div></section>
  </section>;
}

function ActivityCard({ activity, onDetails, onRegister }: { activity: Activity; onDetails: () => void; onRegister: () => void }) { const first = activity.sessions[0], canRegister=activity.registrationOpen&&!activity.allChildrenRegistered; return <article id={`activity-${activity.id}`} className="flex h-full scroll-mt-24 flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"><div className="grid min-h-40 place-items-center overflow-hidden bg-gradient-to-br from-cyan-100 via-blue-100 to-violet-100">{activity.imageUrl?<img src={activity.imageUrl} alt={activity.imageAlt||activity.title} className="h-44 w-full object-cover"/>:<ActivityIllustration small />}</div><div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-800">{activity.subjectName}</span><span className={`rounded-full px-3 py-1 text-sm font-black ${!activity.registrationOpen ? "bg-slate-200 text-slate-700" : activity.availablePlaces ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{!activity.registrationOpen ? "ההרשמה נסגרה" : activity.availablePlaces ? `${activity.availablePlaces} מקומות פנויים` : "רשימת המתנה"}</span></div><h2 className="mt-4 text-2xl font-black">{activity.title}</h2><p className="mt-1 text-slate-600">עם {activity.mentorName}</p>{activity.registeredChildNames.length>0&&<p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-black text-green-900">{registeredChildrenLabel(activity.registeredChildNames)}</p>}{first && <div className="mt-4 rounded-2xl bg-blue-700 p-4 text-white"><p className="text-sm font-bold text-blue-100">המפגש הקרוב</p><p className="mt-1 text-lg font-black">{dateLabel(first.starts_at)}</p><p className="text-2xl font-black">{timeLabel(first.starts_at)}–{timeLabel(first.ends_at)}</p></div>}<div className="mt-4 grid grid-cols-2 gap-2 text-sm"><Info label="מיקום" value={activity.venueName || locationLabels[activity.locationType] || "יעודכן בהמשך"} /><Info label="מחיר" value={activity.isFree ? "ללא עלות" : `${activity.price} ₪`} /></div><div className="mt-auto grid grid-cols-2 gap-3 pt-5"><button onClick={onDetails} className="rounded-xl border border-blue-300 px-4 py-3 font-black text-blue-800">פרטים נוספים</button><button disabled={!canRegister} onClick={onRegister} className="rounded-xl bg-green-600 px-4 py-3 font-black text-white disabled:bg-slate-300">{!activity.registrationOpen?"הרשמה סגורה":activity.allChildrenRegistered?"הילדים כבר רשומים":"רישום ילד/ה נוסף/ת"}</button></div></div></article>; }
function ActivityDetails({ activity }: { activity: Activity }) { return <div className="grid gap-3 sm:grid-cols-2"><Detail title="תיאור" value={activity.description} wide /><Detail title="מועד" value={activity.sessions.map((session) => `${dateLabel(session.starts_at)}, ${timeLabel(session.starts_at)}–${timeLabel(session.ends_at)}`).join("\n")} wide /><Detail title="מפעיל/ת הפעילות" value={activity.mentorName} /><Detail title="מיקום" value={[locationLabels[activity.locationType], activity.venueName, activity.locationDetails].filter(Boolean).join(" · ")} /><Detail title="קהל מתאים" value={audience(activity)} /><Detail title="משתתפים" value={`${activity.registeredCount} רשומים · ${activity.availablePlaces} פנויים מתוך ${activity.maxParticipants}`} /><Detail title="ציוד" value={activity.equipment || "לא נדרש להביא ציוד"} /><Detail title="איסוף" value={activity.pickupOptions?.length ? `${activity.pickupOptions.join(", ")}${activity.pickupDetails ? ` · ${activity.pickupDetails}` : ""}` : "לא מוצע איסוף"} /><Detail title="נגישות והתאמות" value={[...(activity.accessibilityOptions ?? []).map((value) => accessibilityLabels[value] ?? value), activity.accessibilityOther].filter(Boolean).join(", ") || "לא סומנו התאמות נגישות"} /><Detail title="טלפון לחונך" value={activity.mentorPhone || (activity.contactPhoneVisibility === "registered_parents" ? "יוצג לאחר הרשמה מאושרת" : activity.contactPhoneVisibility === "mentor_approved" ? "יוצג לאחר אישור החונך" : "אינו מוצג")} /><Detail title="מדיניות ביטול" value={activity.cancellationPolicy || "לא צוינה מדיניות מיוחדת"} /><Detail title="מחיר" value={activity.isFree ? "ללא עלות" : `${activity.price} ₪`} /></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]); return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><h2 className="text-2xl font-black">{title}</h2><button onClick={onClose} aria-label="סגירת החלון" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-2xl font-black">×</button></header><div className="p-5 sm:p-7">{children}</div></section></div>; }
function Detail({ title, value, wide }: { title: string; value: string; wide?: boolean }) { return <div className={`rounded-2xl border border-blue-100 bg-blue-50/60 p-4 ${wide ? "sm:col-span-2" : ""}`}><h3 className="font-black text-blue-900">{title}</h3><p className="mt-1 whitespace-pre-line leading-7 text-slate-700">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">{label}</span><strong className="block">{value}</strong></div>; }
function ActivityIllustration({ small = false }: { small?: boolean }) { return <svg aria-hidden="true" viewBox="0 0 180 110" className={small ? "h-28 w-44" : "h-36 w-56"}><circle cx="48" cy="43" r="18" fill="#2563eb"/><circle cx="125" cy="40" r="17" fill="#7c3aed"/><path d="M25 94c2-29 13-42 31-42s29 13 31 42" fill="#38bdf8"/><path d="M99 94c2-28 13-41 29-41s28 13 30 41" fill="#a78bfa"/><path d="M78 49l21 13M82 67l17-5" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round"/><circle cx="91" cy="64" r="8" fill="#f97316"/></svg>; }
function audience(activity: Activity) { const parts = []; if (activity.minimumAge || activity.maximumAge) parts.push(`גיל ${activity.minimumAge ?? ""}–${activity.maximumAge ?? ""}`); if (activity.suitableGrades?.length) parts.push(`כיתות ${activity.suitableGrades.map((grade) => gradeLabels[grade] ?? grade).join(", ")}`); return parts.join(" · ") || "מתאים לכל הגילים"; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function timeLabel(value: string) { return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function selector(active: boolean) { return `rounded-xl px-4 py-2 font-black transition ${active ? "bg-white text-blue-800 shadow" : "bg-white/10 text-white hover:bg-white/20"}`; }
function registeredChildrenLabel(names: string[]) { if(names.length===1)return `${names[0]} כבר רשום/ה לפעילות`; return `${names.slice(0,-1).join(", ")} ו${names.at(-1)} כבר רשומים לפעילות`; }
