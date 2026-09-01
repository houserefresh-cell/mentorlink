import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { sendPasswordRecoveryLink } from "@/lib/password-recovery";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const body = await request.json() as { userId?: unknown; accountType?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const accountType = body.accountType === "parent" || body.accountType === "mentor" ? body.accountType : null;
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !accountType || userId === administrator.id) {
      return Response.json({ error: "חשבון לא תקין." }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const target = await admin.auth.admin.getUserById(userId);
    if (target.error || !target.data.user?.email) return Response.json({ error: "לא נמצאה כתובת מייל לחשבון." }, { status: 404 });
    const role = target.data.user.user_metadata?.role;
    if (role && role !== accountType) return Response.json({ error: "סוג החשבון אינו תואם." }, { status: 409 });
    await sendPasswordRecoveryLink(admin, target.data.user.email);
    return adminApiSuccess({ sent: true, email: target.data.user.email });
  } catch (error) {
    return adminApiError(error);
  }
}
