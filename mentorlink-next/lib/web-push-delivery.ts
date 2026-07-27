import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { parsePublicVapidKey } from "./web-push-public-key";

export type SafePushPayload = {
  type: string;
  title: string;
  body: string;
  href: string;
};

type PushDiagnosticStage = "VAPID_CONFIG_INVALID" | "SUBSCRIPTION_LOOKUP" | "PROVIDER_DELIVERY" | "DELIVERY_COMPLETE";

function providerStatus(error: unknown) {
  if (typeof error !== "object" || !error || !("statusCode" in error)) return null;
  const value = Number(error.statusCode);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;
}

function diagnostic(type: string, stage: PushDiagnosticStage, subscriptions: number, successes: number, failures: number, error?: unknown) {
  const statusCode = providerStatus(error);
  const errorName = error instanceof Error ? error.name : null;
  console.info("Web Push delivery", {
    notificationType: type,
    stage,
    subscriptions,
    successes,
    failures,
    ...(statusCode ? { providerStatus: statusCode } : {}),
    ...(errorName ? { errorName } : {}),
  });
}

function configurePush(type: string) {
  const publicKey = parsePublicVapidKey(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY);
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey.ok || !privateKey || !subject) {
    diagnostic(type, "VAPID_CONFIG_INVALID", 0, 0, 1);
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey.key, privateKey);
    return true;
  } catch (error) {
    diagnostic(type, "VAPID_CONFIG_INVALID", 0, 0, 1, error);
    return false;
  }
}

export function safePushPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function deliverSubscription(subscription: { endpoint: string; p256dh_key: string; auth_key: string }, payload: string, ttl: number) {
  try {
    await webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
    }, payload, { TTL: ttl, urgency: "high" });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, statusCode: providerStatus(error), error };
  }
}

export async function sendPushToUser(client: SupabaseClient, userId: string, payload: SafePushPayload) {
  if (!configurePush(payload.type)) return;
  const subscriptions = await client.from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key")
    .eq("user_id", userId).is("disabled_at", null);
  if (subscriptions.error) {
    diagnostic(payload.type, "SUBSCRIPTION_LOOKUP", 0, 0, 1, subscriptions.error);
    return;
  }
  const rows = subscriptions.data ?? [];
  diagnostic(payload.type, "SUBSCRIPTION_LOOKUP", rows.length, 0, 0);
  const safePayload = JSON.stringify({ type: payload.type, title: payload.title, body: payload.body, href: safePushPath(payload.href) });
  const results = await Promise.all(rows.map(async (subscription) => {
    const result = await deliverSubscription(subscription, safePayload, 300);
    if (result.ok) {
      await client.from("push_subscriptions").update({ last_used_at: new Date().toISOString() })
        .eq("id", subscription.id).eq("user_id", userId);
      return true;
    }
    if ([404, 410].includes(result.statusCode ?? 0)) {
      await client.from("push_subscriptions").delete().eq("id", subscription.id).eq("user_id", userId);
    }
    diagnostic(payload.type, "PROVIDER_DELIVERY", 1, 0, 1, result.error);
    return false;
  }));
  const successes = results.filter(Boolean).length;
  diagnostic(payload.type, "DELIVERY_COMPLETE", rows.length, successes, rows.length - successes);
}

export async function sendPushToSubscription(client: SupabaseClient, userId: string, endpoint: string, payload: SafePushPayload) {
  if (!configurePush(payload.type)) return { ok: false, reason: "not_configured" as const };
  const result = await client.from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, last_tested_at")
    .eq("user_id", userId).eq("endpoint", endpoint).is("disabled_at", null).maybeSingle();
  if (result.error || !result.data) return { ok: false, reason: "not_found" as const };
  const lastTested = result.data.last_tested_at ? new Date(result.data.last_tested_at).getTime() : 0;
  if (Date.now() - lastTested < 60_000) return { ok: false, reason: "rate_limited" as const };
  const delivery = await deliverSubscription(result.data, JSON.stringify({ ...payload, href: safePushPath(payload.href) }), 60);
  if (delivery.ok) {
    await client.from("push_subscriptions").update({ last_tested_at: new Date().toISOString(), last_used_at: new Date().toISOString() })
      .eq("id", result.data.id).eq("user_id", userId);
    return { ok: true as const };
  }
  diagnostic(payload.type, "PROVIDER_DELIVERY", 1, 0, 1, delivery.error);
  if ([404, 410].includes(delivery.statusCode ?? 0)) {
    await client.from("push_subscriptions").delete().eq("id", result.data.id).eq("user_id", userId);
    return { ok: false, reason: "expired" as const };
  }
  return { ok: false, reason: "failed" as const };
}
