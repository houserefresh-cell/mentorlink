import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const grades = new Set(["kindergarten", ...Array.from({ length: 12 }, (_, index) => `grade_${index + 1}`)]);

async function childrenWithInterests(parentUserId: string) {
  const admin = createSupabaseAdmin();
  const children = await admin.from("parent_children").select("id, first_name, last_name, grade, birth_date, school_name, accommodation_notes, created_at").eq("parent_user_id", parentUserId).order("created_at");
  if (children.error) return { data: null, error: children.error };
  const ids = (children.data ?? []).map((child) => child.id);
  const interests = ids.length ? await admin.from("parent_child_subject_interests").select("child_id, subject_id, subjects(name, category)").in("child_id", ids) : { data: [], error: null };
  return { data: (children.data ?? []).map((child) => ({ ...child, interests: (interests.data ?? []).filter((interest) => interest.child_id === child.id).map((interest) => ({ subjectId: interest.subject_id, ...((Array.isArray(interest.subjects) ? interest.subjects[0] : interest.subjects) ?? {}) })) })), error: interests.error };
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const result = await childrenWithInterests(user.id);
  if (result.error) return Response.json({ error: "לא ניתן לטעון את פרטי הילדים." }, { status: 500 });
  return Response.json({ children: result.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const grade = typeof payload.grade === "string" && grades.has(payload.grade) ? payload.grade : null;
  const birthDate = typeof payload.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) ? payload.birthDate : null;
  const notes = typeof payload.accommodationNotes === "string" ? payload.accommodationNotes.trim() : "";
  const schoolName = typeof payload.schoolName === "string" ? payload.schoolName.trim() : "";
  const interestIds = Array.isArray(payload.interestSubjectIds) ? [...new Set(payload.interestSubjectIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))] : [];
  if (firstName.length < 1 || firstName.length > 60 || notes.length > 1000) return Response.json({ error: "יש לבדוק את פרטי הילד/ה." }, { status: 400 });
  if (schoolName.length === 1 || schoolName.length > 120) return Response.json({ error: "שם בית הספר אינו תקין." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const result = await admin.rpc("save_parent_child_preferences", { p_parent_user_id: user.id, p_child_id: null, p_first_name: firstName, p_grade: grade, p_birth_date: birthDate, p_school_name: schoolName || null, p_accommodation_notes: notes || null, p_interest_subject_ids: interestIds });
  if (result.error?.code === "23505") return Response.json({ error: "כבר קיים ילד בשם הזה בחשבון." }, { status: 409 });
  if (result.error || !result.data) return Response.json({ error: result.error?.message.includes("INVALID_SUBJECT") ? "אחד מתחומי העניין אינו זמין." : "לא ניתן לשמור את פרטי הילד/ה." }, { status: result.error?.message.includes("INVALID_SUBJECT") ? 400 : 500 });
  await admin.from("parent_children").update({ last_name: lastName || null }).eq("id", result.data).eq("parent_user_id", user.id);
  const refreshed = await childrenWithInterests(user.id);
  return Response.json({ child: refreshed.data?.find((child) => child.id === result.data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const id = typeof payload.id === "string" ? payload.id : "";
  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const grade = typeof payload.grade === "string" && grades.has(payload.grade) ? payload.grade : null;
  const birthDate = typeof payload.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) ? payload.birthDate : null;
  const notes = typeof payload.accommodationNotes === "string" ? payload.accommodationNotes.trim() : "";
  const schoolName = typeof payload.schoolName === "string" ? payload.schoolName.trim() : "";
  const interestIds = Array.isArray(payload.interestSubjectIds) ? [...new Set(payload.interestSubjectIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))] : [];
  if (!/^[0-9a-f-]{36}$/i.test(id) || !firstName || firstName.length > 60 || notes.length > 1000) return Response.json({ error: "יש לבדוק את פרטי הילד/ה." }, { status: 400 });
  if (schoolName.length === 1 || schoolName.length > 120) return Response.json({ error: "שם בית הספר אינו תקין." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const result = await admin.rpc("save_parent_child_preferences", { p_parent_user_id: user.id, p_child_id: id, p_first_name: firstName, p_grade: grade, p_birth_date: birthDate, p_school_name: schoolName || null, p_accommodation_notes: notes || null, p_interest_subject_ids: interestIds });
  if (result.error || !result.data) return Response.json({ error: result.error?.message.includes("INVALID_SUBJECT") ? "אחד מתחומי העניין אינו זמין." : "לא ניתן לעדכן את פרטי הילד/ה." }, { status: result.error?.message.includes("INVALID_SUBJECT") ? 400 : 422 });
  await admin.from("parent_children").update({ last_name: lastName || null }).eq("id", id).eq("parent_user_id", user.id);
  const refreshed = await childrenWithInterests(user.id);
  return Response.json({ child: refreshed.data?.find((child) => child.id === id) });
}
