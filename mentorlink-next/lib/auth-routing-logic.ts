export type AccountRole = "mentor" | "parent_guardian";

export type DashboardResolution = {
  registrationRole?: AccountRole | null;
  savedAccountRoles?: readonly AccountRole[] | null;
  persistedRoleHint?: string | null;
  hasMentorOwnership?: boolean | null;
  hasStarterMentorProfile?: boolean | null;
};

export function resolveDashboardPath(resolution: DashboardResolution) {
  if (
    resolution.registrationRole === "mentor" ||
    resolution.savedAccountRoles?.includes("mentor") ||
    resolution.hasMentorOwnership
  ) {
    return resolution.hasStarterMentorProfile
      ? "/dashboard/mentor"
      : "/dashboard/mentor/onboarding";
  }

  if (
    resolution.registrationRole === "parent_guardian" ||
    resolution.savedAccountRoles?.includes("parent_guardian") ||
    resolution.persistedRoleHint === "parent_guardian" ||
    resolution.persistedRoleHint === "parent"
  ) {
    return "/dashboard/parent";
  }

  return "/setup";
}

export function getRoleSelectionDestination(role: AccountRole) {
  return role === "mentor"
    ? "/dashboard/mentor/onboarding"
    : "/dashboard/parent";
}
