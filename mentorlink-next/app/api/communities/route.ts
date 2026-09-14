import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.trim();
  const admin = createSupabaseAdmin();

  let query = admin
    .from("communities")
    .select("id, name, description, is_public, status, locality_id, israel_localities(name)")
    .eq("status", "active");

  if (city) {
    query = query.ilike("israel_localities.name", city);
  }

  const result = await query.order("name");
  if (result.error) {
    return Response.json({ error: "לא ניתן לטעון קהילות." }, { status: 500 });
  }

  const membershipsResult = user
    ? await admin
        .from("community_memberships")
        .select("community_id, status")
        .eq("user_id", user.id)
    : { data: [], error: null };

  if (membershipsResult.error) {
    return Response.json({ error: "לא ניתן לטעון סטטוס חברות." }, { status: 500 });
  }

  const memberships = new Map<string, string>();
  for (const row of membershipsResult.data ?? []) {
    if (row.community_id) memberships.set(String(row.community_id), row.status ?? "pending");
  }

  type CommunityRow = {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean | null;
    status: string | null;
    locality_id: string | null;
    israel_localities: { name?: string | null } | Array<{ name?: string | null }> | null;
  };

  const communities = ((result.data ?? []) as CommunityRow[]).map((community) => {
    const locality = Array.isArray(community.israel_localities)
      ? community.israel_localities[0]?.name ?? ""
      : community.israel_localities?.name ?? "";
    return {
      id: community.id,
      name: community.name,
      description: community.description ?? "",
      isPublic: Boolean(community.is_public),
      status: community.status,
      locality,
      membershipStatus: memberships.get(String(community.id)) ?? null,
      canJoin: !memberships.has(String(community.id)) || memberships.get(String(community.id)) === "rejected",
    };
  });

  return Response.json({ communities }, { headers: { "Cache-Control": "no-store" } });
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

  const communityId = typeof body.communityId === "string" ? body.communityId : "";
  if (!communityId) {
    return Response.json({ error: "יש לבחור קהילה." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const community = await admin
    .from("communities")
    .select("id, name, is_public, status")
    .eq("id", communityId)
    .maybeSingle();

  if (community.error) {
    return Response.json({ error: "לא ניתן לקרוא את הקהילה." }, { status: 500 });
  }
  if (!community.data || community.data.status !== "active") {
    return Response.json({ error: "הקהילה אינה זמינה." }, { status: 404 });
  }

  const existing = await admin
    .from("community_memberships")
    .select("id, status")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.data && existing.data.status === "active") {
    return Response.json({ membership: { status: "active", communityId }, alreadyMember: true });
  }

  if (existing.data && existing.data.status === "pending") {
    return Response.json({ membership: { status: "pending", communityId }, alreadyMember: true });
  }

  if (existing.data && ["rejected", "suspended", "archived"].includes(existing.data.status)) {
    return Response.json({ error: "הזכות לקהילה נשללה או הושעה; נדרשת החלטה מנהלת." }, { status: 403 });
  }

  const nextStatus = community.data.is_public ? "active" : "pending";
  const result = existing.data
    ? await admin
        .from("community_memberships")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
          joined_via: "request",
        })
        .eq("id", existing.data.id)
        .select("id, community_id, status")
        .single()
    : await admin
        .from("community_memberships")
        .insert({
          community_id: communityId,
          user_id: user.id,
          status: nextStatus,
          joined_via: community.data.is_public ? "request" : "request",
          approved_by: null,
          approved_at: null,
        })
        .select("id, community_id, status")
        .single();

  if (result.error) {
    return Response.json({ error: "לא ניתן לעדכן את החברות בקהילה." }, { status: 500 });
  }

  return Response.json({ membership: result.data, status: nextStatus }, { status: 200 });
}
