import type { PublicMentor } from "./public-mentor-core";

export const ALL_CITIES = "הכול";
export const ALL_OPTIONS = "הכול";

export function normalizeMentorSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("he");
}

export function filterPublicMentors(
  mentors: PublicMentor[],
  search: string,
  city: string,
  subject = ALL_OPTIONS,
  meetingMode = ALL_OPTIONS,
) {
  const query = normalizeMentorSearch(search);
  return mentors.filter((mentor) => {
    const searchable = [mentor.displayName, mentor.city, ...mentor.subjects, ...mentor.experience]
      .filter(Boolean)
      .map((value) => normalizeMentorSearch(String(value)))
      .join(" ");
    return (
      (!query || searchable.includes(query)) &&
      (city === ALL_CITIES || mentor.city === city) &&
      (subject === ALL_OPTIONS || mentor.subjects.includes(subject)) &&
      (meetingMode === ALL_OPTIONS || mentor.meetingModes.includes(meetingMode))
    );
  });
}