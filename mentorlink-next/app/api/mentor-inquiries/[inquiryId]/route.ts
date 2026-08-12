import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { deliverInquiryUpdate } from "@/lib/inquiry-notifications";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const clean = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim().length <= maximum
    ? value.trim()
    : "";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inquiryId: string }> },
) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { inquiryId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(inquiryId)) {
    return Response.json({ error: "פנייה לא תקינה." }, { status: 400 });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const action = clean(payload.action, 20);
  const response = clean(payload.response, 1000);
  try {
    const client = createSupabaseAdmin();
    const current = await client.from("mentor_inquiries")
      .select("*").eq("id", inquiryId).maybeSingle();
    if (current.error || !current.data) {
      return Response.json({ error: "הפנייה לא נמצאה." }, { status: 404 });
    }
    const row = current.data;
    const isParent = user.role === "parent" && row.parent_user_id === user.id;
    const isMentor = user.role === "mentor" && row.mentor_user_id === user.id;
    if (!isParent && !isMentor) return Response.json({ error: "אין הרשאה." }, { status: 403 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let recipientId: string;
    let kind: "mentor_inquiry_responded" | "mentor_inquiry_closed" | "mentor_inquiry_cancelled";
    let title: string;
    let body: string;
    let href: string;
    if (action === "respond" && (isMentor || isParent) && ["pending", "responded", "closed"].includes(row.status)) {
      if (response.length < 2) return Response.json({ error: "יש לכתוב תשובה." }, { status: 400 });
      Object.assign(update, {
        status: "responded",
        ...(isMentor?{mentor_response: response}:{}), archived_at:null,
        responded_at: new Date().toISOString(),
      });
      recipientId = isMentor?row.parent_user_id:row.mentor_user_id;
      kind = "mentor_inquiry_responded";
      title = isMentor?"החונך השיב לפנייה":"הודעה חדשה מההורה";
      body = "ממתינה לך הודעה חדשה בשיחה.";
      href = isMentor?"/dashboard/parent/requests":"/dashboard/mentor/inquiries";
    } else if (action === "close" && ["pending", "responded"].includes(row.status)) {
      Object.assign(update, { status: "closed", closed_at: new Date().toISOString(), archived_at:new Date().toISOString() });
      recipientId = isMentor?row.parent_user_id:row.mentor_user_id;
      kind = "mentor_inquiry_closed";
      title = "הפנייה טופלה";
      body = "הפנייה עודכנה באזור האישי.";
      href = isMentor?"/dashboard/parent/requests":"/dashboard/mentor/inquiries";
    } else if (action === "reopen" && row.status==="closed") {
      Object.assign(update,{status:"responded",closed_at:null,archived_at:null});recipientId=isMentor?row.parent_user_id:row.mentor_user_id;kind="mentor_inquiry_responded";title="השיחה חזרה לפעילות";body="השיחה הוחזרה לשיחות הפעילות.";href=isMentor?"/dashboard/parent/requests":"/dashboard/mentor/inquiries";
    } else if (action === "cancel" && isParent && ["pending", "responded"].includes(row.status)) {
      Object.assign(update, { status: "cancelled", cancelled_at: new Date().toISOString() });
      recipientId = row.mentor_user_id;
      kind = "mentor_inquiry_cancelled";
      title = "פנייה בוטלה";
      body = "פנייה מהורה בוטלה.";
      href = "/dashboard/mentor/inquiries";
    } else {
      return Response.json({ error: "לא ניתן לבצע פעולה במצב הנוכחי." }, { status: 409 });
    }
    const result = await client.from("mentor_inquiries").update(update)
      .eq("id", inquiryId).eq("status", row.status)
      .select("id, status, mentor_response").maybeSingle();
    if (result.error) throw new Error("update failed");
    if (!result.data) return Response.json({ error: "הפנייה כבר השתנתה." }, { status: 409 });
    if(action==="respond") await client.from("mentor_inquiry_messages").insert({inquiry_id:inquiryId,sender_user_id:user.id,sender_role:isMentor?"mentor":"parent",body:response});
    const recipient = await client.auth.admin.getUserById(recipientId);
    await deliverInquiryUpdate(client, {
      userId: recipientId,
      email: recipient.data.user?.email ?? null,
      kind,
      title,
      body,
      href,
    });
    return Response.json({ inquiry: result.data });
  } catch {
    return Response.json({ error: "לא ניתן לעדכן את הפנייה." }, { status: 500 });
  }
}
