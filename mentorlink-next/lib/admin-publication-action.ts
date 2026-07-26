import "server-only";

import type { AdminReviewDataClient } from "./admin-mentor-data";
import { getAgeFromBirthDate } from "./mentor-age";
import {
  updateMentorPublication,
  type PublicationCommand,
  type PublicationRepository,
} from "./admin-publication-action-core";

function repository(admin: AdminReviewDataClient): PublicationRepository {
  return {
    async getApplication(userId) {
      const [publication, profile, consent] = await Promise.all([
        admin.from("mentor_publication").select("status").eq("user_id", userId).maybeSingle(),
        admin.from("mentor_profiles").select("birth_date").eq("user_id", userId).maybeSingle(),
        admin.from("mentor_parent_consents").select("status").eq("user_id", userId).maybeSingle(),
      ]);
      const failure = [publication, profile, consent].find((result) => result.error);
      if (failure?.error) throw new Error("Unable to load mentor publication state");
      if (!publication.data) return null;
      return {
        status: publication.data.status,
        age: profile.data?.birth_date ? getAgeFromBirthDate(profile.data.birth_date) : null,
        parentConsentStatus: consent.data?.status ?? null,
      };
    },
    async updateStatus(userId, expectedStatus, update) {
      const result = await admin
        .from("mentor_publication")
        .update(update)
        .eq("user_id", userId)
        .eq("status", expectedStatus)
        .select("status")
        .maybeSingle();
      if (result.error) throw new Error("Unable to update mentor publication");
      return Boolean(result.data);
    },
  };
}

export function updateMentorPublicationWithAdminClient({
  admin,
  userId,
  administratorId,
  command,
}: {
  admin: AdminReviewDataClient;
  userId: string;
  administratorId: string;
  command: PublicationCommand;
}) {
  return updateMentorPublication(
    { userId, administratorId, command },
    repository(admin),
  );
}
