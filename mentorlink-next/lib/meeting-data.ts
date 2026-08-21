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
  const [windows, mentorBlackouts, administratorBlackouts, accepted, activities] = await Promise.all([
    client.from("mentor_availability_windows").select("*").eq("mentor_user_id", mentorUserId).eq("is_active", true),
    client.from("mentor_blackout_periods").select("starts_at, ends_at").eq("mentor_user_id", mentorUserId).gt("ends_at", now.toISOString()),
    client.from("administrator_blackout_periods").select("starts_at, ends_at").gt("ends_at", now.toISOString()),
    client.from("meeting_requests").select("requested_start_at, requested_end_at, confirmed_start_at, confirmed_end_at").eq("mentor_user_id", mentorUserId).eq("status", "accepted"),
    client.from("mentor_activities").select("id").eq("mentor_user_id", mentorUserId).eq("status", "published"),
  ]);
  if (windows.error || mentorBlackouts.error || administratorBlackouts.error || accepted.error || activities.error) throw new Error("Scheduling data unavailable");
  const activityIds = (activities.data ?? []).map((activity) => activity.id);
  const activitySessions = activityIds.length
    ? await client.from("mentor_activity_sessions").select("starts_at, ends_at").in("activity_id", activityIds).gt("ends_at", now.toISOString())
    : { data: [], error: null };
  if (activitySessions.error) throw new Error("Activity scheduling data unavailable");
  const windowIds = (windows.data ?? []).map((window) => window.id);
  const linked = windowIds.length
    ? await client
      .from("mentor_availability_window_subjects")
      .select("window_id, subjects(name)")
      .in("window_id", windowIds)
    : { data: [], error: null };
  if (linked.error) throw new Error("Scheduling subjects unavailable");
  const subjectsByWindow = new Map<string, string[]>();
  for (const link of linked.data ?? []) {
    const joined = Array.isArray(link.subjects) ? link.subjects[0] : link.subjects;
    if (!joined?.name) continue;
    subjectsByWindow.set(link.window_id, [
      ...(subjectsByWindow.get(link.window_id) ?? []),
      joined.name,
    ]);
  }
  return generateBookableSlots({
    windows: (windows.data ?? [])
      .filter((window) => subjectsByWindow.has(window.id))
      .map((window) => ({
        ...window,
        subjects: [...new Set(subjectsByWindow.get(window.id) ?? [])],
      })) as AvailabilityWindow[],
    blackouts: [...(mentorBlackouts.data ?? []), ...(administratorBlackouts.data ?? [])],
    accepted: [
      ...(accepted.data ?? [])
      .map((meeting) => ({
        starts_at: meeting.confirmed_start_at ?? meeting.requested_start_at,
        ends_at: meeting.confirmed_end_at ?? meeting.requested_end_at,
      }))
      .filter((meeting) => new Date(meeting.ends_at) > now),
      ...(activitySessions.data ?? []),
    ],
    now,
    days,
  });
}
