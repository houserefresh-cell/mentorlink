import { supabase } from "./supabase";
import { resolveDashboardPath } from "./auth-routing-logic";

export async function getDashboardPath(userId: string) {
  const [ownership, mentorProfile, authUser] = await Promise.all([
    supabase
      .from("mentor_account_ownership")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mentor_profiles")
      .select("user_id, first_name, birth_date, bio")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (ownership.error) {
    console.error("Ownership lookup failed", ownership.error);
  }
  if (mentorProfile.error) {
    console.error("Mentor profile lookup failed", mentorProfile.error);
  }
  if (authUser.error) {
    console.error("Auth user lookup failed", authUser.error);
  }

  const userRole = authUser.data?.user?.user_metadata?.role ?? null;
  const hasMentorOwnership = Boolean(ownership.data);
  const profile = mentorProfile.data as { first_name?: string | null; birth_date?: string | null; bio?: string | null } | null;
  const hasStarterProfile = Boolean(profile?.first_name && profile?.birth_date && profile?.bio);

  return resolveDashboardPath({
    persistedRoleHint: userRole,
    hasMentorOwnership,
    hasStarterMentorProfile: hasStarterProfile,
  });
}
