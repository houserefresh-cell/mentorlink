import { validateActivityInput } from "@/lib/mentor-activity-core";
import {
  activeSubjectExists,
  authenticateMentorActivityUser,
  loadOwnedActivity,
  registrationCounts,
} from "@/lib/mentor-activity-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const authentication = await authenticateMentorActivityUser(request);
  if (authentication.error) return authentication.error;
  const client = createSupabaseAdmin();
  try {
    const activities = await client.from("mentor_activities").select("*").eq("mentor_user_id", authentication.user.id).order("created_at", { ascending: false });
    if (activities.error) throw new Error("activity list failed");
    const ids = (activities.data ?? []).map((activity) => activity.id);
    const subjectIds = [...new Set((activities.data ?? []).map((activity) => activity.subject_id).filter(Boolean))];
    const [sessions, registrations, subjects] = ids.length ? await Promise.all([
      client.from("mentor_activity_sessions").select("*").in("activity_id", ids).order("starts_at"),
      client.from("mentor_activity_registrations").select("activity_id, status").in("activity_id", ids),
      subjectIds.length
        ? client.from("subjects").select("id, name").in("id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    if (sessions.error || registrations.error || subjects.error) throw new Error("activity children failed");
    return Response.json({ activities: (activities.data ?? []).map((activity) => ({
      ...activity,
      subject_name: (subjects.data ?? []).find((subject) => subject.id === activity.subject_id)?.name ?? null,
      sessions: (sessions.data ?? []).filter((session) => session.activity_id === activity.id),
      registration_counts: registrationCounts((registrations.data ?? []).filter((registration) => registration.activity_id === activity.id)),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load activities", code: "ACTIVITY_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authentication = await authenticateMentorActivityUser(request);
  if (authentication.error) return authentication.error;
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 }); }
  const publish = payload.status === "published" || payload.action === "publish";
  if (payload.status !== undefined && !["draft", "published"].includes(String(payload.status))) {
    return Response.json({ error: "Invalid initial status", code: "INVALID_STATUS" }, { status: 400 });
  }
  const validated = validateActivityInput(payload, publish ? "published" : "draft");
  if (!validated.ok) return Response.json({ error: validated.error, code: validated.code }, { status: 400 });
  const client = createSupabaseAdmin();
  try {
    if (!await activeSubjectExists(client, validated.activity.subject_id)) {
      return Response.json({ error: "Subject is not active", code: "SUBJECT_NOT_ACTIVE" }, { status: 400 });
    }
    const saved = await client.rpc("save_mentor_activity", {
      p_activity_id: null,
      p_mentor_user_id: authentication.user.id,
      p_activity: validated.activity,
      p_sessions: validated.sessions,
      p_publish: publish,
    });
    if (saved.error || !saved.data) {
      const conflict = rpcConflict(saved.error?.message);
      if (conflict) return Response.json({ error: "Activity conflicts with the mentor calendar", code: conflict }, { status: 409 });
      throw new Error("activity save failed");
    }
    const activity = await loadOwnedActivity(client, authentication.user.id, saved.data);
    if (!activity) throw new Error("saved activity missing");
    return Response.json({ activity }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create activity", code: "ACTIVITY_CREATE_FAILED" }, { status: 500 });
  }
}

function rpcConflict(message?: string) {
  if (message?.includes("ACTIVITY_CONFLICT")) return "ACTIVITY_CONFLICT";
  if (message?.includes("MEETING_CONFLICT")) return "MEETING_CONFLICT";
  return null;
}