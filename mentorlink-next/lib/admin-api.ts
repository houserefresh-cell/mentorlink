import "server-only";

import { NextResponse } from "next/server";
import { AdminAuthorizationError } from "./admin-authorization";

export function adminApiError(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("Administrator review request failed", error);
  return NextResponse.json(
    { error: "Unable to load administrator review data" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function adminApiSuccess(data: unknown) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
