import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const activityId = typeof payload.activityId === "string" ? payload.activityId : "";
  const childIds = Array.isArray(payload.childIds) ? payload.childIds.filter((value): value is string => typeof value === "string" && uuid.test(value)) : [];
  const keys = Array.isArray(payload.idempotencyKeys) ? payload.idempotencyKeys.filter((value): value is string => typeof value === "string" && uuid.test(value)) : [];
  if (!uuid.test(activityId) || !childIds.length || childIds.length !== keys.length || childIds.length > 10) return Response.json({ error: "יש לבחור לפחות ילד אחד." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const profile = await admin.from("parent_profiles").select("phone").eq("user_id", user.id).maybeSingle();
  if (!profile.data?.phone) return Response.json({ error: "לפני הרשמה יש להשלים מספר טלפון בחשבון שלי.", code: "PARENT_PROFILE_REQUIRED" }, { status: 422 });
  const result = await admin.rpc("register_children_for_activity", { p_activity_id: activityId, p_parent_user_id: user.id, p_child_ids: childIds, p_idempotency_keys: keys });
  const message = result.error?.message ?? "";
  if (message.includes("CHILD_ALREADY_REGISTERED")) return Response.json({ error: "אחד הילדים כבר רשום לפעילות." }, { status: 409 });
  if (message.includes("REGISTRATION_CLOSED") || message.includes("ACTIVITY_NOT_AVAILABLE") || message.includes("ACTIVITY_ALREADY_STARTED")) return Response.json({ error: "ההרשמה לפעילות אינה זמינה עוד." }, { status: 422 });
  if (message.includes("CHILD_NOT_OWNED")) return Response.json({ error: "לא ניתן לרשום ילד שאינו שייך לחשבון." }, { status: 403 });
  if (result.error) return Response.json({ error: "לא ניתן להשלים את ההרשמה כרגע." }, { status: 500 });
  return Response.json({ registrations: result.data }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });

  const admin = createSupabaseAdmin();
  const registrations = await admin.from("mentor_activity_registrations")
    .select("id, activity_id, child_id, child_first_name, status, cancelled_at, created_at")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: false });
  if (registrations.error) return Response.json({ error: "לא ניתן לטעון את ההרשמות." }, { status: 500 });

  const activityIds = [...new Set((registrations.data ?? []).map((row) => row.activity_id))];
  const [activities, sessions, counts, approvals, feedback] = await Promise.all([
    activityIds.length
      ? admin.from("mentor_activities").select("id, title, description, status, venue_name, location_type, address, location_details, min_participants, max_participants, minimum_age, maximum_age, suitable_grades, is_free, price, equipment, accessibility_options, accessibility_other, pickup_options, pickup_details, cancellation_policy, registration_deadline, contact_phone_visibility, mentor_user_id").in("id", activityIds)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at, estimated_overrun").in("activity_id", activityIds).order("starts_at")
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? admin.from("mentor_activity_registrations").select("activity_id, status").in("activity_id", activityIds).in("status", ["registered", "waitlisted"])
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? admin.from("mentor_activity_contact_approvals").select("activity_id").in("activity_id", activityIds).eq("parent_user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    (registrations.data ?? []).length
      ? admin.from("mentor_activity_feedback").select("registration_id").in("registration_id", (registrations.data ?? []).map((row) => row.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (activities.error || sessions.error || counts.error || approvals.error || feedback.error) return Response.json({ error: "לא ניתן להשלים את טעינת ההרשמות." }, { status: 500 });

  const mentorIds = [...new Set(((activities.data ?? []) as Array<{ mentor_user_id: string }>).map((row) => row.mentor_user_id).filter(Boolean))];
  const profiles = mentorIds.length ? await admin.from("mentor_profiles").select("user_id, first_name, last_name, phone, city").in("user_id", mentorIds) : { data: [], error: null };
  if (profiles.error) return Response.json({ error: "לא ניתן להשלים את טעינת החונכים." }, { status: 500 });

  const profileMap = new Map((profiles.data ?? []).map((row) => [row.user_id, row]));
  const approvedActivityIds = new Set((approvals.data ?? []).map((row) => row.activity_id));
  const feedbackRegistrationIds = new Set((feedback.data ?? []).map((row) => row.registration_id));
  const countsByActivity = new Map<string, { registered: number; waitlisted: number }>();
  for (const row of counts.data ?? []) {
    const current = countsByActivity.get(row.activity_id) ?? { registered: 0, waitlisted: 0 };
    if (row.status === "registered") current.registered += 1;
    if (row.status === "waitlisted") current.waitlisted += 1;
    countsByActivity.set(row.activity_id, current);
  }

  return Response.json({
    registrations: (registrations.data ?? []).map((registration) => {
      const activity = (activities.data ?? []).find((item) => item.id === registration.activity_id);
      const countsForActivity = countsByActivity.get(registration.activity_id) ?? { registered: 0, waitlisted: 0 };
      const mentor = activity ? profileMap.get(activity.mentor_user_id) : null;
      const isRegistered = registration.status === "registered";
      const mentorPhone = isRegistered && (
        activity?.contact_phone_visibility === "public" ||
        activity?.contact_phone_visibility === "registered_parents" ||
        (activity?.contact_phone_visibility === "mentor_approved" && approvedActivityIds.has(registration.activity_id))
      ) ? mentor?.phone ?? null : null;
      return {
        ...registration,
        feedback_submitted: feedbackRegistrationIds.has(registration.id),
        activity: activity
          ? {
              ...activity,
              mentor_first_name: mentor?.first_name ?? null,
              mentor_last_name: mentor?.last_name ?? null,
              mentor_city: mentor?.city ?? null,
              mentor_phone: mentorPhone,
              address: registration.status === "registered" ? activity.address : null,
              registeredCount: countsForActivity.registered,
              waitlistedCount: countsForActivity.waitlisted,
              availablePlaces: Math.max(0, Number(activity.max_participants ?? 0) - countsForActivity.registered),
            }
          : null,
        sessions: (sessions.data ?? []).filter((session) => session.activity_id === registration.activity_id),
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const registrationId = new URL(request.url).searchParams.get("registrationId") ?? "";
  if (!uuid.test(registrationId)) return Response.json({ error: "הרשמה לא תקינה." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const registration = await admin.from("mentor_activity_registrations").select("activity_id").eq("id", registrationId).eq("parent_user_id", user.id).maybeSingle();
  if (!registration.data) return Response.json({ error: "ההרשמה אינה זמינה לביטול." }, { status: 404 });
  const sessions = await admin.from("mentor_activity_sessions").select("ends_at").eq("activity_id", registration.data.activity_id);
  if ((sessions.data ?? []).length && (sessions.data ?? []).every((session) => Date.parse(session.ends_at) < Date.now())) return Response.json({ error: "לא ניתן לבטל הרשמה לאחר שהפעילות הסתיימה." }, { status: 422 });
  const result = await admin.rpc("cancel_parent_activity_registration", { p_registration_id: registrationId, p_parent_user_id: user.id });
  if (result.error) return Response.json({ error: "לא ניתן לבטל את ההרשמה." }, { status: 422 });
  return Response.json({ ok: true });
}
