import "server-only";

import { createSupabaseServerAuth } from "./supabase-server-auth";
import { createSupabaseAdmin } from "./supabase-admin";

export async function authenticateMeetingUser(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const auth = createSupabaseServerAuth();
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return null;
  const claimedRole = data.user.user_metadata?.role;
  const administratorEmail = process.env.MENTORLINK_ADMIN_EMAIL?.trim().toLowerCase();
  const isAdministrator = Boolean(administratorEmail && data.user.email?.trim().toLowerCase() === administratorEmail);
  const admin = createSupabaseAdmin();
  const [profile, ownership] = await Promise.all([
    admin.from("mentor_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle(),
    admin.from("mentor_account_ownership").select("user_id").eq("user_id", data.user.id).maybeSingle(),
  ]);
  const hasMentorAccount = Boolean(profile.data || ownership.data);
  const role = isAdministrator ? "other" : claimedRole === "mentor" && hasMentorAccount ? "mentor" : claimedRole === "parent" && !hasMentorAccount ? "parent" : "other";
  return { id: data.user.id, email: data.user.email ?? null, role };
}
