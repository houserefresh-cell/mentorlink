import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const client = createSupabaseAdmin();
    const result = await client.from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (result.error) throw new Error("query failed");
    const notifications = result.data ?? [];
    const meetingIds = [...new Set(notifications.flatMap((item) => item.href?.match(/[?&]meeting=([0-9a-f-]{36})/i)?.[1] ?? []))];
    const registrationIds = [...new Set(notifications.flatMap((item) => item.href?.match(/[?&]registration=([0-9a-f-]{36})/i)?.[1] ?? []))];
    const [meetings, registrations] = await Promise.all([
      meetingIds.length ? client.from("meeting_requests").select("id, mentor_user_id, parent_user_id, child_first_name, child_grade_or_age, subject, meeting_mode, requested_start_at, requested_duration_minutes, confirmed_start_at, confirmed_duration_minutes, proposed_start_at, proposed_duration_minutes, meeting_location, cancellation_reason").in("id", meetingIds) : Promise.resolve({ data: [], error: null }),
      registrationIds.length ? client.from("mentor_activity_registrations").select("id, activity_id, parent_user_id, child_first_name, status").in("id", registrationIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (meetings.error || registrations.error) throw new Error("details query failed");
    const activityIds = [...new Set((registrations.data ?? []).map((row) => row.activity_id))];
    const parentIds = [...new Set([...(meetings.data ?? []).map((row) => row.parent_user_id), ...(registrations.data ?? []).map((row) => row.parent_user_id)])];
    const mentorIds = [...new Set((meetings.data ?? []).map((row) => row.mentor_user_id))];
    const [activities, sessions, parents, mentors] = await Promise.all([
      activityIds.length ? client.from("mentor_activities").select("id, title, venue_name, location_type, address, mentor_user_id").in("id", activityIds) : Promise.resolve({ data: [], error: null }),
      activityIds.length ? client.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at").in("activity_id", activityIds).order("starts_at") : Promise.resolve({ data: [], error: null }),
      parentIds.length ? client.from("parent_profiles").select("user_id, first_name, last_name").in("user_id", parentIds) : Promise.resolve({ data: [], error: null }),
      mentorIds.length ? client.from("mentor_profiles").select("user_id, first_name, last_name").in("user_id", mentorIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (activities.error || sessions.error || parents.error || mentors.error) throw new Error("related details query failed");
    const shortName = (profile: { first_name?: string | null; last_name?: string | null } | undefined, fallback: string) => {
      const initial = profile?.last_name?.trim()?.charAt(0);
      return profile?.first_name ? `${profile.first_name}${initial ? ` ${initial}׳` : ""}` : fallback;
    };
    const enriched = notifications.map((notification) => {
      const meetingId = notification.href?.match(/[?&]meeting=([0-9a-f-]{36})/i)?.[1];
      const registrationId = notification.href?.match(/[?&]registration=([0-9a-f-]{36})/i)?.[1];
      const notificationRegistrationStatus = notification.href?.match(/[?&]registration_status=(registered|waitlisted)/)?.[1];
      if (meetingId) {
        const meeting = (meetings.data ?? []).find((row) => row.id === meetingId);
        if (!meeting) return notification;
        const parent = (parents.data ?? []).find((row) => row.user_id === meeting.parent_user_id);
        const mentor = (mentors.data ?? []).find((row) => row.user_id === meeting.mentor_user_id);
        return { ...notification, details: { type: "meeting", parentName: shortName(parent, "הורה"), mentorName: shortName(mentor, "חונך/ת"), childName: meeting.child_first_name, childGrade: meeting.child_grade_or_age, subject: meeting.subject, meetingMode: meeting.meeting_mode, startsAt: meeting.confirmed_start_at ?? meeting.proposed_start_at ?? meeting.requested_start_at, durationMinutes: meeting.confirmed_duration_minutes ?? meeting.proposed_duration_minutes ?? meeting.requested_duration_minutes, location: meeting.meeting_location, reason: meeting.cancellation_reason } };
      }
      if (registrationId) {
        const registration = (registrations.data ?? []).find((row) => row.id === registrationId);
        const activity = (activities.data ?? []).find((row) => row.id === registration?.activity_id);
        if (!registration || !activity) return notification;
        const parent = (parents.data ?? []).find((row) => row.user_id === registration.parent_user_id);
        const session = (sessions.data ?? []).find((row) => row.activity_id === activity.id);
        return { ...notification, details: { type: "activity", parentName: shortName(parent, "הורה"), childName: registration.child_first_name, activityTitle: activity.title, registrationStatus: notificationRegistrationStatus ?? registration.status, startsAt: session?.starts_at ?? null, endsAt: session?.ends_at ?? null, location: activity.venue_name || activity.address || activity.location_type || null } };
      }
      return notification;
    });
    return Response.json({
      notifications: enriched,
      unreadCount: (result.data ?? []).filter((item) => !item.read_at).length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { registrationOnly?: unknown; meetingRequestId?: unknown; notificationId?: unknown };
    const client = createSupabaseAdmin();
    let query = client.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    if (typeof body.notificationId === "string" && /^[0-9a-f-]{36}$/i.test(body.notificationId)) {
      query = query.eq("id", body.notificationId);
    } else if (body.registrationOnly === true) {
      query = query.in("title", ["הרשמה חדשה לפעילות", "הצטרפות לרשימת ההמתנה"]);
    } else if (typeof body.meetingRequestId === "string" && /^[0-9a-f-]{36}$/i.test(body.meetingRequestId)) {
      query = query
        .in("kind", ["meeting_request_created", "meeting_details_updated", "meeting_alternative_proposed", "meeting_request_cancelled", "meeting_request_accepted", "meeting_request_declined"])
        .like("href", `%meeting=${body.meetingRequestId}%`);
    }
    const result = await query;
    if (result.error) throw new Error("update failed");
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unable to update notifications" }, { status: 500 });
  }
}
