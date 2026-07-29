import { revalidatePath } from "next/cache";
import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const CRITICAL_FIELDS = ["first_name", "last_name", "bio", "birth_date", "city", "phone", "profile_photo_path"] as const;
const SAFE_FIELDS = ["grade", "school", "languages"] as const;
const CANCELABLE_FIELDS = new Set(["first_name", "last_name", "bio", "birth_date", "city", "phone"]);
const text = (value: unknown, maximum: number) => typeof value === "string" && value.trim().length <= maximum ? value.trim() : "";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  const client = createSupabaseAdmin();
  const [profile, publication, pending] = await Promise.all([
    client.from("mentor_profiles").select("first_name, last_name, birth_date, grade, school, city, phone, languages, bio, profile_photo_path").eq("user_id", user.id).maybeSingle(),
    client.from("mentor_publication").select("status").eq("user_id", user.id).maybeSingle(),
    client.from("mentor_public_pending_changes").select("id, field_name, current_value, requested_value, requested_at").eq("mentor_user_id", user.id).eq("status", "pending"),
  ]);
  if (profile.error || publication.error || pending.error) return Response.json({ error: "Unable to load mentor profile" }, { status: 500 });
  return Response.json({ profile: profile.data, publicationStatus: publication.data?.status ?? "draft", pendingChanges: pending.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const client = createSupabaseAdmin();
  const [profile, publication] = await Promise.all([
    client.from("mentor_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    client.from("mentor_publication").select("status").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile.error || publication.error) return Response.json({ error: "Unable to load profile state" }, { status: 500 });
  const normalized: Record<string, unknown> = {
    first_name: text(body.first_name, 80), last_name: text(body.last_name, 80),
    birth_date: text(body.birth_date, 10), grade: text(body.grade, 80), school: text(body.school, 160),
    city: text(body.city, 120), phone: text(body.phone, 40),
    languages: Array.isArray(body.languages) ? body.languages.map((value) => text(value, 80)).filter(Boolean).slice(0, 20) : [],
    bio: text(body.bio, 1000),
  };
  if (!normalized.first_name || !normalized.last_name || !normalized.birth_date || !normalized.bio || !(normalized.languages as string[]).length) return Response.json({ error: "Invalid profile", code: "INVALID_PROFILE" }, { status: 400 });
  const published = publication.data?.status === "published";
  const immediate: Record<string, unknown> = {};
  for (const field of SAFE_FIELDS) immediate[field] = normalized[field];
  const changedPendingFields: string[] = [];
  if (profile.data) {
    for (const field of CRITICAL_FIELDS.filter((field) => field !== "profile_photo_path")) {
      const existing = await client.from("mentor_public_pending_changes").select("id").eq("mentor_user_id", user.id).eq("field_name", field).eq("status", "pending").maybeSingle();
      if (existing.error) return Response.json({ error: "Unable to load pending profile change", code: "PENDING_CHANGE_LOOKUP_FAILED" }, { status: 500 });

      if (!published) {
        immediate[field] = normalized[field];
        if (existing.data) {
          const removed = await client.from("mentor_public_pending_changes").delete().eq("id", existing.data.id).eq("mentor_user_id", user.id).eq("status", "pending");
          if (removed.error) return Response.json({ error: "Unable to cancel pending profile change", code: "PENDING_CHANGE_CANCEL_FAILED" }, { status: 500 });
        }
        continue;
      }

      if (JSON.stringify(profile.data[field]) === JSON.stringify(normalized[field])) {
        if (existing.data) {
          const removed = await client.from("mentor_public_pending_changes").delete().eq("id", existing.data.id).eq("mentor_user_id", user.id).eq("status", "pending");
          if (removed.error) return Response.json({ error: "Unable to cancel pending profile change", code: "PENDING_CHANGE_CANCEL_FAILED" }, { status: 500 });
        }
        continue;
      }

      const requestedAt = new Date().toISOString();
      const result = existing.data
        ? await client.from("mentor_public_pending_changes").update({ requested_value: normalized[field], requested_at: requestedAt }).eq("id", existing.data.id).eq("status", "pending")
        : await client.from("mentor_public_pending_changes").insert({ mentor_user_id: user.id, field_name: field, current_value: profile.data[field], requested_value: normalized[field], requested_at: requestedAt });
      if (result.error) return Response.json({ error: "Unable to stage profile change", code: "PENDING_CHANGE_FAILED" }, { status: 500 });
      changedPendingFields.push(field);
    }
  }
  if (!profile.data) return Response.json({ error: "Mentor profile not found", code: "PROFILE_NOT_FOUND" }, { status: 404 });
  const saved = await client.from("mentor_profiles").update({ ...immediate, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (saved.error) return Response.json({ error: "Unable to save profile", code: "PROFILE_SAVE_FAILED" }, { status: 500 });
  const remainingPending = await client.from("mentor_public_pending_changes").select("id, field_name, current_value, requested_value, requested_at").eq("mentor_user_id", user.id).eq("status", "pending");
  const pendingFields = remainingPending.error ? changedPendingFields : (remainingPending.data ?? []).map((change) => change.field_name);
  revalidatePath("/");
  return Response.json({ saved: true, pendingFields, pendingChanges: remainingPending.data ?? [], publicationStatus: publication.data?.status ?? "draft" });
}
export async function DELETE(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "mentor") return Response.json({ error: "Mentor role required" }, { status: 403 });

  const field = new URL(request.url).searchParams.get("field") ?? "";
  if (!CANCELABLE_FIELDS.has(field)) {
    return Response.json({ error: "Invalid pending field", code: "INVALID_PENDING_FIELD" }, { status: 400 });
  }

  const client = createSupabaseAdmin();
  const pending = await client
    .from("mentor_public_pending_changes")
    .select("id, current_value")
    .eq("mentor_user_id", user.id)
    .eq("field_name", field)
    .eq("status", "pending")
    .maybeSingle();

  if (pending.error) {
    return Response.json({ error: "Unable to load pending change", code: "PENDING_CHANGE_LOOKUP_FAILED" }, { status: 500 });
  }

  if (!pending.data) {
    return Response.json({ cancelled: false, field });
  }

  const removed = await client
    .from("mentor_public_pending_changes")
    .delete()
    .eq("id", pending.data.id)
    .eq("mentor_user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (removed.error) {
    return Response.json({ error: "Unable to cancel pending change", code: "PENDING_CHANGE_CANCEL_FAILED" }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/dashboard/admin/mentors");

  return Response.json({
    cancelled: Boolean(removed.data),
    field,
    approvedValue: pending.data.current_value,
  });
}
