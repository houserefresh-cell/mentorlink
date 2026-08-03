import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { loadPublishedSchedulingMentor } from "@/lib/meeting-data";
import { deliverInquiryUpdate } from "@/lib/inquiry-notifications";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { loadPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";

const clean = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim().length <= maximum
    ? value.trim()
    : "";

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") {
    return Response.json({ error: "רק חשבון הורה יכול לשלוח פנייה." }, { status: 403 });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const bookingId = clean(payload.mentorBookingId, 36);
  const idempotencyKey = clean(payload.idempotencyKey, 36);
  const subject = clean(payload.subject, 120) || null;
  const childGradeOrAge = clean(payload.childGradeOrAge, 40) || null;
  const message = clean(payload.message, 1000);
  if (
    !/^[0-9a-f-]{36}$/i.test(bookingId) ||
    !/^[0-9a-f-]{36}$/i.test(idempotencyKey) ||
    message.length < 5
  ) return Response.json({ error: "פרטי הפנייה אינם תקינים." }, { status: 400 });

  try {
    const client = createSupabaseAdmin();
    const parentProfile = await client.from("parent_profiles").select("phone").eq("user_id", user.id).maybeSingle();
    if (!parentProfile.data?.phone) return Response.json({ error: "לפני שליחת פנייה יש להשלים מספר טלפון בחשבון שלי.", code: "PARENT_PROFILE_REQUIRED" }, { status: 422 });
    const mentor = await loadPublishedSchedulingMentor(client, bookingId);
    if (!mentor) return Response.json({ error: "החונך אינו זמין לפניות." }, { status: 404 });
    if (subject && !mentor.subjects.includes(subject)) {
      return Response.json({ error: "התחום אינו שייך לחונך." }, { status: 400 });
    }
    const insert = await client.from("mentor_inquiries").insert({
      idempotency_key: idempotencyKey,
      parent_user_id: user.id,
      mentor_user_id: mentor.mentorUserId,
      subject,
      child_grade_or_age: childGradeOrAge,
      message,
    }).select("id, status").single();
    if (insert.error?.code === "23505") {
      return Response.json({ error: "הפנייה כבר נשלחה." }, { status: 409 });
    }
    if (insert.error || !insert.data) throw new Error("insert failed");
    const mentorUser = await client.auth.admin.getUserById(mentor.mentorUserId);
    await deliverInquiryUpdate(client, {
      userId: mentor.mentorUserId,
      email: mentorUser.data.user?.email ?? null,
      kind: "mentor_inquiry_created",
      title: "פנייה חדשה במנטורלינק",
      body: "התקבלה פנייה חדשה מהורה.",
      href: "/dashboard/mentor/inquiries",
    });
    return Response.json({ inquiry: insert.data }, { status: 201 });
  } catch {
    return Response.json({ error: "לא ניתן לשלוח את הפנייה." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (!["parent", "mentor"].includes(user.role)) {
    return Response.json({ error: "אין הרשאה." }, { status: 403 });
  }
  try {
    const client = createSupabaseAdmin();
    const ownerColumn = user.role === "parent" ? "parent_user_id" : "mentor_user_id";
    const result = await client.from("mentor_inquiries")
      .select("id, mentor_user_id, subject, child_grade_or_age, message, status, mentor_response, responded_at, closed_at, cancelled_at, created_at")
      .eq(ownerColumn, user.id)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error("query failed");
    const rows = result.data ?? [];
    const mentorSummaries = new Map<string, PublicMentor>();
    if (user.role === "parent") {
      const ids = [...new Set(rows.map((row) => row.mentor_user_id))];
      if (ids.length) {
        const [publications, publishedMentors] = await Promise.all([
          client.from("mentor_publication")
            .select("user_id, public_booking_id")
            .eq("status", "published")
            .in("user_id", ids),
          loadPublishedMentors(client),
        ]);
        if (publications.error) throw new Error("publication query failed");
        const mentorsByBookingId = new Map(publishedMentors.map((mentor) => [mentor.bookingId, mentor]));
        for (const publication of publications.data ?? []) {
          const mentor = mentorsByBookingId.get(publication.public_booking_id);
          if (mentor) mentorSummaries.set(publication.user_id, mentor);
        }
      }
    }
    return Response.json({
      inquiries: rows.map(({ mentor_user_id, ...row }) => ({
        ...row,
        ...(user.role === "parent"
          ? { mentor: mentorSummaries.get(mentor_user_id) ?? null }
          : {}),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "לא ניתן לטעון את הפניות." }, { status: 500 });
  }
}
