import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function subjectName(subjects: unknown) {
  const subject = Array.isArray(subjects) ? subjects[0] : subjects;
  if (!subject || typeof subject !== "object" || !("name" in subject)) return null;
  return typeof subject.name === "string" ? subject.name : null;
}

export async function GET(request: Request, context: { params: Promise<{ activityId: string }> }) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "הגישה מיועדת לחונכים בלבד." }, { status: 403 });
  const { activityId } = await context.params;
  if (!uuid.test(activityId)) return Response.json({ error: "פעילות לא תקינה." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const activity = await admin.from("mentor_activities").select("id, title, mentor_user_id, contact_phone_visibility").eq("id", activityId).maybeSingle();
  if (activity.error) return Response.json({ error: "לא ניתן לטעון את הפעילות." }, { status: 500 });
  if (!activity.data || activity.data.mentor_user_id !== user.id) {
    return Response.json({ error: "אין הרשאה לצפות בפרטי ההרשמה." }, { status: 403 });
  }

  const registrations = await admin.from("mentor_activity_registrations")
    .select("id, parent_user_id, child_id, child_first_name, status, created_at")
    .eq("activity_id", activityId).in("status", ["registered", "waitlisted"])
    .order("created_at");
  if (registrations.error) return Response.json({ error: "לא ניתן לטעון את ההרשמות." }, { status: 500 });

  const approvals = await admin.from("mentor_activity_contact_approvals")
    .select("parent_user_id").eq("activity_id", activityId);
  if (approvals.error) return Response.json({ error: "לא ניתן לטעון את הרשאות הקשר." }, { status: 500 });
  const approvedParentIds = new Set((approvals.data ?? []).map((row) => row.parent_user_id));

  const parentIds = [...new Set((registrations.data ?? []).map((row) => row.parent_user_id))];
  const profiles = parentIds.length ? await admin.from("parent_profiles").select("user_id, first_name, last_name, phone, city, street, wants_home_mentoring, house_number, entrance, apartment, address_notes").in("user_id", parentIds) : { data: [], error: null };
  const childIds = [...new Set((registrations.data ?? []).map((row) => row.child_id).filter(Boolean))];
  const children = childIds.length ? await admin.from("parent_children").select("id, first_name, last_name, grade, school_name, gender, display_color").in("id", childIds) : { data: [], error: null };
  const interests = childIds.length ? await admin.from("parent_child_subject_interests").select("child_id, subjects(name)").in("child_id", childIds) : { data: [], error: null };
  const parents = new Map<string, { name: string; phone: string | null; email: string | null }>();
  await Promise.all(parentIds.map(async (parentId) => {
    const result = await admin.auth.admin.getUserById(parentId);
    if (result.error || !result.data.user) return;
    const metadata = result.data.user.user_metadata ?? {};
    const profile = (profiles.data ?? []).find((item) => item.user_id === parentId);
    const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : typeof metadata.full_name === "string" ? metadata.full_name.trim() : [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || "הורה רשום";
    const phone = profile?.phone || result.data.user.phone || (typeof metadata.phone === "string" ? metadata.phone : null);
    parents.set(parentId, { name, phone, email: result.data.user.email ?? null });
  }));

  return Response.json({
    activity: { id: activity.data.id, title: activity.data.title, contactPhoneVisibility: activity.data.contact_phone_visibility },
    registrations: (registrations.data ?? []).map((row) => {
      const parent = parents.get(row.parent_user_id);
      return {
        id: row.id,
        parentUserId: row.parent_user_id,
        parentName: parent?.name ?? "הורה רשום",
        parentPhone: parent?.phone ?? null,
        parentEmail: parent?.email ?? null,
        contactApproved: row.status === "registered" && approvedParentIds.has(row.parent_user_id),
        parentProfile: (profiles.data ?? []).find((item) => item.user_id === row.parent_user_id) ?? null,
        childName: (() => { const child=(children.data ?? []).find(item=>item.id===row.child_id); return [child?.first_name ?? row.child_first_name, child?.last_name].filter(Boolean).join(" "); })(),
        child: (children.data ?? []).find((item) => item.id === row.child_id) ?? null,
        interests: (interests.data ?? [])
          .filter((item) => item.child_id === row.child_id)
          .map((item) => subjectName(item.subjects))
          .filter((name): name is string => Boolean(name)),
        status: row.status,
        registeredAt: row.created_at,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ activityId: string }> }) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "הגישה מיועדת לחונכים בלבד." }, { status: 403 });
  const { activityId } = await context.params;
  let body: { parentUserId?: unknown; approved?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  if (!uuid.test(activityId) || typeof body.parentUserId !== "string" || !uuid.test(body.parentUserId) || typeof body.approved !== "boolean") {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  const result = await createSupabaseAdmin().rpc("set_activity_contact_approval", {
    p_activity_id: activityId, p_mentor_user_id: user.id,
    p_parent_user_id: body.parentUserId, p_approved: body.approved,
  });
  if (result.error?.message.includes("ACTIVITY_NOT_OWNED")) return Response.json({ error: "אין הרשאה לעדכן פעילות זו." }, { status: 403 });
  if (result.error?.message.includes("PARENT_NOT_REGISTERED")) return Response.json({ error: "ניתן לאשר פרטי קשר רק להורה עם הרשמה פעילה." }, { status: 422 });
  if (result.error) return Response.json({ error: "לא ניתן לעדכן את הרשאת פרטי הקשר." }, { status: 500 });
  return Response.json({ ok: true });
}
