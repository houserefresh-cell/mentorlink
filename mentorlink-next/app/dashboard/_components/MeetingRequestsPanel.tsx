"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isUpcomingApprovedMeeting, newestFirst, requiresMentorAction, waitsForParentAction } from "@/lib/mentor-dashboard-status";

type Slot = { startAt: string; meetingMode: string; durations: number[] };
type Meeting = {
  id: string;
  mentor_display_name?: string;
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
};

export default function MeetingRequestsPanel({ role }: { role: "parent" | "mentor" }) {
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<Meeting[]>([]);
  const [message, setMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");

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

  const groups = useMemo(() => groupParentRequests(requests), [requests]);
  const mentorGroups = useMemo(() => groupMentorRequests(requests), [requests]);

  if (loadState === "loading") return <p role="status" className="mt-8 rounded-2xl bg-white p-5 font-bold text-slate-600">טוען פגישות...</p>;
  if (loadState === "error") return <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><p className="font-bold">לא ניתן לטעון את הפגישות כרגע.</p><button type="button" disabled={!token} onClick={() => void load(token)} className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 font-bold disabled:opacity-50">ניסיון נוסף</button></div>;

  return (
    <section dir="rtl" className="mt-8" aria-labelledby="meeting-requests-title">
      {role === "parent" ? (
        <>
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm" aria-labelledby="parent-action-title">
            <h2 id="parent-action-title" className="text-2xl font-black text-amber-950">בקשות שממתינות לתשובתך</h2>
            <p className="mt-2 text-sm text-amber-900">מועדים חלופיים שהחונך הציע וממתינים לאישור או לדחייה שלך.</p>
            <h3 className="mt-4 text-lg font-black text-amber-950">דורשות פעולה ממני</h3>
            <RequestList requests={groups.actionRequired} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} empty="אין כרגע בקשות שממתינות לתשובתך." />
          </section>

          <div className="mt-8 flex items-center gap-3">
            <h2 id="meeting-requests-title" className="text-2xl font-black">הבקשות והפגישות שלי</h2>
            <NotificationBadge count={unreadCount} token={token} clear={() => setUnreadCount(0)} />
          </div>
          <div className="mt-5 space-y-7">
            <RequestGroup title="ממתינות לתשובת החונך" requests={groups.waitingForMentor} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup title="מאושרות וקרובות" requests={groups.upcoming} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup title="התקיימו" requests={groups.completed} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup title="נדחו או בוטלו" requests={groups.closed} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup title="היסטוריה" requests={groups.history} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <h2 id="meeting-requests-title" className="text-2xl font-black">בקשות לפגישה</h2>
            <NotificationBadge count={unreadCount} token={token} clear={() => setUnreadCount(0)} />
          </div>
          <div className="mt-5 space-y-7">
            <RequestGroup id="mentor-action" title="בקשות שמחכות לפעולת החונך" requests={mentorGroups.actionRequired} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup id="waiting-parent" title="הצעות שמחכות לתשובת ההורה" requests={mentorGroups.waitingForParent} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup id="upcoming-approved" title="פגישות קרובות שאושרו" requests={mentorGroups.upcomingApproved} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
            <RequestGroup id="meeting-history" title="היסטוריה" requests={mentorGroups.history} role={role} busyId={busyId} slots={slots} alternatives={alternatives} setAlternatives={setAlternatives} act={act} proposeNext={proposeNext} />
          </div>
        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{message}</p>}
    </section>
  );
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
  return <div className="mt-3 grid gap-4">{requests.map((item) => <MeetingCard key={item.id} item={item} {...props} />)}</div>;
}

function MeetingCard({ item, role, busyId, slots, alternatives, setAlternatives, act, proposeNext }: Omit<ListProps, "requests"> & { item: Meeting }) {
  const confirmedStart = item.confirmed_start_at;
  const confirmedDuration = item.confirmed_duration_minutes;
  const declinedAlternative = item.status === "declined" && Boolean(item.proposed_start_at);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-black">{role === "parent" ? item.mentor_display_name : `${item.child_first_name} · ${item.child_grade_or_age}`}</h4>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{statusLabel(item, role)}</span>
      </div>
      <p className="mt-2">{item.subject} · {item.meeting_mode}</p>
      <p className="mt-2 text-sm text-slate-600">המועד המקורי: {formatDate(item.requested_start_at)} · {item.requested_duration_minutes} דקות</p>
      {item.proposed_start_at && item.proposed_duration_minutes ? (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 font-bold text-amber-950">המועד החלופי: {formatDate(item.proposed_start_at)} · {item.proposed_duration_minutes} דקות</p>
      ) : null}
      {item.status === "accepted" && confirmedStart && confirmedDuration ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-3 font-black text-emerald-900">המועד שאושר: {formatDate(confirmedStart)} · {confirmedDuration} דקות</p>
      ) : null}
      {declinedAlternative && role === "mentor" ? <p className="mt-2 font-bold text-red-700">ההורה דחה את המועד החלופי.</p> : null}
      {role === "mentor" ? <><p className="mt-2 text-slate-700">{item.help_goal}</p>{item.parent_message && <p className="mt-2 text-slate-600">{item.parent_message}</p>}</> : null}
      {item.mentor_response && <p className="mt-2 rounded-xl bg-slate-50 p-3">{item.mentor_response}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
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
            <select aria-label="בחירת מועד חלופי" value={alternatives[item.id] ?? ""} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-11 rounded-xl border border-slate-300 px-3">
              <option value="">בחירת מועד חלופי</option>
              {slots.filter((slot) => slot.meetingMode === item.meeting_mode && slot.startAt !== item.requested_start_at).flatMap((slot) => slot.durations.map((duration) => <option key={`${slot.startAt}-${duration}`} value={`${slot.startAt}|${duration}`}>{formatDate(slot.startAt)} · {duration} דקות</option>))}
            </select>
            <button type="button" disabled={busyId === item.id || !alternatives[item.id]} onClick={() => void proposeNext(item)} className="min-h-11 rounded-xl border border-blue-300 px-4 py-2 font-bold text-blue-800 disabled:opacity-50">הצעת המועד הזמין הבא</button>
          </>
        ) : null}
      </div>
    </article>
  );
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
    upcoming: newestFirst.filter((item) => item.status === "accepted" && effectiveStart(item) >= now),
    completed: newestFirst.filter((item) => item.status === "accepted" && effectiveStart(item) < now),
    closed: newestFirst.filter((item) => ["declined", "cancelled"].includes(item.status)),
    history: newestFirst.filter((item) => !["alternative_proposed", "pending", "accepted", "declined", "cancelled"].includes(item.status)),
  };
}

function effectiveStart(item: Meeting) {
  return new Date(item.confirmed_start_at ?? item.requested_start_at).getTime();
}

function statusLabel(item: Meeting, role: "parent" | "mentor") {
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