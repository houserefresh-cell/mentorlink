import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getAgeFromBirthDate } from "@/lib/mentor-age";
import {
  normalizeCommunityScope,
  resolveMentorVisibilityScope,
} from "@/lib/community-visibility";

const VALID_SCOPES = new Set(["public", "community_restricted"]);

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const [settings, links, profile, approvals] = await Promise.all([
    admin.from("mentor_visibility_settings").select("general_scope").eq("user_id", user.id).maybeSingle(),
    admin.from("mentor_visibility_communities").select("community_id").eq("user_id", user.id).eq("status", "active"),
    admin.from("mentor_profiles").select("birth_date").eq("user_id", user.id).maybeSingle(),
    admin.from("parent_visibility_approvals").select("approved_scope").eq("mentor_user_id", user.id),
  ]);

  if (settings.error || links.error || profile.error || approvals.error) {
    return Response.json({ error: "לא ניתן לטעון את הגדרות הנראות." }, { status: 500 });
  }

  const age = profile.data?.birth_date ? getAgeFromBirthDate(profile.data.birth_date) : null;
  const isMinor = age !== null && age < 18;
  const approvedScope = approvals.data?.some((item) => item.approved_scope === "public")
    ? "public"
    : approvals.data?.some((item) => item.approved_scope === "community_restricted")
      ? "community_restricted"
      : "community_restricted";

  const scope = normalizeCommunityScope(settings.data?.general_scope ?? "public");
  const effectiveScope = resolveMentorVisibilityScope({
    isMinor,
    parentApprovedScope: approvedScope,
    desiredScope: scope,
  });

  return Response.json({
    generalScope: effectiveScope,
    parentApprovedScope: approvedScope,
    communityIds: (links.data ?? []).map((row) => String(row.community_id ?? "")).filter(Boolean),
    isMinor,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }

  const nextGeneralScope = typeof payload.generalScope === "string" ? payload.generalScope : "public";
  const communityIds = Array.isArray(payload.communityIds)
    ? [...new Set(payload.communityIds.filter((value) => typeof value === "string" && value.trim()))]
    : [];

  if (!VALID_SCOPES.has(nextGeneralScope)) {
    return Response.json({ error: "סוג הנראות אינו תקין." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const profile = await admin.from("mentor_profiles").select("birth_date").eq("user_id", user.id).maybeSingle();
  const approvals = await admin.from("parent_visibility_approvals").select("approved_scope").eq("mentor_user_id", user.id);
  if (profile.error || approvals.error) return Response.json({ error: "לא ניתן לטעון את סטטוס האישור ההורי." }, { status: 500 });

  const age = profile.data?.birth_date ? getAgeFromBirthDate(profile.data.birth_date) : null;
  const isMinor = age !== null && age < 18;
  const approvedScope = approvals.data?.some((item) => item.approved_scope === "public")
    ? "public"
    : approvals.data?.some((item) => item.approved_scope === "community_restricted")
      ? "community_restricted"
      : "community_restricted";

  const desiredScope = resolveMentorVisibilityScope({
    isMinor,
    parentApprovedScope: approvedScope,
    desiredScope: nextGeneralScope,
  });

  const settingsResult = await admin
    .from("mentor_visibility_settings")
    .upsert({ user_id: user.id, general_scope: desiredScope, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("user_id, general_scope")
    .single();

  if (settingsResult.error) return Response.json({ error: "לא ניתן לשמור את הגדרות הנראות." }, { status: 500 });

  const activeCommunityIds = desiredScope === "community_restricted" && communityIds.length ? communityIds : [];
  await admin.from("mentor_visibility_communities").delete().eq("user_id", user.id);
  if (activeCommunityIds.length) {
    const validCommunityIdsResult = await admin
      .from("communities")
      .select("id")
      .in("id", activeCommunityIds)
      .eq("status", "active");
    if (validCommunityIdsResult.error) return Response.json({ error: "לא ניתן לאמת את הקהילות שנבחרו." }, { status: 500 });
    const validIds = new Set((validCommunityIdsResult.data ?? []).map((row) => String(row.id ?? "")).filter(Boolean));
    const rows = [...validIds].map((communityId) => ({ user_id: user.id, community_id: communityId, status: "active", updated_at: new Date().toISOString() }));
    if (rows.length) {
      const insertResult = await admin.from("mentor_visibility_communities").insert(rows);
      if (insertResult.error) return Response.json({ error: "לא ניתן לשמור את קהילות ההצגה." }, { status: 500 });
    }
  }

  return Response.json({
    generalScope: desiredScope,
    parentApprovedScope: approvedScope,
    communityIds: activeCommunityIds,
  });
}
