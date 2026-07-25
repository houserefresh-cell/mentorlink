import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { buildAccountRoleRpcArguments } from "@/lib/account-role-policy";

export const runtime = "nodejs";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: auth, error: authError } =
    await admin.auth.getUser(accessToken);
  if (authError || !auth.user) {
    console.error("Account role authentication failed", authError);
    return Response.json({ error: "יש להתחבר מחדש." }, { status: 401 });
  }

  let rpcArguments: ReturnType<typeof buildAccountRoleRpcArguments>;
  try {
    rpcArguments = buildAccountRoleRpcArguments(auth.user.id, body);
  } catch (validationError) {
    console.error("Invalid account role request", validationError);
    return Response.json({ error: "סוג החשבון אינו תקין." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase user-scoped server client is not configured");
    return Response.json(
      { error: "לא ניתן לשמור את סוג החשבון." },
      { status: 500 },
    );
  }

  const authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: assignmentError } = await authenticatedClient.rpc(
    "assign_account_role",
    rpcArguments,
  );
  if (assignmentError) {
    console.error("Account role assignment failed", assignmentError);
    return Response.json(
      { error: "לא ניתן לשמור את סוג החשבון." },
      { status: 409 },
    );
  }

  const existingMetadataRoles = Array.isArray(
    auth.user.user_metadata?.account_roles,
  )
    ? auth.user.user_metadata.account_roles.filter(
        (role: unknown) =>
          role === "mentor" || role === "parent_guardian",
      )
    : [];
  const metadataRoles = [
    ...new Set([
      ...existingMetadataRoles,
      rpcArguments.requested_role,
    ]),
  ];

  const { error: metadataError } = await admin.auth.admin.updateUserById(
    auth.user.id,
    {
      user_metadata: {
        ...auth.user.user_metadata,
        role: rpcArguments.requested_role,
        account_roles: metadataRoles,
        ...(rpcArguments.requested_manages_mentor_profile
          ? { account_owner_type: rpcArguments.requested_role }
          : {}),
      },
    },
  );
  if (metadataError) {
    console.error("Account role display metadata update failed", metadataError);
  }

  return Response.json({ role: rpcArguments.requested_role });
}
