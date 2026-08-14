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
    const { data: current, error } = await client
      .from("meeting_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !current) return Response.json({ error: "Request not found" }, { status: 404 });

    const ownerId = actor === "parent" ? current.parent_user_id : current.mentor_user_id;
    if (ownerId !== user.id) return Response.json({ error: "Not allowed" }, { status: 403 });
    if (action === "archive" && actor === "parent") {
      if (!["cancelled", "declined"].includes(current.status)) return Response.json({ error: "אפשר למחוק מההיסטוריה רק בקשה שבוטלה או נדחתה." }, { status: 409 });
      const archived = await client.from("meeting_requests").update({ archived_by_parent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", requestId).eq("parent_user_id", user.id);
      if (archived.error) throw archived.error;
      return Response.json({ archived: true });
    }
    if (action === "update_details" && actor === "mentor") {
      const details = {
        preparation_notes: clean(payload.preparationNotes, 1000) || null,
        equipment_notes: clean(payload.equipmentNotes, 1000) || null,
        meeting_location: clean(payload.meetingLocation, 300) || null,
        participant_names: Array.isArray(payload.participantNames) ? payload.participantNames.map((item) => clean(item, 60)).filter(Boolean).slice(0, 8) : [],
        updated_at: new Date().toISOString(),
      };
      const updated = await client.from("meeting_requests").update(details).eq("id", requestId).select("id, preparation_notes, equipment_notes, meeting_location, participant_names").single();
      if (updated.error) throw updated.error;
      if (payload.saveAsTemplate === true) await client.from("mentor_meeting_preparation_templates").upsert({ mentor_user_id: user.id, subject: current.subject, preparation_notes: details.preparation_notes, equipment_notes: details.equipment_notes, meeting_location: details.meeting_location, updated_at: new Date().toISOString() }, { onConflict: "mentor_user_id,subject" });
      await createMeetingNotification(client, {
        userId: current.parent_user_id,
        kind: "meeting_details_updated",
        title: "פרטי המפגש עודכנו",
        body: "החונך עדכן את ההכנה, הציוד או מיקום המפגש.",
        href: "/dashboard/parent/requests",
      });
      return Response.json({ request: updated.data });
    }
    if (!canTransition(actor, current.status, action)) {
      return Response.json({ error: "Invalid state transition" }, { status: 409 });
    }

    const now = new Date();
    const update: Record<string, unknown> = { updated_at: now.toISOString() };
    let recipientId: string;
    let kind: string;
    let title: string;

    if (action === "cancel") {
      Object.assign(update, { status: "cancelled", cancelled_at: now.toISOString() });
      recipientId = current.mentor_user_id;
      kind = "meeting_request_cancelled";
      title = "בקשת הפגישה בוטלה";
    } else if (action === "decline") {
      Object.assign(update, {
        status: "declined",
        mentor_response: clean(payload.response, 500),
        responded_at: now.toISOString(),
      });
      const template = await client.from("mentor_meeting_preparation_templates").select("preparation_notes,equipment_notes,meeting_location").eq("mentor_user_id", user.id).eq("subject", current.subject).maybeSingle();
      if (template.data) Object.assign(update, { preparation_notes: current.preparation_notes ?? template.data.preparation_notes, equipment_notes: current.equipment_notes ?? template.data.equipment_notes, meeting_location: current.meeting_location ?? template.data.meeting_location });
      recipientId = current.parent_user_id;
      kind = "meeting_request_declined";
      title = "בקשת הפגישה נדחתה";
    } else if (action === "decline_alternative") {
      Object.assign(update, {
        status: "declined",
        responded_at: now.toISOString(),
      });
      recipientId = current.mentor_user_id;
      kind = "meeting_request_declined";
      title = "ההורה דחה את המועד החלופי";
    } else if (action === "accept" || action === "accept_alternative") {
      const publication = await client
        .from("mentor_publication")
        .select("status")
        .eq("user_id", current.mentor_user_id)
        .maybeSingle();
      if (publication.data?.status !== "published") {
        return Response.json({ error: "Mentor is not published" }, { status: 422 });
      }

      const acceptingAlternative = action === "accept_alternative";
      const startAt = acceptingAlternative ? current.proposed_start_at : current.requested_start_at;
      const duration = Number(acceptingAlternative
        ? current.proposed_duration_minutes
        : current.requested_duration_minutes);
      const start = new Date(startAt ?? "");
      const end = meetingEndAt(start, duration);
      if (!startAt || !Number.isFinite(start.getTime()) || !end || !isMeetingDuration(duration)) {
        return Response.json({ error: "Invalid meeting interval" }, { status: 422 });
      }
      if (!acceptingAlternative && new Date(current.requested_end_at).getTime() !== end.getTime()) {
        return Response.json({ error: "Invalid meeting interval" }, { status: 422 });
      }
      if (overlapsYomKippur(start, end)) {
        return Response.json({ error: YOM_KIPPUR_MESSAGE }, { status: 422 });
      }

      const slots = await loadSlots(client, current.mentor_user_id, now);
      if (!isCurrentGeneratedSlot(slots, startAt, current.meeting_mode, duration, current.subject)) {
        return Response.json({ error: "המועד אינו זמין עוד." }, { status: 422 });
      }

      Object.assign(update, {
        status: "accepted",
        confirmed_start_at: start.toISOString(),
        confirmed_end_at: end.toISOString(),
        confirmed_duration_minutes: duration,
        responded_at: now.toISOString(),
      });
      recipientId = acceptingAlternative ? current.mentor_user_id : current.parent_user_id;
      kind = "meeting_request_accepted";
      title = acceptingAlternative ? "ההורה אישר את המועד החלופי" : "בקשת הפגישה אושרה";
    } else {
      const startAt = clean(payload.proposedStartAt, 40);
      const duration = Number(payload.proposedDurationMinutes);
      const proposedStart = new Date(startAt);
      const proposedEnd = meetingEndAt(proposedStart, duration);
      if (!startAt || !Number.isFinite(proposedStart.getTime()) || !proposedEnd || !isMeetingDuration(duration)) {
        return Response.json({ error: "Invalid alternative slot" }, { status: 400 });
      }
      if (overlapsYomKippur(proposedStart, proposedEnd)) {
        return Response.json({ error: YOM_KIPPUR_MESSAGE }, { status: 422 });
      }
      const slots = await loadSlots(client, current.mentor_user_id, now);
      if (!isCurrentGeneratedSlot(slots, startAt, current.meeting_mode, duration, current.subject)) {
        return Response.json({ error: "המועד החלופי אינו זמין." }, { status: 422 });
      }
      Object.assign(update, {
        status: "alternative_proposed",
        proposed_start_at: proposedStart.toISOString(),
        proposed_duration_minutes: duration,
        mentor_response: clean(payload.response, 500),
        responded_at: now.toISOString(),
      });
      recipientId = current.parent_user_id;
      kind = "meeting_alternative_proposed";
      title = "הוצע מועד חלופי";
    }

    const result = await client
      .from("meeting_requests")
      .update(update)
      .eq("id", requestId)
      .eq("status", current.status)
      .select("id, status, requested_start_at, requested_duration_minutes, proposed_start_at, proposed_duration_minutes, confirmed_start_at, confirmed_duration_minutes")
      .maybeSingle();
    if (result.error?.code === "23P01") {
      return Response.json({ error: "Meeting overlap" }, { status: 409 });
    }
    if (result.error) throw new Error("update failed");
    if (!result.data) return Response.json({ error: "Request changed" }, { status: 409 });

    const href = actor === "parent" ? "/dashboard/mentor/meeting-requests" : "/dashboard/parent";
    await createMeetingNotification(client, {
      userId: recipientId,
      kind,
      title,
      body: title,
      href,
    });
    const recipient = await client.auth.admin.getUserById(recipientId);
    await sendMeetingEmail({
      to: recipient.data.user?.email ?? null,
      subject: title,
      heading: title,
      body: "העדכון זמין באזור האישי במנטורלינק.",
      href,
    });
    await sendPushToUser(client, recipientId, {
      type: kind,
      title,
      body: "עדכון בבקשת פגישה ממתין באזור האישי.",
      href,
    });
    return Response.json({ request: result.data });
  } catch (error) {
    console.error("Meeting request update failed", error);
    return Response.json({ error: "לא ניתן לעדכן את בקשת הפגישה כרגע. הנתונים לא שונו." }, { status: 500 });
  }
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : "";
}
