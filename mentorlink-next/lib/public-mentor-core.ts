export type PublicMentor = {
  bookingId: string;
  displayName: string;
  city: string | null;
  age?: number | null;
  subjects: string[];
  introduction: string | null;
  experience: string[];
  ageGroups: string[];
  meetingModes: string[];
  availability: string[];
  nextAvailability?: Array<{ startAt: string; meetingMode: string; durationMinutes: number }>;
  profilePhotoUrl?: string | null;
};

export type PublishedRow = { user_id: string; status: string; public_booking_id: string };
export type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  bio: string | null;
  birth_date: string | null;
  profile_photo_path?: string | null;
};
export type SubjectRow = {
  user_id: string;
  custom_subject: string | null;
  age_groups: string[] | null;
  subjects: { name?: string | null } | Array<{ name?: string | null }> | null;
};
export type ExperienceRow = {
  user_id: string;
  experience_types: string[] | null;
  mentoring_types: string[] | null;
};
export type PreferenceRow = {
  user_id: string;
  preferred_age_groups: string[] | null;
  meeting_modes: string[] | null;
};
export type AvailabilityRow = {
  user_id: string;
  flexible_availability: boolean | null;
  available_on_holidays: boolean | null;
  time_preferences: string[] | null;
};

function publicAgeFromBirthDate(birthDate: string, now = new Date()) {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const current = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = current("year"), month = current("month"), day = current("day");
  if (!year || !month || !day) return null;
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}
function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function publicDisplayName(firstName: string | null, lastName: string | null) {
  const first = firstName?.trim() || "חונך/ת";
  const initial = Array.from(lastName?.trim() ?? "")[0];
  return initial ? `${first} ${initial}׳` : first;
}

export function mapPublishedMentors(input: {
  publications: PublishedRow[];
  profiles: ProfileRow[];
  subjects: SubjectRow[];
  experiences: ExperienceRow[];
  preferences: PreferenceRow[];
  availability: AvailabilityRow[];
}): PublicMentor[] {
  const publishedIds = new Set(
    input.publications.filter((row) => row.status === "published").map((row) => row.user_id),
  );
  return input.profiles
    .filter((profile) => publishedIds.has(profile.user_id))
    .map((profile) => {
      const subjects = input.subjects.filter((row) => row.user_id === profile.user_id);
      const experience = input.experiences.find((row) => row.user_id === profile.user_id);
      const preferences = input.preferences.find((row) => row.user_id === profile.user_id);
      const availability = input.availability.find((row) => row.user_id === profile.user_id);
      const publication = input.publications.find((row) => row.user_id === profile.user_id);
      return {
        bookingId: publication?.public_booking_id ?? "",
        displayName: publicDisplayName(profile.first_name, profile.last_name),
        city: profile.city?.trim() || null,
        age: profile.birth_date ? publicAgeFromBirthDate(profile.birth_date) : null,
        subjects: unique(subjects.map((row) => {
          const joined = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
          return row.custom_subject || joined?.name;
        })),
        introduction: profile.bio?.trim().slice(0, 400) || null,
        experience: unique([...(experience?.experience_types ?? []), ...(experience?.mentoring_types ?? [])]),
        ageGroups: unique([
          ...subjects.flatMap((row) => row.age_groups ?? []),
          ...(preferences?.preferred_age_groups ?? []),
        ]),
        meetingModes: unique(preferences?.meeting_modes ?? []),
        availability: unique([
          ...(availability?.time_preferences ?? []),
          availability?.flexible_availability ? "זמינות גמישה" : null,
          availability?.available_on_holidays ? "זמין/ה בחופשות" : null,
        ]),
      };
    });
}
