import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { overlapsYomKippur, YOM_KIPPUR_MESSAGE } from "@/lib/israel-calendar";
import { loadPublishedSchedulingMentor, loadSlots } from "@/lib/meeting-data";
import { createMeetingNotification, sendMeetingEmail } from "@/lib/meeting-notifications";
import { isCurrentGeneratedSlot, isMeetingDuration, meetingEndAt } from "@/lib/meeting-scheduling-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/web-push-delivery";

const text = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim().length <= maximum
    ? value.trim()
    : "";

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "Parent role required" }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const bookingId = text(payload.mentorBookingId, 36);
  const idempotencyKey = text(payload.idempotencyKey, 36);
  const subject = text(payload.subject, 120);
  const meetingMode = text(payload.meetingMode, 20);
  const childFirstName = text(payload.childFirstName, 60);
  const childId = text(payload.childId, 36);
  const childGradeOrAge = text(payload.childGradeOrAge, 40);
  const helpGoal = text(payload.helpGoal, 500);
  const parentMessage = text(payload.parentMessage, 500) || null;
  const requestedStartAt = text(payload.requestedStartAt, 40);
  const duration = Number(payload.durationMinutes);
  if (
    !/^[0-9a-f-]{36}$/i.test(bookingId) ||
    !/^[0-9a-f-]{36}$/i.test(idempotencyKey) ||
    !subject || !childFirstName || !childGradeOrAge || !/^[0-9a-f-]{36}$/i.test(childId) ||
    helpGoal.length < 5 || !requestedStartAt
  ) return Response.json({ error: "Invalid meeting request" }, { status: 400 });

  try {
    const client = createSupabaseAdmin();
    const parentProfile = await client.from("parent_profiles").select("phone").eq("user_id", user.id).maybeSingle();
    if (!parentProfile.data?.phone) return Response.json({ error: "לפני בקשת פגישה יש להשלים מספר טלפון בחשבון שלי.", code: "PARENT_PROFILE_REQUIRED" }, { status: 422 });
    const child = await client.from("parent_children").select("id, first_name, grade").eq("id", childId).eq("parent_user_id", user.id).is("removed_at", null).maybeSingle();
    if (!child.data) return Response.json({ error: "יש לבחור ילד/ה מהחשבון." }, { status: 422 });
    const mentor = await loadPublishedSchedulingMentor(client, bookingId);
    if (!mentor) return Response.json({ error: "Published mentor not found" }, { status: 404 });
    if (!mentor.subjects.includes(subject) || !mentor.meetingModes.includes(meetingMode)) {
      return Response.json({ error: "Invalid mentor selection" }, { status: 400 });
    }
    const requestedStart = new Date(requestedStartAt);
    if (!Number.isFinite(requestedStart.getTime()) || !isMeetingDuration(duration)) {
      return Response.json({ error: "Invalid meeting request" }, { status: 400 });
    }
    const requestedEnd = meetingEndAt(requestedStart, duration)!;
    if (overlapsYomKippur(requestedStart, requestedEnd)) {
      return Response.json({ error: YOM_KIPPUR_MESSAGE }, { status: 422 });
    }
    const slots = await loadSlots(client, mentor.mentorUserId);
    const selectedSlot = slots.find((slot) => slot.startAt === requestedStart.toISOString() && slot.meetingMode === meetingMode && slot.durations.includes(duration) && slot.subjects.includes(subject));
    if (!isCurrentGeneratedSlot(slots, requestedStartAt, meetingMode, duration, subject) || !selectedSlot) {
      return Response.json({ error: "המועד אינו זמין עוד." }, { status: 422 });
    }
    const { data, error } = await client.from("meeting_requests").insert({
      idempotency_key: idempotencyKey,
      parent_user_id: user.id,
      mentor_user_id: mentor.mentorUserId,
      child_id: childId,
      subject,
      child_first_name: childFirstName,
      child_grade_or_age: childGradeOrAge,
      help_goal: helpGoal,
      meeting_mode: meetingMode,
      requested_start_at: new Date(requestedStartAt).toISOString(),
      requested_end_at: requestedEnd.toISOString(),
      requested_duration_minutes: duration,
      parent_message: parentMessage,
      meeting_price: selectedSlot.meetingPrice,
    }).select("id, status").single();
    if (error?.code === "23505") return Response.json({ error: "Duplicate request" }, { status: 409 });
    if (error || !data) throw new Error("insert failed");

    await createMeetingNotification(client, {
      userId: mentor.mentorUserId,
      kind: "meeting_request_created",
      title: "בקשת פגישה חדשה",
      body: "התקבלה בקשת פגישה חדשה במנטורלינק",
      href: `/dashboard/mentor/meeting-requests?meeting=${data.id}`,
    });
    const mentorAuth = await client.auth.admin.getUserById(mentor.mentorUserId);
    await sendMeetingEmail({
      to: mentorAuth.data.user?.email ?? null,
      subject: "בקשת פגישה חדשה במנטורלינק",
      heading: "בקשת פגישה חדשה",
      body: "בקשה חדשה ממתינה לבדיקה באזור האישי.",
      href: `/dashboard/mentor/meeting-requests?meeting=${data.id}`,
    });
    await sendPushToUser(client, mentor.mentorUserId, {
      type: "meeting_request_created",
      title: "בקשת פגישה חדשה במנטורלינק",
      body: "התקבלה בקשת פגישה חדשה לאישורך.",
      href: `/dashboard/mentor/meeting-requests?meeting=${data.id}`,
    });
    return Response.json({ request: data }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create meeting request" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!["parent", "mentor"].includes(user.role)) {
    return Response.json({ error: "Role not allowed" }, { status: 403 });
  }
  try {
    const client = createSupabaseAdmin();
    const column = user.role === "parent" ? "parent_user_id" : "mentor_user_id";
    let query = client.from("meeting_requests")
      .select("id, mentor_user_id, parent_user_id, child_id, subject, child_first_name, child_grade_or_age, help_goal, meeting_mode, meeting_price, requested_start_at, requested_duration_minutes, parent_message, status, mentor_response, proposed_start_at, proposed_duration_minutes, confirmed_start_at, confirmed_end_at, confirmed_duration_minutes, responded_at, cancelled_at, cancellation_reason, created_at, updated_at, preparation_notes, equipment_notes, meeting_location, participant_names, archived_by_parent_at")
      .eq(column, user.id)
      .order("created_at", { ascending: false });
    if (user.role === "parent") query = query.is("archived_by_parent_at", null);
    const { data, error } = await query;
    if (error) throw new Error("query failed");
    const rows = [...(data ?? [])].sort((left, right) => Number(right.status === "pending") - Number(left.status === "pending"));
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    const childDetails = new Map<string, { gender: string | null; display_color: string | null }>();
    const childIds = [...new Set(rows.map((row) => row.child_id).filter(Boolean))];
    if (childIds.length) {
      const children = await client.from("parent_children").select("id, gender, display_color").in("id", childIds);
      for (const child of children.data ?? []) childDetails.set(child.id, { gender: child.gender, display_color: child.display_color });
    }
    if (user.role === "parent") {
      const ids = [...new Set(rows.map((row) => row.mentor_user_id))];
      if (ids.length) {
        const profiles = await client.from("mentor_profiles").select("user_id, first_name, last_name, phone").in("user_id", ids);
        for (const profile of profiles.data ?? []) {
          const initial = Array.from(profile.last_name?.trim() ?? "")[0];
          names.set(profile.user_id, `${profile.first_name ?? "חונך/ת"}${initial ? ` ${initial}׳` : ""}`);
          if (profile.phone) phones.set(profile.user_id, profile.phone);
        }
      }
    } else {
      const ids = [...new Set(rows.map((row) => row.parent_user_id))];
      if (ids.length) {
        const profiles = await client.from("parent_profiles").select("user_id, first_name, last_name, phone").in("user_id", ids);
        for (const profile of profiles.data ?? []) {
          const initial = Array.from(profile.last_name?.trim() ?? "")[0];
          names.set(profile.user_id, `${profile.first_name ?? "הורה"}${initial ? ` ${initial}׳` : ""}`);
          if (profile.phone) phones.set(profile.user_id, profile.phone);
        }
      }
    }
    let schedulingMentorBookingId: string | null = null;
    if (user.role === "mentor") {
      const publication = await client.from("mentor_publication").select("public_booking_id").eq("user_id", user.id).maybeSingle();
      schedulingMentorBookingId = publication.data?.public_booking_id ?? null;
    }
    const attentionKinds = user.role === "parent"
      ? ["meeting_details_updated", "meeting_alternative_proposed", "meeting_request_cancelled"]
      : ["meeting_request_created", "meeting_request_cancelled", "meeting_request_accepted", "meeting_request_declined"];
    const unread = await client.from("notifications").select("id, href").eq("user_id", user.id).is("read_at", null).in("kind", attentionKinds);
    const unreadMeetingIds = [...new Set((unread.data ?? []).flatMap((notification) => {
      const match = notification.href?.match(/[?&]meeting=([0-9a-f-]{36})/i);
      return match?.[1] ? [match[1]] : [];
    }))];
    return Response.json({
      schedulingMentorBookingId,
      attentionCount: unread.data?.length ?? 0,
      unreadMeetingIds,
      requests: rows.map(({ mentor_user_id, parent_user_id, ...row }) => ({
        ...row,
        child_gender: childDetails.get(row.child_id)?.gender ?? null,
        child_display_color: childDetails.get(row.child_id)?.display_color ?? "green",
        ...(user.role === "parent" ? { mentor_display_name: names.get(mentor_user_id) ?? "חונך/ת" } : {}),
        ...(user.role === "mentor" ? { parent_display_name: names.get(parent_user_id) ?? "הורה" } : {}),
        contact_phone: phones.get(user.role === "parent" ? mentor_user_id : parent_user_id) ?? null,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load meeting requests" }, { status: 500 });
  }
}
