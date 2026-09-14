import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { israelLocalDateTimeToUtc } from "@/lib/israel-calendar";
import { isMeetingDuration, MEETING_MODES } from "@/lib/meeting-scheduling-core";
import { isAllowedMentorMeetingPrice, type MentorCapabilities } from "@/lib/mentor-age";
import { loadMentorCapabilities } from "@/lib/mentor-capabilities-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { validateMentorAudience } from "@/lib/mentor-audience-access";

function availabilityDiagnostic(stage: string, ok: boolean, code: string) {
  console.info("Mentor availability", { stage, ok, code });
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 });
  try {
    const client = createSupabaseAdmin();
    const [windows, blackouts, capabilities] = await Promise.all([
      client.from("mentor_availability_windows").select("*").eq("mentor_user_id", user.id).order("weekday").order("start_time"),
      client.from("mentor_blackout_periods").select("*").eq("mentor_user_id", user.id).order("starts_at"),
      loadMentorCapabilities(client, user.id),
    ]);
    if (windows.error || blackouts.error) throw new Error("query failed");
    const windowIds = (windows.data ?? []).map((window) => window.id);
    const links = windowIds.length
      ? await client.from("mentor_availability_window_subjects").select("window_id, subject_id").in("window_id", windowIds)
      : { data: [], error: null };
    if (links.error) throw new Error("subject links failed");
    const subjectIdsByWindow = new Map<string, number[]>();
    for (const link of links.data ?? []) {
      subjectIdsByWindow.set(link.window_id, [...(subjectIdsByWindow.get(link.window_id) ?? []), link.subject_id]);
    }
    const meetingRows = windowIds.length
      ? await client.from("meeting_requests").select("id, source_availability_id, requested_start_at, confirmed_start_at, child_first_name, subject, status").eq("mentor_user_id", user.id).in("source_availability_id", windowIds).order("requested_start_at", { ascending: false })
      : { data: [], error: null };
    if (meetingRows.error) throw new Error("meeting history failed");
    const meetingsByWindow = new Map<string, typeof meetingRows.data>();
    for (const meeting of meetingRows.data ?? []) {
      const key = String(meeting.source_availability_id ?? "");
      if (!key) continue;
      meetingsByWindow.set(key, [...(meetingsByWindow.get(key) ?? []), meeting]);
    }
    availabilityDiagnostic("load", true, "AVAILABILITY_LOADED");
    return Response.json({
      windows: (windows.data ?? []).map((window) => ({ ...window, subject_ids: subjectIdsByWindow.get(window.id) ?? [], meetings: meetingsByWindow.get(window.id) ?? [] })),
      blackouts: blackouts.data ?? [],
      capabilities,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    availabilityDiagnostic("load", false, error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "לא ניתן לטעון את הזמינות.", code: "AVAILABILITY_LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה.", code: "INVALID_REQUEST" }, { status: 400 }); }
  try {
    const client = createSupabaseAdmin();
    if (payload.type === "blackout") {
      const startsOn = clean(payload.startsOn, 10);
      const endsOn = clean(payload.endsOn, 10) || startsOn;
      const startsAt = startsOn ? israelLocalDateTimeToUtc(startsOn, "00:00") : new Date(String(payload.startsAt));
      const nextDay = endsOn ? new Date(`${endsOn}T12:00:00Z`) : null;
      if (nextDay) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const endsAt = nextDay ? israelLocalDateTimeToUtc(nextDay.toISOString().slice(0, 10), "00:00") : new Date(String(payload.endsAt));
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        return Response.json({ error: "טווח החסימה אינו תקין.", code: "INVALID_BLACKOUT" }, { status: 400 });
      }
      const result = await client.from("mentor_blackout_periods").insert({ mentor_user_id: user.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: clean(payload.reason, 120) || null }).select("*").single();
      if (result.error) throw new Error("insert failed");
      availabilityDiagnostic("save_blackout", true, "BLACKOUT_SAVED");
      return Response.json({ blackout: result.data }, { status: 201 });
    }
    const capabilities = await loadMentorCapabilities(client, user.id);
    const window = validateWindow(payload, capabilities);
    if (!window) return Response.json({ error: capabilities.isAdult ? "שעות, אופן הפגישה, המחיר או המשכים אינם תקינים." : "שעות, אופן הפגישה, המשכים או המחיר אינם תקינים. לחונך מתחת לגיל 18 המחירים הזמינים הם 0, 10, 20, 30 או 40 ₪.", code: "INVALID_WINDOW" }, { status: 400 });
    const audienceScope = normalizeAudienceScope(payload.audienceScope);
    const requestedCommunityIds = audienceScope === "community" && Array.isArray(payload.communityIds)
      ? [...new Set(payload.communityIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))]
      : [];
    const audience = await validateMentorAudience(client, user.id, audienceScope, requestedCommunityIds);
    if (!audience.ok) {
      const message = audience.code === "PUBLIC_AUDIENCE_NOT_ALLOWED"
        ? "חשיפה ציבורית אינה מותרת לפי הגדרות החשיפה ואישור ההורה."
        : "יש לבחור רק קהילות שמותר לחונך לפרסם בהן.";
      return Response.json({ error: message, code: audience.code }, { status: 403 });
    }
    const subjectIds = await validateSubjectIds(client, user.id, payload.subjectIds);
    if (!subjectIds) return Response.json({ error: "יש לבחור לפחות מקצוע אחד מתוך המקצועות שלך.", code: "INVALID_WINDOW_SUBJECTS" }, { status: 400 });
    const duplicate = await client.from("mentor_availability_windows").select("id")
      .eq("mentor_user_id", user.id).eq("weekday", window.weekday)
      .eq("start_time", window.start_time).eq("end_time", window.end_time)
      .eq("meeting_mode", window.meeting_mode).maybeSingle();
    if (duplicate.error) throw new Error("duplicate check failed");
    if (duplicate.data) return Response.json({ error: "חלון זמינות זה כבר קיים.", code: "DUPLICATE_WINDOW" }, { status: 409 });
    const result = await client.from("mentor_availability_windows").insert({ mentor_user_id: user.id, ...window, audience_scope: audienceScope, community_ids: audience.communityIds }).select("*").single();
    if (result.error) throw new Error("insert failed");
    const linked = await client.from("mentor_availability_window_subjects").insert(
      subjectIds.map((subjectId) => ({ window_id: result.data.id, subject_id: subjectId })),
    );
    if (linked.error) {
      await client.from("mentor_availability_windows").delete().eq("id", result.data.id).eq("mentor_user_id", user.id);
      throw new Error("subject link failed");
    }
    availabilityDiagnostic("save_window", true, "AVAILABILITY_SAVED");
    return Response.json({ window: result.data }, { status: 201 });
  } catch (error) {
    availabilityDiagnostic("save", false, error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "לא ניתן לשמור את הזמינות.", code: "AVAILABILITY_SAVE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה.", code: "INVALID_REQUEST" }, { status: 400 }); }
  const id = clean(payload.id, 36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "חלון הזמינות אינו תקין.", code: "INVALID_WINDOW" }, { status: 400 });
  try {
    const client = createSupabaseAdmin();
    const capabilities = await loadMentorCapabilities(client, user.id);
    const window = validateWindow(payload, capabilities);
    if (!window) return Response.json({ error: capabilities.isAdult ? "חלון הזמינות או המחיר אינם תקינים." : "חלון הזמינות אינו תקין. לחונך מתחת לגיל 18 המחירים הזמינים הם 0, 10, 20, 30 או 40 ₪.", code: "INVALID_WINDOW" }, { status: 400 });
    const audienceScope = normalizeAudienceScope(payload.audienceScope);
    const requestedCommunityIds = audienceScope === "community" && Array.isArray(payload.communityIds)
      ? [...new Set(payload.communityIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0))]
      : [];
    const audience = await validateMentorAudience(client, user.id, audienceScope, requestedCommunityIds);
    if (!audience.ok) {
      const message = audience.code === "PUBLIC_AUDIENCE_NOT_ALLOWED"
        ? "חשיפה ציבורית אינה מותרת לפי הגדרות החשיפה ואישור ההורה."
        : "יש לבחור רק קהילות שמותר לחונך לפרסם בהן.";
      return Response.json({ error: message, code: audience.code }, { status: 403 });
    }
    const subjectIds = payload.subjectIds === undefined
      ? null
      : await validateSubjectIds(client, user.id, payload.subjectIds);
    if (payload.subjectIds !== undefined && !subjectIds) {
      return Response.json({ error: "יש לבחור לפחות מקצוע אחד מתוך המקצועות שלך.", code: "INVALID_WINDOW_SUBJECTS" }, { status: 400 });
    }
    const duplicate = await client.from("mentor_availability_windows").select("id")
      .eq("mentor_user_id", user.id).eq("weekday", window.weekday)
      .eq("start_time", window.start_time).eq("end_time", window.end_time)
      .eq("meeting_mode", window.meeting_mode).neq("id", id).maybeSingle();
    if (duplicate.error) throw new Error("duplicate check failed");
    if (duplicate.data) return Response.json({ error: "חלון זמינות זה כבר קיים.", code: "DUPLICATE_WINDOW" }, { status: 409 });
    const result = await client.from("mentor_availability_windows").update({ ...window, audience_scope: audienceScope, community_ids: audience.communityIds, updated_at: new Date().toISOString() }).eq("id", id).eq("mentor_user_id", user.id).select("*").maybeSingle();
    if (result.error) throw new Error("update failed");
    if (!result.data) return Response.json({ error: "חלון הזמינות לא נמצא.", code: "WINDOW_NOT_FOUND" }, { status: 404 });
    if (subjectIds) {
      const linked = await client.from("mentor_availability_window_subjects").upsert(
        subjectIds.map((subjectId) => ({ window_id: id, subject_id: subjectId })),
        { onConflict: "window_id,subject_id", ignoreDuplicates: true },
      );
      if (linked.error) throw new Error("subject link failed");
      const removed = await client
        .from("mentor_availability_window_subjects")
        .delete()
        .eq("window_id", id)
        .not("subject_id", "in", `(${subjectIds.join(",")})`);
      if (removed.error) throw new Error("subject unlink failed");
    }
    availabilityDiagnostic("update_window", true, "AVAILABILITY_SAVED");
    return Response.json({ window: result.data });
  } catch (error) {
    availabilityDiagnostic("update", false, error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "לא ניתן לעדכן את הזמינות.", code: "AVAILABILITY_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 });
  const url = new URL(request.url); const id = url.searchParams.get("id") ?? ""; const type = url.searchParams.get("type");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid id", code: "INVALID_ID" }, { status: 400 });
  try {
    const client = createSupabaseAdmin();
    const table = type === "blackout" ? "mentor_blackout_periods" : "mentor_availability_windows";
    const result = await client.from(table).delete().eq("id", id).eq("mentor_user_id", user.id);
    if (result.error) throw new Error("delete failed");
    availabilityDiagnostic("delete", true, "AVAILABILITY_DELETED");
    return new Response(null, { status: 204 });
  } catch (error) {
    availabilityDiagnostic("delete", false, error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "לא ניתן להסיר את הזמינות.", code: "AVAILABILITY_DELETE_FAILED" }, { status: 500 });
  }
}

