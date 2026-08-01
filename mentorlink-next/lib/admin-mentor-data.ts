import "server-only";

import { excludeAdministrator } from "./admin-authorization-core";
import { isPendingQueueStatus } from "./admin-review-action-core";
import { getAgeFromBirthDate } from "./mentor-age";
import { createSupabaseAdmin } from "./supabase-admin";
import { classifyMentorRegistration, MENTOR_REGISTRATION_STAGE_LABELS, type MentorRegistrationStage } from "./mentor-registration";

export type AdminReviewDataClient = ReturnType<typeof createSupabaseAdmin>;
export type AdminMentorStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "published"
  | "paused"
  | "rejected";
export type MentorSummary = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  city: string | null;
  submittedAt: string | null;
  status: AdminMentorStatus;
  isMinor: boolean | null;
};
export type MentorRegistrationSummary = MentorSummary & {
  email: string | null;
  phone: string | null;
  school: string | null;
  createdAt: string;
  emailConfirmed: boolean;
  parentConsentStatus: string | null;
  stage: MentorRegistrationStage;
  stageLabel: string;
  lastCompletedStep: string;
  hasPendingSensitiveChanges: boolean;
};
export type AdminMentorDetail = {
  userId: string;
  status: AdminMentorStatus;
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

function check(context: string, error: { message: string } | null) {
  if (error) throw new Error(`${context}: ${error.message}`);
}
function minor(birthDate: unknown) {
  if (typeof birthDate !== "string") return null;
  const age = getAgeFromBirthDate(birthDate);
  return age === null ? null : age < 18;
}

export async function getAllMentorRegistrations(
  administratorUserId: string,
  admin: AdminReviewDataClient,
): Promise<MentorRegistrationSummary[]> {
  const authUsers: Array<{ id: string; email?: string; phone?: string; created_at: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> }> = [];
  for (let page = 1; ; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    check("Unable to load registered users", result.error);
    authUsers.push(...result.data.users);
    if (result.data.users.length < 200) break;
  }
  const mentors = authUsers.filter((user) => user.id !== administratorUserId && user.user_metadata?.role === "mentor");
  if (!mentors.length) return [];
  const ids = mentors.map((user) => user.id);
  const [profilesResult, publicationsResult, consentsResult, subjectsResult, locationsResult, availabilityResult, experienceResult, changesResult] = await Promise.all([
    admin.from("mentor_profiles").select("user_id, first_name, last_name, birth_date, city, school, phone, bio").in("user_id", ids),
    admin.from("mentor_publication").select("user_id, submitted_at, status").in("user_id", ids),
    admin.from("mentor_parent_consents").select("user_id, status").in("user_id", ids),
    admin.from("mentor_subjects").select("user_id").in("user_id", ids),
    admin.from("mentor_locations").select("user_id").in("user_id", ids),
    admin.from("mentor_availability").select("user_id").in("user_id", ids),
    admin.from("mentor_experience").select("user_id").in("user_id", ids),
    admin.from("mentor_public_pending_changes").select("mentor_user_id").eq("status", "pending").in("mentor_user_id", ids),
  ]);
  for (const result of [profilesResult, publicationsResult, consentsResult, subjectsResult, locationsResult, availabilityResult, experienceResult, changesResult]) check("Unable to load registration status", result.error);
  const byId = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => new Map(rows.map((row) => [String(row[key]), row]));
  const profiles = byId((profilesResult.data ?? []) as Array<Record<string, unknown>>, "user_id");
  const publications = byId((publicationsResult.data ?? []) as Array<Record<string, unknown>>, "user_id");
  const consents = byId((consentsResult.data ?? []) as Array<Record<string, unknown>>, "user_id");
  const subjectIds = new Set((subjectsResult.data ?? []).map((row) => row.user_id));
  const locationIds = new Set((locationsResult.data ?? []).map((row) => row.user_id));
  const availabilityIds = new Set((availabilityResult.data ?? []).map((row) => row.user_id));
  const experienceIds = new Set((experienceResult.data ?? []).map((row) => row.user_id));
  const sensitiveIds = new Set((changesResult.data ?? []).map((row) => row.mentor_user_id));
  return mentors.map((user) => {
    const profile = profiles.get(user.id);
    const publication = publications.get(user.id);
    const consent = consents.get(user.id);
    const profileComplete = Boolean(profile?.first_name && profile?.last_name && profile?.birth_date && profile?.city && profile?.bio && subjectIds.has(user.id) && locationIds.has(user.id) && availabilityIds.has(user.id) && experienceIds.has(user.id));
    const stage = classifyMentorRegistration({ birthDate: typeof profile?.birth_date === "string" ? profile.birth_date : null, emailConfirmed: Boolean(user.email_confirmed_at), profileComplete, parentConsentStatus: typeof consent?.status === "string" ? consent.status : null, publicationStatus: typeof publication?.status === "string" ? publication.status : null });
    const completed = [profile ? "פרטים אישיים" : null, subjectIds.has(user.id) ? "מקצועות" : null, locationIds.has(user.id) ? "אזורי פעילות" : null, availabilityIds.has(user.id) ? "זמינות" : null, experienceIds.has(user.id) ? "ניסיון" : null].filter(Boolean);
    return {
      userId: user.id,
      firstName: typeof profile?.first_name === "string" ? profile.first_name : typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null,
      lastName: typeof profile?.last_name === "string" ? profile.last_name : typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : null,
      birthDate: typeof profile?.birth_date === "string" ? profile.birth_date : null,
      city: typeof profile?.city === "string" ? profile.city : null,
      submittedAt: typeof publication?.submitted_at === "string" ? publication.submitted_at : null,
      status: (typeof publication?.status === "string" ? publication.status : "draft") as AdminMentorStatus,
      isMinor: minor(profile?.birth_date), email: user.email ?? null,
      phone: typeof profile?.phone === "string" ? profile.phone : user.phone ?? null,
      school: typeof profile?.school === "string" ? profile.school : null,
      createdAt: user.created_at, emailConfirmed: Boolean(user.email_confirmed_at),
      parentConsentStatus: typeof consent?.status === "string" ? consent.status : null,
      stage, stageLabel: MENTOR_REGISTRATION_STAGE_LABELS[stage],
      lastCompletedStep: completed.at(-1) ?? "יצירת חשבון",
      hasPendingSensitiveChanges: sensitiveIds.has(user.id),
    };
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function summaries(
  administratorUserId: string,
  admin: AdminReviewDataClient,
  statuses: AdminMentorStatus[],
) {
  const publicationsResult = await admin
    .from("mentor_publication")
    .select("user_id, submitted_at, status")
    .in("status", statuses)
    .neq("user_id", administratorUserId)
    .order("submitted_at", { ascending: true });
  check("Unable to load mentor reviews", publicationsResult.error);
  const publications = excludeAdministrator(
    (publicationsResult.data ?? []) as Array<{
      user_id: string;
      submitted_at: string | null;
      status: AdminMentorStatus;
    }>,
    administratorUserId,
  ).filter((publication) => statuses.includes(publication.status));
  if (!publications.length) return [];
  const profilesResult = await admin
    .from("mentor_profiles")
    .select("user_id, first_name, last_name, birth_date, city")
    .in("user_id", publications.map((publication) => publication.user_id));
  check("Unable to load mentor summaries", profilesResult.error);
  const profiles = new Map(
    ((profilesResult.data ?? []) as Array<Record<string, string | null>>)
      .map((profile) => [profile.user_id, profile]),
  );
  return publications.map((publication): MentorSummary => {
    const profile = profiles.get(publication.user_id);
    return {
      userId: publication.user_id,
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      birthDate: profile?.birth_date ?? null,
      city: profile?.city ?? null,
      submittedAt: publication.submitted_at,
      status: publication.status,
      isMinor: minor(profile?.birth_date),
    };
  });
}

export async function getPendingMentors(
  administratorUserId: string,
  admin: AdminReviewDataClient,
) {
  const results = await summaries(administratorUserId, admin, ["pending_review"]);
  return results.filter((mentor) => isPendingQueueStatus(mentor.status));
}

export async function getPendingFieldChangeMentors(
  administratorUserId: string,
  admin: AdminReviewDataClient,
) {
  const changes = await admin.from("mentor_public_pending_changes")
    .select("mentor_user_id").eq("status", "pending");
  check("Unable to load pending field reviews", changes.error);
  const ids = [...new Set((changes.data ?? []).map((change) => change.mentor_user_id))]
    .filter((id) => id !== administratorUserId);
  if (!ids.length) return [];
  const candidates = await summaries(administratorUserId, admin, ["approved", "published", "paused"]);
  return candidates.filter((mentor) => ids.includes(mentor.userId));
}
export function getPublicationMentors(
  administratorUserId: string,
  admin: AdminReviewDataClient,
) {
  return summaries(administratorUserId, admin, ["approved", "published", "paused"]);
}

export async function getAdminMentorDetail(
  userId: string,
  administratorUserId: string,
  admin: AdminReviewDataClient,
): Promise<AdminMentorDetail | null> {
  if (userId === administratorUserId) return null;
  const publication = await admin
    .from("mentor_publication")
    .select("submitted_at, status, published_at")
    .eq("user_id", userId)
    .in("status", ["pending_review", "approved", "published", "paused"])
    .maybeSingle();
  check("Unable to verify administrator review", publication.error);
  if (!publication.data) return null;
  const results = await Promise.all([
    admin.from("mentor_profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_subjects").select("subject_id, custom_subject, age_groups, subjects(name)").eq("user_id", userId).order("subject_id"),
    admin.from("mentor_availability").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_locations").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_experience").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_preferences").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_parent_consents").select("status, parent_name, parent_relationship, details_confirmed, participation_confirmed, contact_confirmed, consent_requested_at, consented_at, declined_at, consent_version").eq("user_id", userId).maybeSingle(),
    admin.from("mentor_public_pending_changes").select("id, field_name, current_value, requested_value, requested_at").eq("mentor_user_id", userId).eq("status", "pending").order("requested_at"),
  ]);
  const failure = results.find((result) => result.error);
  check("Unable to load mentor review", failure?.error ?? null);
  const [profileResult, subjectsResult, availability, locations, experience, preferences, parentConsent, pendingChanges] = results;
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
    if (!signed.error) photoUrl = signed.data.signedUrl;
  }
  return {
    userId,
    status: publication.data.status as AdminMentorStatus,
    submittedAt: publication.data.submitted_at,
    publishedAt: publication.data.published_at,
    profile,
    subjects,
    availability: (availability.data as Record<string, unknown> | null) ?? null,
    locations: (locations.data as Record<string, unknown> | null) ?? null,
    experience: (experience.data as Record<string, unknown> | null) ?? null,
    preferences: (preferences.data as Record<string, unknown> | null) ?? null,
    parentConsent: (parentConsent.data as Record<string, unknown> | null) ?? null,
    isMinor: minor(profile?.birth_date),
    photoUrl,
    pendingChanges: ((pendingChanges.data ?? []) as Array<{ id: string; field_name: string; current_value: unknown; requested_value: unknown; requested_at: string }>).map((change) => ({ id: change.id, fieldName: change.field_name, currentValue: change.current_value, requestedValue: change.requested_value, requestedAt: change.requested_at })),
  };
}
