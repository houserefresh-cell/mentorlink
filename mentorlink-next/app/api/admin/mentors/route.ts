import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { getAllMentorRegistrations, getPendingFieldChangeMentors, getPendingMentors, getPublicationMentors } from "@/lib/admin-mentor-data";
import { loadAuthorizedAdminReview } from "@/lib/admin-review-loader";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const result = await loadAuthorizedAdminReview(
      request.headers.get("authorization"),
      authorizeAdministrator,
      createSupabaseAdmin,
      async (administrator, serviceRoleClient) => {
        const [mentors, fieldChangeMentors, publicationMentors, registrations] = await Promise.all([
          getPendingMentors(administrator.id, serviceRoleClient),
          getPendingFieldChangeMentors(administrator.id, serviceRoleClient),
          getPublicationMentors(administrator.id, serviceRoleClient),
          getAllMentorRegistrations(administrator.id, serviceRoleClient),
        ]);
        return { mentors, fieldChangeMentors, publicationMentors, registrations };
      },
    );
    return adminApiSuccess(result);
  } catch (error) {
    return adminApiError(error);
  }
}
