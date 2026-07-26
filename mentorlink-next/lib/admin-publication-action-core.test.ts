import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePublicationCommand,
  PublicationInputError,
  updateMentorPublication,
  type PublicationApplication,
  type PublicationRepository,
  type PublicationUpdate,
} from "./admin-publication-action-core.ts";

const NOW = new Date("2026-07-27T09:00:00.000Z");

function repository(application: PublicationApplication | null, succeeds = true) {
  const updates: Array<{ expected: string; update: PublicationUpdate }> = [];
  const value: PublicationRepository = {
    async getApplication() { return application; },
    async updateStatus(_userId, expected, update) {
      updates.push({ expected, update });
      return succeeds;
    },
  };
  return { value, updates };
}

test("administrator can publish an approved adult", async () => {
  const repo = repository({ status: "approved", age: 25, parentConsentStatus: null });
  const result = await updateMentorPublication(
    { userId: "mentor", administratorId: "admin", command: { action: "publish" } },
    repo.value,
    NOW,
  );
  assert.deepEqual(result, { outcome: "updated", status: "published", publishedAt: NOW.toISOString() });
  assert.deepEqual(repo.updates, [{
    expected: "approved",
    update: {
      status: "published",
      published_at: NOW.toISOString(),
      published_by: "admin",
      updated_at: NOW.toISOString(),
    },
  }]);
});

test("administrator can publish a minor with approved consent", async () => {
  const repo = repository({ status: "approved", age: 17, parentConsentStatus: "approved" });
  assert.equal((await updateMentorPublication(
    { userId: "minor", administratorId: "admin", command: { action: "publish" } },
    repo.value,
    NOW,
  )).outcome, "updated");
});

test("administrator cannot publish a minor without approved consent", async () => {
  const repo = repository({ status: "approved", age: 17, parentConsentStatus: "sent" });
  assert.equal((await updateMentorPublication(
    { userId: "minor", administratorId: "admin", command: { action: "publish" } },
    repo.value,
    NOW,
  )).outcome, "publication_blocked");
  assert.equal(repo.updates.length, 0);
});

test("administrator pauses published mentor without replacing publication metadata", async () => {
  const repo = repository({ status: "published", age: 25, parentConsentStatus: null });
  const result = await updateMentorPublication(
    { userId: "mentor", administratorId: "admin", command: { action: "pause" } },
    repo.value,
    NOW,
  );
  assert.deepEqual(result, { outcome: "updated", status: "paused", publishedAt: null });
  assert.deepEqual(repo.updates[0], {
    expected: "published",
    update: { status: "paused", updated_at: NOW.toISOString() },
  });
});

test("administrator republishes paused mentor with new metadata", async () => {
  const repo = repository({ status: "paused", age: 25, parentConsentStatus: null });
  const result = await updateMentorPublication(
    { userId: "mentor", administratorId: "new-admin", command: { action: "republish" } },
    repo.value,
    NOW,
  );
  assert.equal(result.outcome, "updated");
  assert.equal(repo.updates[0]?.expected, "paused");
  assert.equal(repo.updates[0]?.update.published_by, "new-admin");
});

for (const status of ["draft", "pending_review", "rejected", "published", "paused"]) {
  test(`publish rejects invalid transition from ${status}`, async () => {
    const repo = repository({ status, age: 25, parentConsentStatus: null });
    assert.deepEqual(await updateMentorPublication(
      { userId: "mentor", administratorId: "admin", command: { action: "publish" } },
      repo.value,
      NOW,
    ), { outcome: "conflict" });
  });
}

test("conditional publication race returns conflict", async () => {
  const repo = repository({ status: "approved", age: 25, parentConsentStatus: null }, false);
  assert.deepEqual(await updateMentorPublication(
    { userId: "mentor", administratorId: "admin", command: { action: "publish" } },
    repo.value,
    NOW,
  ), { outcome: "conflict" });
});

test("only supported publication actions parse", () => {
  assert.deepEqual(parsePublicationCommand({ action: "pause" }), { action: "pause" });
  assert.throws(() => parsePublicationCommand({ action: "approve" }), PublicationInputError);
});
