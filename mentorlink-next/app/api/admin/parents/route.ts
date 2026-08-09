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

    const parents = users.filter((user) => user.user_metadata?.role === "parent");
    if (!parents.length) return adminApiSuccess({ parents: [] });
    const parentIds = parents.map((parent) => parent.id);

    const [profilesResult, childrenResult] = await Promise.all([
      admin.from("parent_profiles").select("user_id,first_name,last_name,phone,city,street,wants_home_mentoring,house_number,entrance,apartment,address_notes,created_at,updated_at").in("user_id", parentIds),
      admin.from("parent_children").select("id,parent_user_id,first_name,last_name,grade,school_name,created_at").in("parent_user_id", parentIds),
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
