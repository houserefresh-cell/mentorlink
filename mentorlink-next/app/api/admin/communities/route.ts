import { createHash, randomBytes } from "node:crypto";
import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get("communityId")?.trim();
    const q = searchParams.get("q")?.trim() ?? "";
    const admin = createSupabaseAdmin();

    if (q) {
      const users = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (users.error) throw new Error(users.error.message);
      const needle = q.toLowerCase();
      const matches = (users.data.users ?? [])
        .filter((user) => {
          const metadata = user.user_metadata ?? {};
          const fullName = `${metadata.first_name ?? ""} ${metadata.last_name ?? ""}`.toLowerCase();
          const email = (user.email ?? "").toLowerCase();
          const phone = (user.phone ?? "").toLowerCase();
          return fullName.includes(needle) || email.includes(needle) || phone.includes(needle);
        })
        .slice(0, 25)
        .map((user) => ({
          id: user.id,
          email: user.email ?? null,
          name: [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ") || user.email || "משתמש",
          phone: user.phone ?? null,
          role: user.user_metadata?.role ?? "user",
        }));
      return adminApiSuccess({ users: matches });
    }

    const [result, pendingRows] = await Promise.all([
      admin
        .from("communities")
        .select("id, name, description, is_public, status, is_pilot, created_at, locality_id, israel_localities(name)")
        .order("created_at", { ascending: false }),
      admin.from("community_memberships").select("community_id").eq("status", "pending"),
    ]);

    if (result.error) throw new Error(result.error.message);
    if (pendingRows.error) throw new Error(pendingRows.error.message);

    type CommunityRow = {
      id: string;
      name: string;
      description: string | null;
      is_public: boolean | null;
      status: string | null;
      is_pilot: boolean | null;
      created_at: string | null;
      israel_localities?: { name?: string | null } | { name?: string | null }[] | null;
    };

    const pendingByCommunity = new Map<string, number>();
    for (const row of pendingRows.data ?? []) {
      const key = String(row.community_id ?? "");
      if (!key) continue;
      pendingByCommunity.set(key, (pendingByCommunity.get(key) ?? 0) + 1);
    }

    const communities = ((result.data ?? []) as CommunityRow[]).map((community) => {
      const locality = Array.isArray(community.israel_localities)
        ? community.israel_localities[0]?.name ?? ""
        : community.israel_localities?.name ?? "";
      return {
        id: community.id,
        name: community.name,
        locality,
        description: community.description ?? "",
        isPublic: Boolean(community.is_public),
        status: community.status,
        isPilot: Boolean(community.is_pilot),
        pendingCount: pendingByCommunity.get(community.id) ?? 0,
        createdAt: community.created_at,
      };
    });

    if (!communityId) return adminApiSuccess({ communities });

    const selected = ((result.data ?? []) as CommunityRow[]).find((row) => row.id === communityId);
    if (!selected) return Response.json({ error: "הקהילה לא נמצאה." }, { status: 404 });

    const [members, invitations] = await Promise.all([
      admin
        .from("community_memberships")
        .select("id, user_id, status, joined_via, approved_by, approved_at, created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false }),
      admin
        .from("community_invitations")
        .select("id, invite_type, expires_at, max_uses, uses_count, revoked_at, created_at")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false }),
    ]);
    if (members.error) throw new Error(members.error.message);
    if (invitations.error) throw new Error(invitations.error.message);

    const membershipUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (membershipUsers.error) throw new Error(membershipUsers.error.message);
    const byUserId = new Map(
      (membershipUsers.data.users ?? []).map((user) => [
        user.id,
        {
          email: user.email ?? null,
          name: [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ") || user.email || "משתמש",
          phone: user.phone ?? null,
          role: user.user_metadata?.role ?? "user",
        },
      ]),
    );

    return adminApiSuccess({
      community: {
        id: selected.id,
        name: selected.name,
        description: selected.description ?? "",
        isPublic: Boolean(selected.is_public),
        status: selected.status,
        isPilot: Boolean(selected.is_pilot),
        locality: Array.isArray(selected.israel_localities) ? selected.israel_localities[0]?.name ?? "" : selected.israel_localities?.name ?? "",
      },
      members: (members.data ?? []).map((row) => ({ ...row, user: byUserId.get(row.user_id) ?? null })),
      pendingRequests: (members.data ?? []).filter((row) => row.status === "pending"),
      invitations: invitations.data ?? [],
    });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const locality = typeof body.locality === "string" ? body.locality.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const isPublic = body.isPublic === true || body.is_public === true;
    const status = typeof body.status === "string" ? body.status : "active";
    const isPilot = body.isPilot === true || body.is_pilot === true;

    if (!name || !locality) {
      return Response.json({ error: "יש להזין שם קהילה ועיר/יישוב." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const localityResult = await admin
      .from("israel_localities")
      .select("id")
      .ilike("name", locality)
      .maybeSingle();

    if (localityResult.error) throw new Error(localityResult.error.message);
    if (!localityResult.data) {
      return Response.json({ error: "העיר/יישוב לא נמצא במקור הרשמי של המערכת." }, { status: 400 });
    }

    const insertResult = await admin
      .from("communities")
      .insert({
        name,
        locality_id: localityResult.data.id,
        description: description || null,
        is_public: isPublic,
        status: ["active", "hidden", "archived"].includes(status) ? status : "active",
        is_pilot: isPilot,
        created_by: administrator.id,
      })
      .select("id, name, description, is_public, status, is_pilot, created_at");

    if (insertResult.error) throw new Error(insertResult.error.message);

    return adminApiSuccess({ community: insertResult.data?.[0] ?? null });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";
    const admin = createSupabaseAdmin();

    if (action === "update-community") {
      const id = typeof payload.id === "string" ? payload.id : "";
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const description = typeof payload.description === "string" ? payload.description.trim() : "";
      const status = typeof payload.status === "string" ? payload.status : "active";
      const isPublic = payload.isPublic === true || payload.is_public === true;
      const isPilot = payload.isPilot === true || payload.is_pilot === true;
      const locality = typeof payload.locality === "string" ? payload.locality.trim() : "";
      if (!id || !name) return Response.json({ error: "חסרים פרטי קהילה." }, { status: 400 });

      let localityId: string | null = null;
      if (locality) {
        const result = await admin.from("israel_localities").select("id").ilike("name", locality).maybeSingle();
        if (result.error) throw new Error(result.error.message);
        if (!result.data) return Response.json({ error: "העיר/יישוב לא נמצא במקור הרשמי של המערכת." }, { status: 400 });
        localityId = result.data.id;
      }

      const update: Record<string, unknown> = {
        name,
        description: description || null,
        is_public: isPublic,
        status: ["active", "hidden", "archived"].includes(status) ? status : "active",
        is_pilot: isPilot,
        updated_at: new Date().toISOString(),
      };
      if (localityId) update.locality_id = localityId;

      const updated = await admin
        .from("communities")
        .update(update)
        .eq("id", id)
        .select("id, name, description, is_public, status, is_pilot, locality_id")
        .single();
      if (updated.error) throw new Error(updated.error.message);
      return adminApiSuccess({ community: updated.data });
    }

    if (action === "approve-membership" || action === "reject-membership") {
      const membershipId = typeof payload.membershipId === "string" ? payload.membershipId : "";
      if (!membershipId) return Response.json({ error: "חברת קהילה חסרה." }, { status: 400 });
      const nextStatus = action === "approve-membership" ? "active" : "rejected";
      const updated = await admin
        .from("community_memberships")
        .update({ status: nextStatus, approved_by: administrator.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", membershipId)
        .select("id, community_id, user_id, status")
        .single();
      if (updated.error) throw new Error(updated.error.message);
      return adminApiSuccess({ membership: updated.data });
    }

    if (action === "manual-add-member") {
      const communityId = typeof payload.communityId === "string" ? payload.communityId : "";
      const userId = typeof payload.userId === "string" ? payload.userId : "";
      if (!communityId || !userId) return Response.json({ error: "חסרים פרטי קהילה או משתמש." }, { status: 400 });

      const community = await admin.from("communities").select("id, is_public").eq("id", communityId).maybeSingle();
      if (community.error) throw new Error(community.error.message);
      if (!community.data) return Response.json({ error: "הקהילה לא נמצאה." }, { status: 404 });

      const existing = await admin.from("community_memberships").select("id, status").eq("community_id", communityId).eq("user_id", userId).maybeSingle();
      if (existing.data) {
        const nextStatus = "active";
        const updated = await admin
          .from("community_memberships")
          .update({ status: nextStatus, approved_by: administrator.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", existing.data.id)
          .select("id, community_id, user_id, status")
          .single();
        if (updated.error) throw new Error(updated.error.message);
        return adminApiSuccess({ membership: updated.data, created: false });
      }

      const inserted = await admin
        .from("community_memberships")
        .insert({
          community_id: communityId,
          user_id: userId,
          status: community.data.is_public ? "active" : "pending",
          joined_via: "admin_manual",
          approved_by: administrator.id,
          approved_at: new Date().toISOString(),
        })
        .select("id, community_id, user_id, status")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      return adminApiSuccess({ membership: inserted.data, created: true });
    }

    if (action === "generate-invite") {
      const communityId = typeof payload.communityId === "string" ? payload.communityId : "";
      if (!communityId) return Response.json({ error: "חסרה קהילה." }, { status: 400 });

      const days = Number(payload.days ?? 30);
      const maxUses = Number(payload.maxUses ?? 0);
      const token = `${randomBytes(24).toString("hex")}.${randomBytes(12).toString("hex")}`;
      const expiresAt = new Date(Date.now() + Math.max(1, Number.isFinite(days) ? days : 30) * 86400000).toISOString();

      const inserted = await admin
        .from("community_invitations")
        .insert({
          community_id: communityId,
          created_by: administrator.id,
          invite_type: "link",
          token_hash: hashToken(token),
          expires_at: expiresAt,
          max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
          uses_count: 0,
          revoked_at: null,
        })
        .select("id, community_id, expires_at, max_uses, uses_count, created_at")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
      return adminApiSuccess({
        invite: {
          ...inserted.data,
          token,
          url: `${siteUrl}/communities?invite=${encodeURIComponent(token)}`,
        },
      });
    }

    if (action === "revoke-invite") {
      const invitationId = typeof payload.invitationId === "string" ? payload.invitationId : "";
      if (!invitationId) return Response.json({ error: "חסרה הזמנה." }, { status: 400 });
      const revoked = await admin
        .from("community_invitations")
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invitationId)
        .select("id, revoked_at")
        .single();
      if (revoked.error) throw new Error(revoked.error.message);
      return adminApiSuccess({ invitation: revoked.data });
    }

    return Response.json({ error: "פעולה לא תקינה." }, { status: 400 });
  } catch (error) {
    return adminApiError(error);
  }
}

