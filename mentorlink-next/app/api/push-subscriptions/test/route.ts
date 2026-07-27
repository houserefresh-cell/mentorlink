import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToSubscription } from "@/lib/web-push-delivery";

export async function POST(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  let body: { endpoint?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint.startsWith("https://")) {
    return Response.json({ error: "מינוי לא תקין." }, { status: 400 });
  }
  const result = await sendPushToSubscription(createSupabaseAdmin(), user.id, endpoint, {
    type: "push_test",
    title: "ההתראות של MentorLink פעילות",
    body: "מעכשיו תקבלו עדכון כאשר מתקבלת פנייה או בקשת פגישה.",
    href: user.role === "mentor" ? "/dashboard/mentor" : "/dashboard/parent",
  });
  if (result.ok) return Response.json({ message: "התראת הניסיון נשלחה." });
  if (result.reason === "rate_limited") {
    return Response.json({ error: "יש להמתין דקה לפני ניסיון נוסף." }, { status: 429 });
  }
  if (result.reason === "not_found" || result.reason === "expired") {
    return Response.json({ error: "המינוי אינו פעיל עוד." }, { status: 404 });
  }
  return Response.json({ error: "לא ניתן לשלוח התראת ניסיון." }, { status: 500 });
}
