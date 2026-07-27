export type PublicMentor = {
  bookingId: string;
  displayName: string;
  city: string | null;
  subjects: string[];
  introduction: string | null;
  experience: string[];
  ageGroups: string[];
  meetingModes: string[];
  availability: string[];
};

export type PublishedRow = { user_id: string; status: string; public_booking_id: string };
export type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  bio: string | null;
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
