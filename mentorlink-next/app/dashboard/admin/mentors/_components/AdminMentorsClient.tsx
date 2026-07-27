"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "pending_review" | "approved" | "published" | "paused";
type Summary = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  submittedAt: string | null;
  isMinor: boolean | null;
  status: Status;
};
type Detail = {
  userId: string;
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
};

const LABELS: Record<string, string> = {
  first_name: "First name", last_name: "Last name", birth_date: "Birth date",
  grade: "Grade", school: "School", city: "City", phone: "Phone",
  languages: "Languages", bio: "Biography", weekly_schedule: "Weekly schedule",
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
  parent_name: "Parent or guardian name", parent_relationship: "Relationship",
  details_confirmed: "Details confirmed", participation_confirmed: "Participation confirmed",
  contact_confirmed: "Contact confirmed", consent_requested_at: "Consent requested",
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
  return body as { mentors?: Summary[]; fieldChangeMentors?: Summary[]; publicationMentors?: Summary[]; mentor?: Detail };
}

export default function AdminMentorsClient({ userId }: { userId?: string }) {
  const [mentors, setMentors] = useState<Summary[] | null>(null);
  const [fieldChangeMentors, setFieldChangeMentors] = useState<Summary[] | null>(null);
  const [publicationMentors, setPublicationMentors] = useState<Summary[] | null>(null);
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
        {!error && !userId && (mentors === null || fieldChangeMentors === null || publicationMentors === null) ? <Loading /> : null}
        {!error && mentor ? <DetailView mentor={mentor} /> : null}
        {!error && mentors && fieldChangeMentors && publicationMentors ? <QueueView pending={mentors} fieldChanges={fieldChangeMentors} publication={publicationMentors} /> : null}
      </div>
    </main>
  );
}

function QueueView({ pending, fieldChanges, publication }: { pending: Summary[]; fieldChanges: Summary[]; publication: Summary[] }) {
  return (
    <div className="space-y-10">
      <QueueSection title="Pending mentor reviews" empty="There are no mentor profiles awaiting review." mentors={pending} />
      <QueueSection title="Pending critical field changes" empty="There are no critical field changes awaiting review." mentors={fieldChanges} />
      <QueueSection title="Publication management" empty="There are no approved or published mentors to manage." mentors={publication} />
    </div>
  );
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
      {pendingChanges.length ? <ReviewSection title="Pending critical field changes">
        <div className="grid gap-4">{pendingChanges.map((change) => <article key={change.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold">{LABELS[change.fieldName] ?? change.fieldName}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-500">Current approved value</p><p className="mt-1 break-words">{formatValue(change.currentValue)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Requested value</p><p className="mt-1 break-words">{formatValue(change.requestedValue)}</p></div></div>
          <div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => void reviewField(change.id, "approve")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">Approve field</button><button disabled={busy} onClick={() => void reviewField(change.id, "reject")} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-50">Reject field</button></div>
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function Loading() { return <p className="rounded-2xl bg-white p-8 text-slate-600">Loading…</p>; }
function EmptyValue() { return <p className="text-slate-500">No saved information.</p>; }
function ErrorPanel({ message }: { message: string }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p className="font-bold">Access denied</p><p className="mt-1">{message}</p></div>; }
