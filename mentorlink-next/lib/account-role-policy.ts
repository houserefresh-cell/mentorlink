export type AccountRoleRequest = {
  role: "mentor" | "parent_guardian";
  managesMentorProfile: boolean;
};

export function buildAccountRoleRpcArguments(
  authenticatedUserId: string | null | undefined,
  input: unknown,
) {
  if (!authenticatedUserId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!input || typeof input !== "object") {
    throw new Error("INVALID_ACCOUNT_ROLE");
  }

  const candidate = input as Record<string, unknown>;
  if ("userId" in candidate || "requested_user_id" in candidate) {
    throw new Error("TARGET_USER_NOT_ALLOWED");
  }

  if (
    candidate.role !== "mentor" &&
    candidate.role !== "parent_guardian"
  ) {
    throw new Error("INVALID_ACCOUNT_ROLE");
  }

  if (
    candidate.managesMentorProfile !== undefined &&
    typeof candidate.managesMentorProfile !== "boolean"
  ) {
    throw new Error("INVALID_MENTOR_PROFILE_FLAG");
  }

  return {
    requested_role: candidate.role,
    requested_manages_mentor_profile:
      candidate.managesMentorProfile === true,
  } satisfies {
    requested_role: AccountRoleRequest["role"];
    requested_manages_mentor_profile:
      AccountRoleRequest["managesMentorProfile"];
  };
}

export function addAccountRole(
  existingRoles: readonly AccountRoleRequest["role"][],
  requestedRole: AccountRoleRequest["role"],
) {
  return [...new Set([...existingRoles, requestedRole])];
}
