import { MIN_MENTOR_REGISTRATION_AGE } from "./mentor-registration.ts";

export type PublicationAction = "publish" | "pause" | "republish";
export type PublicationCommand = { action: PublicationAction };
export type PublicationApplication = {
  status: string;
  age: number | null;
  parentConsentStatus: string | null;
};
export type PublicationUpdate = {
  status: "published" | "paused";
  updated_at: string;
  published_at?: string;
  published_by?: string;
};
export type PublicationRepository = {
  getApplication(userId: string): Promise<PublicationApplication | null>;
  updateStatus(
    userId: string,
    expectedStatus: string,
    update: PublicationUpdate,
  ): Promise<boolean>;
};
export type PublicationResult =
  | { outcome: "updated"; status: "published" | "paused"; publishedAt: string | null }
  | { outcome: "not_found" }
  | { outcome: "conflict" }
  | { outcome: "publication_blocked"; message: string };

export class PublicationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationInputError";
  }
}

export function parsePublicationCommand(value: unknown): PublicationCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PublicationInputError("A publication action is required");
  }
  const action = (value as { action?: unknown }).action;
  if (action !== "publish" && action !== "pause" && action !== "republish") {
    throw new PublicationInputError("Action must be publish, pause, or republish");
  }
  return { action };
}

const transition = {
  publish: { from: "approved", to: "published" },
  pause: { from: "published", to: "paused" },
  republish: { from: "paused", to: "published" },
} as const;

export async function updateMentorPublication(
  {
    userId,
    administratorId,
    command,
  }: {
    userId: string;
    administratorId: string;
    command: PublicationCommand;
  },
  repository: PublicationRepository,
  now = new Date(),
): Promise<PublicationResult> {
  const application = await repository.getApplication(userId);
  if (!application) return { outcome: "not_found" };
  const expected = transition[command.action];
  if (application.status !== expected.from) return { outcome: "conflict" };

  if (command.action !== "pause") {
    if (application.age === null) {
      return {
        outcome: "publication_blocked",
        message: "A valid mentor birth date is required before publication",
      };
    }
    if (application.age < MIN_MENTOR_REGISTRATION_AGE) {
      return { outcome: "publication_blocked", message: `Mentor must be at least ${MIN_MENTOR_REGISTRATION_AGE} years old` };
    }
    if (application.age < 18 && application.parentConsentStatus !== "approved") {
      return {
        outcome: "publication_blocked",
        message: "Approved parent consent is required to publish a minor mentor",
      };
    }
  }

  const changedAt = now.toISOString();
  const update: PublicationUpdate =
    command.action === "pause"
      ? { status: "paused", updated_at: changedAt }
      : {
          status: "published",
          published_at: changedAt,
          published_by: administratorId,
          updated_at: changedAt,
        };
  const updated = await repository.updateStatus(userId, expected.from, update);
  if (!updated) return { outcome: "conflict" };
  return {
    outcome: "updated",
    status: update.status,
    publishedAt: update.published_at ?? null,
  };
}
