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
    return Response.json({
      notifications: result.data ?? [],
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
    const body = await request.json().catch(() => ({})) as { registrationOnly?: unknown; meetingRequestId?: unknown };
    const client = createSupabaseAdmin();
    let query = client.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    if (body.registrationOnly === true) {
      query = query.in("title", ["הרשמה חדשה לפעילות", "הצטרפות לרשימת ההמתנה"]);
    } else if (typeof body.meetingRequestId === "string" && /^[0-9a-f-]{36}$/i.test(body.meetingRequestId)) {
      query = query
        .in("kind", ["meeting_request_created", "meeting_details_updated", "meeting_alternative_proposed", "meeting_request_cancelled"])
        .like("href", `%meeting=${body.meetingRequestId}%`);
    }
    const result = await query;
    if (result.error) throw new Error("update failed");
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unable to update notifications" }, { status: 500 });
  }
}
