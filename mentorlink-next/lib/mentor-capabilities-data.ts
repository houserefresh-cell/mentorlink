import "server-only";

import { getMentorCapabilities } from "./mentor-age";
import type { createSupabaseAdmin } from "./supabase-admin";

export async function loadMentorCapabilities(
  client: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
) {
  const profile = await client
    .from("mentor_profiles")
    .select("birth_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) throw new Error("Unable to load mentor birth date");
  return getMentorCapabilities(profile.data?.birth_date ?? null);
}
