import "server-only";

import { excludeAdministrator } from "./admin-authorization-core";
import { isPendingQueueStatus } from "./admin-review-action-core";
import { getAgeFromBirthDate } from "./mentor-age";
import { createSupabaseAdmin } from "./supabase-admin";

export type AdminReviewDataClient = ReturnType<typeof createSupabaseAdmin>;

export type PendingMentorSummary = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  city: string | null;
  submittedAt: string | null;
  isMinor: boolean | null;
};

export type PendingMentorDetail = {
  userId: string;
  status: "pending_review";
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

function check(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function isMinor(birthDate: unknown) {
  if (typeof birthDate !== "string") return null;
  const age = getAgeFromBirthDate(birthDate);
  return age === null ? null : age < 18;
}

export async function getPendingMentors(
  administratorUserId: string,
  admin: AdminReviewDataClient,
): Promise<PendingMentorSummary[]> {
  const publicationsResult = await admin
    .from("mentor_publication")
    .select("user_id, submitted_at, status")
    .eq("status", "pending_review")
    .neq("user_id", administratorUserId)
    .order("submitted_at", { ascending: true });
  check("Unable to load pending mentor reviews", publicationsResult.error);

  const publications = excludeAdministrator(
    (publicationsResult.data ?? []) as Array<{
      user_id: string;
      submitted_at: string | null;
      status: string;
    }>,
    administratorUserId,
  ).filter((publication) => isPendingQueueStatus(publication.status));
  if (!publications.length) return [];

  const profilesResult = await admin
    .from("mentor_profiles")
    .select("user_id, first_name, last_name, birth_date, city")
    .in("user_id", publications.map(({ user_id }) => user_id));
  check("Unable to load mentor summaries", profilesResult.error);

  const profiles = new Map(
    ((profilesResult.data ?? []) as Array<Record<string, string | null>>).map(
      (profile) => [profile.user_id, profile],
    ),
  );
  return publications.map((publication) => {
    const profile = profiles.get(publication.user_id);
    return {
      userId: publication.user_id,
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      birthDate: profile?.birth_date ?? null,
      city: profile?.city ?? null,
      submittedAt: publication.submitted_at,
      isMinor: isMinor(profile?.birth_date),
    };
  });
}

export async function getPendingMentorDetail(
  userId: string,
  administratorUserId: string,
  admin: AdminReviewDataClient,
): Promise<PendingMentorDetail | null> {
  if (userId === administratorUserId) return null;
  const publication = await admin
    .from("mentor_publication")
    .select("submitted_at")
    .eq("user_id", userId)
    .eq("status", "pending_review")
    .maybeSingle();
  check("Unable to verify pending review", publication.error);
  if (!publication.data) return null;

  const results = await Promise.all([
    admin.from("mentor_profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_subjects").select("subject_id, custom_subject, age_groups, subjects(name)").eq("user_id", userId).order("subject_id"),
    admin.from("mentor_availability").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_locations").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_experience").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_preferences").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_parent_consents").select("status, parent_name, parent_relationship, details_confirmed, participation_confirmed, contact_confirmed, consent_requested_at, consented_at, declined_at, consent_version").eq("user_id", userId).maybeSingle(),
  ]);
  const failure = results.find(({ error }) => error);
  check("Unable to load mentor review", failure?.error ?? null);

  const [profileResult, subjectsResult, availability, locations, experience, preferences, parentConsent] = results;
  const profile = (profileResult.data as Record<string, unknown> | null) ?? null;
  const subjects = ((subjectsResult.data ?? []) as Array<{
    subject_id: number;
    custom_subject: string | null;
    age_groups: string[] | null;
    subjects: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>).map((subject) => {
    const joined = Array.isArray(subject.subjects) ? subject.subjects[0] : subject.subjects;
    return {
      subjectId: subject.subject_id,
      subjectName: joined?.name ?? null,
      customSubject: subject.custom_subject,
      ageGroups: subject.age_groups ?? [],
    };
  });

  let photoUrl: string | null = null;
  if (typeof profile?.profile_photo_path === "string" && profile.profile_photo_path) {
    const signed = await admin.storage.from("mentor-profile-photos").createSignedUrl(profile.profile_photo_path, 900);
    if (signed.error) console.error("Unable to sign mentor profile photo", signed.error);
    else photoUrl = signed.data.signedUrl;
  }

  return {
    userId,
    status: "pending_review",
    submittedAt: publication.data.submitted_at,
    profile,
    subjects,
    availability: (availability.data as Record<string, unknown> | null) ?? null,
    locations: (locations.data as Record<string, unknown> | null) ?? null,
    experience: (experience.data as Record<string, unknown> | null) ?? null,
    preferences: (preferences.data as Record<string, unknown> | null) ?? null,
    parentConsent: (parentConsent.data as Record<string, unknown> | null) ?? null,
    isMinor: isMinor(profile?.birth_date),
    photoUrl,
  };
}
