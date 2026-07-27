import { revalidatePath } from "next/cache";
import { adminApiError } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_FIELDS = new Set(["first_name", "last_name", "bio", "birth_date", "profile_photo_path"]);
const customSubjectId = (field: string) => /^custom_subject:(\d+)$/.exec(field)?.[1] ?? null;
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string; changeId: string }> }) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const { userId, changeId } = await params;
    if (!isUuid(userId) || !isUuid(changeId) || userId === administrator.id) return Response.json({ error: "Pending change not found" }, { status: 404 });
    const body = await request.json();
    if (!body || !["approve", "reject"].includes(body.action)) return Response.json({ error: "Invalid action" }, { status: 400 });
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (body.action === "reject" && reason.length < 3) return Response.json({ error: "Rejection reason is required" }, { status: 400 });
    const client = createSupabaseAdmin();
    const pending = await client.from("mentor_public_pending_changes").select("id, field_name, requested_value").eq("id", changeId).eq("mentor_user_id", userId).eq("status", "pending").maybeSingle();
    if (pending.error || !pending.data || (!ALLOWED_FIELDS.has(pending.data.field_name) && !customSubjectId(pending.data.field_name))) return Response.json({ error: "Pending change not found" }, { status: 404 });
    if (body.action === "approve") {
      const subjectId = customSubjectId(pending.data.field_name);
      const applied = subjectId
        ? await client.from("mentor_subjects").update({ custom_subject: pending.data.requested_value }).eq("user_id", userId).eq("subject_id", Number(subjectId))
        : await client.from("mentor_profiles").update({ [pending.data.field_name]: pending.data.requested_value, updated_at: new Date().toISOString() }).eq("user_id", userId);
      if (applied.error) throw new Error("apply failed");
    }
    const reviewed = await client.from("mentor_public_pending_changes").update({ status: body.action === "approve" ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: administrator.id, rejection_reason: body.action === "reject" ? reason : null }).eq("id", changeId).eq("status", "pending").select("id").maybeSingle();
    if (reviewed.error) throw new Error("review failed");
    if (!reviewed.data) return Response.json({ error: "Pending change already reviewed" }, { status: 409 });
    revalidatePath("/");
    return Response.json({ change: { id: changeId, status: body.action === "approve" ? "approved" : "rejected" } });
  } catch (error) {
    console.error("Field review failed", error instanceof Error ? error.name : "UnknownError");
    return adminApiError(error);
  }
}
