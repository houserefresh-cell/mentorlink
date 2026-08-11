import { MentorActivityForm } from "../../_components/MentorActivityForm";

export default async function EditMentorActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ needsNewDate?: string }>;
}) {
  const { activityId } = await params;
  const query = await searchParams;
  return <MentorActivityForm activityId={activityId} needsNewDate={query.needsNewDate === "1"} />;
}
