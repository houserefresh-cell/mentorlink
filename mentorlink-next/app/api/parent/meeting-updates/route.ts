import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const updates = await admin.from("meeting_request_updates")
    .select("id, meeting_request_id, update_type, body, created_at, read_at")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: false });
  if (updates.error) return Response.json({ error: "לא ניתן לטעון את עדכוני הפגישות." }, { status: 500 });
  const meetingIds = [...new Set((updates.data ?? []).map((item) => item.meeting_request_id))];
  const meetings = meetingIds.length
    ? await admin.from("meeting_requests").select("id, mentor_user_id, subject, child_first_name, child_grade_or_age, meeting_mode, requested_start_at, requested_duration_minutes, confirmed_start_at, confirmed_duration_minutes, proposed_start_at, proposed_duration_minutes, meeting_location, cancellation_reason").in("id", meetingIds).eq("parent_user_id", user.id)
    : { data: [], error: null };
  if (meetings.error) return Response.json({ error: "לא ניתן לטעון את פרטי הפגישות." }, { status: 500 });
  const mentorIds = [...new Set((meetings.data ?? []).map((meeting) => meeting.mentor_user_id))];
  const mentors = mentorIds.length ? await admin.from("mentor_profiles").select("user_id, first_name, last_name").in("user_id", mentorIds) : { data: [], error: null };
  if (mentors.error) return Response.json({ error: "לא ניתן לטעון את פרטי החונכים." }, { status: 500 });
  const meetingMap = new Map((meetings.data ?? []).map((item) => [item.id, item]));
  return Response.json({
    updates: (updates.data ?? []).map((update) => {
      const meeting = meetingMap.get(update.meeting_request_id);
      const mentor = (mentors.data ?? []).find((item) => item.user_id === meeting?.mentor_user_id);
      const initial = mentor?.last_name?.trim()?.charAt(0);
      return {
        ...update,
        subject: meeting?.subject ?? "פגישה",
        childName: meeting?.child_first_name ?? "הילד/ה",
        childGrade: meeting?.child_grade_or_age ?? null,
        mentorName: mentor?.first_name ? `${mentor.first_name}${initial ? ` ${initial}׳` : ""}` : "חונך/ת",
        meetingMode: meeting?.meeting_mode ?? null,
        startsAt: meeting?.confirmed_start_at ?? meeting?.proposed_start_at ?? meeting?.requested_start_at ?? null,
        durationMinutes: meeting?.confirmed_duration_minutes ?? meeting?.proposed_duration_minutes ?? meeting?.requested_duration_minutes ?? null,
        location: meeting?.meeting_location ?? null,
        reason: meeting?.cancellation_reason ?? null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updateId = typeof payload.updateId === "string" ? payload.updateId : "";
  if (payload.action !== "mark_read" || !uuid.test(updateId)) return Response.json({ error: "עדכון לא תקין." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const result = await admin.from("meeting_request_updates")
    .update({ read_at: new Date().toISOString() })
    .eq("id", updateId)
    .eq("parent_user_id", user.id)
    .is("read_at", null)
    .select("meeting_request_id")
    .maybeSingle();
  if (result.error) return Response.json({ error: "לא ניתן לסמן את העדכון כנקרא." }, { status: 422 });
  if (!result.data) return Response.json({ error: "העדכון כבר נקרא או אינו קיים." }, { status: 404 });
  await admin.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .like("href", `%meeting=${result.data.meeting_request_id}%`);
  return Response.json({ ok: true });
}
