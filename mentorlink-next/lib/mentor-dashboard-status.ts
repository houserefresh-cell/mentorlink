export type MentorMeetingSummary = {
  status: string;
  confirmed_start_at?: string | null;
  proposed_start_at?: string | null;
  created_at?: string;
};

export type MentorInquirySummary = { status: string };

export function requiresMentorAction(meeting: MentorMeetingSummary) {
  return meeting.status === "pending";
}

export function waitsForParentAction(meeting: MentorMeetingSummary) {
  return meeting.status === "alternative_proposed" ||
    (meeting.status === "accepted" && Boolean(meeting.proposed_start_at));
}

export function isUpcomingApprovedMeeting(
  meeting: MentorMeetingSummary,
  now = Date.now(),
) {
  if (meeting.status !== "accepted" || !meeting.confirmed_start_at) return false;
  const confirmedStart = new Date(meeting.confirmed_start_at).getTime();
  return Number.isFinite(confirmedStart) && confirmedStart >= now;
}

export function isActiveGeneralInquiry(inquiry: MentorInquirySummary) {
  return inquiry.status === "pending" || inquiry.status === "responded";
}

export function newestFirst<T extends { created_at?: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.created_at ?? 0).getTime() -
      new Date(left.created_at ?? 0).getTime(),
  );
}
