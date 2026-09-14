export type MentorGeneralVisibility = "public" | "community_restricted";
export type CommunityMembershipStatus = "pending" | "active" | "rejected" | "suspended" | "archived";

export function isPublishedMentor(publicationStatus: string | null | undefined) {
  return publicationStatus === "published";
}

export function isParentConsentApproved(status: string | null | undefined) {
  return status === "approved";
}

export function isMentorVisibleToUser({
  publicationStatus,
  parentConsentStatus,
  generalVisibility,
  allowedCommunityIds,
  userCommunityIds,
}: {
  publicationStatus: string | null | undefined;
  parentConsentStatus: string | null | undefined;
  generalVisibility: MentorGeneralVisibility | null | undefined;
  allowedCommunityIds: Array<string | null | undefined>;
  userCommunityIds: Array<string | null | undefined>;
}) {
  if (!isPublishedMentor(publicationStatus)) return false;
  if (parentConsentStatus && parentConsentStatus !== "approved") return false;
  if (generalVisibility === "public") return true;
  if (generalVisibility === "community_restricted") {
    const allowedSet = new Set(allowedCommunityIds.filter(Boolean) as string[]);
    const memberSet = new Set(userCommunityIds.filter(Boolean) as string[]);
    return allowedSet.size > 0 && [...allowedSet].some((communityId) => memberSet.has(communityId));
  }
  return true;
}

export function isCommunityAllowedForMember({
  communityStatus,
  membershipStatus,
  isPublicCommunity,
}: {
  communityStatus: string | null | undefined;
  membershipStatus: CommunityMembershipStatus | null | undefined;
  isPublicCommunity: boolean;
}) {
  if (communityStatus === "archived" || communityStatus === "hidden") return false;
  if (isPublicCommunity) return membershipStatus === "active" || membershipStatus === null;
  return membershipStatus === "active";
}

export function nextMembershipStatusForRequest({
  isPublicCommunity,
  currentStatus,
}: {
  isPublicCommunity: boolean;
  currentStatus?: CommunityMembershipStatus | null;
}) {
  if (currentStatus === "active") return "active" as const;
  if (currentStatus === "pending") return "pending" as const;
  if (currentStatus === "rejected") return isPublicCommunity ? "active" : "pending";
  if (isPublicCommunity) return "active" as const;
  return "pending" as const;
}

export function normalizeCommunityScope(scope: string | null | undefined) {
  if (scope === "community_restricted") return "community_restricted" as const;
  return "public" as const;
}

export function canMentorUseVisibility({
  isMinor,
  parentApprovedScope,
  proposedScope,
}: {
  isMinor: boolean;
  parentApprovedScope?: string | null;
  proposedScope: MentorGeneralVisibility;
}) {
  if (proposedScope !== "public") return true;
  if (!isMinor) return true;
  return normalizeCommunityScope(parentApprovedScope) === "public";
}

export function resolveMentorVisibilityScope({
  isMinor,
  parentApprovedScope,
  desiredScope,
}: {
  isMinor: boolean;
  parentApprovedScope?: string | null;
  desiredScope?: string | null;
}) {
  const requested = normalizeCommunityScope(desiredScope);
  if (!canMentorUseVisibility({ isMinor, parentApprovedScope, proposedScope: requested })) {
    return "community_restricted" as const;
  }
  return requested;
}
