"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isUpcomingApprovedMeeting, newestFirst, requiresMentorAction, waitsForParentAction } from "@/lib/mentor-dashboard-status";
import { MentorImportantUpdates } from "@/app/dashboard/mentor/_components/MentorDashboardShell";

type Slot = { startAt: string; meetingMode: string; durations: number[] };
type Meeting = {
  id: string;
  child_id: string;
  mentor_display_name?: string;
  parent_display_name?: string;
  subject: string;
  child_first_name: string;
  child_grade_or_age: string;
  child_gender: "boy" | "girl" | null;
  child_display_color: string;
  help_goal: string;
  meeting_mode: string;
  meeting_price: number;
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
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  preparation_notes: string | null;
  equipment_notes: string | null;
  meeting_location: string | null;
  participant_names: string[];
  contact_phone: string | null;
};

type MentorMeetingView = "mentor-action" | "waiting-parent" | "upcoming-approved" | "history";
type ParentMeetingView = "requests" | "meetings" | "completed" | "cancelled";
type MeetingDetailsValues = { preparationNotes: string; equipmentNotes: string; meetingLocation: string; participantNames: string; saveAsTemplate: boolean };

export default function MeetingRequestsPanel({ role, view = "mentor-action" }: { role: "parent" | "mentor"; view?: MentorMeetingView }) {
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<Meeting[]>([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMeetingIds, setUnreadMeetingIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [parentView, setParentView] = useState<ParentMeetingView>("meetings");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [mentorHistoryView, setMentorHistoryView] = useState<"completed"|"cancelled">("completed");

  const load = useCallback(async (accessToken: string) => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/meeting-requests", {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("MEETINGS_LOAD_FAILED");
      setRequests(body.requests ?? []);
      setUnreadCount(body.attentionCount ?? 0);
      setUnreadMeetingIds(body.unreadMeetingIds ?? []);
      const bookingId = body.schedulingMentorBookingId ?? "";
      if (role === "mentor" && bookingId) {
        const slotsResponse = await fetch(`/api/meeting-requests/available-slots?mentor=${bookingId}`);
        const slotsBody = await slotsResponse.json().catch(() => ({}));
        if (slotsResponse.ok) setSlots(slotsBody.slots ?? []);
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

  async function cancelMeeting(item: Meeting) {
    const reason = window.prompt("מה הסיבה לביטול הפגישה? הסיבה תישלח להורה.", "");
    if (reason === null) return;
    if (reason.trim().length < 3) { setMessage("יש לציין סיבה קצרה לביטול הפגישה."); return; }
    if (!window.confirm("לבטל את הפגישה? ההורה יקבל הודעה.")) return;
    setBusyId(item.id); setMessage("");
    try {
      const response = await fetch(`/api/meeting-requests/${item.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", reason: reason.trim() }) });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "הפגישה בוטלה וההורה קיבל עדכון." : body.error ?? "לא ניתן לבטל את הפגישה.");
      if (response.ok) await load(token);
    } finally { setBusyId(""); }
  }

  async function markMeetingRead(meetingId: string) {
    if (!unreadMeetingIds.includes(meetingId)) return;
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ meetingRequestId: meetingId }) });
    if (response.ok) await load(token);
  }

  async function updateDetails(item: Meeting, values: MeetingDetailsValues) {
    setBusyId(item.id);
    const response=await fetch(`/api/meeting-requests/${item.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"update_details",...values,participantNames:values.participantNames.split(",").map(v=>v.trim()).filter(Boolean)})});
    const body=await response.json().catch(()=>({}));
    setMessage(response.ok?"פרטי המפגש עודכנו ונשלחו להורה.":body.error??"לא ניתן לעדכן את פרטי המפגש.");
    if(response.ok){setEditingMeeting(null);await load(token);} setBusyId("");
  }

  const groups = useMemo(() => groupParentRequests(requests), [requests]);
  const childOptions = useMemo(() => [...new Map(requests.map((item) => [item.child_id, { id: item.child_id, name: item.child_first_name, color: item.child_display_color }])).values()], [requests]);
  const filteredGroups = useMemo(() => Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, (items as Meeting[]).filter((item) => selectedChildren.length === 0 || selectedChildren.includes(item.child_id))])) as typeof groups, [groups, selectedChildren]);
  const mentorGroups = useMemo(() => groupMentorRequests(requests), [requests]);

  if (loadState === "loading") return <p role="status" className="mt-8 rounded-2xl bg-white p-5 font-bold text-slate-600">טוען פגישות...</p>;
  if (loadState === "error") return <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-bold">לא ניתן לטעון את הפגישות כרגע.</p><button type="button" disabled={!token} onClick={() => void load(token)} className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold disabled:opacity-50">ניסיון נוסף</button></div>;

  return (
    <section dir="rtl" className="mt-8" aria-labelledby="meeting-requests-title">
      {role === "parent" ? (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <h2 id="meeting-requests-title" className="text-2xl font-black">הפגישות שלי</h2>
            <NotificationBadge count={unreadCount} />
            </div>
            <Link href="/dashboard/parent#mentor-search" className="rounded-xl bg-blue-700 px-5 py-3 font-black text-white">בקשת פגישה חדשה</Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border bg-white p-3"><button type="button" onClick={()=>setSelectedChildren([])} className={childFilterClass(selectedChildren.length===0,"green")}>כל הילדים</button>{childOptions.map(child=><button type="button" key={child.id} onClick={()=>setSelectedChildren(current=>current.includes(child.id)?current.filter(id=>id!==child.id):[...current,child.id])} className={childFilterClass(selectedChildren.includes(child.id),child.color)}>{child.name}</button>)}</div>
          <nav className="mt-5 grid gap-2 rounded-2xl bg-blue-700 p-2 text-white sm:grid-cols-4" aria-label="סינון פגישות">
            <ParentTab label="פגישות קרובות" count={filteredGroups.upcoming.length} selected={parentView === "meetings"} onClick={() => setParentView("meetings")} />
            <ParentTab label="פגישות שממתינות לאישור החונך" count={filteredGroups.waitingForMentor.length + filteredGroups.actionRequired.length} selected={parentView === "requests"} onClick={() => setParentView("requests")} />
            <ParentTab label="פגישות שהסתיימו" count={filteredGroups.completed.length} selected={parentView === "completed"} onClick={() => setParentView("completed")} />
            <ParentTab label="פגישות שבוטלו" count={filteredGroups.closed.length + filteredGroups.history.length} selected={parentView === "cancelled"} onClick={() => setParentView("cancelled")} />
          </nav>
          <div className="mt-6 space-y-7">
            {parentView === "requests" && <RequestGroup title="ממתינות לאישור" requests={[...filteredGroups.waitingForMentor,...filteredGroups.actionRequired]} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} cancelMeeting={cancelMeeting} markMeetingRead={markMeetingRead} unreadMeetingIds={unreadMeetingIds} updateDetails={setEditingMeeting} />}
            {parentView === "meetings" && <RequestGroup title="פגישות שאושרו וטרם התקיימו" requests={filteredGroups.upcoming} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} cancelMeeting={cancelMeeting} markMeetingRead={markMeetingRead} unreadMeetingIds={unreadMeetingIds} updateDetails={setEditingMeeting} />}
            {parentView === "completed" && <RequestGroup title="פגישות שהתקיימו" requests={filteredGroups.completed} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} cancelMeeting={cancelMeeting} markMeetingRead={markMeetingRead} unreadMeetingIds={unreadMeetingIds} updateDetails={setEditingMeeting} />}
            {parentView === "cancelled" && <RequestGroup title="פגישות שבוטלו" requests={[...filteredGroups.closed,...filteredGroups.history]} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} cancelMeeting={cancelMeeting} markMeetingRead={markMeetingRead} unreadMeetingIds={unreadMeetingIds} updateDetails={setEditingMeeting} />}
          </div>
        </>
      ) : (
        <>
          <MentorImportantUpdates scope="meetings" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-bold text-blue-700">בקשות ופגישות</p><h1 id="meeting-requests-title" className="mt-1 text-3xl font-black">{MENTOR_VIEWS[view].title}</h1></div>
            <NotificationBadge count={unreadCount} />
          </div>
          <nav aria-label="סינון בקשות ופגישות" className="mt-5 flex flex-wrap gap-2">{Object.entries(MENTOR_VIEWS).map(([key, item]) => { const count = mentorViewRequests(mentorGroups, key as MentorMeetingView).length; return <Link key={key} href={"/dashboard/mentor/meetings?view=" + key} aria-current={view === key ? "page" : undefined} className={`rounded-full border px-4 py-2 font-bold transition ${item.style} ${view === key ? "scale-105 font-black shadow-md ring-2 ring-slate-700/30" : "opacity-90 hover:opacity-100"}`}>{item.title} <span className="font-black" aria-label={`${count} פריטים`}>({count})</span></Link>; })}</nav>
          <div className="mt-5">
            {view==="history"&&<nav aria-label="סינון היסטוריית פגישות" className="mb-5 grid gap-2 rounded-2xl bg-slate-800 p-2 sm:grid-cols-2"><button onClick={()=>setMentorHistoryView("completed")} className={`min-h-12 rounded-xl px-5 font-black ${mentorHistoryView==="completed"?"scale-[1.03] bg-white text-slate-900 shadow-lg ring-2 ring-white":"text-white"}`}>הסתיימו ({mentorGroups.completed.length})</button><button onClick={()=>setMentorHistoryView("cancelled")} className={`min-h-12 rounded-xl px-5 font-black ${mentorHistoryView==="cancelled"?"scale-[1.03] bg-white text-slate-900 shadow-lg ring-2 ring-white":"text-white"}`}>בוטלו ({mentorGroups.cancelled.length})</button></nav>}
            <RequestGroup title={view==="history"?(mentorHistoryView==="completed"?"פגישות שהסתיימו":"פגישות שבוטלו"):MENTOR_VIEWS[view].title} requests={view==="history"?mentorGroups[mentorHistoryView]:mentorViewRequests(mentorGroups, view)} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} cancelMeeting={cancelMeeting} markMeetingRead={markMeetingRead} unreadMeetingIds={unreadMeetingIds} updateDetails={setEditingMeeting} />
          </div>        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{message}</p>}
      {editingMeeting && <MeetingDetailsEditor item={editingMeeting} busy={busyId===editingMeeting.id} onClose={()=>setEditingMeeting(null)} onSave={(values)=>void updateDetails(editingMeeting,values)} />}
    </section>
  );
}

