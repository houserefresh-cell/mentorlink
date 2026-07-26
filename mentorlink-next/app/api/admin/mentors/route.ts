import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { getPendingMentors } from "@/lib/admin-mentor-data";
import { loadAuthorizedAdminReview } from "@/lib/admin-review-loader";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const mentors = await loadAuthorizedAdminReview(
      request.headers.get("authorization"),
      authorizeAdministrator,
      createSupabaseAdmin,
      (administrator, serviceRoleClient) =>
        getPendingMentors(administrator.id, serviceRoleClient),
    );
    return adminApiSuccess({ mentors });
  } catch (error) {
    return adminApiError(error);
  }
}
