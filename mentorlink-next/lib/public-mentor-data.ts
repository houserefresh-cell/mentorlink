import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdmin } from "./supabase-admin";
import {
  mapPublishedMentors,
  type AvailabilityRow,
  type ExperienceRow,
  type PreferenceRow,
  type ProfileRow,
  type PublishedRow,
  type SubjectRow,
} from "./public-mentor-core";

export async function loadPublishedMentors(admin = createSupabaseAdmin()) {
  const publications = await admin
    .from("mentor_publication")
    .select("user_id, status, public_booking_id")
    .eq("status", "published");
  if (publications.error) throw new Error("Unable to load published mentors");
  const ids = ((publications.data ?? []) as PublishedRow[]).map((row) => row.user_id);
  if (!ids.length) return [];

  const [profiles, subjects, experiences, preferences, availability, consents] = await Promise.all([
    admin.from("mentor_profiles").select("user_id, first_name, last_name, city, bio, birth_date, profile_photo_path").in("user_id", ids),
    admin.from("mentor_subjects").select("user_id, custom_subject, age_groups, subjects(name)").in("user_id", ids),
    admin.from("mentor_experience").select("user_id, experience_types, mentoring_types").in("user_id", ids),
    admin.from("mentor_preferences").select("user_id, preferred_age_groups, meeting_modes").in("user_id", ids),
    admin.from("mentor_availability").select("user_id, flexible_availability, available_on_holidays, time_preferences").in("user_id", ids),
    admin.from("mentor_parent_consents").select("user_id, status, profile_photo_visibility").in("user_id", ids),
  ]);
  if ([profiles, subjects, experiences, preferences, availability, consents].some((result) => result.error)) {
    throw new Error("Unable to load published mentor cards");
  }
  const mapped = mapPublishedMentors({
    publications: publications.data as PublishedRow[],
    profiles: profiles.data as ProfileRow[],
    subjects: subjects.data as SubjectRow[],
    experiences: experiences.data as ExperienceRow[],
    preferences: preferences.data as PreferenceRow[],
    availability: availability.data as AvailabilityRow[],
  });

  const allowedPhotoPaths = new Map(
    (profiles.data ?? []).flatMap((profile) => {
      const consent = (consents.data ?? []).find((row) => row.user_id === profile.user_id);
      if (consent?.status !== "approved" || consent.profile_photo_visibility !== "public" || !profile.profile_photo_path) return [];
      const publication = (publications.data ?? []).find((row) => row.user_id === profile.user_id);
      return publication ? [[publication.public_booking_id, profile.profile_photo_path] as const] : [];
    }),
  );

  return Promise.all(mapped.map(async (mentor) => {
    const path = allowedPhotoPaths.get(mentor.bookingId);
    if (!path) return mentor;
    const { data } = await admin.storage.from("mentor-profile-photos").createSignedUrl(path, 3600);
    return { ...mentor, profilePhotoUrl: data?.signedUrl ?? null };
  }));
}

export const getPublishedMentors = unstable_cache(
  loadPublishedMentors,
  ["public-published-mentors"],
  { revalidate: 60, tags: ["public-mentors"] },
);