function MeetingDetailsEditor({ item, busy, onClose, onSave }: { item: Meeting; busy: boolean; onClose: () => void; onSave: (values: MeetingDetailsValues) => void }) {
  const [preparationNotes,setPreparationNotes]=useState(item.preparation_notes??"");
  const [equipmentNotes,setEquipmentNotes]=useState(item.equipment_notes??"");
  const [meetingLocation,setMeetingLocation]=useState(item.meeting_location??"");
  const [participantNames,setParticipantNames]=useState((item.participant_names??[]).join(", "));
  const [saveAsTemplate,setSaveAsTemplate]=useState(false);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close);},[onClose]);
  const input="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event)=>event.target===event.currentTarget&&onClose()}>
    <form onSubmit={(event)=>{event.preventDefault();onSave({preparationNotes,equipmentNotes,meetingLocation,participantNames,saveAsTemplate});}} role="dialog" aria-modal="true" aria-labelledby="meeting-details-editor-title" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><h2 id="meeting-details-editor-title" className="text-2xl font-black">עדכון פרטי המפגש</h2><p className="mt-1 text-sm text-slate-600">הפרטים יופיעו מיד להורה בכרטיס המפגש.</p></div><button type="button" onClick={onClose} aria-label="סגירה" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-2xl font-black">×</button></header>
      <div className="space-y-4 p-5 sm:p-7">
        <label className="grid gap-2 font-bold">מיקום או קישור למפגש<input value={meetingLocation} onChange={(event)=>setMeetingLocation(event.target.value)} className={input}/></label>
        <label className="grid gap-2 font-bold">מה צריך להכין לפגישה?<textarea rows={3} value={preparationNotes} onChange={(event)=>setPreparationNotes(event.target.value)} className={input}/></label>
        <label className="grid gap-2 font-bold">מה צריך להביא?<textarea rows={3} value={equipmentNotes} onChange={(event)=>setEquipmentNotes(event.target.value)} className={input}/></label>
        <label className="grid gap-2 font-bold">משתתפים נוספים שתואמו עם ההורים<input value={participantNames} onChange={(event)=>setParticipantNames(event.target.value)} placeholder="הפרדה בפסיקים" className={input}/></label>
        <label className="flex items-start gap-3 rounded-2xl border bg-blue-50 p-4 font-bold"><input type="checkbox" checked={saveAsTemplate} onChange={(event)=>setSaveAsTemplate(event.target.checked)} className="mt-1 h-5 w-5 accent-blue-700"/><span>שמירת פרטי ההכנה כתבנית לפגישות עתידיות בתחום {item.subject}</span></label>
        <div className="flex flex-wrap justify-end gap-3 border-t pt-5"><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3 font-bold">ביטול</button><button type="submit" disabled={busy} className="rounded-xl bg-blue-700 px-6 py-3 font-black text-white disabled:bg-slate-400">{busy?"שומר...":"שמירה ושליחה להורה"}</button></div>
      </div>
    </form>
  </div>;
}

