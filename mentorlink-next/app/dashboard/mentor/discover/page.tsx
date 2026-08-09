import PublicMentorDirectory from "@/app/_components/PublicMentorDirectory";
import SubjectDiscovery from "@/app/_components/SubjectDiscovery";
import { getPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";

export default async function MentorDiscoverPage() {
  let mentors: PublicMentor[] = [];
  try {
    mentors = await getPublishedMentors();
  } catch {
    console.error("Unable to load the mentor discovery directory.");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-3xl font-black">חיפוש חונכים ופעילויות בסביבה</h1>
      <p className="mt-2 font-medium text-slate-700">אפשר לקבל רעיונות לפי תחום ולעיין בפרופילים ובפעילויות של חונכים אחרים.</p>
      <SubjectDiscovery targetPath="/dashboard/mentor/discover" />
      <div id="mentor-search" className="mt-7 scroll-mt-24">
        <PublicMentorDirectory mentors={mentors} expandableFilters interactionMode="read-only" />
      </div>
    </div>
  );
}
