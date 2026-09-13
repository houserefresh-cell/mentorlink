import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { computeInsights } from "@/lib/admin-control-center-insights";

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const admin = createSupabaseAdmin();
    const [meetings, activities] = await Promise.all([
      admin.from("meeting_requests").select("created_at, status, cancelled_at").limit(2000),
      admin.from("mentor_activities").select("created_at, published_at, status").limit(2000),
    ]);

    if (meetings.error) throw meetings.error;
    if (activities.error) throw activities.error;

    return adminApiSuccess({
      insights: computeInsights({
        meetings: meetings.data ?? [],
        activities: activities.data ?? [],
      }),
    });
  } catch (error) {
    return adminApiError(error);
  }
}
