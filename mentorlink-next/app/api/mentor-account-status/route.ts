import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerAuth } from "@/lib/supabase-server-auth";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  const auth = await createSupabaseServerAuth().auth.getUser(token);
  if (auth.error || !auth.data.user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  const admin = createSupabaseAdmin();
  const control = await admin.from("mentor_account_controls").select("status, reason, suspended_until, previous_publication_status").eq("user_id", auth.data.user.id).maybeSingle();
  if (control.error) return Response.json({ error: "לא ניתן לבדוק את מצב החשבון." }, { status: 500 });
  if (control.data?.status === "suspended" && control.data.suspended_until && Date.parse(control.data.suspended_until) <= Date.now()) {
    await admin.from("mentor_account_controls").update({ status: "active", reason: null, suspended_until: null, previous_publication_status: null, updated_at: new Date().toISOString() }).eq("user_id", auth.data.user.id);
    if (control.data.previous_publication_status === "published") await admin.from("mentor_publication").update({ status: "published" }).eq("user_id", auth.data.user.id).eq("status", "paused");
    return Response.json({ status: "active", reason: null, suspendedUntil: null }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ status: control.data?.status ?? "active", reason: control.data?.reason ?? null, suspendedUntil: control.data?.suspended_until ?? null }, { headers: { "Cache-Control": "no-store" } });
}
