import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const validPhone = (value: string) => /^[+]?[0-9][0-9\s-]{7,18}$/.test(value);

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const result = await admin.from("parent_profiles").select("first_name, last_name, phone, city, street, wants_home_mentoring, house_number, entrance, apartment, address_notes").eq("user_id", user.id).maybeSingle();
  if (result.error) return Response.json({ error: "לא ניתן לטעון את פרטי ההורה." }, { status: 500 });
  if (result.data) return Response.json({ profile: result.data }, { headers: { "Cache-Control": "no-store" } });
  const authUser = await admin.auth.admin.getUserById(user.id);
  const metadata = authUser.data.user?.user_metadata ?? {};
  return Response.json({
    profile: {
      first_name: typeof metadata.first_name === "string" ? metadata.first_name : "",
      last_name: typeof metadata.last_name === "string" ? metadata.last_name : "",
      phone: typeof metadata.phone === "string" ? metadata.phone : authUser.data.user?.phone ?? "",
      city: "", street: "", wants_home_mentoring: false,
      house_number: "", entrance: "", apartment: "", address_notes: "",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) return Response.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (user.role !== "parent") return Response.json({ error: "הגישה מיועדת להורים בלבד." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "בקשה לא תקינה." }, { status: 400 }); }
  const firstName = clean(body.firstName, 60), lastName = clean(body.lastName, 60), phone = clean(body.phone, 20);
  const city = clean(body.city, 80), street = clean(body.street, 120), wantsHome = body.wantsHomeMentoring === true;
  const houseNumber = clean(body.houseNumber, 20), entrance = clean(body.entrance, 20), apartment = clean(body.apartment, 20), addressNotes = clean(body.addressNotes, 300);
  if (!firstName || !lastName || !validPhone(phone)) return Response.json({ error: "יש להזין שם מלא ומספר טלפון תקין." }, { status: 400 });
  if (wantsHome && (!city || !street || !houseNumber)) return Response.json({ error: "לחונכות בבית יש להזין עיר, רחוב ומספר בית." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const result = await admin.rpc("save_parent_profile", {
    p_user_id: user.id, p_first_name: firstName, p_last_name: lastName, p_phone: phone,
    p_city: city || null, p_street: street || null, p_wants_home_mentoring: wantsHome,
    p_house_number: houseNumber || null, p_entrance: entrance || null,
    p_apartment: apartment || null, p_address_notes: addressNotes || null,
  });
  if (result.error) return Response.json({ error: "לא ניתן לשמור את פרטי ההורה." }, { status: 500 });
  return Response.json({ ok: true });
}
