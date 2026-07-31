import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function createMeetingNotification(
  client: SupabaseClient,
  notification: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    href: string;
  },
) {
  const { error } = await client.from("notifications").insert({
    user_id: notification.userId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    href: notification.href,
  });
  if (error) console.error("Meeting notification delivery failed");
}

export async function sendMeetingEmail(input: {
  to: string | null;
  subject: string;
  heading: string;
  body: string;
  href: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mentorlink.co.il";
  if (!apiKey || !from || !input.to) return;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: `<div dir="rtl"><h1>${escapeHtml(input.heading)}</h1><p>${escapeHtml(input.body)}</p><p><a href="${siteUrl}${input.href}">פתיחת MentorLink</a></p></div>`,
      }),
    });
    if (!response.ok) console.error("Meeting email delivery failed");
  } catch {
    console.error("Meeting email delivery failed");
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
