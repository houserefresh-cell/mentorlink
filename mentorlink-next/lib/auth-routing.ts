import { supabase } from "./supabase";

export async function getDashboardPath(userId: string) {
  const [ownership, mentorProfile] = await Promise.all([
    supabase
      .from("mentor_account_ownership")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("mentor_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (ownership.error) {
    console.error("Ownership lookup failed", ownership.error);
  }
  if (mentorProfile.error) {
    console.error("Mentor profile lookup failed", mentorProfile.error);
  }

  return ownership.data || mentorProfile.data
    ? "/dashboard/mentor"
    : "/dashboard/parent";
}
