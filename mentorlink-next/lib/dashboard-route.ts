export function resolveDashboardPath({
  role,
  hasCompletedMentorProfile,
}: {
  role: unknown;
  hasCompletedMentorProfile: boolean;
}) {
  if (role === "admin") {
    return "/dashboard/admin/mentors";
  }

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
