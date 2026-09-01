import { sendPasswordRecoveryLink } from "@/lib/password-recovery";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const GENERIC_MESSAGE = "אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס הסיסמה.";

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return Response.json({ message: GENERIC_MESSAGE });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ message: GENERIC_MESSAGE });
  }
  try {
    await sendPasswordRecoveryLink(createSupabaseAdmin(), email);
  } catch {
    // Never expose whether the account exists.
  }
  return Response.json({ message: GENERIC_MESSAGE }, { headers: { "Cache-Control": "no-store" } });
}