function ParentTab({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`min-h-12 rounded-xl px-4 py-3 font-black transition ${selected ? "bg-white text-blue-800 shadow" : "bg-blue-600 text-white hover:bg-blue-500"}`}>{label} <span aria-label={`${count} פריטים`}>({count})</span></button>;
}

function childCardClass(color: string) { return ({green:"border-emerald-300 bg-emerald-50/70",blue:"border-blue-300 bg-blue-50/70",turquoise:"border-cyan-300 bg-cyan-50/70",peach:"border-orange-300 bg-orange-50/70",pink:"border-pink-300 bg-pink-50/70",red:"border-rose-300 bg-rose-50/70",violet:"border-violet-300 bg-violet-50/70",amber:"border-amber-300 bg-amber-50/70"} as Record<string,string>)[color]??"border-slate-300 bg-white"; }
function childFilterClass(selected: boolean, color: string) { return `rounded-xl border px-4 py-2 font-black ${selected ? childCardClass(color) + " ring-2 ring-blue-600" : "border-slate-300 bg-white"}`; }

type ListProps = {
  requests: Meeting[];
  role: "parent" | "mentor";
  busyId: string;
  slots: Slot[];
  alternatives: Record<string, string>;
  setAlternatives: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  act: (id: string, action: string, confirmation: string) => Promise<void>;
  proposeNext: (item: Meeting) => Promise<void>;
  cancelMeeting: (item: Meeting) => Promise<void>;
  markMeetingRead: (meetingId: string) => Promise<void>;
  unreadMeetingIds: string[];
  updateDetails: (item: Meeting) => void;
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

function MeetingCard({ item, role, busyId, slots, alternatives, setAlternatives, act, proposeNext, cancelMeeting, markMeetingRead, unreadMeetingIds, updateDetails }: Omit<ListProps, "requests"> & { item: Meeting }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [renderNow] = useState(()=>Date.now());
  const confirmedStart = item.confirmed_start_at;
  const confirmedDuration = item.confirmed_duration_minutes;
  const declinedAlternative = item.status === "declined" && Boolean(item.proposed_start_at);
  const visual = meetingVisual(item, role);
  const displayedStart = confirmedStart ?? item.proposed_start_at ?? item.requested_start_at;
  const displayedDuration = confirmedDuration ?? item.proposed_duration_minutes ?? item.requested_duration_minutes;
  const hasUnreadUpdate = unreadMeetingIds.includes(item.id);
  const canMentorCancel = role === "mentor" && item.status === "accepted" && effectiveStart(item) - renderNow >= 12 * 60 * 60 * 1000;
  return (
    <article className={`flex min-h-[24rem] flex-col overflow-hidden rounded-3xl border-2 p-5 shadow-sm ${role === "parent" ? childCardClass(item.child_display_color) : visual.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-black">{role === "parent" ? item.mentor_display_name : `${item.child_first_name} · ${item.child_grade_or_age}`}</h4>
        <div className="flex items-center gap-2">{hasUnreadUpdate && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">חדש</span>}<span className={`rounded-full border px-3 py-1 text-sm font-bold ${visual.badge}`}>{statusLabel(item, role)}</span></div>
      </div>
      {role === "parent" && <p className="mt-2 font-black text-slate-900">עבור {item.child_first_name} · {item.child_gender === "girl" ? "בת" : "בן"} · {item.child_grade_or_age}</p>}
      {role === "mentor" && <p className="mt-2 font-black text-slate-900">{item.child_gender === "girl" ? "בת" : "בן"} · {item.child_grade_or_age}</p>}
      {role === "mentor" && <p className="mt-2 font-black text-slate-900">הורה: {item.parent_display_name ?? "הורה"}</p>}
      <p className="mt-2 font-bold text-slate-700">{item.subject} · {item.meeting_mode}</p>
      <div className="mt-2 grid gap-2 rounded-xl bg-white/80 p-3 text-sm sm:grid-cols-2"><p><b>מיקום:</b> {item.meeting_location || (item.meeting_mode === "אונליין" ? "קישור יימסר לאחר האישור" : "טרם נקבע")}</p><p><b>עלות:</b> {item.meeting_price ? `${item.meeting_price} ₪` : "ללא עלות"}</p></div>
      <div className={`mt-4 rounded-2xl p-4 ${item.status === "accepted" ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-950"}`}><p className="text-sm font-black">{item.status === "accepted" ? "פגישה קרובה" : "בקשת פגישה — עדיין לא אושרה"}</p><p className="mt-2 text-xl font-black">{formatDate(displayedStart)}</p><p className="mt-1 font-bold">אורך המפגש: {displayedDuration} דקות</p></div>
      {item.proposed_start_at && item.proposed_duration_minutes ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 font-bold text-amber-950">המועד החלופי: {formatDate(item.proposed_start_at)} · {item.proposed_duration_minutes} דקות</p>
      ) : null}
      {item.status === "accepted" && confirmedStart && confirmedDuration ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-3 font-black text-emerald-900">המועד שאושר: {formatDate(confirmedStart)} · {confirmedDuration} דקות</p>
      ) : null}
      {declinedAlternative && role === "mentor" ? <p className="mt-2 font-bold text-red-700">ההורה דחה את המועד החלופי.</p> : null}
      <button type="button" aria-expanded={detailsOpen} onClick={() => { const opening = !detailsOpen; setDetailsOpen(opening); if (opening) void markMeetingRead(item.id); }} className="mt-3 min-h-11 rounded-xl border border-blue-300 bg-white px-4 py-2 font-black text-blue-800">{detailsOpen ? "סגירת פרטי המפגש" : "פרטי המפגש המלאים"}</button>
      {detailsOpen && <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 text-slate-800">
        <p><b>מטרת המפגש:</b> {item.help_goal}</p>
        <p><b>הבקשה נשלחה:</b> {formatDate(item.created_at)}</p>
        {item.parent_message && <p><b>הודעת ההורה:</b> {item.parent_message}</p>}
        {item.mentor_response && <p><b>תשובת החונך:</b> {item.mentor_response}</p>}
        {item.preparation_notes && <p><b>הכנה למפגש:</b> {item.preparation_notes}</p>}
        {item.equipment_notes && <p><b>מה להביא:</b> {item.equipment_notes}</p>}
        {item.meeting_location && <p><b>מיקום או קישור:</b> {item.meeting_location}</p>}
        {item.participant_names?.length > 0 && <p><b>משתתפים נוספים:</b> {item.participant_names.join(", ")}</p>}
        {item.cancellation_reason && <p className="rounded-xl bg-red-50 p-3 text-red-900"><b>סיבת הביטול:</b> {item.cancellation_reason}</p>}
      </div>}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {item.contact_phone && <>
          <a href={`tel:${item.contact_phone}`} className="min-h-11 rounded-xl border border-blue-300 bg-white px-4 py-2 font-bold text-blue-800">התקשרות</a>
          <a href={`https://wa.me/972${item.contact_phone.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer" className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">WhatsApp</a>
        </>}
        {role === "parent" && item.proposed_start_at && item.proposed_duration_minutes && ["alternative_proposed", "accepted"].includes(item.status) ? (
          <>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "accept_alternative", "לאשר את המועד החלופי?")} className="min-h-11 rounded-xl bg-green-700 px-4 py-2 font-bold text-white disabled:opacity-50">אישור המועד החלופי</button>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "decline_alternative", "לדחות את המועד החלופי?")} className="min-h-11 rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 disabled:opacity-50">דחיית המועד החלופי</button>
          </>
        ) : null}
        {role === "parent" && ["pending","accepted"].includes(item.status) ? (
          item.status === "accepted" && effectiveStart(item)-renderNow<24*60*60*1000
            ? <p className="w-full rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">פחות מ־24 שעות נותרו לפגישה. לביטול יש ליצור קשר ישירות עם החונך.</p>
            : <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "cancel", item.status === "accepted" ? "לבטל את הפגישה? החונך יקבל הודעה." : "לבטל את בקשת הפגישה?")} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700 disabled:opacity-50">{item.status === "accepted" ? "ביטול הפגישה" : "ביטול הבקשה"}</button>
        ) : null}
        {role === "mentor" && item.status === "pending" ? (
          <>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "accept", "לאשר את הבקשה?")} className="min-h-11 rounded-xl bg-green-700 px-4 py-2 font-bold text-white disabled:opacity-50">אישור</button>
            <button type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "decline", "לדחות את הבקשה?")} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">דחייה</button>
            <select aria-label="בחירת מועד חלופי" value={alternatives[item.id] ?? ""} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-violet-300 bg-white px-3">
              <option value="">בחירת מועד חלופי</option>
              {slots.filter((slot) => slot.meetingMode === item.meeting_mode && slot.startAt !== item.requested_start_at).flatMap((slot) => slot.durations.map((duration) => <option key={`${slot.startAt}-${duration}`} value={`${slot.startAt}|${duration}`}>{formatDate(slot.startAt)} · {duration} דקות</option>))}
            </select>
            <button type="button" disabled={busyId === item.id || !alternatives[item.id]} onClick={() => void proposeNext(item)} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50">הצעת מועד אחר</button>
          </>
        ) : null}
        {role === "mentor" && item.status === "accepted" ? <>
          <select aria-label="בחירת מועד אחר" value={alternatives[item.id] ?? ""} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-violet-300 bg-white px-3">
            <option value="">בחירת מועד אחר</option>
            {slots.filter((slot) => slot.meetingMode === item.meeting_mode && slot.startAt !== item.confirmed_start_at && new Date(slot.startAt).getTime() > renderNow).flatMap((slot) => slot.durations.map((duration) => <option key={`${slot.startAt}-${duration}`} value={`${slot.startAt}|${duration}`}>{formatDate(slot.startAt)} · {duration} דקות</option>))}
          </select>
          <button type="button" disabled={busyId === item.id || !alternatives[item.id]} onClick={() => void proposeNext(item)} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50">הצעת מועד אחר</button>
          {canMentorCancel ? <button type="button" disabled={busyId === item.id} onClick={() => void cancelMeeting(item)} className="min-h-11 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold text-red-700 disabled:opacity-50">ביטול הפגישה</button> : <p className="w-full rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">פחות מ־12 שעות נותרו לפגישה. לא ניתן לבטל דרך המערכת; יש ליצור קשר עם ההורה.</p>}
        </> : null}
        {role === "mentor" && ["pending","alternative_proposed","accepted"].includes(item.status)&&<button type="button" disabled={busyId===item.id} onClick={()=>void updateDetails(item)} className="min-h-11 rounded-xl border border-blue-400 bg-white px-4 py-2 font-bold text-blue-800">עדכון פרטי המפגש</button>}
        {role === "parent" && ["cancelled","declined"].includes(item.status)&&<button type="button" disabled={busyId===item.id} onClick={()=>void act(item.id,"archive","להסיר את הבקשה מההיסטוריה?")} className="min-h-11 rounded-xl border px-4 py-2 font-bold">מחיקה מההיסטוריה</button>}
      </div>
    </article>
  );
}

const MENTOR_VIEWS: Record<MentorMeetingView, { title: string; style: string }> = {
  "upcoming-approved": { title: "אושרה", style: "border-emerald-300 bg-emerald-50 text-emerald-950" },
  "mentor-action": { title: "ממתינה לפעולת החונך", style: "border-amber-300 bg-amber-50 text-amber-950" },
  "waiting-parent": { title: "ממתינה לתגובת ההורה", style: "border-violet-300 bg-violet-50 text-violet-950" },
  history: { title: "היסטוריית פגישות", style: "border-slate-300 bg-slate-50 text-slate-800" },
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
  const upcomingApproved = ordered.filter((item) => isUpcomingApprovedMeeting(item)).sort((left,right)=>effectiveStart(left)-effectiveStart(right));
  const visibleIds = new Set([...actionRequired, ...waitingForParent, ...upcomingApproved].map((item) => item.id));
  const history=ordered.filter((item)=>!visibleIds.has(item.id));
  const completed=history.filter((item)=>item.status==="accepted"&&effectiveStart(item)<Date.now()).sort((left,right)=>effectiveStart(right)-effectiveStart(left));
  const cancelled=history.filter((item)=>["cancelled","declined"].includes(item.status)).sort((left,right)=>new Date(right.updated_at).getTime()-new Date(left.updated_at).getTime());
  return { actionRequired, waitingForParent, upcomingApproved, history:[...completed,...cancelled], completed, cancelled };
}

function groupParentRequests(requests: Meeting[]) {
  const now = Date.now();
  const newestFirst = [...requests].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  return {
    actionRequired: newestFirst.filter((item) => item.status === "alternative_proposed" || (item.status === "accepted" && Boolean(item.proposed_start_at))),
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
  if (item.status === "declined") return "בוטלה";
  if (item.status === "cancelled") return "בוטלה";
  return "ממתינה לתשובת החונך";
}

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span aria-label={`${count} עדכונים חדשים`} className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{count}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
