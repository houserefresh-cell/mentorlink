export type AccountRole = "mentor" | "parent";

export type DashboardResolution = {
  registrationRole?: AccountRole | null;
  savedAccountRole?: AccountRole | null;
  persistedRoleHint?: string | null;
  hasMentorOwnership?: boolean | null;
  hasStarterMentorProfile?: boolean | null;
};

export function resolveDashboardPath(resolution: DashboardResolution) {
  if (
    resolution.registrationRole === "mentor" ||
    resolution.savedAccountRole === "mentor" ||
    resolution.hasMentorOwnership
  ) {
    return resolution.hasStarterMentorProfile
      ? "/dashboard/mentor"
      : "/dashboard/mentor/onboarding";
  }

  if (
    resolution.registrationRole === "parent" ||
    resolution.savedAccountRole === "parent" ||
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
