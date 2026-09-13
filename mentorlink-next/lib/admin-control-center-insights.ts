export function computeInsights(input: {
  meetings: Array<{ created_at?: string | null; status?: string | null; cancelled_at?: string | null }>;
  activities: Array<{ created_at?: string | null; published_at?: string | null; status?: string | null }>;
}) {
  const now = Date.now();
  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(currentPeriodStart.getDate() - 30);
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

  const meetingRows = input.meetings ?? [];
  const activityRows = input.activities ?? [];

  const currentMeetings = meetingRows.filter((row) => row.created_at && new Date(row.created_at).getTime() >= currentPeriodStart.getTime());
  const previousMeetings = meetingRows.filter((row) => row.created_at && new Date(row.created_at).getTime() >= previousPeriodStart.getTime() && new Date(row.created_at).getTime() < currentPeriodStart.getTime());

  const cancellationRate = meetingRows.length
    ? (meetingRows.filter((row) => row.status === "cancelled" || row.cancelled_at).length / meetingRows.length) * 100
    : 0;

  return {
    meetingVolumeDelta: currentMeetings.length - previousMeetings.length,
    cancellationRate,
    activeMentors: new Set(meetingRows.filter((row) => row.status).map((row) => row.status)).size,
    activeActivities: activityRows.filter((row) => row.status === "published").length,
    currentPeriodMeetings: currentMeetings.length,
    previousPeriodMeetings: previousMeetings.length,
    now,
  };
}
