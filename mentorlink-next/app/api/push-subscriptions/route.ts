import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type SubscriptionBody = {
  action?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  return Response.json({
    configured: Boolean(
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY &&
      process.env.WEB_PUSH_SUBJECT
    ),
    publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  let body: SubscriptionBody;
  try { body = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) {
    return Response.json({ error: "מינוי לא תקין." }, { status: 400 });
  }
  try {
    const client = createSupabaseAdmin();
    if (body.action === "state") {
      const state = await client.from("push_subscriptions")
        .select("id, disabled_at").eq("user_id", user.id).eq("endpoint", endpoint)
        .maybeSingle();
      if (state.error) throw new Error("state failed");
      return Response.json({ subscribed: Boolean(state.data && !state.data.disabled_at) });
    }
    const p256dh = body.keys?.p256dh?.trim() ?? "";
    const auth = body.keys?.auth?.trim() ?? "";
    if (p256dh.length < 20 || p256dh.length > 512 || auth.length < 8 || auth.length > 256) {
      return Response.json({ error: "מפתחות המינוי אינם תקינים." }, { status: 400 });
    }
    const existing = await client.from("push_subscriptions")
      .select("id, user_id").eq("endpoint", endpoint).maybeSingle();
    if (existing.error) throw new Error("lookup failed");
    if (existing.data && existing.data.user_id !== user.id) {
      return Response.json({ error: "המינוי שייך לחשבון אחר." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const result = existing.data
      ? await client.from("push_subscriptions").update({
          p256dh_key: p256dh, auth_key: auth, updated_at: now, disabled_at: null,
        }).eq("id", existing.data.id).eq("user_id", user.id).select("id").single()
      : await client.from("push_subscriptions").insert({
          user_id: user.id, endpoint, p256dh_key: p256dh, auth_key: auth,
        }).select("id").single();
    if (result.error) throw new Error("save failed");
    return Response.json({ subscribed: true }, { status: existing.data ? 200 : 201 });
  } catch {
    return Response.json({ error: "לא ניתן לשמור את המינוי." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  let body: { endpoint?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint.startsWith("https://")) {
    return Response.json({ error: "מינוי לא תקין." }, { status: 400 });
  }
  try {
    const client = createSupabaseAdmin();
    const result = await client.from("push_subscriptions")
      .delete().eq("user_id", user.id).eq("endpoint", endpoint);
    if (result.error) throw new Error("delete failed");
    return Response.json({ subscribed: false });
  } catch {
    return Response.json({ error: "לא ניתן להסיר את המינוי." }, { status: 500 });
  }
}
