import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const activities = await admin.from("mentor_activities").select("*").eq("status", "published").order("published_at", { ascending: false });
  if (activities.error) return Response.json({ error: "לא ניתן לטעון פעילויות כרגע." }, { status: 500 });
  const ids = (activities.data ?? []).map((row) => row.id);
  const mentorIds = [...new Set((activities.data ?? []).map((row) => row.mentor_user_id))];
  const subjectIds = [...new Set((activities.data ?? []).map((row) => row.subject_id).filter(Boolean))];
  const [sessions, registrations, profiles, subjects, publications] = await Promise.all([
    ids.length ? admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at, estimated_overrun").in("activity_id", ids).gt("starts_at", new Date().toISOString()).order("starts_at") : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("mentor_activity_registrations").select("activity_id, status").in("activity_id", ids).in("status", ["registered", "waitlisted"]) : Promise.resolve({ data: [], error: null }),
    mentorIds.length ? admin.from("mentor_profiles").select("user_id, first_name, last_name, city").in("user_id", mentorIds) : Promise.resolve({ data: [], error: null }),
    subjectIds.length ? admin.from("subjects").select("id, name, category").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
    mentorIds.length ? admin.from("mentor_publication").select("user_id, public_booking_id").in("user_id", mentorIds).eq("status", "published") : Promise.resolve({ data: [], error: null }),
  ]);
  if (sessions.error || registrations.error || profiles.error || subjects.error || publications.error) return Response.json({ error: "לא ניתן להשלים את טעינת הפעילויות." }, { status: 500 });
  const publicActivities = (activities.data ?? []).flatMap((activity) => {
    const upcoming = (sessions.data ?? []).filter((session) => session.activity_id === activity.id);
    if (!upcoming.length) return [];
    const mentor = (profiles.data ?? []).find((profile) => profile.user_id === activity.mentor_user_id);
    const subject = (subjects.data ?? []).find((item) => item.id === activity.subject_id);
    const counts = (registrations.data ?? []).filter((row) => row.activity_id === activity.id);
    const registered = counts.filter((row) => row.status === "registered").length;
    const imageUrl = activity.image_path ? admin.storage.from("activity-images").getPublicUrl(activity.image_path).data.publicUrl : null;
    return [{
      id: activity.id, title: activity.title, description: activity.description, subjectId: activity.subject_id,
      subjectName: subject?.name ?? "פעילות העשרה", mentorName: `${mentor?.first_name ?? "חונך/ת"}${mentor?.last_name ? ` ${Array.from(mentor.last_name)[0]}׳` : ""}`,
      mentorBookingId: (publications.data ?? []).find((publication) => publication.user_id === activity.mentor_user_id)?.public_booking_id ?? null,
      city: mentor?.city ?? null, locationType: activity.location_type, venueName: activity.venue_name,
      locationDetails: activity.location_details, minParticipants: activity.min_participants,
      maxParticipants: activity.max_participants, minimumAge: activity.minimum_age,
      maximumAge: activity.maximum_age, suitableGrades: activity.suitable_grades,
      isFree: activity.is_free, price: activity.price, equipment: activity.equipment,
      accessibilityOptions: activity.accessibility_options ?? [], accessibilityOther: activity.accessibility_other,
      pickupOptions: activity.pickup_options, pickupDetails: activity.pickup_details,
      cancellationPolicy: activity.cancellation_policy, registrationDeadline: activity.registration_deadline,
      imageUrl, imageAlt: activity.image_alt,
      registrationOpen: Boolean(activity.registration_deadline && new Date(activity.registration_deadline) > new Date()),
      sessions: upcoming, registeredCount: registered,
      waitlistedCount: counts.filter((row) => row.status === "waitlisted").length,
      availablePlaces: Math.max(0, Number(activity.max_participants ?? 0) - registered),
    }];
  });
  return Response.json({ activities: publicActivities }, { headers: { "Cache-Control": "no-store" } });
}
