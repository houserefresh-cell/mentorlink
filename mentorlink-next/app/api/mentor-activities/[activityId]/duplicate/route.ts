import { activeSubjectExists, authenticateMentorActivityUser, loadOwnedActivity } from "@/lib/mentor-activity-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ activityId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: Context) {
  const authentication = await authenticateMentorActivityUser(request);
  if (authentication.error) return authentication.error;
  const { activityId } = await params;
  if (!UUID.test(activityId)) return Response.json({ error: "Invalid activity id", code: "INVALID_ACTIVITY_ID" }, { status: 400 });
  const client = createSupabaseAdmin();
  try {
    const source = await loadOwnedActivity(client, authentication.user.id, activityId);
    if (!source) return Response.json({ error: "Activity not found", code: "ACTIVITY_NOT_FOUND" }, { status: 404 });
    if (!await activeSubjectExists(client, source.subject_id)) {
      return Response.json({ error: "Subject is not active", code: "SUBJECT_NOT_ACTIVE" }, { status: 400 });
    }
    const title = source.title ? `עותק של ${source.title}`.slice(0, 120) : null;
    const duplicate = await client.from("mentor_activities").insert({
      mentor_user_id: authentication.user.id,
      subject_id: source.subject_id,
      title,
      description: source.description,
      status: "draft",
      format: source.format,
      location_type: source.location_type,
      venue_name: source.venue_name,
      address: source.address,
      location_details: source.location_details,
      min_participants: source.min_participants,
      max_participants: source.max_participants,
      minimum_age: source.minimum_age,
      maximum_age: source.maximum_age,
      suitable_grades: source.suitable_grades,
      is_free: source.is_free,
      price: source.price,
      registration_deadline: null,
      equipment: source.equipment,
      accessibility: source.accessibility,
      cancellation_policy: source.cancellation_policy,
      pickup_options: source.pickup_options,
      pickup_details: source.pickup_details,
      published_at: null,
      cancelled_at: null,
      completed_at: null,
    }).select("*").single();
    if (duplicate.error || !duplicate.data) throw new Error("duplicate failed");
    return Response.json({ activity: { ...duplicate.data, sessions: [], registration_counts: { registered: 0, waitlisted: 0 } } }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to duplicate activity", code: "ACTIVITY_DUPLICATE_FAILED" }, { status: 500 });
  }
}
