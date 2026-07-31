export const ACTIVITY_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export const ACTIVITY_FORMATS = ["one_time", "series"] as const;
export const ACTIVITY_LOCATIONS = [
  "mentor_home", "mentee_home", "school", "public_place", "sports_park",
  "community_center", "sports_complex", "online", "other",
] as const;
export const ACTIVITY_OVERRUNS = ["none", "5_10_minutes", "15_20_minutes"] as const;
export const ACTIVITY_PICKUPS = ["school", "after_school", "home", "other"] as const;
export const ACTIVITY_GRADES = [
  "grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6",
  "grade_7", "grade_8", "grade_9", "grade_10", "grade_11", "grade_12", "graduate",
] as const;

type ValidationMode = "draft" | "published";
type SessionInput = { startsAt?: unknown; endsAt?: unknown; estimatedOverrun?: unknown };

export type CleanActivitySession = {
  starts_at: string;
  ends_at: string;
  estimated_overrun: (typeof ACTIVITY_OVERRUNS)[number];
};

export type CleanActivity = {
  subject_id: number | null;
  title: string | null;
  description: string | null;
  format: (typeof ACTIVITY_FORMATS)[number] | null;
  location_type: (typeof ACTIVITY_LOCATIONS)[number] | null;
  venue_name: string | null;
  address: string | null;
  location_details: string | null;
  min_participants: number | null;
  max_participants: number | null;
  minimum_age: number | null;
  maximum_age: number | null;
  suitable_grades: string[];
  is_free: boolean;
  price: number;
  registration_deadline: string | null;
  equipment: string | null;
  accessibility: string | null;
  cancellation_policy: string | null;
  pickup_options: string[];
  pickup_details: string | null;
};

export type ActivityValidationResult =
  | { ok: true; activity: CleanActivity; sessions: CleanActivitySession[] }
  | { ok: false; code: string; error: string };

function text(value: unknown, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maximum ? cleaned : undefined;
}

function nullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

function choice<T extends readonly string[]>(value: unknown, allowed: T) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : undefined;
}

function choices(value: unknown, allowed: readonly string[]) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const cleaned = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  return cleaned.every((item) => allowed.includes(item)) ? cleaned : null;
}

