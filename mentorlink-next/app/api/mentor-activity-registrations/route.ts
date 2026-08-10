import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function subjectName(subjects: unknown) {
  const subject = Array.isArray(subjects) ? subjects[0] : subjects;
  return subject && typeof subject === "object" && "name" in subject && typeof subject.name === "string"
    ? subject.name : null;
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "הגישה מיועדת לחונכים בלבד." }, { status: 403 });

  const admin = createSupabaseAdmin();
  const activities = await admin.from("mentor_activities")
    .select("id, title").eq("mentor_user_id", user.id);
  if (activities.error) return Response.json({ error: "לא ניתן לטעון את הפעילויות." }, { status: 500 });
  const activityIds = (activities.data ?? []).map((activity) => activity.id);
  if (!activityIds.length) return Response.json({ registrations: [] });

  const registrations = await admin.from("mentor_activity_registrations")
    .select("id, activity_id, parent_user_id, child_id, child_first_name, status, created_at")
    .in("activity_id", activityIds).in("status", ["registered", "waitlisted"])
    .order("created_at", { ascending: false });
  if (registrations.error) return Response.json({ error: "לא ניתן לטעון את ההרשמות." }, { status: 500 });

  const rows = registrations.data ?? [];
  const parentIds = [...new Set(rows.map((row) => row.parent_user_id))];
  const childIds = [...new Set(rows.map((row) => row.child_id).filter(Boolean))];
  const [profiles, children, interests, sessions] = await Promise.all([
    parentIds.length ? admin.from("parent_profiles").select("user_id, first_name, last_name, phone, city, street, wants_home_mentoring, house_number, entrance, apartment, address_notes").in("user_id", parentIds) : Promise.resolve({ data: [], error: null }),
    childIds.length ? admin.from("parent_children").select("id, first_name, last_name, grade, school_name").in("id", childIds) : Promise.resolve({ data: [], error: null }),
    childIds.length ? admin.from("parent_child_subject_interests").select("child_id, subjects(name)").in("child_id", childIds) : Promise.resolve({ data: [], error: null }),
    admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at").in("activity_id", activityIds).order("starts_at"),
  ]);
  if (profiles.error || children.error || interests.error || sessions.error) {
    return Response.json({ error: "לא ניתן לטעון את פרטי ההרשמות." }, { status: 500 });
  }

  const parentAuth = new Map<string, { email: string | null; phone: string | null }>();
  await Promise.all(parentIds.map(async (parentId) => {
    const result = await admin.auth.admin.getUserById(parentId);
    if (result.data.user) parentAuth.set(parentId, {
      email: result.data.user.email ?? null,
      phone: result.data.user.phone ?? (typeof result.data.user.user_metadata?.phone === "string" ? result.data.user.user_metadata.phone : null),
    });
  }));

  return Response.json({ registrations: rows.map((row) => {
    const activity = (activities.data ?? []).find((item) => item.id === row.activity_id);
    const profile = (profiles.data ?? []).find((item) => item.user_id === row.parent_user_id);
    const child = (children.data ?? []).find((item) => item.id === row.child_id);
    const auth = parentAuth.get(row.parent_user_id);
    return {
      id: row.id,
      activityId: row.activity_id,
      activityTitle: activity?.title ?? "פעילות",
      status: row.status,
      registeredAt: row.created_at,
      nextSession: (sessions.data ?? []).find((session) => session.activity_id === row.activity_id && new Date(session.ends_at).getTime() >= Date.now())
        ?? (sessions.data ?? []).filter((session) => session.activity_id === row.activity_id).at(-1) ?? null,
      child: child ?? { first_name: row.child_first_name, last_name: null, grade: null, school_name: null },
      interests: (interests.data ?? []).filter((item) => item.child_id === row.child_id).map((item) => subjectName(item.subjects)).filter(Boolean),
      parent: profile ? { ...profile, email: auth?.email ?? null, phone: profile.phone || auth?.phone || null } : { first_name: "הורה", last_name: "רשום", email: auth?.email ?? null, phone: auth?.phone ?? null },
    };
  }) }, { headers: { "Cache-Control": "no-store" } });
}
