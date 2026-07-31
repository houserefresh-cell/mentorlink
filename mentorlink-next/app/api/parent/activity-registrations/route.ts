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
  const result = await createSupabaseAdmin().rpc("register_children_for_activity", { p_activity_id: activityId, p_parent_user_id: user.id, p_child_ids: childIds, p_idempotency_keys: keys });
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
  const registrations = await admin.from("mentor_activity_registrations").select("id, activity_id, child_id, child_first_name, status, cancelled_at, created_at").eq("parent_user_id", user.id).order("created_at", { ascending: false });
  if (registrations.error) return Response.json({ error: "לא ניתן לטעון את ההרשמות." }, { status: 500 });
  const activityIds = [...new Set((registrations.data ?? []).map((row) => row.activity_id))];
  const activities = activityIds.length ? await admin.from("mentor_activities").select("id, title, status, venue_name, location_type, address, location_details").in("id", activityIds) : { data: [], error: null };
  const sessions = activityIds.length ? await admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at").in("activity_id", activityIds).order("starts_at") : { data: [], error: null };
  if (activities.error || sessions.error) return Response.json({ error: "לא ניתן להשלים את טעינת ההרשמות." }, { status: 500 });
  return Response.json({ registrations: (registrations.data ?? []).map((registration) => { const activity = (activities.data ?? []).find((item) => item.id === registration.activity_id); return { ...registration, activity: activity ? { ...activity, address: registration.status === "registered" ? activity.address : null } : null, sessions: (sessions.data ?? []).filter((session) => session.activity_id === registration.activity_id) }; }) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const registrationId = new URL(request.url).searchParams.get("registrationId") ?? "";
  if (!uuid.test(registrationId)) return Response.json({ error: "הרשמה לא תקינה." }, { status: 400 });
  const result = await createSupabaseAdmin().rpc("cancel_parent_activity_registration", { p_registration_id: registrationId, p_parent_user_id: user.id });
  if (result.error) return Response.json({ error: "לא ניתן לבטל את ההרשמה." }, { status: 422 });
  return Response.json({ ok: true });
}
