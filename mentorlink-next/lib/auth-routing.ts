import { supabase } from "./supabase";
import { resolveDashboardPath } from "./auth-routing-logic";

export async function getDashboardPath(userId: string) {
  const [accountRole, ownership, mentorProfile, authUser] = await Promise.all([
    supabase
      .from("account_roles")
      .select("role")
      .eq("user_id", userId),
    supabase
      .from("mentor_account_ownership")
      .select("user_id, owner_type")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mentor_profiles")
      .select("user_id, first_name, birth_date, bio")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (accountRole.error) {
    console.error("Account role lookup failed", accountRole.error);
  }
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
  const hasMentorOwnership = ownership.data?.owner_type === "mentor";
  const profile = mentorProfile.data as { first_name?: string | null; birth_date?: string | null; bio?: string | null } | null;
  const hasStarterProfile = Boolean(profile?.first_name && profile?.birth_date && profile?.bio);

  return resolveDashboardPath({
    savedAccountRoles: (accountRole.data ?? [])
      .map(({ role }) => role)
      .filter(
        (role): role is "mentor" | "parent_guardian" =>
          role === "mentor" || role === "parent_guardian",
      ),
    persistedRoleHint: userRole,
    hasMentorOwnership,
    hasStarterMentorProfile: hasStarterProfile,
  });
}
