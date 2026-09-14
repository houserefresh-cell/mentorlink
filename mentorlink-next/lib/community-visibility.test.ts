import test from "node:test";
import assert from "node:assert/strict";
import {
  canMentorUseVisibility,
  isCommunityAllowedForMember,
  isMentorVisibleToUser,
  nextMembershipStatusForRequest,
  normalizeCommunityScope,
  resolveMentorVisibilityScope,
} from "./community-visibility.ts";

test("public mentors remain visible when published and the parent approval gate is satisfied", () => {
  assert.equal(
    isMentorVisibleToUser({
      publicationStatus: "published",
      parentConsentStatus: "approved",
      generalVisibility: "public",
      allowedCommunityIds: [],
      userCommunityIds: [],
    }),
    true,
  );
});

test("community-restricted mentors require an active membership in an allowed community", () => {
  assert.equal(
    isMentorVisibleToUser({
      publicationStatus: "published",
      parentConsentStatus: "approved",
      generalVisibility: "community_restricted",
      allowedCommunityIds: ["community-1", "community-2"],
      userCommunityIds: ["community-2"],
    }),
    true,
  );
  assert.equal(
    isMentorVisibleToUser({
      publicationStatus: "published",
      parentConsentStatus: "approved",
      generalVisibility: "community_restricted",
      allowedCommunityIds: ["community-1", "community-2"],
      userCommunityIds: ["community-3"],
    }),
    false,
  );
});

test("public communities allow direct join while private communities require a request", () => {
  assert.equal(nextMembershipStatusForRequest({ isPublicCommunity: true }), "active");
  assert.equal(nextMembershipStatusForRequest({ isPublicCommunity: false }), "pending");
});

test("private community access is blocked until membership is active", () => {
  assert.equal(
    isCommunityAllowedForMember({
      communityStatus: "active",
      membershipStatus: "pending",
      isPublicCommunity: false,
    }),
    false,
  );
  assert.equal(
    isCommunityAllowedForMember({
      communityStatus: "active",
      membershipStatus: "active",
      isPublicCommunity: false,
    }),
    true,
  );
  assert.equal(
    isCommunityAllowedForMember({
      communityStatus: "active",
      membershipStatus: null,
      isPublicCommunity: true,
    }),
    true,
  );
});

test("missing scope values normalize to the public default", () => {
  assert.equal(normalizeCommunityScope("community_restricted"), "community_restricted");
  assert.equal(normalizeCommunityScope(null), "public");
});

test("parent-approved ceiling prevents public visibility beyond the approved scope", () => {
  assert.equal(
    canMentorUseVisibility({ isMinor: true, parentApprovedScope: "public", proposedScope: "public" }),
    true,
  );
  assert.equal(
    canMentorUseVisibility({ isMinor: true, parentApprovedScope: "community_restricted", proposedScope: "public" }),
    false,
  );
  assert.equal(
    resolveMentorVisibilityScope({ isMinor: true, parentApprovedScope: "community_restricted", desiredScope: "public" }),
    "community_restricted",
  );
});
