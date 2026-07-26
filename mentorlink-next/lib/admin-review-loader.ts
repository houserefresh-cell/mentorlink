import type { AdminIdentity } from "./admin-authorization-core";

export async function loadAuthorizedAdminReview<TClient, TResult>(
  authorizationHeader: string | null,
  authorize: (header: string | null) => Promise<AdminIdentity>,
  createServiceRoleClient: () => TClient,
  load: (administrator: AdminIdentity, client: TClient) => Promise<TResult>,
) {
  const administrator = await authorize(authorizationHeader);
  const serviceRoleClient = createServiceRoleClient();
  return load(administrator, serviceRoleClient);
}
