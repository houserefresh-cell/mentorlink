import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

type BeginRequestResult = {
  request_id: string;
  parent_email: string;
  parent_name: string;
  parent_relationship: string;
  mentor_name: string;
  consent_version: string;
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

  const admin = createSupabaseAdmin();
  const { data: auth, error: authError } =
    await admin.auth.getUser(accessToken);
  if (authError || !auth.user) {
    console.error("Parent consent request authentication failed", authError);
    return Response.json({ error: "יש להתחבר מחדש." }, { status: 401 });
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error: beginError } = await admin.rpc(
    "begin_parent_consent_email_request",
    {
      requested_mentor_user_id: auth.user.id,
      requested_token_hash: tokenHash,
      requested_expires_at: expiresAt,
    },
  );
  const consentRequest = (data?.[0] ?? null) as BeginRequestResult | null;

  if (beginError || !consentRequest) {
    console.error("Could not begin parent consent email request", beginError);
    const rateLimited =
      beginError?.message.includes("wait one minute") ||
      beginError?.message.includes("requests are allowed");
    return Response.json(
      {
        error: rateLimited
          ? "ניתן לשלוח בקשה אחת בדקה. נסו שוב בעוד זמן קצר."
          : "לא ניתן לשלוח את הבקשה. ודאו שכל פרטי ההורה נשמרו.",
      },
      { status: rateLimited ? 429 : 400 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin;
  const verifyUrl = `${siteUrl}/parent-consent/verify#token=${encodeURIComponent(rawToken)}`;

  try {
    await sendConsentEmail(consentRequest, verifyUrl);

    const { error: completeError } = await admin.rpc(
      "complete_parent_consent_email_delivery",
      {
        requested_mentor_user_id: auth.user.id,
        requested_request_id: consentRequest.request_id,
      },
    );
    if (completeError) {
      console.error("Could not mark parent consent email as delivered", completeError);
      throw new Error("Could not complete parent consent delivery");
    }

    return Response.json({
      message: "בקשת האישור נשלחה להורה בהצלחה.",
      retryAfterSeconds: 60,
    });
  } catch (error) {
    console.error("Parent consent email delivery failed", error);
    const { error: revokeError } = await admin.rpc(
      "revoke_parent_consent_email_request",
      {
        requested_mentor_user_id: auth.user.id,
        requested_request_id: consentRequest.request_id,
      },
    );
    if (revokeError) {
      console.error("Could not revoke failed parent consent request", revokeError);
    }
    return Response.json(
      { error: "שליחת המייל נכשלה. סטטוס האישור לא שונה." },
      { status: 502 },
    );
  }
}

async function sendConsentEmail(
  consentRequest: BeginRequestResult,
  verifyUrl: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Resend is not configured");
  }

  const mentorName = escapeHtml(consentRequest.mentor_name || "החונך");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [consentRequest.parent_email],
      subject: `בקשת אישור הורה עבור ${consentRequest.mentor_name || "חונך/ת"}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
          <h1>אישור הורה ב-MentorLink</h1>
          <p>שלום ${escapeHtml(consentRequest.parent_name)},</p>
          <p>התקבלה בקשה לאשר את השתתפות ${mentorName} כחונך/ת בפלטפורמה.</p>
          <p><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:white;border-radius:10px;text-decoration:none">לבדיקת הבקשה ולאישור או סירוב</a></p>
          <p>הקישור אישי, חד-פעמי ותקף למשך 48 שעות. אין להעבירו לאחרים.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend returned ${response.status}: ${responseText}`);
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
