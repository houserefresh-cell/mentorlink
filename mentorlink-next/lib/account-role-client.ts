import { supabase } from "./supabase";
import {
  getRoleSelectionDestination,
  type AccountRole,
} from "./auth-routing-logic";

export async function persistAccountRole(
  role: AccountRole,
  ownerType: "mentor" | "parent_guardian" = "mentor",
) {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch("/api/account-role", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role, ownerType }),
  });
  const result = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(result.error || "ROLE_ASSIGNMENT_FAILED");
  }

  return getRoleSelectionDestination(role);
}
