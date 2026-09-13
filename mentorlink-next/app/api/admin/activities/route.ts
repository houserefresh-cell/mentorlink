import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { filterActivityRows } from "@/lib/admin-control-center-core";

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "40");
    const status = searchParams.get("status") ?? "";
    const mentorId = searchParams.get("mentorId") ?? "";
    const search = searchParams.get("query") ?? "";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from("mentor_activities").select("id, mentor_user_id, title, status, max_participants, updated_at, created_at, published_at").order("updated_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      mentor_user_id: row.mentor_user_id,
      title: row.title,
      status: row.status,
      max_participants: row.max_participants,
      updated_at: row.updated_at,
      created_at: row.created_at,
      published_at: row.published_at,
    }));

    const filtered = filterActivityRows(rows, { search, status, mentorId, from, to });
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    const mentorIds = [...new Set(paged.map((row) => row.mentor_user_id).filter(Boolean))];
    const mentors = mentorIds.length ? await admin.from("mentor_profiles").select("user_id, first_name, last_name").in("user_id", mentorIds) : { data: [], error: null };
    if (mentors.error) throw mentors.error;

    const map = new Map((mentors.data ?? []).map((row) => [row.user_id, `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()]));

    return adminApiSuccess({
      rows: paged.map((row) => ({ ...row, mentorName: map.get(row.mentor_user_id ?? "") || null })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    return adminApiError(error);
  }
}
