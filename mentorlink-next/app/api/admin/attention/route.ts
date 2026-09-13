import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { classifyAdminAttention } from "@/lib/admin-control-center-core";

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const admin = createSupabaseAdmin();

    const [meetings, activities, feedback] = await Promise.all([
      admin.from("meeting_requests").select("id, mentor_user_id, parent_user_id, status, subject, requested_start_at, confirmed_start_at, proposed_start_at, cancelled_at, updated_at, child_first_name").order("updated_at", { ascending: false }).limit(500),
      admin.from("mentor_activities").select("id, mentor_user_id, title, status, max_participants, updated_at, created_at, published_at").order("updated_at", { ascending: false }).limit(500),
      admin.from("mentor_activity_feedback").select("id, contextType, admin_handling_status, safety_incident, requests_admin_contact, submitted_at").order("submitted_at", { ascending: false }).limit(200),
    ]);

    if (meetings.error) throw meetings.error;
    if (activities.error) throw activities.error;
    if (feedback.error) throw feedback.error;

    const attention = classifyAdminAttention({
      meetings: (meetings.data ?? []).map((row) => ({
        id: row.id,
        mentor_user_id: row.mentor_user_id,
        parent_user_id: row.parent_user_id,
        status: row.status,
        subject: row.subject,
        requested_start_at: row.requested_start_at,
        confirmed_start_at: row.confirmed_start_at,
        proposed_start_at: row.proposed_start_at,
        cancelled_at: row.cancelled_at,
        updated_at: row.updated_at,
        child_first_name: row.child_first_name,
      })),
      activities: (activities.data ?? []).map((row) => ({
        id: row.id,
        mentor_user_id: row.mentor_user_id,
        title: row.title,
        status: row.status,
        max_participants: row.max_participants,
        updated_at: row.updated_at,
        created_at: row.created_at,
        published_at: row.published_at,
      })),
      feedback: (feedback.data ?? []).map((row) => ({
        id: row.id,
        contextType: row.contextType,
        admin_handling_status: row.admin_handling_status,
        safety_incident: row.safety_incident,
        requests_admin_contact: row.requests_admin_contact,
        submitted_at: row.submitted_at,
      })),
    });

    return adminApiSuccess({ attention });
  } catch (error) {
    return adminApiError(error);
  }
}
