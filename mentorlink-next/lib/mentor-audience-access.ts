import { getAgeFromBirthDate } from "@/lib/mentor-age";
import { normalizeCommunityScope } from "@/lib/community-visibility";

type SupabaseLike = any;

export type MentorAudienceAccess = {
  generalScope: "public" | "community_restricted";
  parentApprovedScope: "public" | "community_restricted";
  isMinor: boolean;
  allowedCommunityIds: string[];
  canUsePublicAudience: boolean;
};

export async function loadMentorAudienceAccess(client: SupabaseLike, mentorUserId: string): Promise<MentorAudienceAccess> {
  const [settings, links, profile, approvals] = await Promise.all([
    client.from("mentor_visibility_settings").select("general_scope").eq("user_id", mentorUserId).maybeSingle(),
    client.from("mentor_visibility_communities").select("community_id").eq("user_id", mentorUserId).eq("status", "active"),
    client.from("mentor_profiles").select("birth_date").eq("user_id", mentorUserId).maybeSingle(),
    client.from("parent_visibility_approvals").select("approved_scope").eq("mentor_user_id", mentorUserId),
  ]);
  if (settings.error || links.error || profile.error || approvals.error) throw new Error("MENTOR_AUDIENCE_ACCESS_LOAD_FAILED");
  const age = profile.data?.birth_date ? getAgeFromBirthDate(profile.data.birth_date) : null;
  const isMinor = age !== null && age < 18;
  const parentApprovedScope = approvals.data?.some((row: any) => row.approved_scope === "public") ? "public" : "community_restricted";
  const generalScope = normalizeCommunityScope(settings.data?.general_scope ?? "public");
  return {
    generalScope,
    parentApprovedScope,
    isMinor,
    allowedCommunityIds: (links.data ?? []).map((row: any) => String(row.community_id ?? "")).filter(Boolean),
    canUsePublicAudience: !isMinor || parentApprovedScope === "public",
  };
}

export async function validateMentorAudience(
  client: SupabaseLike,
  mentorUserId: string,
  audienceScope: "all" | "community",
  communityIds: string[],
) {
  const access = await loadMentorAudienceAccess(client, mentorUserId);
  if (audienceScope === "all") {
    if (!access.canUsePublicAudience || access.generalScope === "community_restricted") {
      return { ok: false as const, code: "PUBLIC_AUDIENCE_NOT_ALLOWED", access };
    }
    return { ok: true as const, communityIds: [] as string[], access };
  }
  if (!communityIds.length) return { ok: false as const, code: "COMMUNITY_REQUIRED", access };
  const unique = [...new Set(communityIds)];
  const communities = await client.from("communities").select("id").in("id", unique).eq("status", "active");
  if (communities.error) throw new Error("COMMUNITY_VALIDATION_FAILED");
  const valid = new Set((communities.data ?? []).map((row: any) => String(row.id)));
  if (unique.some((id) => !valid.has(id))) return { ok: false as const, code: "INVALID_COMMUNITY", access };
  if (access.generalScope === "community_restricted") {
    const allowed = new Set(access.allowedCommunityIds);
    if (unique.some((id) => !allowed.has(id))) return { ok: false as const, code: "COMMUNITY_OUTSIDE_VISIBILITY", access };
  }
  return { ok: true as const, communityIds: unique, access };
}
