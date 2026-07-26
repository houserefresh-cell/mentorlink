import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { reviewMentorWithAdminClient } from "@/lib/admin-review-action";
import { parseReviewCommand, ReviewInputError } from "@/lib/admin-review-action-core";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { getAdminMentorDetail } from "@/lib/admin-mentor-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const { userId } = await params;
    if (!isUuid(userId)) {
      return Response.json({ error: "Mentor review not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const mentor = await getAdminMentorDetail(userId, administrator.id, createSupabaseAdmin());
    if (!mentor) {
      return Response.json({ error: "Mentor review not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return adminApiSuccess({ mentor });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const { userId } = await params;
    if (!isUuid(userId) || userId === administrator.id) {
      return Response.json({ error: "Mentor review not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    let payload: unknown;
    try { payload = await request.json(); }
    catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const result = await reviewMentorWithAdminClient({
      admin: createSupabaseAdmin(),
      userId,
      reviewerId: administrator.id,
      command: parseReviewCommand(payload),
    });
    if (result.outcome === "not_found") return Response.json({ error: "Mentor review not found" }, { status: 404 });
    if (result.outcome === "conflict") return Response.json({ error: "This mentor application has already been reviewed" }, { status: 409 });
    if (result.outcome === "approval_blocked") return Response.json({ error: result.message }, { status: 422 });
    return adminApiSuccess({ review: result });
  } catch (error) {
    if (error instanceof ReviewInputError) {
      return Response.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return adminApiError(error);
  }
}
