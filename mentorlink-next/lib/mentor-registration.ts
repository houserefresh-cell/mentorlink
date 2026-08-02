import { getAgeFromBirthDate } from "./mentor-age.ts";

export const MIN_MENTOR_REGISTRATION_AGE = 10;

export type MentorRegistrationStage =
  | "blocked_age"
  | "awaiting_email"
  | "incomplete"
  | "awaiting_parent_request"
  | "awaiting_parent_consent"
  | "ready_for_review"
  | "pending_review"
  | "active"
  | "inactive";

export function classifyMentorRegistration(input: {
  birthDate: string | null;
  emailConfirmed: boolean;
  profileComplete: boolean;
  parentConsentStatus: string | null;
  publicationStatus: string | null;
}): MentorRegistrationStage {
  const age = input.birthDate ? getAgeFromBirthDate(input.birthDate) : null;
  if (age !== null && age < MIN_MENTOR_REGISTRATION_AGE) return "blocked_age";
  if (!input.emailConfirmed) return "awaiting_email";
  if (!input.profileComplete || age === null) return "incomplete";
  if (age < 18 && !input.parentConsentStatus) return "awaiting_parent_request";
  if (age < 18 && input.parentConsentStatus !== "approved") return "awaiting_parent_consent";
  if (!input.publicationStatus || input.publicationStatus === "draft") return "ready_for_review";
  if (input.publicationStatus === "pending_review") return "pending_review";
  if (["approved", "published"].includes(input.publicationStatus)) return "active";
  return "inactive";
}

export const MENTOR_REGISTRATION_STAGE_LABELS: Record<MentorRegistrationStage, string> = {
  blocked_age: "נחסם עקב גיל",
  awaiting_email: "ממתין לאימות מייל",
  incomplete: "ממתין להשלמת פרטים",
  awaiting_parent_request: "ממתין לשליחת אישור הורה",
  awaiting_parent_consent: "ממתין לאישור הורה",
  ready_for_review: "מוכן לשליחה לבדיקת מנהל",
  pending_review: "מוכן לבדיקת מנהל",
  active: "חונך פעיל",
  inactive: "חשבון לא פעיל",
};
