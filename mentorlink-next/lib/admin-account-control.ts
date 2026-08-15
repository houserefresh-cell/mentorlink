import "server-only";

import type { createSupabaseAdmin } from "./supabase-admin";
import type { MentorAccountAction } from "./admin-account-control-core";

type Admin = ReturnType<typeof createSupabaseAdmin>;

export async function applyMentorAccountAction(input: {
  admin: Admin; userId: string; administratorUserId: string; action: MentorAccountAction;
}) {
  const { admin, userId, administratorUserId, action } = input;
  const auth = await admin.auth.admin.getUserById(userId);
  if (auth.error || !auth.data.user || auth.data.user.user_metadata?.role !== "mentor") return { outcome: "not_found" as const };
  const profile = await admin.from("mentor_profiles").select("first_name, last_name, profile_photo_path").eq("user_id", userId).maybeSingle();
  if (profile.error) throw new Error("Unable to load mentor account");
  const targetName = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || null;

  if (action.action === "permanently_delete") {
    const activities = await admin.from("mentor_activities").select("id, image_path").eq("mentor_user_id", userId);
    if (activities.error) throw new Error("Unable to inspect mentor activities");
    const activityIds = (activities.data ?? []).map((row) => row.id);
    if (activityIds.length) {
      const active = await admin.from("mentor_activity_registrations").select("id").in("activity_id", activityIds).in("status", ["registered", "waitlisted"]).limit(1);
      if (active.error) throw new Error("Unable to inspect activity registrations");
      if (active.data?.length && !action.force) return { outcome: "active_registrations" as const };
    }
    const event = await admin.from("mentor_account_admin_events").insert({
      target_user_id: userId, target_email: auth.data.user.email ?? null, target_name: targetName,
      action: "permanently_deleted", reason: action.reason, administrator_user_id: administratorUserId,
      metadata: { createdAt: auth.data.user.created_at, activityCount: activityIds.length },
    });
    if (event.error) throw new Error("Unable to record permanent deletion");
    const now = new Date().toISOString();
    const warnings = activityIds.length ? [`${activityIds.length} פעילויות נשמרות בהיסטוריה ולא יופעלו בשחזור`] : [];
    const recorded = await admin.from("admin_deleted_accounts").upsert({ user_id: userId, account_type: "mentor", email: auth.data.user.email ?? null, display_name: targetName, reason: action.reason, warnings, deleted_at: now, deleted_by: administratorUserId, restored_at: null, restored_by: null }, { onConflict: "user_id" });
    if (recorded.error) throw new Error("Unable to record deleted mentor account");
    const metadata = { ...(auth.data.user.user_metadata ?? {}), administratively_deleted_at: now };
    const deleted = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h", user_metadata: metadata });
    if (deleted.error) {
      await admin.from("admin_deleted_accounts").delete().eq("user_id", userId).eq("deleted_at", now);
      throw new Error(`Unable to disable deleted mentor: ${deleted.error.message}`);
    }
    await admin.from("mentor_publication").update({ status: "paused" }).eq("user_id", userId).in("status", ["approved", "published"]);
    return { outcome: "deleted" as const };
  }

  const current = await admin.from("mentor_account_controls").select("status, previous_publication_status").eq("user_id", userId).maybeSingle();
  const publication = await admin.from("mentor_publication").select("status").eq("user_id", userId).maybeSingle();
  if (current.error || publication.error) throw new Error("Unable to load account state");
  const previousPublicationStatus = current.data?.previous_publication_status ?? publication.data?.status ?? null;
  const nextStatus = action.action === "restore" ? "active" : action.action === "block" ? "blocked" : "suspended";
  const control = await admin.from("mentor_account_controls").upsert({
    user_id: userId, status: nextStatus,
    reason: action.action === "restore" ? null : action.reason,
    suspended_until: action.action === "suspend" ? action.suspendedUntil : null,
    previous_publication_status: action.action === "restore" ? null : previousPublicationStatus,
    acted_by: administratorUserId, acted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (control.error) throw new Error("Unable to save account control");
  if (action.action === "restore") {
    const authUpdate = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (authUpdate.error) throw new Error("Unable to restore mentor login");
    if (current.data?.previous_publication_status === "published") await admin.from("mentor_publication").update({ status: "published" }).eq("user_id", userId).eq("status", "paused");
  } else {
    const hours = action.action === "suspend" ? Math.max(1, Math.ceil((Date.parse(action.suspendedUntil) - Date.now()) / 3_600_000)) : 876000;
    const authUpdate = await admin.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` });
    if (authUpdate.error) throw new Error("Unable to disable mentor login");
    await admin.from("mentor_publication").update({ status: "paused" }).eq("user_id", userId).in("status", ["approved", "published"]);
  }
  const history = await admin.from("mentor_account_admin_events").insert({
    target_user_id: userId, target_email: auth.data.user.email ?? null, target_name: targetName,
    action: action.action === "restore" ? "restored" : action.action === "block" ? "blocked" : "suspended",
    reason: action.reason, administrator_user_id: administratorUserId,
    metadata: action.action === "suspend" ? { suspendedUntil: action.suspendedUntil } : {},
  });
  if (history.error) throw new Error("Unable to record account action");
  return { outcome: "updated" as const, status: nextStatus };
}
