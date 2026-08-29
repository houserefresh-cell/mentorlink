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
        const registrations = await getAllMentorRegistrations(administrator.id, serviceRoleClient);
        const activeIds = new Set(registrations.map((mentor) => mentor.userId));
        const [mentors, fieldChangeMentors, publicationMentors] = await Promise.all([
          getPendingMentors(administrator.id, serviceRoleClient),
          getPendingFieldChangeMentors(administrator.id, serviceRoleClient),
          getPublicationMentors(administrator.id, serviceRoleClient),
        ]);
        return {
          mentors: mentors.filter((mentor) => activeIds.has(mentor.userId)),
          fieldChangeMentors: fieldChangeMentors.filter((mentor) => activeIds.has(mentor.userId)),
          publicationMentors: publicationMentors.filter((mentor) => activeIds.has(mentor.userId)),
          registrations,
        };
      },
    );
    return adminApiSuccess(result);
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 80) : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || !firstName) {
      return Response.json({ error: "יש להזין שם, אימייל תקין וסיסמה זמנית בת 6 תווים לפחות." }, { status: 400 });
    }
    const admin = createSupabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { role: "mentor", first_name: firstName, last_name: lastName, account_owner_type: "mentor", must_change_password: true },
      app_metadata: { created_by_administrator: true },
    });
    if (created.error || !created.data.user) {
      const duplicate = created.error?.message.toLowerCase().includes("already") || created.error?.message.toLowerCase().includes("registered");
      return Response.json({ error: duplicate ? "כבר קיים חשבון עם כתובת המייל הזאת." : `לא ניתן ליצור את החשבון: ${created.error?.message ?? "שגיאה לא ידועה"}` }, { status: duplicate ? 409 : 500 });
    }
    const ownership = await admin.from("mentor_account_ownership").insert({
      user_id: created.data.user.id,
      owner_type: "mentor",
      created_by_administrator: true,
    });
    if (ownership.error?.code === "23505") {
      const existing = await admin.from("mentor_account_ownership").select("owner_type").eq("user_id", created.data.user.id).maybeSingle();
      if (existing.data?.owner_type === "mentor") {
        const marked = await admin.from("mentor_account_ownership").update({ created_by_administrator: true }).eq("user_id", created.data.user.id).eq("owner_type", "mentor");
        if (marked.error) {
          console.error("Unable to mark managed mentor account", marked.error);
          await admin.auth.admin.deleteUser(created.data.user.id);
          return Response.json({ error: `החשבון לא הושלם ולכן בוטל. ${marked.error.message}` }, { status: 500 });
        }
      } else {
        console.error("Managed mentor ownership conflicts with an existing account", ownership.error);
        await admin.auth.admin.deleteUser(created.data.user.id);
        return Response.json({ error: "החשבון לא הושלם ולכן בוטל." }, { status: 500 });
      }
    }
    if (ownership.error && ownership.error.code !== "23505") {
      console.error("Unable to complete managed mentor account", ownership.error);
      await admin.auth.admin.deleteUser(created.data.user.id);
      return Response.json({ error: `החשבון לא הושלם ולכן בוטל. ${ownership.error.message}` }, { status: 500 });
    }
    const now = new Date().toISOString();
    const publication = await admin.from("mentor_publication").insert({
      user_id: created.data.user.id,
      status: "approved",
      submitted_at: now,
      reviewed_at: now,
      reviewed_by: administrator.id,
      updated_at: now,
    });
    if (publication.error) {
      console.error("Unable to approve managed mentor account", publication.error);
      await admin.auth.admin.deleteUser(created.data.user.id);
      return Response.json({ error: `החשבון לא הושלם ולכן בוטל. ${publication.error.message}` }, { status: 500 });
    }
    return Response.json({ userId: created.data.user.id, email, firstName, lastName }, { status: 201 });
  } catch (error) { return adminApiError(error); }
}
