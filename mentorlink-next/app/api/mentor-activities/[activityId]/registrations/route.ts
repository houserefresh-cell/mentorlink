import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .select("id, parent_user_id, child_first_name, status, created_at")
    .eq("activity_id", activityId).in("status", ["registered", "waitlisted"])
    .order("created_at");
  if (registrations.error) return Response.json({ error: "לא ניתן לטעון את ההרשמות." }, { status: 500 });

  const approvals = await admin.from("mentor_activity_contact_approvals")
    .select("parent_user_id").eq("activity_id", activityId);
  if (approvals.error) return Response.json({ error: "לא ניתן לטעון את הרשאות הקשר." }, { status: 500 });
  const approvedParentIds = new Set((approvals.data ?? []).map((row) => row.parent_user_id));

  const parentIds = [...new Set((registrations.data ?? []).map((row) => row.parent_user_id))];
  const parents = new Map<string, { name: string; phone: string | null; familyInitial: string }>();
  await Promise.all(parentIds.map(async (parentId) => {
    const result = await admin.auth.admin.getUserById(parentId);
    if (result.error || !result.data.user) return;
    const metadata = result.data.user.user_metadata ?? {};
    const metadataName = [metadata.first_name, metadata.last_name].filter((value) => typeof value === "string" && value.trim()).join(" ").trim();
    const name = typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name.trim() : metadataName || "הורה רשום";
    const parts = name.split(/\s+/).filter(Boolean);
    const phone = result.data.user.phone || (typeof metadata.phone === "string" ? metadata.phone : null);
    parents.set(parentId, { name, phone, familyInitial: parts.length > 1 ? Array.from(parts.at(-1) ?? "")[0] ?? "" : "" });
  }));

  return Response.json({
    activity: { id: activity.data.id, title: activity.data.title, contactPhoneVisibility: activity.data.contact_phone_visibility },
    registrations: (registrations.data ?? []).map((row) => {
      const parent = parents.get(row.parent_user_id);
      return {
        id: row.id,
        parentUserId: row.status === "registered" ? row.parent_user_id : null,
        parentName: row.status === "registered" ? parent?.name ?? "הורה רשום" : null,
        parentPhone: row.status === "registered" ? parent?.phone ?? null : null,
        contactApproved: row.status === "registered" && approvedParentIds.has(row.parent_user_id),
        childName: `${row.child_first_name}${parent?.familyInitial ? ` ${parent.familyInitial}.` : ""}`,
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
