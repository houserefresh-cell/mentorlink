import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { getPendingMentorDetail } from "@/lib/admin-mentor-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const administrator = await authorizeAdministrator(
      request.headers.get("authorization"),
    );
    const { userId } = await params;
    if (!isUuid(userId)) {
      return Response.json(
        { error: "Mentor review not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const serviceRoleClient = createSupabaseAdmin();
    const mentor = await getPendingMentorDetail(
      userId,
      administrator.id,
      serviceRoleClient,
    );
    if (!mentor) {
      return Response.json(
        { error: "Mentor review not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return adminApiSuccess({ mentor });
  } catch (error) {
    return adminApiError(error);
  }
}
