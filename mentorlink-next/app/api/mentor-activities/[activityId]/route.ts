import { canTransitionActivity, validateActivityInput } from "@/lib/mentor-activity-core";
import {
  activeSubjectExists,
  activityPayloadFromRow,
  authenticateMentorActivityUser,
  loadOwnedActivity,
} from "@/lib/mentor-activity-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Context = { params: Promise<{ activityId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function contextActivity(request: Request, context: Context) {
  const authentication = await authenticateMentorActivityUser(request);
  if (authentication.error) return { response: authentication.error };
  const { activityId } = await context.params;
  if (!UUID.test(activityId)) return { response: Response.json({ error: "Invalid activity id", code: "INVALID_ACTIVITY_ID" }, { status: 400 }) };
  const client = createSupabaseAdmin();
  const activity = await loadOwnedActivity(client, authentication.user.id, activityId);
  if (!activity) return { response: Response.json({ error: "Activity not found", code: "ACTIVITY_NOT_FOUND" }, { status: 404 }) };
  return { client, user: authentication.user, activityId, activity };
}

export async function GET(request: Request, context: Context) {
  try {
    const loaded = await contextActivity(request, context);
    if ("response" in loaded) return loaded.response;
    const activeRegistrations = await loaded.client.from("mentor_activity_registrations")
      .select("id", { count: "exact", head: true }).eq("activity_id", loaded.activityId)
      .in("status", ["registered", "waitlisted"]);
    if (activeRegistrations.error) throw new Error("registration count failed");
    return Response.json({ activity: { ...loaded.activity, edit_locked: (activeRegistrations.count ?? 0) > 0 } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load activity", code: "ACTIVITY_LOAD_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 }); }
  try {
    const loaded = await contextActivity(request, context);
    if ("response" in loaded) return loaded.response;
    const action = typeof payload.action === "string" ? payload.action : "edit";
    if (action === "cancel") {
      if (!canTransitionActivity(loaded.activity.status, "cancelled")) {
        return Response.json({ error: "Activity cannot be cancelled", code: "INVALID_STATUS_TRANSITION" }, { status: 409 });
      }
      const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
      if (reason.length < 3 || reason.length > 2000) {
        return Response.json({ error: "Cancellation reason is required", code: "CANCELLATION_REASON_REQUIRED" }, { status: 400 });
      }
      const cancelled = await loaded.client.rpc("cancel_mentor_activity_with_update", {
        p_activity_id: loaded.activityId,
        p_mentor_user_id: loaded.user.id,
        p_reason: reason,
      });
      if (cancelled.error) {
        if (cancelled.error.message.includes("ACTIVITY_NOT_OWNED_OR_CANCELLABLE")) {
          return Response.json({ error: "Activity changed", code: "ACTIVITY_CHANGED" }, { status: 409 });
        }
        throw new Error("cancel failed");
      }
      const activity = await loadOwnedActivity(loaded.client, loaded.user.id, loaded.activityId);
      if (!activity) throw new Error("cancelled activity missing");
      return Response.json({ activity });
    }

    if (action !== "edit" && action !== "publish") {
      return Response.json({ error: "Invalid action", code: "INVALID_ACTION" }, { status: 400 });
    }
    if (!["draft", "published"].includes(loaded.activity.status) || (action === "publish" && loaded.activity.status !== "draft")) {
      return Response.json({ error: "Activity cannot be edited or published", code: "ACTIVITY_NOT_EDITABLE" }, { status: 409 });
    }
    const activeRegistrations = await loaded.client.from("mentor_activity_registrations")
      .select("id", { count: "exact", head: true }).eq("activity_id", loaded.activityId)
      .in("status", ["registered", "waitlisted"]);
    if (activeRegistrations.error) throw new Error("registration lock lookup failed");
    if ((activeRegistrations.count ?? 0) > 0) {
      return Response.json({ error: "לפעילות זו כבר קיימות הרשמות ולכן פרטיה המרכזיים נעולים. ניתן לשלוח עדכון לנרשמים או לבטל את הפעילות.", code: "ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS" }, { status: 409 });
    }
    const existingPayload = activityPayloadFromRow(loaded.activity);
    const merged: Record<string, unknown> = { ...existingPayload, ...payload };
    merged.sessions = payload.sessions ?? loaded.activity.sessions.map((session: Record<string, unknown>) => ({
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      estimatedOverrun: session.estimated_overrun,
    }));
    const publishing = action === "publish";
    const validated = validateActivityInput(merged, publishing ? "published" : "draft");
    if (!validated.ok) return Response.json({ error: validated.error, code: validated.code }, { status: 400 });
    if (!await activeSubjectExists(loaded.client, validated.activity.subject_id)) {
      return Response.json({ error: "Subject is not active", code: "SUBJECT_NOT_ACTIVE" }, { status: 400 });
    }
    const saved = await loaded.client.rpc("save_mentor_activity", {
      p_activity_id: loaded.activityId,
      p_mentor_user_id: loaded.user.id,
      p_activity: validated.activity,
      p_sessions: validated.sessions,
      p_publish: publishing,
    });
    if (saved.error || !saved.data) {
      const conflict = rpcConflict(saved.error?.message);
      if (conflict) return Response.json({ error: "Activity conflicts with the mentor calendar", code: conflict }, { status: 409 });
      if (saved.error?.message.includes("ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS")) {
        return Response.json({ error: "לפעילות זו כבר קיימות הרשמות ולכן פרטיה המרכזיים נעולים. ניתן לשלוח עדכון לנרשמים או לבטל את הפעילות.", code: "ACTIVITY_LOCKED_ACTIVE_REGISTRATIONS" }, { status: 409 });
      }
      if (saved.error?.message.includes("ACTIVITY_NOT_OWNED") || saved.error?.message.includes("ACTIVITY_NOT_EDITABLE")) {
        return Response.json({ error: "Activity changed", code: "ACTIVITY_CHANGED" }, { status: 409 });
      }
      throw new Error("activity save failed");
    }
    const activity = await loadOwnedActivity(loaded.client, loaded.user.id, saved.data);
    if (!activity) throw new Error("saved activity missing");
    return Response.json({ activity });
  } catch {
    return Response.json({ error: "Unable to update activity", code: "ACTIVITY_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const loaded = await contextActivity(request, context);
    if ("response" in loaded) return loaded.response;
    if (!["draft", "cancelled"].includes(loaded.activity.status)) {
      return Response.json({ error: "Only drafts or cancelled activities without registrations can be deleted", code: "ACTIVITY_DELETE_FORBIDDEN" }, { status: 409 });
    }
    const registrations = await loaded.client.from("mentor_activity_registrations").select("id", { count: "exact", head: true }).eq("activity_id", loaded.activityId);
    if (registrations.error) throw new Error("registration count failed");
    if ((registrations.count ?? 0) > 0) return Response.json({ error: "Activity has registrations", code: "ACTIVITY_HAS_REGISTRATIONS" }, { status: 409 });
    const removed = await loaded.client.from("mentor_activities").delete().eq("id", loaded.activityId).eq("mentor_user_id", loaded.user.id).in("status", ["draft", "cancelled"]);
    if (removed.error) throw new Error("delete failed");
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Unable to delete activity", code: "ACTIVITY_DELETE_FAILED" }, { status: 500 });
  }
}

function rpcConflict(message?: string) {
  if (message?.includes("ACTIVITY_CONFLICT")) return "ACTIVITY_CONFLICT";
  if (message?.includes("MEETING_CONFLICT")) return "MEETING_CONFLICT";
  return null;
}
