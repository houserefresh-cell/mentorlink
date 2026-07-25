export type AccountRoleRequest = {
  role: "mentor" | "parent";
  ownerType: "mentor" | "parent_guardian";
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
    candidate.role !== "parent"
  ) {
    throw new Error("INVALID_ACCOUNT_ROLE");
  }

  if (
    candidate.ownerType !== undefined &&
    candidate.ownerType !== "mentor" &&
    candidate.ownerType !== "parent_guardian"
  ) {
    throw new Error("INVALID_ACCOUNT_OWNER_TYPE");
  }

  return {
    requested_role: candidate.role,
    requested_owner_type: candidate.ownerType ?? "mentor",
  } satisfies {
    requested_role: AccountRoleRequest["role"];
    requested_owner_type: AccountRoleRequest["ownerType"];
  };
}
