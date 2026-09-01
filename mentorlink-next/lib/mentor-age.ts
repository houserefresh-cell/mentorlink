export const ADULT_MENTOR_AGE = 18;
export const MINOR_MEETING_PRICE_OPTIONS = [0, 10, 20, 30, 40] as const;
export const MAX_MINOR_ACTIVITY_PRICE = 25;

export type MentorCapabilities = {
  age: number | null;
  isAdult: boolean;
  requiresParentConsent: boolean;
  meetingPriceOptions: readonly number[] | null;
  maxActivityPrice: number | null;
};

function israelDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function getAgeFromBirthDate(birthDate: string, now = new Date()) {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;
  const current = israelDateParts(now);
  if (!current.year || !current.month || !current.day) return null;
  let age = current.year - birthYear;
  if (
    current.month < birthMonth ||
    (current.month === birthMonth && current.day < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

export function getMentorCapabilities(
  birthDate: string | null | undefined,
  now = new Date(),
): MentorCapabilities {
  const age = birthDate ? getAgeFromBirthDate(birthDate, now) : null;
  const isAdult = age !== null && age >= ADULT_MENTOR_AGE;
  return {
    age,
    isAdult,
    requiresParentConsent: !isAdult,
    meetingPriceOptions: isAdult ? null : MINOR_MEETING_PRICE_OPTIONS,
    maxActivityPrice: isAdult ? null : MAX_MINOR_ACTIVITY_PRICE,
  };
}

export function isAllowedMentorMeetingPrice(
  value: number,
  capabilities: MentorCapabilities,
) {
  if (!Number.isFinite(value) || value < 0) return false;
  return capabilities.isAdult ||
    MINOR_MEETING_PRICE_OPTIONS.includes(value as (typeof MINOR_MEETING_PRICE_OPTIONS)[number]);
}

export function isAllowedMentorActivityPrice(
  value: number,
  capabilities: MentorCapabilities,
) {
  if (!Number.isFinite(value) || value < 0) return false;
  return capabilities.isAdult || value <= MAX_MINOR_ACTIVITY_PRICE;
}
