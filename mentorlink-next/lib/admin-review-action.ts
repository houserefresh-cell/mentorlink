import "server-only";

import type { AdminReviewDataClient } from "./admin-mentor-data";
import { getAgeFromBirthDate } from "./mentor-age";
import {
  reviewMentorApplication,
  type ReviewCommand,
  type ReviewRepository,
} from "./admin-review-action-core";

function createReviewRepository(
  admin: AdminReviewDataClient,
): ReviewRepository {
  return {
    async getApplication(userId) {
      const [publication, profile, consent] = await Promise.all([
        admin
          .from("mentor_publication")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle(),
        admin
          .from("mentor_profiles")
          .select("birth_date")
          .eq("user_id", userId)
          .maybeSingle(),
        admin
          .from("mentor_parent_consents")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      const failure = [publication, profile, consent].find(
        (result) => result.error,
      );
      if (failure?.error) {
        throw new Error(`Unable to load mentor review: ${failure.error.message}`);
      }
      if (!publication.data) return null;
      return {
        status: publication.data.status,
        age: profile.data?.birth_date
          ? getAgeFromBirthDate(profile.data.birth_date)
          : null,
        parentConsentStatus: consent.data?.status ?? null,
      };
    },
    async updatePending(userId, update) {
      const result = await admin
        .from("mentor_publication")
        .update(update)
        .eq("user_id", userId)
        .eq("status", "pending_review")
        .select("user_id")
        .maybeSingle();
      if (result.error) {
        throw new Error(`Unable to save mentor review: ${result.error.message}`);
      }
      return Boolean(result.data);
    },
  };
}

export async function reviewMentorWithAdminClient({
  admin,
  userId,
  reviewerId,
  command,
}: {
  admin: AdminReviewDataClient;
  userId: string;
  reviewerId: string;
  command: ReviewCommand;
}) {
  return reviewMentorApplication(
    { userId, reviewerId, command },
    createReviewRepository(admin),
  );
}
