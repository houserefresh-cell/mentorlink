import { authenticateMentorActivityUser, loadOwnedActivity } from "@/lib/mentor-activity-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ activityId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["operational", "reminder", "equipment", "meeting_point", "delay", "postponement", "general"]);

async function owned(request: Request, context: Context) {
  const authentication = await authenticateMentorActivityUser(request);
  if (authentication.error) return { response: authentication.error };
  const { activityId } = await context.params;
  if (!UUID.test(activityId)) return { response: Response.json({ error: "Invalid activity id", code: "INVALID_ACTIVITY_ID" }, { status: 400 }) };
  const client = createSupabaseAdmin();
  const activity = await loadOwnedActivity(client, authentication.user.id, activityId);
  if (!activity) return { response: Response.json({ error: "Activity not found", code: "ACTIVITY_NOT_FOUND" }, { status: 404 }) };
  return { client, user: authentication.user, activityId };
}

export async function GET(request: Request, context: Context) {
  try {
    const loaded = await owned(request, context);
    if ("response" in loaded) return loaded.response;
    const [updates, registrations] = await Promise.all([
      loaded.client.from("mentor_activity_updates").select("id,recipient_scope,recipient_parent_user_id,update_type,body,delay_minutes,proposed_start_at,proposed_end_at,created_at")
        .eq("activity_id", loaded.activityId).order("created_at", { ascending: false }),
      loaded.client.from("mentor_activity_registrations").select("parent_user_id,child_first_name,status")
        .eq("activity_id", loaded.activityId).in("status", ["registered", "waitlisted"]),
    ]);
    if (updates.error || registrations.error) throw new Error("updates lookup failed");
    const recipientMap = new Map<string, { parentUserId: string; childFirstNames: string[] }>();
    for (const row of registrations.data ?? []) {
      const current: { parentUserId: string; childFirstNames: string[] } = recipientMap.get(row.parent_user_id) ?? { parentUserId: row.parent_user_id, childFirstNames: [] };
      if (!current.childFirstNames.includes(row.child_first_name)) current.childFirstNames.push(row.child_first_name);
      recipientMap.set(row.parent_user_id, current);
    }
    const recipients = Array.from(recipientMap.values());
    return Response.json({ updates: updates.data ?? [], recipients }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load updates", code: "ACTIVITY_UPDATES_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 }); }
  try {
    const loaded = await owned(request, context);
    if ("response" in loaded) return loaded.response;
    const scope = body.recipientScope === "parent" ? "parent" : "all_active";
    const type = typeof body.updateType === "string" ? body.updateType : "general";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const recipient = scope === "parent" && typeof body.recipientParentUserId === "string" ? body.recipientParentUserId : null;
    const delay = type === "delay" && Number.isInteger(body.delayMinutes) ? Number(body.delayMinutes) : null;
    const proposedStart = type === "postponement" && typeof body.proposedStartAt === "string" ? body.proposedStartAt : null;
    const proposedEnd = type === "postponement" && typeof body.proposedEndAt === "string" ? body.proposedEndAt : null;
    if (!TYPES.has(type) || message.length < 1 || message.length > 2000 || (scope === "parent" && (!recipient || !UUID.test(recipient)))) {
      return Response.json({ error: "Invalid update", code: "INVALID_ACTIVITY_UPDATE" }, { status: 400 });
    }
    if (type === "delay" && (delay === null || delay < 1 || delay > 240)) return Response.json({ error: "Invalid delay", code: "INVALID_DELAY" }, { status: 400 });
    const proposedStartMs = proposedStart ? Date.parse(proposedStart) : Number.NaN;
    const proposedEndMs = proposedEnd ? Date.parse(proposedEnd) : Number.NaN;
    if (type === "postponement" && (!Number.isFinite(proposedStartMs) || !Number.isFinite(proposedEndMs) || proposedStartMs >= proposedEndMs)) {
      return Response.json({ error: "Invalid postponement", code: "INVALID_POSTPONEMENT" }, { status: 400 });
    }
    const saved = await loaded.client.rpc("create_mentor_activity_update", {
      p_activity_id: loaded.activityId, p_sender_user_id: loaded.user.id,
      p_recipient_scope: scope, p_recipient_parent_user_id: recipient,
      p_update_type: type, p_body: message, p_delay_minutes: delay,
      p_proposed_start_at: proposedStart, p_proposed_end_at: proposedEnd,
    });
    if (saved.error) {
      if (saved.error.message.includes("RECIPIENT_NOT_REGISTERED") || saved.error.message.includes("ACTIVITY_NOT_OWNED")) {
        return Response.json({ error: "Forbidden", code: "UPDATE_FORBIDDEN" }, { status: 403 });
      }
      if (saved.error.message.includes("NO_ACTIVE_RECIPIENTS")) return Response.json({ error: "No recipients", code: "NO_ACTIVE_RECIPIENTS" }, { status: 409 });
      throw new Error("update save failed");
    }
    return Response.json({ updateId: saved.data }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to send update", code: "ACTIVITY_UPDATE_SEND_FAILED" }, { status: 500 });
  }
}
