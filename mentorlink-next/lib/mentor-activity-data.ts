import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateMeetingUser } from "./meeting-auth";
import { createSupabaseAdmin } from "./supabase-admin";

export async function authenticateMentorActivityUser(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return { error: Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 }) };
  if (user.role !== "mentor") return { error: Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 }) };
  const publication = await createSupabaseAdmin().from("mentor_publication").select("status").eq("user_id", user.id).maybeSingle();
  if (publication.error || publication.data?.status !== "published") {
    return { error: Response.json({ error: "ניתן לנהל פעילויות רק לאחר השלמת ההרשמה, אישור המנהל ופרסום החונך.", code: "MENTOR_NOT_PUBLISHED" }, { status: 403 }) };
  }
  return { user };
}

export async function activeSubjectExists(client: SupabaseClient, subjectId: number | null) {
  if (subjectId === null) return true;
  const result = await client.from("subjects").select("id").eq("id", subjectId).eq("moderation_status", "active").maybeSingle();
  if (result.error) throw new Error("subject lookup failed");
  return Boolean(result.data);
}

export async function loadOwnedActivity(client: SupabaseClient, mentorUserId: string, activityId: string) {
  const activity = await client.from("mentor_activities").select("*").eq("id", activityId).eq("mentor_user_id", mentorUserId).maybeSingle();
  if (activity.error) throw new Error("activity lookup failed");
  if (!activity.data) return null;
  const [sessions, registrations] = await Promise.all([
    client.from("mentor_activity_sessions").select("*").eq("activity_id", activityId).order("starts_at"),
    client.from("mentor_activity_registrations").select("status").eq("activity_id", activityId),
  ]);
  if (sessions.error || registrations.error) throw new Error("activity children lookup failed");
  return {
    ...activity.data,
    sessions: sessions.data ?? [],
    registration_counts: registrationCounts(registrations.data ?? []),
  };
}

export function registrationCounts(rows: Array<{ status: string }>) {
  return rows.reduce((counts, row) => {
    if (row.status === "registered") counts.registered += 1;
    if (row.status === "waitlisted") counts.waitlisted += 1;
    counts.total += 1;
    return counts;
  }, { registered: 0, waitlisted: 0, total: 0 });
}

export function activityPayloadFromRow(row: Record<string, unknown>) {
  return {
    subjectId: row.subject_id,
    title: row.title,
    description: row.description,
    format: row.format,
    locationType: row.location_type,
    venueName: row.venue_name,
    address: row.address,
    locationDetails: row.location_details,
    minParticipants: row.min_participants,
    maxParticipants: row.max_participants,
    minimumAge: row.minimum_age,
    maximumAge: row.maximum_age,
    suitableGrades: row.suitable_grades,
    isFree: row.is_free,
    price: row.price,
    registrationDeadline: row.registration_deadline,
    equipment: row.equipment,
    accessibilityOptions: row.accessibility_options,
    accessibilityOther: row.accessibility_other,
    cancellationPolicy: row.cancellation_policy,
    contactPhoneVisibility: row.contact_phone_visibility ?? "registered_parents",
    pickupOptions: row.pickup_options,
    pickupDetails: row.pickup_details,
  };
}
