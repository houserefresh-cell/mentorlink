import "server-only";

import type { NextRequest } from "next/server";

export function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  if (requestOrigin !== origin) return false;

  const configuredOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    ...(process.env.ALLOWED_ORIGINS?.split(",") ?? []),
  ];
  const allowedOrigins = new Set<string>();

  for (const configuredOrigin of configuredOrigins) {
    if (!configuredOrigin?.trim()) continue;
    try {
      const parsedOrigin = new URL(configuredOrigin.trim());
      const isLocalhost =
        parsedOrigin.hostname === "localhost" ||
        parsedOrigin.hostname === "127.0.0.1";
      if (!isLocalhost || process.env.NODE_ENV === "development") {
        allowedOrigins.add(parsedOrigin.origin);
      }
    } catch {
      // Invalid configured origins are ignored and never become trusted.
    }
  }

  if (process.env.NODE_ENV === "development") {
    const currentUrl = new URL(request.url);
    if (
      currentUrl.hostname === "localhost" ||
      currentUrl.hostname === "127.0.0.1"
    ) {
      allowedOrigins.add(currentUrl.origin);
    }
  }

  return allowedOrigins.has(requestOrigin);
}
