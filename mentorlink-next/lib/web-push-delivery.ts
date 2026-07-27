import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export type SafePushPayload = {
  type: string;
  title: string;
  body: string;
  href: string;
};

function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    console.error("Web Push configuration is invalid");
    return false;
  }
}

export function safePushPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function sendPushToUser(
  client: SupabaseClient,
  userId: string,
  payload: SafePushPayload,
) {
  if (!configurePush()) return;
  const subscriptions = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key")
    .eq("user_id", userId)
    .is("disabled_at", null);
  if (subscriptions.error) {
    console.error("Push subscription lookup failed");
    return;
  }
  const safePayload = JSON.stringify({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    href: safePushPath(payload.href),
  });
  await Promise.all((subscriptions.data ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
      }, safePayload, { TTL: 300, urgency: "high" });
      await client.from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", subscription.id).eq("user_id", userId);
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if ([404, 410].includes(statusCode)) {
        await client.from("push_subscriptions")
          .delete().eq("id", subscription.id).eq("user_id", userId);
      } else {
        console.error("Push delivery failed");
      }
    }
  }));
}

export async function sendPushToSubscription(
  client: SupabaseClient,
  userId: string,
  endpoint: string,
  payload: SafePushPayload,
) {
  if (!configurePush()) return { ok: false, reason: "not_configured" as const };
  const result = await client.from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, last_tested_at")
    .eq("user_id", userId).eq("endpoint", endpoint).is("disabled_at", null)
    .maybeSingle();
  if (result.error || !result.data) return { ok: false, reason: "not_found" as const };
  const lastTested = result.data.last_tested_at
    ? new Date(result.data.last_tested_at).getTime()
    : 0;
  if (Date.now() - lastTested < 60_000) {
    return { ok: false, reason: "rate_limited" as const };
  }
  try {
    await webpush.sendNotification({
      endpoint: result.data.endpoint,
      keys: { p256dh: result.data.p256dh_key, auth: result.data.auth_key },
    }, JSON.stringify({ ...payload, href: safePushPath(payload.href) }), {
      TTL: 60,
      urgency: "high",
    });
    await client.from("push_subscriptions").update({
      last_tested_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    }).eq("id", result.data.id).eq("user_id", userId);
    return { ok: true as const };
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number(error.statusCode)
      : 0;
    if ([404, 410].includes(statusCode)) {
      await client.from("push_subscriptions")
        .delete().eq("id", result.data.id).eq("user_id", userId);
      return { ok: false, reason: "expired" as const };
    }
    console.error("Test push delivery failed");
    return { ok: false, reason: "failed" as const };
  }
}
