import { MentorActivityForm } from "../../_components/MentorActivityForm";

export default async function EditMentorActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  return <MentorActivityForm activityId={activityId} />;
}
