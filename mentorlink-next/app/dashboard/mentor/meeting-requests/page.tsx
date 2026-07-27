import MeetingRequestsPanel from "../../_components/MeetingRequestsPanel";
import { MentorPageShell } from "../_components/MentorPageShell";

export default function MentorMeetingRequestsPage() {
  return <MentorPageShell title="בקשות לפגישה" description="אישור, דחייה או הצעת מועד חלופי לבקשות שהתקבלו."><MeetingRequestsPanel role="mentor" /></MentorPageShell>;
}
