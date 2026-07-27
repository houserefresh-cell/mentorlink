import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { overlapsYomKippur, YOM_KIPPUR_MESSAGE } from "@/lib/israel-calendar";
import { loadSlots } from "@/lib/meeting-data";
import { createMeetingNotification, sendMeetingEmail } from "@/lib/meeting-notifications";
import { canTransition, isCurrentGeneratedSlot, isMeetingDuration, meetingEndAt } from "@/lib/meeting-scheduling-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/web-push-delivery";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { requestId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return Response.json({ error: "Invalid request" }, { status: 400 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const action = typeof payload.action === "string" ? payload.action : "";
  const actor = user.role === "parent" ? "parent" : user.role === "mentor" ? "mentor" : null;
  if (!actor) return Response.json({ error: "Role not allowed" }, { status: 403 });

  try {
    const client = createSupabaseAdmin();
    const { data: current, error } = await client.from("meeting_requests").select("*").eq("id", requestId).maybeSingle();
    if (error || !current) return Response.json({ error: "Request not found" }, { status: 404 });
    const ownerId = actor === "parent" ? current.parent_user_id : current.mentor_user_id;
    if (ownerId !== user.id) return Response.json({ error: "Not allowed" }, { status: 403 });
    if (!canTransition(actor, current.status, action)) {
      return Response.json({ error: "Invalid state transition" }, { status: 409 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let recipientId: string;
    let kind: string;
    let title: string;
    if (action === "cancel") {
      Object.assign(update, { status: "cancelled", cancelled_at: new Date().toISOString() });
      recipientId = current.mentor_user_id;
      kind = "meeting_request_cancelled";
      title = "בקשת פגישה בוטלה";
    } else if (action === "decline") {
      Object.assign(update, {
        status: "declined",
        mentor_response: clean(payload.response, 500),
        responded_at: new Date().toISOString(),
      });
      recipientId = current.parent_user_id;
      kind = "meeting_request_declined";
      title = "בקשת הפגישה נדחתה";
    } else if (action === "accept") {
      const publication = await client.from("mentor_publication").select("status").eq("user_id", current.mentor_user_id).maybeSingle();
      if (publication.data?.status !== "published") return Response.json({ error: "Mentor is not published" }, { status: 422 });
      const requestedStart = new Date(current.requested_start_at);
      const requestedEnd = new Date(current.requested_end_at);
      const expectedEnd = meetingEndAt(requestedStart, current.requested_duration_minutes);
      if (
        !Number.isFinite(requestedStart.getTime()) ||
        !Number.isFinite(requestedEnd.getTime()) ||
        !expectedEnd ||
        requestedEnd.getTime() !== expectedEnd.getTime() ||
        !isMeetingDuration(current.requested_duration_minutes)
      ) {
        return Response.json({ error: "Invalid meeting interval" }, { status: 422 });
      }
      if (overlapsYomKippur(requestedStart, requestedEnd)) return Response.json({ error: YOM_KIPPUR_MESSAGE }, { status: 422 });
      const slots = await loadSlots(client, current.mentor_user_id);
      if (!isCurrentGeneratedSlot(slots, current.requested_start_at, current.meeting_mode, current.requested_duration_minutes)) {
        return Response.json({ error: "המועד אינו זמין עוד." }, { status: 422 });
      }
      Object.assign(update, {
        status: "accepted",
        requested_end_at: requestedEnd.toISOString(),
        responded_at: new Date().toISOString(),
      });
      recipientId = current.parent_user_id;
      kind = "meeting_request_accepted";
      title = "בקשת הפגישה אושרה";
    } else {
      const startAt = clean(payload.proposedStartAt, 40);
      const duration = Number(payload.proposedDurationMinutes);
      const proposedStart = new Date(startAt);
      if (!startAt || !Number.isFinite(proposedStart.getTime()) || !isMeetingDuration(duration)) {
        return Response.json({ error: "Invalid alternative slot" }, { status: 400 });
      }
      const proposedEnd = new Date(proposedStart.getTime() + duration * 60_000);
      if (overlapsYomKippur(proposedStart, proposedEnd)) return Response.json({ error: YOM_KIPPUR_MESSAGE }, { status: 422 });
      const slots = await loadSlots(client, current.mentor_user_id);
      if (!isCurrentGeneratedSlot(slots, startAt, current.meeting_mode, duration)) {
        return Response.json({ error: "המועד החלופי אינו זמין." }, { status: 422 });
      }
      Object.assign(update, {
        status: "alternative_proposed",
        proposed_start_at: new Date(startAt).toISOString(),
        proposed_duration_minutes: duration,
        mentor_response: clean(payload.response, 500),
        responded_at: new Date().toISOString(),
      });
      recipientId = current.parent_user_id;
      kind = "meeting_alternative_proposed";
      title = "הוצע מועד חלופי";
    }

    const result = await client.from("meeting_requests").update(update)
      .eq("id", requestId).eq("status", current.status).select("id, status").maybeSingle();
    if (result.error?.code === "23P01") return Response.json({ error: "Meeting overlap" }, { status: 409 });
    if (result.error) throw new Error("update failed");
    if (!result.data) return Response.json({ error: "Request changed" }, { status: 409 });
    await createMeetingNotification(client, {
      userId: recipientId,
      kind,
      title,
      body: title,
      href: actor === "parent" ? "/dashboard/mentor/meeting-requests" : "/dashboard/parent",
    });
    const recipient = await client.auth.admin.getUserById(recipientId);
    await sendMeetingEmail({
      to: recipient.data.user?.email ?? null,
      subject: title,
      heading: title,
      body: "העדכון זמין באזור האישי במנטורלינק.",
      href: actor === "parent" ? "/dashboard/mentor/meeting-requests" : "/dashboard/parent",
    });
    await sendPushToUser(client, recipientId, {
      type: kind,
      title,
      body: "עדכון בבקשת פגישה ממתין באזור האישי.",
      href: actor === "parent" ? "/dashboard/mentor/meeting-requests" : "/dashboard/parent",
    });
    return Response.json({ request: result.data });
  } catch {
    return Response.json({ error: "Unable to update meeting request" }, { status: 500 });
  }
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : "";
}
