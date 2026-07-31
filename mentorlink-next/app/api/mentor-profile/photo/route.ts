import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const path = typeof body.path === "string" && body.path.startsWith(`${user.id}/`) && body.path.length <= 240 ? body.path : null;
  if (body.path !== null && !path) return Response.json({ error: "Invalid photo path" }, { status: 400 });
  const client = createSupabaseAdmin();
  const [profile, publication] = await Promise.all([
    client.from("mentor_profiles").select("profile_photo_path").eq("user_id", user.id).maybeSingle(),
    client.from("mentor_publication").select("status").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile.error || publication.error || !profile.data) return Response.json({ error: "Unable to load photo state" }, { status: 500 });
  if (publication.data?.status === "published") {
    const existing = await client.from("mentor_public_pending_changes").select("id").eq("mentor_user_id", user.id).eq("field_name", "profile_photo_path").eq("status", "pending").maybeSingle();
    const change = { current_value: profile.data.profile_photo_path, requested_value: path, requested_at: new Date().toISOString() };
    const saved = existing.data ? await client.from("mentor_public_pending_changes").update(change).eq("id", existing.data.id) : await client.from("mentor_public_pending_changes").insert({ mentor_user_id: user.id, field_name: "profile_photo_path", ...change });
    if (saved.error) return Response.json({ error: "Unable to stage photo", code: "PHOTO_REVIEW_FAILED" }, { status: 500 });
    return Response.json({ pending: true });
  }
  const saved = await client.from("mentor_profiles").update({ profile_photo_path: path, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (saved.error) return Response.json({ error: "Unable to save photo", code: "PHOTO_SAVE_FAILED" }, { status: 500 });
  return Response.json({ pending: false });
}