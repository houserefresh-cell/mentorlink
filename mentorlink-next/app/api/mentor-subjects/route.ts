import { revalidatePath, revalidateTag } from "next/cache";
import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  SUBJECT_CATEGORIES,
  validateProposedSubject,
  type SubjectCategory,
} from "@/lib/subject-catalog-core";

const AGE_GROUPS = new Set([
  "א׳–ב׳",
  "ג׳–ד׳",
  "ה׳–ו׳",
  "חטיבת ביניים",
  "תיכון",
]);

async function mentor(request: Request) {
  const user = await authenticateMeetingUser(
    request.headers.get("authorization"),
  );
  return user?.role === "mentor" ? user : null;
}

export async function GET(request: Request) {
  const user = await mentor(request);
  if (!user) {
    return Response.json({ error: "Mentor authentication required" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const [catalog, selected] = await Promise.all([
    admin
      .from("subjects")
      .select("id, name, category, created_by")
      .eq("moderation_status", "active")
      .order("category")
      .order("name"),
    admin
      .from("mentor_subjects")
      .select("subject_id, age_groups")
      .eq("user_id", user.id),
  ]);

  if (catalog.error || selected.error) {
    return Response.json({ error: "Unable to load mentor subjects" }, { status: 500 });
  }

  const activeIds = new Set((catalog.data ?? []).map((subject) => subject.id));
  const selectedIds = new Set((selected.data ?? []).map((choice) => choice.subject_id));
  return Response.json(
    {
      catalog: (catalog.data ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        category: subject.category,
        canDelete: subject.created_by === user.id && selectedIds.has(subject.id),
      })),
      selected: (selected.data ?? []).filter((choice) =>
        activeIds.has(choice.subject_id),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await mentor(request);
  if (!user) {
    return Response.json({ error: "Mentor authentication required" }, { status: 401 });
  }

  let body: { name?: unknown; category?: unknown; addToProfile?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const category = body.category;
  const addToProfile = body.addToProfile === undefined ? true : body.addToProfile;
  if (typeof addToProfile !== "boolean") {
    return Response.json(
      { error: "Invalid profile selection", code: "INVALID_ADD_TO_PROFILE" },
      { status: 400 },
    );
  }
  if (
    typeof category !== "string" ||
    !SUBJECT_CATEGORIES.includes(category as SubjectCategory)
  ) {
    return Response.json({ error: "Invalid category", code: "INVALID_CATEGORY" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [existing, recent] = await Promise.all([
    admin.from("subjects").select("id, name"),
    admin
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .gte("created_at", since),
  ]);
  if (existing.error || recent.error) {
    return Response.json({ error: "Unable to validate subject" }, { status: 500 });
  }
  if ((recent.count ?? 0) >= 10) {
    return Response.json(
      { error: "נוספו יותר מדי מקצועות בזמן קצר. אפשר לנסות שוב מחר.", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const checked = validateProposedSubject(
    typeof body.name === "string" ? body.name : "",
    (existing.data ?? []).map((subject) => subject.name),
  );
  if (!checked.ok) {
    return Response.json(
      {
        error: checked.code === "DUPLICATE"
          ? `כבר קיים מקצוע דומה: ${checked.duplicate}`
          : "שם המקצוע אינו תקין.",
        code: checked.code,
        duplicate: "duplicate" in checked ? checked.duplicate : null,
      },
      { status: 400 },
    );
  }

  const inserted = await admin
    .from("subjects")
    .insert({
      name: checked.name,
      normalized_name: checked.normalizedName,
      category,
      created_by: user.id,
      moderation_status: "active",
    })
    .select("id, name, category")
    .single();

  if (inserted.error) {
    return Response.json(
      {
        error: inserted.error.code === "23505"
          ? "המקצוע כבר קיים במאגר."
          : "לא ניתן להוסיף את המקצוע.",
        code: inserted.error.code === "23505" ? "DUPLICATE" : "SUBJECT_CREATE_FAILED",
      },
      { status: inserted.error.code === "23505" ? 409 : 500 },
    );
  }

  const linked = addToProfile
    ? await admin.from("mentor_subjects").upsert(
        {
          user_id: user.id,
          subject_id: inserted.data.id,
          age_groups: [...AGE_GROUPS],
          custom_subject: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,subject_id" },
      )
    : { error: null };
  if (linked.error) {
    return Response.json(
      { error: "המקצוע נוסף למאגר, אך לא ניתן לשייך אותו לפרופיל.", code: "SUBJECT_LINK_FAILED" },
      { status: 500 },
    );
  }

  revalidatePath("/");
  revalidateTag("public-mentors", { expire: 0 });
  return Response.json(
    { subject: inserted.data, addedToProfile: addToProfile },
    { status: 201 },
  );
}

export async function PUT(request: Request) {
  const user = await mentor(request);
  if (!user) {
    return Response.json({ error: "Mentor authentication required" }, { status: 401 });
  }

  let body: { selections?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!Array.isArray(body.selections) || body.selections.length === 0) {
    return Response.json({ error: "יש לבחור לפחות מקצוע אחד.", code: "EMPTY_SELECTION" }, { status: 400 });
  }

  const selections = body.selections.map((selection) => {
    const row = selection as { subjectId?: unknown; ageGroups?: unknown };
    const subjectId = Number(row.subjectId);
    const ageGroups = Array.isArray(row.ageGroups)
      ? [...new Set(row.ageGroups.filter((value): value is string => typeof value === "string" && AGE_GROUPS.has(value)))]
      : [];
    return { subjectId, ageGroups };
  });

  if (
    selections.some(
      ({ subjectId, ageGroups }) =>
        !Number.isInteger(subjectId) || subjectId <= 0 || ageGroups.length === 0,
    ) ||
    new Set(selections.map(({ subjectId }) => subjectId)).size !== selections.length
  ) {
    return Response.json({ error: "בחירת המקצועות אינה תקינה.", code: "INVALID_SELECTION" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const validSubjects = await admin
    .from("subjects")
    .select("id")
    .eq("moderation_status", "active")
    .in("id", selections.map(({ subjectId }) => subjectId));
  if (
    validSubjects.error ||
    (validSubjects.data ?? []).length !== selections.length
  ) {
    return Response.json({ error: "אחד המקצועות אינו זמין.", code: "SUBJECT_NOT_AVAILABLE" }, { status: 400 });
  }

  const saved = await admin.from("mentor_subjects").upsert(
    selections.map(({ subjectId, ageGroups }) => ({
      user_id: user.id,
      subject_id: subjectId,
      age_groups: ageGroups,
      custom_subject: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,subject_id" },
  );
  if (saved.error) {
    return Response.json({ error: "לא ניתן לשמור את המקצועות." }, { status: 500 });
  }

  const selectedIds = selections.map(({ subjectId }) => subjectId);
  const existingChoices = await admin
    .from("mentor_subjects")
    .select("subject_id")
    .eq("user_id", user.id);
  if (existingChoices.error) {
    return Response.json({ error: "המקצועות נשמרו, אך הסנכרון לא הושלם." }, { status: 500 });
  }
  const removedIds = (existingChoices.data ?? [])
    .map((row) => row.subject_id)
    .filter((subjectId) => !selectedIds.includes(subjectId));
  if (removedIds.length) {
    const removed = await admin
      .from("mentor_subjects")
      .delete()
      .eq("user_id", user.id)
      .in("subject_id", removedIds);
    if (removed.error) {
      return Response.json({ error: "המקצועות נשמרו, אך לא ניתן להסיר בחירות ישנות." }, { status: 500 });
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard/mentor/profile");
  revalidatePath("/dashboard/mentor/subjects");
  revalidateTag("public-mentors", { expire: 0 });
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const user = await mentor(request);
  if (!user) {
    return Response.json({ error: "Mentor authentication required" }, { status: 401 });
  }
  const subjectId = Number(new URL(request.url).searchParams.get("subjectId"));
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return Response.json({ error: "מקצוע לא תקין.", code: "INVALID_SUBJECT" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const subject = await admin
    .from("subjects")
    .select("id, created_by")
    .eq("id", subjectId)
    .maybeSingle();
  if (subject.error || !subject.data || subject.data.created_by !== user.id) {
    return Response.json({ error: "ניתן למחוק רק מקצוע שהוספת.", code: "DELETE_FORBIDDEN" }, { status: 403 });
  }

  const unlinked = await admin
    .from("mentor_subjects")
    .delete()
    .eq("user_id", user.id)
    .eq("subject_id", subjectId);
  if (unlinked.error) {
    return Response.json({ error: "לא ניתן להסיר את המקצוע." }, { status: 500 });
  }

  const ownWindows = await admin
    .from("mentor_availability_windows")
    .select("id")
    .eq("mentor_user_id", user.id);
  if (ownWindows.error) {
    return Response.json({ error: "המקצוע הוסר, אך לא ניתן לעדכן את חלונות הזמינות." }, { status: 500 });
  }
  const ownWindowIds = (ownWindows.data ?? []).map((window) => window.id);
  if (ownWindowIds.length) {
    const removedWindowLinks = await admin
      .from("mentor_availability_window_subjects")
      .delete()
      .eq("subject_id", subjectId)
      .in("window_id", ownWindowIds);
    if (removedWindowLinks.error) {
      return Response.json({ error: "המקצוע הוסר, אך לא ניתן לעדכן את חלונות הזמינות." }, { status: 500 });
    }
  }

  const otherUsage = await admin
    .from("mentor_subjects")
    .select("user_id", { count: "exact", head: true })
    .eq("subject_id", subjectId);
  if (otherUsage.error) {
    return Response.json({ error: "המקצוע הוסר מהפרופיל, אך בדיקת המאגר נכשלה." }, { status: 500 });
  }
  if ((otherUsage.count ?? 0) === 0) {
    const removed = await admin
      .from("subjects")
      .delete()
      .eq("id", subjectId)
      .eq("created_by", user.id);
    if (removed.error) {
      return Response.json({ error: "המקצוע הוסר מהפרופיל, אך לא מהמאגר." }, { status: 500 });
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard/mentor/subjects");
  revalidateTag("public-mentors", { expire: 0 });
  return Response.json({ deleted: true, removedFromCatalog: (otherUsage.count ?? 0) === 0 });
}
