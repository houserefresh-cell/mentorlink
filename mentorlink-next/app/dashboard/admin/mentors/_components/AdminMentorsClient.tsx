"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Summary = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  city: string | null;
  submittedAt: string | null;
  isMinor: boolean | null;
};

type Detail = {
  userId: string;
  submittedAt: string | null;
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
};

const LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  birth_date: "Birth date",
  grade: "Grade",
  school: "School",
  city: "City",
  phone: "Phone",
  languages: "Languages",
  bio: "Biography",
  weekly_schedule: "Weekly schedule",
  flexible_availability: "Flexible availability",
  available_on_holidays: "Available on holidays",
  recurring_meetings: "Recurring meetings",
  one_time_meetings: "One-time meetings",
  time_preferences: "Preferred times",
  activity_areas: "Activity areas",
  preferred_schools: "Preferred schools",
  custom_school: "Other school",
  meeting_places: "Meeting places",
  has_previous_mentoring: "Previous mentoring experience",
  previous_mentoring_details: "Previous mentoring details",
  experience_types: "Experience types",
  courses_and_certificates: "Courses and certificates",
  strengths: "Strengths",
  relationship_values: "Relationship values",
  motivation: "Motivation",
  mentoring_types: "Mentoring types",
  preferred_age_groups: "Preferred age groups",
  preferred_gender: "Preferred gender",
  max_travel_distance_km: "Maximum travel distance (km)",
  meeting_modes: "Meeting modes",
  session_formats: "Session formats",
  preferred_meetings_per_week: "Preferred meetings per week",
  preferred_session_duration_minutes: "Session duration (minutes)",
  willing_special_needs: "Willing to mentor special needs",
  additional_matching_info: "Additional matching information",
  status: "Status",
  parent_name: "Parent or guardian name",
  parent_relationship: "Relationship",
  details_confirmed: "Details confirmed",
  participation_confirmed: "Participation confirmed",
  contact_confirmed: "Contact confirmed",
  consent_requested_at: "Consent requested",
  consented_at: "Consent granted",
  declined_at: "Consent declined",
  consent_version: "Consent version",
};

const HIDDEN_FIELDS = new Set([
  "user_id",
  "created_at",
  "updated_at",
  "profile_photo_path",
]);

async function authorizedGet(path: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("AUTHENTICATION_REQUIRED");
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await response.json()) as {
    error?: string;
    mentors?: Summary[];
    mentor?: Detail;
  };
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? "AUTHENTICATION_REQUIRED" : body.error ?? "Request failed",
    );
  }
  return body;
}

export default function AdminMentorsClient({ userId }: { userId?: string }) {
  const [mentors, setMentors] = useState<Summary[] | null>(null);
  const [mentor, setMentor] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    authorizedGet(
      userId ? `/api/admin/mentors/${encodeURIComponent(userId)}` : "/api/admin/mentors",
    )
      .then((body) => {
        if (!active) return;
        if (userId) setMentor(body.mentor ?? null);
        else setMentors(body.mentors ?? []);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const message =
          requestError instanceof Error ? requestError.message : "Request failed";
        if (message === "AUTHENTICATION_REQUIRED") {
          window.location.replace("/login");
          return;
        }
        setError(message);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
            Secure administrator area
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">
            {userId ? "Mentor profile review" : "Pending mentor reviews"}
          </h1>
          <p className="mt-2 text-slate-600">
            Read-only review. No approval or rejection controls are available.
          </p>
        </header>
        {error ? <ErrorPanel message={error} /> : null}
        {!error && userId && !mentor ? <Loading /> : null}
        {!error && !userId && mentors === null ? <Loading /> : null}
        {!error && mentor ? <DetailView mentor={mentor} /> : null}
        {!error && mentors ? <ListView mentors={mentors} /> : null}
      </div>
    </main>
  );
}

function ListView({ mentors }: { mentors: Summary[] }) {
  if (!mentors.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        There are no mentor profiles awaiting review.
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {mentors.map((mentor) => (
        <Link
          key={mentor.userId}
          href={`/dashboard/admin/mentors/${mentor.userId}`}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {[mentor.firstName, mentor.lastName].filter(Boolean).join(" ") ||
                  "Unnamed mentor"}
              </h2>
              <p className="mt-1 text-slate-600">
                {mentor.city || "City not saved"} ·{" "}
                {mentor.isMinor === true
                  ? "Minor"
                  : mentor.isMinor === false
                    ? "Adult"
                    : "Age unavailable"}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
              Pending review
            </span>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Submitted {formatDate(mentor.submittedAt)}
          </p>
        </Link>
      ))}
    </div>
  );
}

function DetailView({ mentor }: { mentor: Detail }) {
  return (
    <div className="space-y-6">
      <Link href="/dashboard/admin/mentors" className="font-bold text-blue-700">
        ← Back to pending reviews
      </Link>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="font-bold text-amber-900">Pending review</p>
        <p className="mt-1 text-sm text-amber-800">
          Submitted {formatDate(mentor.submittedAt)}
        </p>
      </section>
      <ReviewSection title="Personal profile">
        <RecordFields value={mentor.profile} />
      </ReviewSection>
      <ReviewSection title="Mentoring subjects">
        {mentor.subjects.length ? (
          <div className="grid gap-3">
            {mentor.subjects.map((subject) => (
              <div key={subject.subjectId} className="rounded-xl bg-slate-50 p-4">
                <p className="font-bold">
                  {subject.customSubject || subject.subjectName || "Unnamed subject"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Age groups: {subject.ageGroups.join(", ") || "Not saved"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyValue />
        )}
      </ReviewSection>
      <ReviewSection title="Availability">
        <RecordFields value={mentor.availability} />
      </ReviewSection>
      <ReviewSection title="Locations and schools">
        <RecordFields value={mentor.locations} />
      </ReviewSection>
      <ReviewSection title="Experience and mentoring approach">
        <RecordFields value={mentor.experience} />
      </ReviewSection>
      <ReviewSection title="Matching preferences">
        <RecordFields value={mentor.preferences} />
      </ReviewSection>
      <ReviewSection title="Profile photo">
        {mentor.photoUrl ? (
          <Image
            src={mentor.photoUrl}
            alt="Saved mentor profile"
            width={192}
            height={192}
            unoptimized
            className="h-48 w-48 rounded-2xl object-cover"
          />
        ) : (
          <EmptyValue />
        )}
      </ReviewSection>
      <ReviewSection title="Parent consent">
        <p className="mb-4 font-bold">
          {mentor.isMinor === true
            ? `Minor — consent status: ${String(mentor.parentConsent?.status ?? "missing")}`
            : mentor.isMinor === false
              ? "Adult — parent consent not required"
              : "Age unavailable — consent requirement cannot be determined"}
        </p>
        {mentor.isMinor === true ? (
          <RecordFields value={mentor.parentConsent} />
        ) : null}
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function RecordFields({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <EmptyValue />;
  const fields = Object.entries(value).filter(([key]) => !HIDDEN_FIELDS.has(key));
  if (!fields.length) return <EmptyValue />;
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, fieldValue]) => (
        <div key={key} className="rounded-xl bg-slate-50 p-4">
          <dt className="text-sm font-bold text-slate-500">
            {LABELS[key] ?? key.replaceAll("_", " ")}
          </dt>
          <dd className="mt-1 break-words text-slate-900">{formatValue(fieldValue)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(value: unknown): string {
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

function Loading() {
  return <p className="rounded-2xl bg-white p-8 text-slate-600">Loading…</p>;
}

function EmptyValue() {
  return <p className="text-slate-500">No saved information.</p>;
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
      <p className="font-bold">Access denied</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
