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
  const [sessions, registrations, profiles, subjects, publications, parentConsents, parentChildren] = await Promise.all([
    ids.length ? admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at, estimated_overrun").in("activity_id", ids).gt("starts_at", new Date().toISOString()).order("starts_at") : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from("mentor_activity_registrations").select("activity_id, child_id, parent_user_id, status").in("activity_id", ids).in("status", ["registered", "waitlisted"]) : Promise.resolve({ data: [], error: null }),
    mentorIds.length ? admin.from("mentor_profiles").select("user_id, first_name, last_name, city, phone, birth_date").in("user_id", mentorIds) : Promise.resolve({ data: [], error: null }),
    subjectIds.length ? admin.from("subjects").select("id, name, category").in("id", subjectIds) : Promise.resolve({ data: [], error: null }),
    mentorIds.length ? admin.from("mentor_publication").select("user_id, public_booking_id").in("user_id", mentorIds).eq("status", "published") : Promise.resolve({ data: [], error: null }),
    mentorIds.length ? admin.from("mentor_parent_consents").select("user_id, contact_confirmed, status").in("user_id", mentorIds).eq("status", "approved") : Promise.resolve({ data: [], error: null }),
    admin.from("parent_children").select("id, first_name").eq("parent_user_id", user.id),
  ]);
  if (sessions.error || registrations.error || profiles.error || subjects.error || publications.error || parentConsents.error || parentChildren.error) return Response.json({ error: "לא ניתן להשלים את טעינת הפעילויות." }, { status: 500 });
  const participantIds = [...new Set((registrations.data ?? []).map((row) => row.child_id).filter(Boolean))];
  const participantChildren = participantIds.length ? await admin.from("parent_children").select("id, first_name, last_name").in("id", participantIds) : { data: [], error: null };
  if (participantChildren.error) return Response.json({ error: "לא ניתן להשלים את טעינת המשתתפים." }, { status: 500 });
  const participantById = new Map((participantChildren.data ?? []).map((child) => [child.id, child]));
  const displayName = (childId: string) => { const child = participantById.get(childId); const firstName = child?.first_name ?? "ילד/ה"; const initial = child?.last_name?.trim()?.charAt(0); return initial ? `${firstName} ${initial}׳` : firstName; };
  const publicActivities = (activities.data ?? []).flatMap((activity) => {
    const upcoming = (sessions.data ?? []).filter((session) => session.activity_id === activity.id);
    if (!upcoming.length) return [];
    const mentor = (profiles.data ?? []).find((profile) => profile.user_id === activity.mentor_user_id);
    const subject = (subjects.data ?? []).find((item) => item.id === activity.subject_id);
    const counts = (registrations.data ?? []).filter((row) => row.activity_id === activity.id);
    const registered = counts.filter((row) => row.status === "registered").length;
    const parentActiveChildIds = new Set(counts.filter((row) => row.parent_user_id === user.id).map((row) => row.child_id));
    const allChildrenRegistered = (parentChildren.data?.length ?? 0) > 0 && parentActiveChildIds.size >= (parentChildren.data?.length ?? 0);
    const registeredChildNames = (parentChildren.data ?? []).filter((child) => parentActiveChildIds.has(child.id)).map((child) => child.first_name);
    const imageUrl = activity.image_path ? admin.storage.from("activity-images").getPublicUrl(activity.image_path).data.publicUrl : null;
    const isAdult = mentor?.birth_date ? new Date(mentor.birth_date) <= new Date(new Date().setFullYear(new Date().getFullYear() - 18)) : false;
    const hasContactConsent = (parentConsents.data ?? []).some((row) => row.user_id === activity.mentor_user_id && row.contact_confirmed === true);
    const mentorPhone = activity.contact_phone_visibility === "public" && (isAdult || hasContactConsent) ? mentor?.phone ?? null : null;
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
      contactPhoneVisibility: activity.contact_phone_visibility, mentorPhone,
      imageUrl, imageAlt: activity.image_alt,
      registrationOpen: Boolean(activity.registration_deadline && new Date(activity.registration_deadline) > new Date()),
      allChildrenRegistered,
      registeredChildNames,
      registrationUnavailableReason: allChildrenRegistered ? "הילדים כבר רשומים" : null,
      sessions: upcoming, registeredCount: registered,
      waitlistedCount: counts.filter((row) => row.status === "waitlisted").length,
      registeredNames: counts.filter((row) => row.status === "registered").map((row) => displayName(row.child_id)),
      waitlistedNames: counts.filter((row) => row.status === "waitlisted").map((row) => displayName(row.child_id)),
      availablePlaces: Math.max(0, Number(activity.max_participants ?? 0) - registered),
    }];
  });
  return Response.json({ activities: publicActivities }, { headers: { "Cache-Control": "no-store" } });
}
