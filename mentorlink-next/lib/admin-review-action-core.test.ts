import test from "node:test";
import assert from "node:assert/strict";
import {
  isPendingQueueStatus,
  parseReviewCommand,
  reviewMentorApplication,
  ReviewInputError,
  type ReviewApplication,
  type ReviewRepository,
  type ReviewUpdate,
} from "./admin-review-action-core.ts";

const NOW = new Date("2026-07-26T12:00:00.000Z");

function repository(
  application: ReviewApplication | null,
  updateSucceeds = true,
) {
  const updates: ReviewUpdate[] = [];
  const value: ReviewRepository = {
    async getApplication() {
      return application;
    },
    async updatePending(_userId, update) {
      updates.push(update);
      return updateSucceeds;
    },
  };
  return { value, updates };
}

test("administrator can approve a pending adult mentor", async () => {
  const repo = repository({
    status: "pending_review",
    age: 26,
    parentConsentStatus: null,
  });
  const result = await reviewMentorApplication(
    {
      userId: "mentor",
      reviewerId: "administrator",
      command: { action: "approve" },
    },
    repo.value,
    NOW,
  );
  assert.deepEqual(result, {
    outcome: "reviewed",
    status: "approved",
    reviewedAt: NOW.toISOString(),
  });
  assert.deepEqual(repo.updates, [
    {
      status: "approved",
      reviewed_at: NOW.toISOString(),
      reviewed_by: "administrator",
      rejection_reason: null,
      updated_at: NOW.toISOString(),
    },
  ]);
});

test("administrator can approve a minor with approved parent consent", async () => {
  const repo = repository({
    status: "pending_review",
    age: 16,
    parentConsentStatus: "approved",
  });
  const result = await reviewMentorApplication(
    {
      userId: "minor",
      reviewerId: "administrator",
      command: { action: "approve" },
    },
    repo.value,
    NOW,
  );
  assert.equal(result.outcome, "reviewed");
  assert.equal(repo.updates[0]?.status, "approved");
});

test("administrator cannot approve a minor without approved consent", async () => {
  const repo = repository({
    status: "pending_review",
    age: 16,
    parentConsentStatus: "sent",
  });
  const result = await reviewMentorApplication(
    {
      userId: "minor",
      reviewerId: "administrator",
      command: { action: "approve" },
    },
    repo.value,
    NOW,
  );
  assert.equal(result.outcome, "approval_blocked");
  assert.match(
    result.outcome === "approval_blocked" ? result.message : "",
    /parent consent/i,
  );
  assert.equal(repo.updates.length, 0);
});

test("administrator can reject with a trimmed valid reason", async () => {
  const command = parseReviewCommand({
    action: "reject",
    reason: "  Profile information could not be verified.  ",
  });
  const repo = repository({
    status: "pending_review",
    age: 16,
    parentConsentStatus: null,
  });
  const result = await reviewMentorApplication(
    { userId: "mentor", reviewerId: "administrator", command },
    repo.value,
    NOW,
  );
  assert.equal(result.outcome, "reviewed");
  assert.equal(
    repo.updates[0]?.rejection_reason,
    "Profile information could not be verified.",
  );
});

test("rejection without a meaningful reason is rejected", () => {
  assert.throws(
    () => parseReviewCommand({ action: "reject", reason: "  " }),
    ReviewInputError,
  );
});

test("invalid action is rejected", () => {
  assert.throws(
    () => parseReviewCommand({ action: "publish" }),
    ReviewInputError,
  );
});

test("already reviewed mentor returns conflict without an update", async () => {
  const repo = repository({
    status: "approved",
    age: 26,
    parentConsentStatus: null,
  });
  const result = await reviewMentorApplication(
    {
      userId: "mentor",
      reviewerId: "administrator",
      command: { action: "approve" },
    },
    repo.value,
    NOW,
  );
  assert.deepEqual(result, { outcome: "conflict" });
  assert.equal(repo.updates.length, 0);
});

test("conditional update race returns conflict", async () => {
  const repo = repository(
    {
      status: "pending_review",
      age: 26,
      parentConsentStatus: null,
    },
    false,
  );
  const result = await reviewMentorApplication(
    {
      userId: "mentor",
      reviewerId: "administrator",
      command: { action: "approve" },
    },
    repo.value,
    NOW,
  );
  assert.deepEqual(result, { outcome: "conflict" });
});

test("pending queue accepts only pending_review status", () => {
  assert.equal(isPendingQueueStatus("pending_review"), true);
  assert.equal(isPendingQueueStatus("approved"), false);
  assert.equal(isPendingQueueStatus("rejected"), false);
  assert.equal(isPendingQueueStatus("published"), false);
});
