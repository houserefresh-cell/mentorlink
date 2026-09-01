import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { loadMentorCapabilities } from "@/lib/mentor-capabilities-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await authenticateMeetingUser(request.headers.get("authorization"));
  if (!user) {
    return Response.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (user.role !== "mentor") {
    return Response.json({ error: "Mentor role required", code: "MENTOR_ROLE_REQUIRED" }, { status: 403 });
  }
  try {
    const capabilities = await loadMentorCapabilities(createSupabaseAdmin(), user.id);
    return Response.json(
      { capabilities },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "לא ניתן לטעון את הרשאות החונך.", code: "MENTOR_CAPABILITIES_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
