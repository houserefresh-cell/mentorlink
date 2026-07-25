import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

type AccountRoleRequest = {
  role?: "mentor" | "parent";
  ownerType?: "mentor" | "parent_guardian";
};

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 403 });
  }

  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return Response.json({ error: "יש להתחבר מחדש." }, { status: 401 });
  }

  let body: AccountRoleRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (
    !body.role ||
    !["mentor", "parent"].includes(body.role) ||
    (body.ownerType &&
      !["mentor", "parent_guardian"].includes(body.ownerType))
  ) {
    return Response.json({ error: "סוג החשבון אינו תקין." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: auth, error: authError } =
    await admin.auth.getUser(accessToken);
  if (authError || !auth.user) {
    console.error("Account role authentication failed", authError);
    return Response.json({ error: "יש להתחבר מחדש." }, { status: 401 });
  }

  const { error: assignmentError } = await admin.rpc("assign_account_role", {
    requested_user_id: auth.user.id,
    requested_role: body.role,
    requested_owner_type: body.ownerType ?? "mentor",
  });
  if (assignmentError) {
    console.error("Account role assignment failed", assignmentError);
    return Response.json(
      {
        error: assignmentError.message.includes("different role")
          ? "כתובת המייל כבר משויכת לחשבון מסוג אחר."
          : "לא ניתן לשמור את סוג החשבון.",
      },
      { status: 409 },
    );
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(
    auth.user.id,
    {
      user_metadata: {
        ...auth.user.user_metadata,
        role: body.role,
        ...(body.role === "mentor"
          ? { account_owner_type: body.ownerType ?? "mentor" }
          : {}),
      },
    },
  );
  if (metadataError) {
    console.error("Account role display metadata update failed", metadataError);
  }

  return Response.json({ role: body.role });
}
