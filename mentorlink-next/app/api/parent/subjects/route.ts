import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { loadSlots } from "@/lib/meeting-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("he");
}

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });

  const client = createSupabaseAdmin();
  try {
    const [publications, catalog, memberships] = await Promise.all([
      client.from("mentor_publication").select("user_id").eq("status", "published"),
      client
        .from("subjects")
        .select("id, name, category")
        .eq("moderation_status", "active")
        .order("category")
        .order("name"),
      client.from("community_memberships").select("community_id").eq("user_id", user.id).eq("status", "active"),
    ]);
    if (publications.error || catalog.error || memberships.error) throw new Error("marketplace lookup failed");
    const memberIds = new Set((memberships.data ?? []).map((row) => String(row.community_id)));

    const mentorIds = [...new Set((publications.data ?? []).map((row) => row.user_id))];
    const subjects = catalog.data ?? [];
    const subjectByName = new Map(
      subjects.map((subject) => [normalizeName(subject.name), subject]),
    );

    const meetingMentorsBySubject = new Map<number, Set<string>>();
    const slotGroups = await Promise.all(
      mentorIds.map(async (mentorUserId) => ({
        mentorUserId,
        slots: (await loadSlots(client, mentorUserId, new Date(), 60).catch(() => [])).filter((slot) => slot.audienceScope !== "community" || (slot.communityIds ?? []).some((id) => memberIds.has(id))),
      })),
    );
    for (const { mentorUserId, slots } of slotGroups) {
      const offeredNames = new Set(slots.flatMap((slot) => slot.subjects));
      for (const name of offeredNames) {
        const subject = subjectByName.get(normalizeName(name));
        if (!subject) continue;
        const mentors = meetingMentorsBySubject.get(subject.id) ?? new Set<string>();
        mentors.add(mentorUserId);
        meetingMentorsBySubject.set(subject.id, mentors);
      }
    }

    const now = new Date().toISOString();
    const activities = mentorIds.length
      ? await client
          .from("mentor_activities")
          .select("id, mentor_user_id, subject_id, registration_deadline, audience_scope, community_ids")
          .in("mentor_user_id", mentorIds)
          .eq("status", "published")
          .gt("registration_deadline", now)
      : { data: [], error: null };
    if (activities.error) throw new Error("activity lookup failed");

    const activityIds = (activities.data ?? []).map((row) => row.id);
    const futureSessions = activityIds.length
      ? await client
          .from("mentor_activity_sessions")
          .select("activity_id")
          .in("activity_id", activityIds)
          .gt("ends_at", now)
      : { data: [], error: null };
    if (futureSessions.error) throw new Error("activity session lookup failed");
    const activityWithFutureSession = new Set(
      (futureSessions.data ?? []).map((row) => row.activity_id),
    );

    const activityCountBySubject = new Map<number, number>();
    for (const activity of activities.data ?? []) {
      if (activity.audience_scope === "community" && !(activity.community_ids ?? []).some((id: string) => memberIds.has(String(id)))) continue;
      if (!activity.subject_id || !activityWithFutureSession.has(activity.id)) continue;
      activityCountBySubject.set(
        activity.subject_id,
        (activityCountBySubject.get(activity.subject_id) ?? 0) + 1,
      );
    }

    const visibleSubjects = subjects
      .filter(
        (subject) =>
          (meetingMentorsBySubject.get(subject.id)?.size ?? 0) > 0 ||
          (activityCountBySubject.get(subject.id) ?? 0) > 0,
      )
      .map((subject) => ({
        ...subject,
        meetingMentorCount: meetingMentorsBySubject.get(subject.id)?.size ?? 0,
        activityCount: activityCountBySubject.get(subject.id) ?? 0,
      }));

    return Response.json(
      { subjects: visibleSubjects },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "לא ניתן לטעון את התחומים הפעילים כרגע." },
      { status: 500 },
    );
  }
}
