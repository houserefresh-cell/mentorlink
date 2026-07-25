export type DashboardResolution = {
  registrationRole?: "mentor" | "parent" | null;
  persistedRoleHint?: string | null;
  hasMentorOwnership?: boolean | null;
  hasStarterMentorProfile?: boolean | null;
};

export function resolveDashboardPath(resolution: DashboardResolution) {
  if (
    resolution.registrationRole === "mentor" ||
    resolution.hasMentorOwnership
  ) {
    return resolution.hasStarterMentorProfile
      ? "/dashboard/mentor"
      : "/dashboard/mentor/onboarding";
  }

  if (
    resolution.registrationRole === "parent" ||
    resolution.persistedRoleHint === "parent"
  ) {
    return "/dashboard/parent";
  }

  return "/setup";
}
