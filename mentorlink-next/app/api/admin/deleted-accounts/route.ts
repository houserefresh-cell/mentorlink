import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { User } from "@supabase/supabase-js";

type DeletionMetadata = { accountType?: "parent" | "mentor"; displayName?: string | null; reason?: string | null; warnings?: string[] };

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const admin = createSupabaseAdmin();
    const archived = await admin.from("admin_deleted_accounts").select("user_id,account_type,email,display_name,reason,warnings,deleted_at").is("restored_at", null).order("deleted_at", { ascending: false });
    const archiveById = new Map((archived.data ?? []).map((row) => [row.user_id, row]));
    const users: User[] = [];
    for (let page = 1; ; page += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (result.error) throw result.error;
      users.push(...result.data.users);
      if (result.data.users.length < 200) break;
    }
    const accounts = users.flatMap((user) => {
      const deletedAt = typeof user.user_metadata?.administratively_deleted_at === "string" ? user.user_metadata.administratively_deleted_at : null;
      if (!deletedAt) return [];
      const saved = (user.user_metadata?.administrative_deletion ?? {}) as DeletionMetadata;
      const archive = archiveById.get(user.id);
      return [{ user_id: user.id, account_type: archive?.account_type ?? saved.accountType ?? user.user_metadata?.role, email: archive?.email ?? user.email ?? null, display_name: archive?.display_name ?? saved.displayName ?? null, reason: archive?.reason ?? saved.reason ?? null, warnings: archive?.warnings ?? saved.warnings ?? [], deleted_at: archive?.deleted_at ?? deletedAt }];
    }).filter((account) => account.account_type === "parent" || account.account_type === "mentor").sort((left, right) => Date.parse(right.deleted_at) - Date.parse(left.deleted_at));
    return adminApiSuccess({ accounts });
  } catch (error) { return adminApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const payload = await request.json() as Record<string, unknown>;
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "חשבון לא תקין." }, { status: 400 });
    const admin = createSupabaseAdmin();
    const user = await admin.auth.admin.getUserById(userId);
    if (user.error || !user.data.user) return Response.json({ error: "חשבון ההתחברות המקורי לא נמצא ולכן לא ניתן לשחזר אותו." }, { status: 409 });
    const accountType = user.data.user.user_metadata?.role;
    if (!user.data.user.user_metadata?.administratively_deleted_at || !["parent", "mentor"].includes(accountType)) return Response.json({ error: "החשבון אינו מסומן כמחוק." }, { status: 409 });
    const metadata = { ...(user.data.user.user_metadata ?? {}), administratively_deleted_at: null, administrative_deletion: null };
    const auth = await admin.auth.admin.updateUserById(userId, { ban_duration: "none", user_metadata: metadata });
    if (auth.error) throw auth.error;
    const restored = await admin.from("admin_deleted_accounts").update({ restored_at: new Date().toISOString(), restored_by: administrator.id }).eq("user_id", userId).is("restored_at", null);
    if (restored.error) console.error("Unable to mirror account restoration in archive", restored.error);
    if (accountType === "mentor") {
      const control = await admin.from("mentor_account_controls").upsert({ user_id: userId, status: "active", reason: null, suspended_until: null, acted_by: administrator.id, acted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      if (control.error) throw control.error;
    }
    const verified = await admin.auth.admin.getUserById(userId);
    if (verified.error || verified.data.user?.user_metadata?.administratively_deleted_at) return Response.json({ error: "החשבון נפתח לכניסה, אך לא הוסר מרשימת המחוקים. יש לנסות שוב." }, { status: 409 });
    return adminApiSuccess({ restored: true });
  } catch (error) { return adminApiError(error); }
}
