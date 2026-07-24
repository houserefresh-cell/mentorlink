import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function jsonNoStore(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
    },
  });
}

type VerifyRequestBody = {
  action?: "lookup" | "respond";
  token?: string;
  decision?: "approved" | "declined";
  detailsConfirmed?: boolean;
  participationConfirmed?: boolean;
  contactConfirmed?: boolean;
};

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonNoStore({ error: "בקשה לא תקינה." }, 403);
  }

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "בקשה לא תקינה." }, 400);
  }

  if (!body.token || body.token.length > 200) {
    return jsonNoStore({ error: "בקשה לא תקינה." }, 400);
  }

  const admin = createSupabaseAdmin();
  const tokenHash = hashToken(body.token);

  if (body.action === "lookup") {
    const { data, error } = await admin.rpc(
      "get_parent_consent_email_request",
      { requested_token_hash: tokenHash },
    );

    if (error) {
      console.error("Could not read parent consent request", error);
      return jsonNoStore({ state: "invalid" }, 400);
    }

    const result = data?.[0];
    return jsonNoStore({
      state: result?.request_state ?? "invalid",
      mentorName: result?.mentor_name ?? "",
      parentName: result?.parent_name ?? "",
      parentRelationship: result?.parent_relationship ?? "",
      consentVersion: result?.consent_version ?? "",
    });
  }

  if (
    body.action !== "respond" ||
    !["approved", "declined"].includes(body.decision ?? "")
  ) {
    return jsonNoStore({ error: "בקשה לא תקינה." }, 400);
  }

  const { data, error } = await admin.rpc(
    "respond_to_parent_consent_email_request",
    {
      requested_token_hash: tokenHash,
      requested_decision: body.decision,
      confirmed_details: body.detailsConfirmed === true,
      confirmed_participation: body.participationConfirmed === true,
      confirmed_contact: body.contactConfirmed === true,
    },
  );

  if (error) {
    console.error("Could not process parent consent response", error);
    return jsonNoStore(
      { error: "לא ניתן לטפל בבקשה. נסו שוב." },
      400,
    );
  }

  return jsonNoStore({ state: data ?? "used_or_invalid" });
}
