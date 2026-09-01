import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function sendPasswordRecoveryLink(client: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mentorlink.co.il").replace(/\/$/, "");
  const generated = await client.auth.admin.generateLink({
    type: "recovery",
    email: normalized,
    options: { redirectTo: `${siteUrl}/auth/callback?flow=password_recovery` },
  });
  if (generated.error || !generated.data.properties?.action_link) {
    throw generated.error ?? new Error("Unable to create password recovery link");
  }
  await sendRecoveryEmail(normalized, generated.data.properties.action_link);
}

async function sendRecoveryEmail(to: string, actionLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Password recovery email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "איפוס סיסמה ב־MentorLink",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>איפוס סיסמה</h1><p>התקבלה בקשה לבחור סיסמה חדשה לחשבון MentorLink.</p><p><a href="${escapeAttribute(actionLink)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">בחירת סיסמה חדשה</a></p><p style="color:#64748b">אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error("Unable to send password recovery email");
}

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
