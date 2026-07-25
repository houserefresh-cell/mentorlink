type MentorRegistrationView =
  | { view: "signup" }
  | { view: "onboarding" }
  | {
      view: "redirect";
      destination: "/dashboard/mentor" | "/dashboard/parent" | "/register";
    };

export function resolveMentorRegistrationView({
  isAuthenticated,
  role,
  hasCompletedMentorProfile,
}: {
  isAuthenticated: boolean;
  role: unknown;
  hasCompletedMentorProfile: boolean;
}): MentorRegistrationView {
  if (!isAuthenticated) {
    return { view: "signup" };
  }

  if (role === "mentor") {
    return hasCompletedMentorProfile
      ? { view: "redirect", destination: "/dashboard/mentor" }
      : { view: "onboarding" };
  }

  if (role === "parent") {
    return { view: "redirect", destination: "/dashboard/parent" };
  }

  return { view: "redirect", destination: "/register" };
}
