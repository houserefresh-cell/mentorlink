import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createMeetingNotification, sendMeetingEmail } from "./meeting-notifications";
import { sendPushToUser } from "./web-push-delivery";

export async function deliverInquiryUpdate(
  client: SupabaseClient,
  input: {
    userId: string;
    email: string | null;
    kind: "mentor_inquiry_created" | "mentor_inquiry_responded" | "mentor_inquiry_closed" | "mentor_inquiry_cancelled";
    title: string;
    body: string;
    href: string;
  },
) {
  await createMeetingNotification(client, input);
  await sendMeetingEmail({
    to: input.email,
    subject: input.title,
    heading: input.title,
    body: input.body,
    href: input.href,
  });
  await sendPushToUser(client, input.userId, {
    type: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
  });
}
