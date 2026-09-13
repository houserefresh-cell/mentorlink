import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { filterMeetingRows } from "@/lib/admin-control-center-core";

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "40");
    const status = searchParams.get("status") ?? "";
    const subject = searchParams.get("subject") ?? "";
    const mentorId = searchParams.get("mentorId") ?? "";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const query = searchParams.get("query") ?? "";

    const admin = createSupabaseAdmin();
    const fromClause = admin.from("meeting_requests").select("id, mentor_user_id, parent_user_id, status, subject, requested_start_at, confirmed_start_at, proposed_start_at, cancelled_at, created_at, updated_at, child_first_name, child_grade_or_age").order("updated_at", { ascending: false });
    const { data, error } = await fromClause;
    if (error) throw error;

    const meetingRows = (data ?? []).map((row) => ({
      id: row.id,
      mentor_user_id: row.mentor_user_id,
      parent_user_id: row.parent_user_id,
      status: row.status,
      subject: row.subject,
      requested_start_at: row.requested_start_at,
      confirmed_start_at: row.confirmed_start_at,
      proposed_start_at: row.proposed_start_at,
      cancelled_at: row.cancelled_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      child_first_name: row.child_first_name,
    }));

    const filtered = filterMeetingRows(meetingRows, { search: query, status, mentorId, subject, from, to });
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const mentorIds = [...new Set(paged.map((row) => row.mentor_user_id).filter(Boolean))];
    const parentIds = [...new Set(paged.map((row) => row.parent_user_id).filter(Boolean))];
    const [mentors, parents] = await Promise.all([
      mentorIds.length ? admin.from("mentor_profiles").select("user_id, first_name, last_name").in("user_id", mentorIds) : Promise.resolve({ data: [] as Array<{ user_id: string; first_name: string | null; last_name: string | null }>, error: null }),
      parentIds.length ? admin.from("parent_profiles").select("user_id, first_name, last_name").in("user_id", parentIds) : Promise.resolve({ data: [] as Array<{ user_id: string; first_name: string | null; last_name: string | null }>, error: null }),
    ]);

    if (mentors.error) throw mentors.error;
    if (parents.error) throw parents.error;

    const mentorMap = new Map((mentors.data ?? []).map((row) => [row.user_id, `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()]));
    const parentMap = new Map((parents.data ?? []).map((row) => [row.user_id, `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()]));

    return adminApiSuccess({
      rows: paged.map((row) => ({
        ...row,
        mentorName: mentorMap.get(row.mentor_user_id ?? "") || null,
        parentName: parentMap.get(row.parent_user_id ?? "") || null,
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    return adminApiError(error);
  }
}
