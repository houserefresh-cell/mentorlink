import { revalidatePath, revalidateTag } from "next/cache";
import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type ReviewResult = {
  review_outcome: "approve" | "reject" | "conflict" | "not_found";
  reviewed_field: string | null;
  approved_value: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string; changeId: string }> },
) {
  try {
    const administrator = await authorizeAdministrator(
      request.headers.get("authorization"),
    );
    const { userId, changeId } = await params;
    if (!isUuid(userId) || !isUuid(changeId) || userId === administrator.id) {
      return Response.json({ error: "Pending change not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!body || !["approve", "reject"].includes(String(body.action))) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const action = body.action as "approve" | "reject";
    const reason = typeof body.reason === "string"
      ? body.reason.trim().slice(0, 500)
      : "";
    if (action === "reject" && reason.length < 3) {
      return Response.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const client = createSupabaseAdmin();
    const reviewed = await client
      .rpc("review_mentor_public_pending_change", {
        p_change_id: changeId,
        p_mentor_user_id: userId,
        p_reviewer_id: administrator.id,
        p_action: action,
        p_rejection_reason: action === "reject" ? reason : null,
      })
      .maybeSingle();

    if (reviewed.error) throw new Error("Atomic field review failed");
    const result = reviewed.data as ReviewResult | null;
    if (!result || result.review_outcome === "not_found") {
      return Response.json({ error: "Pending change not found" }, { status: 404 });
    }
    if (result.review_outcome === "conflict") {
      return Response.json(
        { error: "Pending change already reviewed" },
        { status: 409 },
      );
    }

    revalidateTag("public-mentors", { expire: 0 });
    revalidatePath("/");
    revalidatePath("/dashboard/mentor");
    revalidatePath("/dashboard/mentor/profile");
    revalidatePath("/dashboard/mentor/photo");
    revalidatePath("/dashboard/admin/mentors");
    revalidatePath(`/dashboard/admin/mentors/${userId}`);

    return adminApiSuccess({
      change: {
        id: changeId,
        status: result.review_outcome === "approve" ? "approved" : "rejected",
        fieldName: result.reviewed_field,
        approvedValue: result.approved_value,
      },
    });
  } catch (error) {
    console.error(
      "Field review failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return adminApiError(error);
  }
}