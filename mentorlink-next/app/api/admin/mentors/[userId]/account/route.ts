import { revalidatePath, revalidateTag } from "next/cache";
import { applyMentorAccountAction } from "@/lib/admin-account-control";
import { MentorAccountControlInputError, parseMentorAccountAction } from "@/lib/admin-account-control-core";
import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const { userId } = await params;
    if (!isUuid(userId) || userId === administrator.id) return Response.json({ error: "חשבון החונך לא נמצא." }, { status: 404 });
    const action = parseMentorAccountAction(await request.json());
    const result = await applyMentorAccountAction({ admin: createSupabaseAdmin(), userId, administratorUserId: administrator.id, action });
    if (result.outcome === "not_found") return Response.json({ error: "חשבון החונך לא נמצא." }, { status: 404 });
    if (result.outcome === "active_registrations") return Response.json({ error: "לא ניתן למחוק חשבון שיש לו נרשמים פעילים. אפשר לחסום אותו או לבטל תחילה את הפעילויות ולטפל בנרשמים." }, { status: 409 });
    revalidateTag("public-mentors", { expire: 0 });
    revalidatePath("/dashboard/admin/mentors");
    revalidatePath("/dashboard/parent");
    return adminApiSuccess({ account: result });
  } catch (error) {
    if (error instanceof MentorAccountControlInputError || error instanceof SyntaxError) return Response.json({ error: error instanceof Error ? error.message : "בקשה לא תקינה." }, { status: 400 });
    return adminApiError(error);
  }
}
