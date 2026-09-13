import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function countByStatus<T extends { status?: string | null }>(rows: T[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const admin = createSupabaseAdmin();

    const [publications, activities, meetingRequests, activityFeedback, meetingFeedback, mentorControls] = await Promise.all([
      admin.from("mentor_publication").select("status"),
      admin.from("mentor_activities").select("status"),
      admin.from("meeting_requests").select("status"),
      admin.from("mentor_activity_feedback").select("admin_handling_status"),
      admin.from("mentor_meeting_feedback").select("admin_handling_status"),
      admin.from("mentor_account_controls").select("status"),
    ]);

    const publicationRows = publications.data ?? [];
    const activityRows = activities.data ?? [];
    const meetingRows = meetingRequests.data ?? [];
    const activityFeedbackRows = activityFeedback.data ?? [];
    const meetingFeedbackRows = meetingFeedback.data ?? [];
    const controlRows = mentorControls.data ?? [];

    const summary = {
      mentorProfiles: publicationRows.length,
      publishedMentors: countByStatus(publicationRows, "published"),
      pendingMentors: countByStatus(publicationRows, "pending_review"),
      pausedMentors: countByStatus(publicationRows, "paused"),
      mentorActivities: activityRows.length,
      publishedActivities: countByStatus(activityRows, "published"),
      meetingRequests: meetingRows.length,
      pendingMeetings: countByStatus(meetingRows, "pending"),
      acceptedMeetings: countByStatus(meetingRows, "accepted"),
      unresolvedFeedback: activityFeedbackRows.filter((row) => row.admin_handling_status !== "resolved").length + meetingFeedbackRows.filter((row) => row.admin_handling_status !== "resolved").length,
      suspendedAccounts: controlRows.filter((row) => row.status === "suspended").length,
      blockedAccounts: controlRows.filter((row) => row.status === "blocked").length,
    };

    const attention = [
      {
        title: "חונכים בQUEUE",
        value: summary.pendingMentors,
        detail: "ממתינים לאישור או בדיקה",
      },
      {
        title: "פעילויות פעילות",
        value: summary.publishedActivities,
        detail: "נמצאות במרחב הציבורי",
      },
      {
        title: "פגישות ממתינות",
        value: summary.pendingMeetings,
        detail: "זמינות לאישור ונסיעה",
      },
      {
        title: "משובים פתוחים",
        value: summary.unresolvedFeedback,
        detail: "דורשים תשומת לב ניהולית",
      },
    ];

    return adminApiSuccess({
      summary,
      attention,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminApiError(error);
  }
}
