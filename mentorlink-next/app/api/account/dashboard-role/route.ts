import { createSupabaseServerAuth } from "@/lib/supabase-server-auth";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return Response.json({ administrator: false }, { status: 401 });
  const auth = createSupabaseServerAuth();
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return Response.json({ administrator: false }, { status: 401 });
  const configuredEmail = process.env.MENTORLINK_ADMIN_EMAIL?.trim().toLowerCase();
  const administrator = Boolean(configuredEmail && data.user.email?.trim().toLowerCase() === configuredEmail);
  return Response.json({ administrator }, { headers: { "Cache-Control": "no-store" } });
}