function validateWindow(payload: Record<string, unknown>, capabilities: MentorCapabilities) {
  const weekday = Number(payload.weekday); const startTime = clean(payload.startTime, 8); const endTime = clean(payload.endTime, 8); const meetingMode = clean(payload.meetingMode, 20);
  const durations = Array.isArray(payload.durations) ? payload.durations.map(Number).filter(isMeetingDuration) : [];
  const meetingPrice = Number(payload.meetingPrice ?? 0);
  const location = clean(payload.location, 240);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime || !MEETING_MODES.includes(meetingMode as never) || !durations.length || !isAllowedMentorMeetingPrice(meetingPrice, capabilities)) return null;
  if (meetingMode === "פרונטלי" && !location) return null;
  return { weekday, start_time: startTime, end_time: endTime, meeting_mode: meetingMode, location: meetingMode === "אונליין" ? null : location, meeting_price: meetingPrice, supported_durations: [...new Set(durations)], is_active: payload.isActive !== false, effective_start_date: clean(payload.effectiveStartDate, 10) || null, effective_end_date: clean(payload.effectiveEndDate, 10) || null, timezone: "Asia/Jerusalem" };
}
function normalizeAudienceScope(value: unknown) {
  return value === "community" ? "community" : "all";
}
function clean(value: unknown, maximum: number) { return typeof value === "string" && value.trim().length <= maximum ? value.trim() : ""; }

async function validateSubjectIds(client: ReturnType<typeof createSupabaseAdmin>, userId: string, value: unknown) {
  const subjectIds = Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
  if (!subjectIds.length) return null;
  const owned = await client.from("mentor_subjects").select("subject_id").eq("user_id", userId).in("subject_id", subjectIds);
  if (owned.error || (owned.data ?? []).length !== subjectIds.length) return null;
  return subjectIds;
}
