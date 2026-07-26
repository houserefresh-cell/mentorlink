import type { PublicMentor } from "./public-mentor-core";

export const ALL_CITIES = "כל הערים";

export function filterPublicMentors(
  mentors: PublicMentor[],
  search: string,
  city: string,
) {
  const query = search.trim().toLocaleLowerCase("he");

  return mentors.filter((mentor) => {
    const searchable = [
      mentor.displayName,
      mentor.city,
      mentor.introduction,
      ...mentor.subjects,
      ...mentor.experience,
      ...mentor.ageGroups,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("he");

    return (
      (!query || searchable.includes(query)) &&
      (city === ALL_CITIES || mentor.city === city)
    );
  });
}
