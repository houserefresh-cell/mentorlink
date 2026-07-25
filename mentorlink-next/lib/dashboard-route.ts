export function resolveDashboardPath({
  role,
  hasCompletedMentorProfile,
}: {
  role: unknown;
  hasCompletedMentorProfile: boolean;
}) {
  if (role === "mentor") {
    return hasCompletedMentorProfile
      ? "/dashboard/mentor"
      : "/register/mentor";
  }

  if (role === "parent") {
    return "/dashboard/parent";
  }

  return "/register";
}
