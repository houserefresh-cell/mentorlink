export const MAX_REJECTION_REASON_LENGTH = 1000;
export const MIN_REJECTION_REASON_LENGTH = 3;

export type ReviewCommand =
  | { action: "approve" }
  | { action: "reject"; reason: string };

export type ReviewApplication = {
  status: string;
  age: number | null;
  parentConsentStatus: string | null;
};

export type ReviewUpdate = {
  status: "approved" | "rejected";
  reviewed_at: string;
  reviewed_by: string;
  rejection_reason: string | null;
  updated_at: string;
};

export type ReviewRepository = {
  getApplication(userId: string): Promise<ReviewApplication | null>;
  updatePending(
    userId: string,
    update: ReviewUpdate,
  ): Promise<boolean>;
};

export type ReviewResult =
  | { outcome: "reviewed"; status: "approved" | "rejected"; reviewedAt: string }
  | { outcome: "not_found" }
  | { outcome: "conflict" }
  | { outcome: "approval_blocked"; message: string };

export class ReviewInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewInputError";
  }
}

export function isPendingQueueStatus(status: string) {
  return status === "pending_review";
}

export function parseReviewCommand(value: unknown): ReviewCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReviewInputError("A review action is required");
  }

  const candidate = value as { action?: unknown; reason?: unknown };
  if (candidate.action === "approve") {
    return { action: "approve" };
  }
  if (candidate.action !== "reject") {
    throw new ReviewInputError("Action must be approve or reject");
  }
  if (typeof candidate.reason !== "string") {
    throw new ReviewInputError("A rejection reason is required");
  }

  const reason = candidate.reason.trim();
  if (reason.length < MIN_REJECTION_REASON_LENGTH) {
    throw new ReviewInputError(
      `Rejection reason must be at least ${MIN_REJECTION_REASON_LENGTH} characters`,
    );
  }
  if (reason.length > MAX_REJECTION_REASON_LENGTH) {
    throw new ReviewInputError(
      `Rejection reason must be at most ${MAX_REJECTION_REASON_LENGTH} characters`,
    );
  }
  return { action: "reject", reason };
}

export async function reviewMentorApplication(
  {
    userId,
    reviewerId,
    command,
  }: {
    userId: string;
    reviewerId: string;
    command: ReviewCommand;
  },
  repository: ReviewRepository,
  now = new Date(),
): Promise<ReviewResult> {
  const application = await repository.getApplication(userId);
  if (!application) return { outcome: "not_found" };
  if (application.status !== "pending_review") return { outcome: "conflict" };

  if (command.action === "approve") {
    if (application.age === null) {
      return {
        outcome: "approval_blocked",
        message: "A valid mentor birth date is required before approval",
      };
    }
    if (application.age < 18 && application.parentConsentStatus !== "approved") {
      return {
        outcome: "approval_blocked",
        message: "Approved parent consent is required for a minor mentor",
      };
    }
  }

  const reviewedAt = now.toISOString();
  const status = command.action === "approve" ? "approved" : "rejected";
  const updated = await repository.updatePending(userId, {
    status,
    reviewed_at: reviewedAt,
    reviewed_by: reviewerId,
    rejection_reason: command.action === "reject" ? command.reason : null,
    updated_at: reviewedAt,
  });
  if (!updated) return { outcome: "conflict" };
  return { outcome: "reviewed", status, reviewedAt };
}