function instant(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function validateActivityInput(
  payload: Record<string, unknown>,
  mode: ValidationMode,
  now = new Date(),
): ActivityValidationResult {
  const subjectId = nullableInteger(payload.subjectId);
  const title = text(payload.title, 120);
  const description = text(payload.description, 4000);
  const format = choice(payload.format, ACTIVITY_FORMATS);
  const locationType = choice(payload.locationType, ACTIVITY_LOCATIONS);
  const venueName = text(payload.venueName, 160);
  const address = text(payload.address, 300);
  const locationDetails = text(payload.locationDetails, 1000);
  const minimumParticipants = nullableInteger(payload.minParticipants);
  const maximumParticipants = nullableInteger(payload.maxParticipants);
  const minimumAge = nullableInteger(payload.minimumAge);
  const maximumAge = nullableInteger(payload.maximumAge);
  const grades = choices(payload.suitableGrades, ACTIVITY_GRADES);
  const isFree = payload.isFree === undefined ? true : payload.isFree;
  const price = payload.price === undefined || payload.price === "" ? 0 : Number(payload.price);
  const deadline = instant(payload.registrationDeadline);
  const equipment = text(payload.equipment, 2000);
  const accessibility = text(payload.accessibility, 2000);
  const cancellationPolicy = text(payload.cancellationPolicy, 2000);
  const pickups = choices(payload.pickupOptions, ACTIVITY_PICKUPS);
  const pickupDetails = text(payload.pickupDetails, 500);

  if (
    subjectId === undefined || title === undefined || description === undefined || format === undefined ||
    locationType === undefined || venueName === undefined || address === undefined ||
    locationDetails === undefined || minimumParticipants === undefined || maximumParticipants === undefined ||
    minimumAge === undefined || maximumAge === undefined || grades === null ||
    typeof isFree !== "boolean" || !Number.isFinite(price) || deadline === undefined ||
    equipment === undefined || accessibility === undefined || cancellationPolicy === undefined ||
    pickups === null || pickupDetails === undefined
  ) return invalid("INVALID_ACTIVITY", "Activity fields are invalid");

  if (title !== null && title.length < 3) return invalid("INVALID_TITLE", "Title is too short");
  if (description !== null && description.length < 10) return invalid("INVALID_DESCRIPTION", "Description is too short");
  if (subjectId !== null && subjectId <= 0) return invalid("INVALID_SUBJECT", "Subject is invalid");
  if (minimumParticipants !== null && minimumParticipants < 1) return invalid("INVALID_CAPACITY", "Capacity is invalid");
  if (maximumParticipants !== null && (maximumParticipants < 1 || maximumParticipants > 500)) return invalid("INVALID_CAPACITY", "Capacity is invalid");
  if (minimumParticipants !== null && maximumParticipants !== null && maximumParticipants < minimumParticipants) return invalid("INVALID_CAPACITY", "Capacity is invalid");
  if (minimumAge !== null && (minimumAge < 3 || minimumAge > 120)) return invalid("INVALID_AUDIENCE", "Minimum age is invalid");
  if (maximumAge !== null && (maximumAge < 3 || maximumAge > 120 || (minimumAge !== null && maximumAge < minimumAge))) return invalid("INVALID_AUDIENCE", "Maximum age is invalid");
  if ((isFree && price !== 0) || (!isFree && price <= 0) || price > 99_999_999.99) return invalid("INVALID_PRICE", "Price is invalid");
  if (locationType === "online" && address !== null) return invalid("INVALID_LOCATION", "Online activity cannot have an address");
  if (pickupDetails !== null && !pickups.includes("other")) return invalid("INVALID_PICKUP", "Pickup details require the other option");
  if (pickups.includes("other") && pickupDetails === null) return invalid("INVALID_PICKUP", "Other pickup requires details");

  const sessionsInput = Array.isArray(payload.sessions) ? payload.sessions as SessionInput[] : [];
  const sessions: CleanActivitySession[] = [];
  for (const row of sessionsInput) {
    if (!row || typeof row !== "object") return invalid("INVALID_SESSION", "Session is invalid");
    const startsAt = instant(row.startsAt);
    const endsAt = instant(row.endsAt);
    const overrun = choice(row.estimatedOverrun ?? "none", ACTIVITY_OVERRUNS);
    if (!startsAt || !endsAt || !overrun || new Date(endsAt) <= new Date(startsAt)) {
      return invalid("INVALID_SESSION", "Session must end after it starts");
    }
    sessions.push({ starts_at: startsAt, ends_at: endsAt, estimated_overrun: overrun });
  }
  sessions.sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  if (new Set(sessions.map((session) => session.starts_at)).size !== sessions.length) {
    return invalid("DUPLICATE_SESSION", "Session start times must be unique");
  }

  if (mode === "published") {
    if (!subjectId || !title || !description || !format || !locationType) return invalid("PUBLISH_INCOMPLETE", "Required publication fields are missing");
    if (minimumParticipants === null || maximumParticipants === null) return invalid("PUBLISH_INCOMPLETE", "Capacity is required");
    if (minimumAge === null && maximumAge === null && !grades.length) return invalid("PUBLISH_INCOMPLETE", "Audience is required");
    if (!deadline) return invalid("PUBLISH_INCOMPLETE", "Registration deadline is required");
    if (!sessions.length || !sessions.some((session) => new Date(session.starts_at) > now)) return invalid("NO_FUTURE_SESSION", "A future session is required");
    if (new Date(deadline) >= new Date(sessions[0].starts_at)) return invalid("INVALID_DEADLINE", "Registration deadline must precede the first session");
  }

  return { ok: true, activity: {
    subject_id: subjectId, title, description, format, location_type: locationType,
    venue_name: venueName, address, location_details: locationDetails,
    min_participants: minimumParticipants, max_participants: maximumParticipants,
    minimum_age: minimumAge, maximum_age: maximumAge, suitable_grades: grades,
    is_free: isFree, price, registration_deadline: deadline, equipment,
    accessibility, cancellation_policy: cancellationPolicy, pickup_options: pickups,
    pickup_details: pickupDetails,
  }, sessions };
}

export function canTransitionActivity(from: string, to: string) {
  if (from === "draft") return to === "published";
  if (from === "published") return to === "cancelled" || to === "completed";
  return false;
}

export function periodsOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart);
}

function invalid(code: string, error: string): ActivityValidationResult {
  return { ok: false, code, error };
}
