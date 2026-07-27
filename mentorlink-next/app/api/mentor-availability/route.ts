import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { israelLocalDateTimeToUtc } from "@/lib/israel-calendar";
import { MEETING_DURATIONS, MEETING_MODES } from "@/lib/meeting-scheduling-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  try {
    const client = createSupabaseAdmin();
    const [windows, blackouts] = await Promise.all([
      client.from("mentor_availability_windows").select("*").eq("mentor_user_id", user.id).order("weekday"),
      client.from("mentor_blackout_periods").select("*").eq("mentor_user_id", user.id).order("starts_at"),
    ]);
    if (windows.error || blackouts.error) throw new Error("query failed");
    return Response.json({ windows: windows.data ?? [], blackouts: blackouts.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load availability" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
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
        return Response.json({ error: "Invalid blackout period" }, { status: 400 });
      }
      const result = await client.from("mentor_blackout_periods").insert({
        mentor_user_id: user.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: clean(payload.reason, 120) || null,
      }).select("*").single();
      if (result.error) throw new Error("insert failed");
      return Response.json({ blackout: result.data }, { status: 201 });
    }
    const window = validateWindow(payload);
    if (!window) return Response.json({ error: "Invalid availability window" }, { status: 400 });
    const result = await client.from("mentor_availability_windows").insert({
      mentor_user_id: user.id,
      ...window,
    }).select("*").single();
    if (result.error) throw new Error("insert failed");
    return Response.json({ window: result.data }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to save availability" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const id = clean(payload.id, 36);
  const window = validateWindow(payload);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !window) return Response.json({ error: "Invalid availability window" }, { status: 400 });
  try {
    const client = createSupabaseAdmin();
    const result = await client.from("mentor_availability_windows").update({
      ...window,
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("mentor_user_id", user.id).select("*").maybeSingle();
    if (result.error) throw new Error("update failed");
    if (!result.data) return Response.json({ error: "Window not found" }, { status: 404 });
    return Response.json({ window: result.data });
  } catch {
    return Response.json({ error: "Unable to update availability" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const type = url.searchParams.get("type");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  try {
    const client = createSupabaseAdmin();
    const table = type === "blackout" ? "mentor_blackout_periods" : "mentor_availability_windows";
    const result = await client.from(table).delete().eq("id", id).eq("mentor_user_id", user.id);
    if (result.error) throw new Error("delete failed");
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Unable to delete availability" }, { status: 500 });
  }
}

function validateWindow(payload: Record<string, unknown>) {
  const weekday = Number(payload.weekday);
  const startTime = clean(payload.startTime, 8);
  const endTime = clean(payload.endTime, 8);
  const meetingMode = clean(payload.meetingMode, 20);
  const durations = Array.isArray(payload.durations)
    ? payload.durations.map(Number).filter((duration) => MEETING_DURATIONS.includes(duration as never))
    : [];
  if (
    !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
    !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) ||
    endTime <= startTime || !MEETING_MODES.includes(meetingMode as never) ||
    !durations.length
  ) return null;
  return {
    weekday,
    start_time: startTime,
    end_time: endTime,
    meeting_mode: meetingMode,
    supported_durations: [...new Set(durations)],
    is_active: payload.isActive !== false,
    effective_start_date: clean(payload.effectiveStartDate, 10) || null,
    effective_end_date: clean(payload.effectiveEndDate, 10) || null,
    timezone: "Asia/Jerusalem",
  };
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length <= maximum ? value.trim() : "";
}
