"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isUpcomingApprovedMeeting, newestFirst, requiresMentorAction, waitsForParentAction } from "@/lib/mentor-dashboard-status";

type Slot = { startAt: string; meetingMode: string; durations: number[] };
type Meeting = {
  id: string;
  mentor_display_name?: string;
  parent_display_name?: string;
  subject: string;
  child_first_name: string;
  child_grade_or_age: string;
  help_goal: string;
  meeting_mode: string;
  requested_start_at: string;
  requested_duration_minutes: number;
  parent_message: string | null;
  status: string;
  mentor_response: string | null;
  proposed_start_at: string | null;
  proposed_duration_minutes: number | null;
  confirmed_start_at: string | null;
  confirmed_end_at: string | null;
  confirmed_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  preparation_notes: string | null;
  equipment_notes: string | null;
  meeting_location: string | null;
  participant_names: string[];
  contact_phone: string | null;
};

type MentorMeetingView = "mentor-action" | "waiting-parent" | "upcoming-approved" | "history";
type ParentMeetingView = "requests" | "meetings" | "history";

export default function MeetingRequestsPanel({ role, view = "mentor-action" }: { role: "parent" | "mentor"; view?: MentorMeetingView }) {
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<Meeting[]>([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [parentView, setParentView] = useState<ParentMeetingView>("meetings");

  const load = useCallback(async (accessToken: string) => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/meeting-requests", {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("MEETINGS_LOAD_FAILED");
      setRequests(body.requests ?? []);
      const bookingId = body.schedulingMentorBookingId ?? "";
      if (role === "mentor" && bookingId) {
        const slotsResponse = await fetch(`/api/meeting-requests/available-slots?mentor=${bookingId}`);
        const slotsBody = await slotsResponse.json().catch(() => ({}));
        if (slotsResponse.ok) setSlots(slotsBody.slots ?? []);
      }
      const notificationResponse = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      if (notificationResponse.ok) {
        const notificationBody = await notificationResponse.json().catch(() => ({}));
        setUnreadCount(notificationBody.unreadCount ?? 0);
      }
      setLoadState("loaded");
    } catch {
      setLoadState("error");
    }
  }, [role]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token ?? "";
      setToken(accessToken);
      if (accessToken) void load(accessToken); else setLoadState("error");
    });
  }, [load]);

  async function act(id: string, action: string, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/meeting-requests/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "הבקשה עודכנה." : body.error ?? "לא ניתן לעדכן את הבקשה.");
      if (response.ok) await load(token);
    } finally {
      setBusyId("");
    }
  }

  async function proposeNext(item: Meeting) {
    const selection = alternatives[item.id];
    if (!selection) {
      setMessage("יש לבחור מועד חלופי.");
      return;
    }
    const [proposedStartAt, durationText] = selection.split("|");
    if (!window.confirm(`להציע את המועד ${formatDate(proposedStartAt)}?`)) return;
    setBusyId(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/meeting-requests/${item.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "propose_alternative",
          proposedStartAt,
          proposedDurationMinutes: Number(durationText),
        }),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "המועד החלופי הוצע." : body.error ?? "לא ניתן להציע את המועד.");
      if (response.ok) await load(token);
    } finally {
      setBusyId("");
    }
  }

  async function updateDetails(item: Meeting) {
    const preparationNotes=window.prompt("מה צריך להכין לפגישה?",item.preparation_notes??""); if(preparationNotes===null)return;
    const equipmentNotes=window.prompt("מה צריך להביא?",item.equipment_notes??""); if(equipmentNotes===null)return;
    const meetingLocation=window.prompt("מיקום או קישור למפגש",item.meeting_location??""); if(meetingLocation===null)return;
    const participants=window.prompt("שמות ילדים נוספים שתואמו עם הוריהם (מופרדים בפסיקים)",(item.participant_names??[]).join(", ")); if(participants===null)return;
    const saveAsTemplate=window.confirm("לשמור את פרטי ההכנה גם כתבנית לפגישות הבאות בתחום הזה?");
    setBusyId(item.id);
    const response=await fetch(`/api/meeting-requests/${item.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"update_details",preparationNotes,equipmentNotes,meetingLocation,participantNames:participants.split(",").map(v=>v.trim()).filter(Boolean),saveAsTemplate})});
    setMessage(response.ok?"פרטי המפגש עודכנו.":"לא ניתן לעדכן את פרטי המפגש."); if(response.ok)await load(token); setBusyId("");
  }

  const groups = useMemo(() => groupParentRequests(requests), [requests]);
  const mentorGroups = useMemo(() => groupMentorRequests(requests), [requests]);

  if (loadState === "loading") return <p role="status" className="mt-8 rounded-2xl bg-white p-5 font-bold text-slate-600">טוען פגישות...</p>;
  if (loadState === "error") return <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-bold">לא ניתן לטעון את הפגישות כרגע.</p><button type="button" disabled={!token} onClick={() => void load(token)} className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold disabled:opacity-50">ניסיון נוסף</button></div>;

  return (
    <section dir="rtl" className="mt-8" aria-labelledby="meeting-requests-title">
      {role === "parent" ? (
        <>
          {groups.actionRequired.length > 0 && <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm" aria-labelledby="parent-action-title">
            <h2 id="parent-action-title" className="text-2xl font-black text-amber-950">בקשות שממתינות לתשובתך</h2>
            <p className="mt-2 text-sm text-amber-900">מועדים חלופיים שהחונך הציע וממתינים לאישור או לדחייה שלך.</p>
            <h3 className="mt-4 text-lg font-black text-amber-950">דורשות פעולה ממני</h3>
            <RequestList requests={groups.actionRequired} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} empty="אין כרגע בקשות שממתינות לתשובתך." />
          </section>}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <h2 id="meeting-requests-title" className="text-2xl font-black">הבקשות והפגישות שלי</h2>
            <NotificationBadge count={unreadCount} token={token} clear={() => setUnreadCount(0)} />
            </div>
            <Link href="/dashboard/parent#mentor-search" className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white">בקשת פגישה חדשה</Link>
          </div>
          <nav className="mt-5 grid gap-2 rounded-2xl bg-blue-700 p-2 text-white sm:grid-cols-3" aria-label="סינון בקשות ופגישות">
            <ParentTab label="פגישות קרובות" count={groups.upcoming.length} selected={parentView === "meetings"} onClick={() => setParentView("meetings")} />
            <ParentTab label="בקשות פתוחות" count={groups.waitingForMentor.length + groups.actionRequired.length} selected={parentView === "requests"} onClick={() => setParentView("requests")} />
            <ParentTab label="היסטוריה" count={groups.completed.length + groups.closed.length + groups.history.length} selected={parentView === "history"} onClick={() => setParentView("history")} />
          </nav>
          <div className="mt-6 space-y-7">
            {parentView === "requests" && <RequestGroup title="ממתינות לתשובת החונך" requests={groups.waitingForMentor} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} />}
            {parentView === "meetings" && <RequestGroup title="פגישות שאושרו וטרם התקיימו" requests={groups.upcoming} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} />}
            {parentView === "history" && <><RequestGroup title="פגישות שהתקיימו" requests={groups.completed} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} /><RequestGroup title="נדחו או בוטלו" requests={groups.closed} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} /><RequestGroup title="היסטוריה נוספת" requests={groups.history} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} /></>}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-bold text-blue-700">בקשות ופגישות</p><h1 id="meeting-requests-title" className="mt-1 text-3xl font-black">{MENTOR_VIEWS[view].title}</h1></div>
            <NotificationBadge count={unreadCount} token={token} clear={() => setUnreadCount(0)} />
          </div>
          <nav aria-label="סינון בקשות ופגישות" className="mt-5 flex flex-wrap gap-2">{Object.entries(MENTOR_VIEWS).map(([key, item]) => { const count = mentorViewRequests(mentorGroups, key as MentorMeetingView).length; return <Link key={key} href={"/dashboard/mentor/meetings?view=" + key} aria-current={view === key ? "page" : undefined} className={`rounded-full border px-4 py-2 font-bold transition ${view === key ? item.active : item.inactive}`}>{item.title} <span className="font-black" aria-label={`${count} פריטים`}>({count})</span></Link>; })}</nav>
          <div className="mt-5">
            <RequestGroup title={MENTOR_VIEWS[view].title} requests={mentorViewRequests(mentorGroups, view)} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} updateDetails={updateDetails} />
          </div>        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{message}</p>}
    </section>
  );
}

function ParentTab({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`min-h-12 rounded-xl px-4 py-3 font-black transition ${selected ? "bg-white text-blue-800 shadow" : "bg-blue-600 text-white hover:bg-blue-500"}`}>{label} <span aria-label={`${count} פריטים`}>({count})</span></button>;
}

type ListProps = {
  requests: Meeting[];
  role: "parent" | "mentor";
  busyId: string;
  slots: Slot[];
  alternatives: Record<string, string>;
  setAlternatives: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  act: (id: string, action: string, confirmation: string) => Promise<void>;
  proposeNext: (item: Meeting) => Promise<void>;
  updateDetails: (item: Meeting) => Promise<void>;
};

function RequestGroup({ id, title, ...props }: ListProps & { id?: string; title: string }) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`group-${title}`}>
      <h3 id={`group-${title}`} className="text-xl font-black text-slate-900">{title}</h3>
      <RequestList {...props} empty="אין בקשות בקטגוריה זו." />
    </section>
  );
}

function RequestList({ requests, empty, ...props }: ListProps & { empty: string }) {
  if (!requests.length) return <p className="mt-3 rounded-2xl bg-white p-5 text-slate-600">{empty}</p>;
  return <div className="mt-3 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{requests.map((item) => <MeetingCard key={item.id} item={item} {...props} />)}</div>;
}

function MeetingCard({ item, role, busyId, slots, alternatives, setAlternatives, act, proposeNext, updateDetails }: Omit<ListProps, "requests"> & { item: Meeting }) {
  const confirmedStart = item.confirmed_start_at;
  const confirmedDuration = item.confirmed_duration_minutes;
  const declinedAlternative = item.status === "declined" && Boolean(item.proposed_start_at);
  const visual = meetingVisual(item, role);
  const displayedStart = confirmedStart ?? item.proposed_start_at ?? item.requested_start_at;
  const displayedDuration = confirmedDuration ?? item.proposed_duration_minutes ?? item.requested_duration_minutes;
  return (
    <article className={`flex min-h-[24rem] flex-col overflow-hidden rounded-3xl border-2 p-5 shadow-sm ${visual.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-black">{role === "parent" ? item.mentor_display_name : `${item.child_first_name} · ${item.child_grade_or_age}`}</h4>
        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${visual.badge}`}>{statusLabel(item, role)}</span>
      </div>
      {role === "parent" && <p className="mt-2 font-black text-slate-900">עבור {item.child_first_name} · {item.child_grade_or_age}</p>}
      {role === "mentor" && <p className="mt-2 font-black text-slate-900">הורה: {item.parent_display_name ?? "הורה"}</p>}
      <p className="mt-2 font-bold text-slate-700">{item.subject} · {item.meeting_mode}</p>
      <div className={`mt-4 rounded-2xl p-4 ${item.status === "accepted" ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-950"}`}><p className="text-sm font-black">{item.status === "accepted" ? "פגישה קרובה" : "בקשת פגישה — עדיין לא אושרה"}</p><p className="mt-2 text-xl font-black">{formatDate(displayedStart)}</p><p className="mt-1 font-bold">אורך המפגש: {displayedDuration} דקות</p></div>
      {item.proposed_start_at && item.proposed_duration_minutes ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 font-bold text-amber-950">המועד החלופי: {formatDate(item.proposed_start_at)} · {item.proposed_duration_minutes} דקות</p>
      ) : null}
      {item.status === "accepted" && confirmedStart && confirmedDuration ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-3 font-black text-emerald-900">המועד שאושר: {formatDate(confirmedStart)} · {confirmedDuration} דקות</p>
      ) : null}
      {declinedAlternative && role === "mentor" ? <p className="mt-2 font-bold text-red-700">ההורה דחה את המועד החלופי.</p> : null}
      <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 text-slate-800">
        <p><b>מטרת המפגש:</b> {item.help_goal}</p>
        <p><b>הבקשה נשלחה:</b> {formatDate(item.created_at)}</p>
        {item.parent_message && <p><b>הודעת ההורה:</b> {item.parent_message}</p>}
        {item.mentor_response && <p><b>תשובת החונך:</b> {item.mentor_response}</p>}
        {item.preparation_notes && <p><b>הכנה למפגש:</b> {item.preparation_notes}</p>}
        {item.equipment_notes && <p><b>מה להביא:</b> {item.equipment_notes}</p>}
        {item.meeting_location && <p><b>מיקום או קישור:</b> {item.meeting_location}</p>}
        {item.participant_names?.length > 0 && <p><b>משתתפים נוספים:</b> {item.participant_names.join(", ")}</p>}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {item.contact_phone && <>
          <a href={`tel:${item.contact_phone}`} className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 py-2 font-bold text-blue-800">התקשרות</a>
          <a href={`https://wa.me/972${item.contact_phone.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer" className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">WhatsApp</a>
        </>}
        {role === "parent" && item.status === "alternative_proposed" ? (
          <>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "accept_alternative", "לאשר את המועד החלופי?")} className="min-h-11 rounded-xl bg-green-700 px-4 py-2 font-bold text-white disabled:opacity-50">אישור המועד החלופי</button>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "decline_alternative", "לדחות את המועד החלופי?")} className="min-h-11 rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 disabled:opacity-50">דחיית המועד החלופי</button>
          </>
        ) : null}
        {role === "parent" && item.status === "pending" ? (
          <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "cancel", "לבטל את בקשת הפגישה?")} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700 disabled:opacity-50">ביטול הבקשה</button>
        ) : null}
        {role === "mentor" && item.status === "pending" ? (
          <>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "accept", "לאשר את הבקשה?")} className="min-h-11 rounded-xl bg-green-700 px-4 py-2 font-bold text-white disabled:opacity-50">אישור</button>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "decline", "לדחות את הבקשה?")} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">דחייה</button>
            <select aria-label="בחירת מועד חלופי" value={alternatives[item.id] ?? ""} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-violet-300 bg-white px-3">
              <option value="">בחירת מועד חלופי</option>
              {slots.filter((slot) => slot.meetingMode === item.meeting_mode && slot.startAt !== item.requested_start_at).flatMap((slot) => slot.durations.map((duration) => <option key={`${slot.startAt}-${duration}`} value={`${slot.startAt}|${duration}`}>{formatDate(slot.startAt)} · {duration} דקות</option>))}
            </select>
            <button type="button" disabled={busyId === item.id || !alternatives[item.id]} onClick={() => void proposeNext(item)} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50">הצעת המועד הזמין הבא</button>
          </>
        ) : null}
        {role === "mentor" && ["pending","alternative_proposed","accepted"].includes(item.status)&&<button type="button" disabled={busyId===item.id} onClick={()=>void updateDetails(item)} className="min-h-11 rounded-xl border border-blue-400 bg-white px-4 py-2 font-bold text-blue-800">עדכון פרטי המפגש</button>}
        {role === "parent" && ["cancelled","declined"].includes(item.status)&&<button type="button" disabled={busyId===item.id} onClick={()=>void act(item.id,"archive","להסיר את הבקשה מההיסטוריה?")} className="min-h-11 rounded-xl border px-4 py-2 font-bold">מחיקה מההיסטוריה</button>}
      </div>
    </article>
  );
}

const MENTOR_VIEWS: Record<MentorMeetingView, { title: string; active: string; inactive: string }> = {
  "mentor-action": { title: "ממתינה לפעולת החונך", active: "border-amber-700 bg-amber-700 text-white", inactive: "border-amber-300 bg-amber-50 text-amber-950" },
  "waiting-parent": { title: "ממתינה לתגובת ההורה", active: "border-violet-700 bg-violet-700 text-white", inactive: "border-violet-300 bg-violet-50 text-violet-950" },
  "upcoming-approved": { title: "אושרה", active: "border-emerald-700 bg-emerald-700 text-white", inactive: "border-emerald-300 bg-emerald-50 text-emerald-950" },
  history: { title: "היסטוריית פגישות", active: "border-slate-700 bg-slate-700 text-white", inactive: "border-slate-300 bg-slate-50 text-slate-800" },
};

function meetingVisual(item: Meeting, role: "parent" | "mentor") {
  if (item.status === "accepted" && effectiveStart(item) < Date.now()) return { badge: "border-slate-400 bg-slate-200 text-slate-900", card: "border-slate-400 bg-slate-50" };
  if (item.status === "accepted") return { badge: "border-emerald-300 bg-emerald-100 text-emerald-950", card: "border-emerald-300 bg-emerald-50/70" };
  if (item.status === "cancelled") return { badge: "border-rose-400 bg-rose-200 text-rose-950", card: "border-rose-400 bg-rose-50/70" };
  if (item.status === "declined") return { badge: "border-red-300 bg-red-100 text-red-950", card: "border-red-300 bg-red-50/70" };
  if (item.status === "alternative_proposed") return { badge: "border-violet-300 bg-violet-100 text-violet-950", card: "border-violet-300 bg-violet-50/70" };
  if (item.status === "pending" && role === "mentor") return { badge: "border-amber-300 bg-amber-100 text-amber-950", card: "border-amber-300 bg-amber-50/70" };
  return { badge: "border-blue-300 bg-blue-100 text-blue-950", card: "border-blue-300 bg-blue-50/70" };
}

function mentorViewRequests(groups: ReturnType<typeof groupMentorRequests>, view: MentorMeetingView) {
  if (view === "mentor-action") return groups.actionRequired;
  if (view === "waiting-parent") return groups.waitingForParent;
  if (view === "upcoming-approved") return groups.upcomingApproved;
  return groups.history;
}
function groupMentorRequests(requests: Meeting[]) {
  const ordered = newestFirst(requests);
  const actionRequired = ordered.filter(requiresMentorAction);
  const waitingForParent = ordered.filter(waitsForParentAction);
  const upcomingApproved = ordered.filter((item) => isUpcomingApprovedMeeting(item));
  const visibleIds = new Set([...actionRequired, ...waitingForParent, ...upcomingApproved].map((item) => item.id));
  return { actionRequired, waitingForParent, upcomingApproved, history: ordered.filter((item) => !visibleIds.has(item.id)) };
}

function groupParentRequests(requests: Meeting[]) {
  const now = Date.now();
  const newestFirst = [...requests].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  return {
    actionRequired: newestFirst.filter((item) => item.status === "alternative_proposed"),
    waitingForMentor: newestFirst.filter((item) => item.status === "pending"),
    upcoming: newestFirst.filter((item) => item.status === "accepted" && effectiveStart(item) >= now).sort((left, right) => effectiveStart(left) - effectiveStart(right)),
    completed: newestFirst.filter((item) => item.status === "accepted" && effectiveStart(item) < now),
    closed: newestFirst.filter((item) => ["declined", "cancelled"].includes(item.status)),
    history: newestFirst.filter((item) => !["alternative_proposed", "pending", "accepted", "declined", "cancelled"].includes(item.status)),
  };
}

function effectiveStart(item: Meeting) {
  return new Date(item.confirmed_start_at ?? item.requested_start_at).getTime();
}

function statusLabel(item: Meeting, role: "parent" | "mentor") {
  if (item.status === "accepted" && effectiveStart(item) < Date.now()) return "הסתיימה";
  if (item.status === "alternative_proposed") return role === "parent" ? "ממתין לאישורך" : "ממתין לאישור ההורה";
  if (item.status === "accepted") return "מאושרת";
  if (item.status === "declined" && item.proposed_start_at) return role === "mentor" ? "ההורה דחה את המועד החלופי" : "המועד החלופי נדחה";
  if (item.status === "declined") return "נדחתה";
  if (item.status === "cancelled") return "בוטלה";
  return "ממתינה לתשובת החונך";
}

function NotificationBadge({ count, token, clear }: { count: number; token: string; clear: () => void }) {
  if (count <= 0) return null;
  return <button type="button" onClick={async () => { await fetch("/api/notifications", { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); clear(); }} aria-label="סימון ההתראות כנקראו" className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{count}</button>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
