import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Number(searchParams.get("limit") ?? "10");
    if (!q) return adminApiSuccess({ mentors: [], parents: [], children: [], meetings: [], activities: [] });

    const admin = createSupabaseAdmin();
    const searchTerm = `%${q}%`;

    const [mentors, parents, children, meetings, activities] = await Promise.all([
      admin.from("mentor_profiles").select("user_id, first_name, last_name, city").or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},city.ilike.${searchTerm}`).limit(limit),
      admin.from("parent_profiles").select("user_id, first_name, last_name, city").or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},city.ilike.${searchTerm}`).limit(limit),
      admin.from("parent_children").select("id, parent_user_id, first_name, last_name, grade").or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},grade.ilike.${searchTerm}`).limit(limit),
      admin.from("meeting_requests").select("id, subject, child_first_name, status").or(`subject.ilike.${searchTerm},child_first_name.ilike.${searchTerm},status.ilike.${searchTerm}`).limit(limit),
      admin.from("mentor_activities").select("id, title, status").or(`title.ilike.${searchTerm},status.ilike.${searchTerm}`).limit(limit),
    ]);

    if (mentors.error) throw mentors.error;
    if (parents.error) throw parents.error;
    if (children.error) throw children.error;
    if (meetings.error) throw meetings.error;
    if (activities.error) throw activities.error;

    return adminApiSuccess({
      mentors: mentors.data ?? [],
      parents: parents.data ?? [],
      children: children.data ?? [],
      meetings: meetings.data ?? [],
      activities: activities.data ?? [],
    });
  } catch (error) {
    return adminApiError(error);
  }
}
