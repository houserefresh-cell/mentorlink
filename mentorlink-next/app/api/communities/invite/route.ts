import { createHash } from "node:crypto";
import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "אין קוד הזמנה." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const result = await admin.from("community_invitations").select("id, community_id, token_hash, expires_at, max_uses, uses_count, revoked_at, communities(id, name, is_public, status)");
  if (result.error) {
    return Response.json({ error: "לא ניתן לבדוק את קוד ההזמנה." }, { status: 500 });
  }

  const invited = (result.data ?? []).find((row) => {
    const hash = String(row.token_hash ?? "");
    const revoked = row.revoked_at ?? null;
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    const maxUses = row.max_uses ?? null;
    const used = Number(row.uses_count ?? 0);
    const active = !revoked && (!expiresAt || expiresAt > new Date()) && (maxUses === null || used < maxUses);
    return active && hash === hashToken(token);
  });

  if (!invited || !invited.communities) {
    return Response.json({ error: "קוד ההזמנה אינו תקף או פג תוקפו." }, { status: 404 });
  }

  const community = Array.isArray(invited.communities)
    ? invited.communities[0]
    : invited.communities;

  return Response.json({
    valid: true,
    community: {
      id: community?.id ?? invited.community_id,
      name: community?.name ?? "קהילה",
      isPublic: Boolean(community?.is_public),
      status: community?.status ?? "active",
    },
    inviteId: invited.id,
  });
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return Response.json({ error: "אין קוד הזמנה." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const invitesResult = await admin.from("community_invitations").select("id, community_id, token_hash, expires_at, max_uses, uses_count, revoked_at");
  if (invitesResult.error) {
    return Response.json({ error: "לא ניתן לעבד את קוד ההזמנה." }, { status: 500 });
  }

  const invite = (invitesResult.data ?? []).find((row) => {
    const hash = String(row.token_hash ?? "");
    const revoked = row.revoked_at ?? null;
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    const maxUses = row.max_uses ?? null;
    const used = Number(row.uses_count ?? 0);
    const active = !revoked && (!expiresAt || expiresAt > new Date()) && (maxUses === null || used < maxUses);
    return active && hash === hashToken(token);
  });

  if (!invite) {
    return Response.json({ error: "קוד ההזמנה אינו תקף או פג תוקפו." }, { status: 404 });
  }

  const communityResult = await admin
    .from("communities")
    .select("id, name, is_public, status")
    .eq("id", invite.community_id)
    .maybeSingle();

  if (communityResult.error || !communityResult.data) {
    return Response.json({ error: "הקהילה של הקוד לא נמצאת יותר במערכת." }, { status: 404 });
  }

  if (communityResult.data.status !== "active") {
    return Response.json({ error: "הקהילה אינה זמינה כרגע." }, { status: 403 });
  }

  const existingResult = await admin
    .from("community_memberships")
    .select("id, status")
    .eq("community_id", invite.community_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingResult.data && existingResult.data.status === "active") {
    return Response.json({ membership: { status: "active", communityId: invite.community_id }, alreadyMember: true });
  }

  const nextStatus = communityResult.data.is_public ? "active" : "pending";
  const membership = existingResult.data
    ? await admin
        .from("community_memberships")
        .update({ status: nextStatus, joined_via: "invite", updated_at: new Date().toISOString() })
        .eq("id", existingResult.data.id)
        .select("id, community_id, status")
        .single()
    : await admin
        .from("community_memberships")
        .insert({
          community_id: invite.community_id,
          user_id: user.id,
          status: nextStatus,
          joined_via: "invite",
          approved_by: null,
          approved_at: null,
        })
        .select("id, community_id, status")
        .single();

  if (membership.error) {
    return Response.json({ error: "לא ניתן להוסיף את המשתמש לקהילה." }, { status: 500 });
  }

  const updatedInvite = await admin
    .from("community_invitations")
    .update({
      uses_count: Number(invite.uses_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .select("id, uses_count")
    .maybeSingle();

  if (updatedInvite.error) {
    return Response.json({ error: "לא ניתן לסיים את השימוש בהזמנה." }, { status: 500 });
  }

  return Response.json({ membership: membership.data, status: nextStatus, alreadyMember: Boolean(existingResult.data) }, { status: 200 });
}
