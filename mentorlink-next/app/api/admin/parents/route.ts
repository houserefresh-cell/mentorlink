import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type AuthParent = {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
  banned_until?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function GET(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const admin = createSupabaseAdmin();
    const users: AuthParent[] = [];

    for (let page = 1; ; page += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (result.error) throw result.error;
      users.push(...(result.data.users as AuthParent[]));
      if (result.data.users.length < 200) break;
    }

    const parents = users.filter((user) => user.user_metadata?.role === "parent" && !user.user_metadata?.administratively_deleted_at);
    if (!parents.length) return adminApiSuccess({ parents: [] });
    const parentIds = parents.map((parent) => parent.id);

    const [profilesResult, childrenResult] = await Promise.all([
      admin.from("parent_profiles").select("user_id,first_name,last_name,phone,city,street,wants_home_mentoring,house_number,entrance,apartment,address_notes,created_at,updated_at").in("user_id", parentIds),
      admin.from("parent_children").select("id,parent_user_id,first_name,last_name,grade,school_name,created_at").in("parent_user_id", parentIds).is("removed_at", null),
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (childrenResult.error) throw childrenResult.error;

    const children = childrenResult.data ?? [];
    const childIds = children.map((child) => child.id);
    const interestsResult = childIds.length
      ? await admin.from("parent_child_subject_interests").select("child_id,subject_id").in("child_id", childIds)
      : { data: [], error: null };
    if (interestsResult.error) throw interestsResult.error;
    const subjectIds = [...new Set((interestsResult.data ?? []).map((interest) => interest.subject_id))];
    const subjectsResult = subjectIds.length
      ? await admin.from("subjects").select("id,name").in("id", subjectIds)
      : { data: [], error: null };
    if (subjectsResult.error) throw subjectsResult.error;

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile]));
    const subjects = new Map((subjectsResult.data ?? []).map((subject) => [String(subject.id), subject.name]));
    const interestsByChild = new Map<string, string[]>();
    for (const interest of interestsResult.data ?? []) {
      const name = subjects.get(String(interest.subject_id));
      if (name) interestsByChild.set(interest.child_id, [...(interestsByChild.get(interest.child_id) ?? []), name]);
    }

    return adminApiSuccess({
      parents: parents
        .map((user) => {
          const profile = profiles.get(user.id);
          return {
            userId: user.id,
            email: user.email ?? null,
            authPhone: user.phone ?? null,
            emailConfirmed: Boolean(user.email_confirmed_at),
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            firstName: profile?.first_name ?? text(user.user_metadata?.first_name),
            lastName: profile?.last_name ?? text(user.user_metadata?.last_name),
            phone: profile?.phone ?? text(user.user_metadata?.phone) ?? user.phone ?? null,
            city: profile?.city ?? null,
            street: profile?.street ?? null,
            wantsHomeMentoring: profile?.wants_home_mentoring ?? false,
            houseNumber: profile?.house_number ?? null,
            entrance: profile?.entrance ?? null,
            apartment: profile?.apartment ?? null,
            addressNotes: profile?.address_notes ?? null,
            profileComplete: Boolean(profile),
            accountDisabled: Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now()),
            children: children
              .filter((child) => child.parent_user_id === user.id)
              .map((child) => ({
                id: child.id,
                firstName: child.first_name,
                lastName: child.last_name,
                grade: child.grade,
                schoolName: child.school_name,
                interests: interestsByChild.get(child.id) ?? [],
              })),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  } catch (error) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorizeAdministrator(request.headers.get("authorization"));
    const payload = await request.json() as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "111111";
    if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || password.length < 6) return Response.json({ error: "יש להזין שם מלא, אימייל תקין וסיסמה בת 6 תווים לפחות." }, { status: 400 });
    const admin = createSupabaseAdmin();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "parent", first_name: firstName, last_name: lastName, must_change_password: true } });
    if (created.error || !created.data.user) return Response.json({ error: created.error?.message ?? "לא ניתן ליצור את החשבון." }, { status: 422 });
    return adminApiSuccess({ created: true, userId: created.data.user.id, email, temporaryPassword: password });
  } catch (error) { return adminApiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const administrator = await authorizeAdministrator(request.headers.get("authorization"));
    const payload = await request.json() as Record<string, unknown>;
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    const action = typeof payload.action === "string" ? payload.action : "";
    if (!/^[0-9a-f-]{36}$/i.test(userId) || userId === administrator.id || !["suspend", "restore", "delete"].includes(action)) return Response.json({ error: "פעולה לא תקינה." }, { status: 400 });
    const admin = createSupabaseAdmin();
    const target = await admin.auth.admin.getUserById(userId);
    if (!target.data.user || target.data.user.user_metadata?.role !== "parent") return Response.json({ error: "חשבון ההורה לא נמצא." }, { status: 404 });
    if (action === "delete") {
      const [profile, registrations, meetings] = await Promise.all([
        admin.from("parent_profiles").select("first_name,last_name").eq("user_id", userId).maybeSingle(),
        admin.from("mentor_activity_registrations").select("id", { count: "exact", head: true }).eq("parent_user_id", userId).in("status", ["registered", "waitlisted"]),
        admin.from("meeting_requests").select("id", { count: "exact", head: true }).eq("parent_user_id", userId).in("status", ["pending", "alternative_proposed", "accepted"]),
      ]);
      const inspectionError = profile.error ?? registrations.error ?? meetings.error;
      if (inspectionError) throw inspectionError;
      const warnings = [registrations.count ? `${registrations.count} הרשמות פעילות נשמרות בהיסטוריה` : null, meetings.count ? `${meetings.count} בקשות או פגישות פעילות נשמרות בהיסטוריה` : null].filter((item): item is string => Boolean(item));
      const now = new Date().toISOString();
      const recorded = await admin.from("admin_deleted_accounts").upsert({ user_id: userId, account_type: "parent", email: target.data.user.email ?? null, display_name: [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || null, warnings, deleted_at: now, deleted_by: administrator.id, restored_at: null, restored_by: null }, { onConflict: "user_id" });
      if (recorded.error) throw recorded.error;
      const metadata = { ...(target.data.user.user_metadata ?? {}), administratively_deleted_at: now };
      const deleted = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h", user_metadata: metadata });
      if (deleted.error) {
        await admin.from("admin_deleted_accounts").delete().eq("user_id", userId).eq("deleted_at", now);
        throw deleted.error;
      }
      return adminApiSuccess({ deleted: true });
    }
    const updated = await admin.auth.admin.updateUserById(userId, { ban_duration: action === "restore" ? "none" : "876000h" });
    if (updated.error) throw updated.error;
    return adminApiSuccess({ status: action === "restore" ? "active" : "suspended" });
  } catch (error) { return adminApiError(error); }
}
