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
import { loadSlots } from "./meeting-data";
import { getMentorCapabilities } from "./mentor-age";

export async function loadPublishedMentors(admin = createSupabaseAdmin(), userId?: string | null) {
  const publications = await admin
    .from("mentor_publication")
    .select("user_id, status, public_booking_id")
    .eq("status", "published");
  if (publications.error) throw new Error("Unable to load published mentors");
  const ids = ((publications.data ?? []) as PublishedRow[]).map((row) => row.user_id);
  if (!ids.length) return [];

  const [profiles, subjects, experiences, preferences, availability, consents, visibilitySettings, visibilityCommunityLinks, userCommunityMemberships] = await Promise.all([
    admin.from("mentor_profiles").select("user_id, first_name, last_name, city, bio, birth_date, profile_photo_path").in("user_id", ids),
    admin.from("mentor_subjects").select("user_id, custom_subject, age_groups, subjects(name)").in("user_id", ids),
    admin.from("mentor_experience").select("user_id, experience_types, mentoring_types").in("user_id", ids),
    admin.from("mentor_preferences").select("user_id, preferred_age_groups, meeting_modes").in("user_id", ids),
    admin.from("mentor_availability").select("user_id, flexible_availability, available_on_holidays, time_preferences").in("user_id", ids),
    admin.from("mentor_parent_consents").select("user_id, status, profile_photo_visibility").in("user_id", ids),
    admin.from("mentor_visibility_settings").select("user_id, general_scope").in("user_id", ids),
    admin.from("mentor_visibility_communities").select("user_id, community_id").in("user_id", ids).eq("status", "active"),
    userId ? admin.from("community_memberships").select("community_id").eq("user_id", userId).eq("status", "active") : Promise.resolve({ data: [], error: null }),
  ]);
  if ([profiles, subjects, experiences, preferences, availability, consents, visibilitySettings, visibilityCommunityLinks, userCommunityMemberships].some((result) => result.error)) {
    throw new Error("Unable to load published mentor cards");
  }
  const visibilityMap = new Map((visibilitySettings.data ?? []).map((row) => [row.user_id, row.general_scope ?? "public"]));
  const allowedCommunityMap = new Map<string, Set<string>>();
  for (const link of visibilityCommunityLinks.data ?? []) {
    const communityId = String(link.community_id ?? "");
    if (!communityId) continue;
    const set = allowedCommunityMap.get(link.user_id) ?? new Set<string>();
    set.add(communityId);
    allowedCommunityMap.set(link.user_id, set);
  }
  const userCommunityIds = new Set((userCommunityMemberships.data ?? []).map((row) => String(row.community_id ?? "")).filter(Boolean));
  const visibleUserIds = new Set<string>();
  for (const publication of publications.data ?? []) {
    const userIdValue = publication.user_id;
    const scope = visibilityMap.get(userIdValue) ?? "public";
    if (scope === "public") {
      visibleUserIds.add(userIdValue);
      continue;
    }
    if (userId && allowedCommunityMap.get(userIdValue)?.size) {
      const match = [...(allowedCommunityMap.get(userIdValue) ?? [])].some((communityId) => userCommunityIds.has(communityId));
      if (match) visibleUserIds.add(userIdValue);
    }
  }
  const mapped = mapPublishedMentors({
    publications: (publications.data as PublishedRow[]).filter((row) => visibleUserIds.has(row.user_id)),
    profiles: profiles.data as ProfileRow[],
    subjects: subjects.data as SubjectRow[],
    experiences: experiences.data as ExperienceRow[],
    preferences: preferences.data as PreferenceRow[],
    availability: availability.data as AvailabilityRow[],
  });

  const windowsResult = await admin.from("mentor_availability_windows").select("id, mentor_user_id, weekday, start_time, end_time, meeting_mode").in("mentor_user_id", ids).eq("is_active", true).order("weekday").order("start_time");
  if (windowsResult.error) throw new Error("Unable to load mentor availability windows");
  const windowIds = (windowsResult.data ?? []).map(window => window.id);
  const linksResult = windowIds.length ? await admin.from("mentor_availability_window_subjects").select("window_id, subjects(name)").in("window_id", windowIds) : { data: [], error: null };
  if (linksResult.error) throw new Error("Unable to load mentor availability subjects");
  const subjectsByWindow = new Map<string,string[]>();
  for (const link of linksResult.data ?? []) { const joined=Array.isArray(link.subjects)?link.subjects[0]:link.subjects; if(joined?.name)subjectsByWindow.set(link.window_id,[...(subjectsByWindow.get(link.window_id)??[]),joined.name]); }
  const windowsByMentor = new Map<string,Array<{weekday:number;startTime:string;endTime:string;meetingMode:string;subjects:string[]}>>();
  for(const window of windowsResult.data??[]){windowsByMentor.set(window.mentor_user_id,[...(windowsByMentor.get(window.mentor_user_id)??[]),{weekday:window.weekday,startTime:String(window.start_time).slice(0,5),endTime:String(window.end_time).slice(0,5),meetingMode:window.meeting_mode,subjects:[...new Set(subjectsByWindow.get(window.id)??[])]}])}

  const allowedPhotoPaths = new Map(
    (profiles.data ?? []).flatMap((profile) => {
      const consent = (consents.data ?? []).find((row) => row.user_id === profile.user_id);
      const capabilities = getMentorCapabilities(profile.birth_date);
      if (!profile.profile_photo_path) return [];
      if (!capabilities.isAdult && (consent?.status !== "approved" || consent.profile_photo_visibility !== "public")) return [];
      const publication = (publications.data ?? []).find((row) => row.user_id === profile.user_id);
      return publication ? [[publication.public_booking_id, profile.profile_photo_path] as const] : [];
    }),
  );

  const userIdByBookingId = new Map((publications.data ?? []).map((row) => [row.public_booking_id, row.user_id]));
  return Promise.all(mapped.map(async (mentor) => {
    const path = allowedPhotoPaths.get(mentor.bookingId);
    const mentorUserId = userIdByBookingId.get(mentor.bookingId);
    const [photo, slots] = await Promise.all([
      path ? admin.storage.from("mentor-profile-photos").createSignedUrl(path, 3600) : Promise.resolve({ data: null }),
      mentorUserId ? loadSlots(admin, mentorUserId, new Date(), 21).catch(() => []) : Promise.resolve([]),
    ]);
    return { ...mentor, profilePhotoUrl: photo.data?.signedUrl ?? null, weeklyAvailability: mentorUserId ? windowsByMentor.get(mentorUserId) ?? [] : [], nextAvailability: slots.slice(0, 4).map((slot) => ({ startAt: slot.startAt, meetingMode: slot.meetingMode, durationMinutes: slot.durations[0] })) };
  }));
}

export const getPublishedMentors = unstable_cache(
  async (userId?: string | null) => loadPublishedMentors(createSupabaseAdmin(), userId),
  ["public-published-mentors"],
  { revalidate: 60, tags: ["public-mentors"] },
);
