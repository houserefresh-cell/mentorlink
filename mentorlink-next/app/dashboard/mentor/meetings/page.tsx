import MeetingRequestsPanel from "../../_components/MeetingRequestsPanel";

const VIEWS = ["mentor-action", "waiting-parent", "upcoming-approved", "history"] as const;

export default async function MentorMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const selected = VIEWS.includes(view as (typeof VIEWS)[number])
    ? view as (typeof VIEWS)[number]
    : "mentor-action";
  return <div className="mx-auto max-w-5xl"><MeetingRequestsPanel role="mentor" view={selected} /></div>;
}