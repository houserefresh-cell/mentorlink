import { supabase } from "./supabase";
import { resolveDashboardPath } from "./dashboard-route";

export { resolveDashboardPath } from "./dashboard-route";

export async function getDashboardPath(userId: string) {
  const [authUser, mentorProfile] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("mentor_profiles")
      .select("user_id, first_name, birth_date, bio")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (authUser.error) {
    console.error("Authenticated user lookup failed", authUser.error);
  }
  if (mentorProfile.error) {
    console.error("Mentor profile lookup failed", mentorProfile.error);
  }

  const user =
    authUser.data.user?.id === userId ? authUser.data.user : null;
  const profile = mentorProfile.data as {
    first_name?: string | null;
    birth_date?: string | null;
    bio?: string | null;
  } | null;

  return resolveDashboardPath({
    role: user?.user_metadata?.role,
    hasCompletedMentorProfile: Boolean(
      profile?.first_name && profile?.birth_date && profile?.bio,
    ),
  });
}
