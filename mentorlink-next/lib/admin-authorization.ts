import "server-only";

import { createSupabaseServerAuth } from "./supabase-server-auth";
import {
  getBearerToken,
  isConfiguredAdministrator,
  type AdminIdentity,
} from "./admin-authorization-core";

export class AdminAuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 500,
  ) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export async function authorizeAdministrator(
  authorizationHeader: string | null,
): Promise<AdminIdentity> {
  const token = getBearerToken(authorizationHeader);
  if (!token) {
    throw new AdminAuthorizationError("Authentication required", 401);
  }

  const configuredEmail = process.env.MENTORLINK_ADMIN_EMAIL;
  if (!configuredEmail?.trim()) {
    console.error("MENTORLINK_ADMIN_EMAIL is not configured");
    throw new AdminAuthorizationError("Administrator access is unavailable", 500);
  }

  const { data, error } = await createSupabaseServerAuth().auth.getUser(token);
  if (error || !data.user) {
    throw new AdminAuthorizationError("Authentication required", 401);
  }
  if (
    !data.user.email_confirmed_at ||
    !isConfiguredAdministrator(data.user.email, configuredEmail)
  ) {
    throw new AdminAuthorizationError("Administrator access required", 403);
  }

  return { id: data.user.id, email: data.user.email! };
}
