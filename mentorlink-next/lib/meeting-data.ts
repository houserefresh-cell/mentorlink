import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBookableSlots, type AvailabilityWindow } from "./meeting-scheduling-core";

export async function loadPublishedSchedulingMentor(
  client: SupabaseClient,
  publicBookingId: string,
) {
  const publication = await client
    .from("mentor_publication")
    .select("user_id, public_booking_id")
    .eq("public_booking_id", publicBookingId)
    .eq("status", "published")
    .maybeSingle();
  if (publication.error || !publication.data) return null;
  const mentorUserId = publication.data.user_id as string;
  const [profile, subjects, preferences] = await Promise.all([
    client.from("mentor_profiles").select("first_name, last_name").eq("user_id", mentorUserId).maybeSingle(),
    client.from("mentor_subjects").select("custom_subject, subjects(name)").eq("user_id", mentorUserId),
    client.from("mentor_preferences").select("meeting_modes").eq("user_id", mentorUserId).maybeSingle(),
  ]);
  if (profile.error || subjects.error || preferences.error) return null;
  const offeredSubjects = [...new Set((subjects.data ?? []).map((row) => {
    const joined = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    return row.custom_subject || joined?.name;
  }).filter((value): value is string => Boolean(value)))];
  const modes = ((preferences.data?.meeting_modes ?? []) as string[])
    .flatMap((mode) => mode.includes("ו") && mode.includes("אונליין")
      ? ["פרונטלי", "אונליין"]
      : [mode])
    .filter((mode) => ["פרונטלי", "אונליין"].includes(mode));
  const first = profile.data?.first_name?.trim() || "חונך/ת";
  const initial = Array.from(profile.data?.last_name?.trim() ?? "")[0];
  return {
    mentorUserId,
    publicBookingId,
    displayName: initial ? `${first} ${initial}׳` : first,
    subjects: offeredSubjects,
    meetingModes: [...new Set(modes)],
  };
}

export async function loadSlots(
  client: SupabaseClient,
  mentorUserId: string,
  now = new Date(),
  days = 30,
) {
  const [windows, mentorBlackouts, administratorBlackouts, accepted] = await Promise.all([
    client.from("mentor_availability_windows").select("*").eq("mentor_user_id", mentorUserId).eq("is_active", true),
    client.from("mentor_blackout_periods").select("starts_at, ends_at").eq("mentor_user_id", mentorUserId).gt("ends_at", now.toISOString()),
    client.from("administrator_blackout_periods").select("starts_at, ends_at").gt("ends_at", now.toISOString()),
    client.from("meeting_requests").select("requested_start_at, requested_duration_minutes").eq("mentor_user_id", mentorUserId).eq("status", "accepted").gt("requested_start_at", now.toISOString()),
  ]);
  if (windows.error || mentorBlackouts.error || administratorBlackouts.error || accepted.error) throw new Error("Scheduling data unavailable");
  return generateBookableSlots({
    windows: (windows.data ?? []) as AvailabilityWindow[],
    blackouts: [...(mentorBlackouts.data ?? []), ...(administratorBlackouts.data ?? [])],
    accepted: (accepted.data ?? []).map((meeting) => ({
      starts_at: meeting.requested_start_at,
      ends_at: new Date(new Date(meeting.requested_start_at).getTime() + meeting.requested_duration_minutes * 60_000).toISOString(),
    })),
    now,
    days,
  });
}
