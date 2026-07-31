import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const grades = new Set(Array.from({ length: 12 }, (_, index) => `grade_${index + 1}`));

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const result = await createSupabaseAdmin().from("parent_children").select("id, first_name, grade, birth_date, accommodation_notes, created_at").eq("parent_user_id", user.id).order("created_at");
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
  const grade = typeof payload.grade === "string" && grades.has(payload.grade) ? payload.grade : null;
  const birthDate = typeof payload.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) ? payload.birthDate : null;
  const notes = typeof payload.accommodationNotes === "string" ? payload.accommodationNotes.trim() : "";
  if (firstName.length < 1 || firstName.length > 60 || notes.length > 1000) return Response.json({ error: "יש לבדוק את פרטי הילד/ה." }, { status: 400 });
  const result = await createSupabaseAdmin().from("parent_children").insert({ parent_user_id: user.id, first_name: firstName, grade, birth_date: birthDate, accommodation_notes: notes || null }).select("id, first_name, grade, birth_date, accommodation_notes, created_at").single();
  if (result.error?.code === "23505") return Response.json({ error: "כבר קיים ילד בשם הזה בחשבון." }, { status: 409 });
  if (result.error || !result.data) return Response.json({ error: "לא ניתן לשמור את פרטי הילד/ה." }, { status: 500 });
  return Response.json({ child: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const id = typeof payload.id === "string" ? payload.id : "";
  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const grade = typeof payload.grade === "string" && grades.has(payload.grade) ? payload.grade : null;
  const birthDate = typeof payload.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.birthDate) ? payload.birthDate : null;
  const notes = typeof payload.accommodationNotes === "string" ? payload.accommodationNotes.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !firstName || firstName.length > 60 || notes.length > 1000) return Response.json({ error: "יש לבדוק את פרטי הילד/ה." }, { status: 400 });
  const result = await createSupabaseAdmin().from("parent_children").update({ first_name: firstName, grade, birth_date: birthDate, accommodation_notes: notes || null, updated_at: new Date().toISOString() }).eq("id", id).eq("parent_user_id", user.id).select("id, first_name, grade, birth_date, accommodation_notes, created_at").maybeSingle();
  if (result.error || !result.data) return Response.json({ error: "לא ניתן לעדכן את פרטי הילד/ה." }, { status: 422 });
  return Response.json({ child: result.data });
}
