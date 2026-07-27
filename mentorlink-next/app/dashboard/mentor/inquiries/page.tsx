import MentorInquiriesPanel from "../../_components/MentorInquiriesPanel";
import { MentorPageShell } from "../_components/MentorPageShell";

export default function MentorInquiriesPage() {
  return <MentorPageShell title="פניות מהורים" description="פניות כלליות נפרדות מבקשות לפגישה."><MentorInquiriesPanel role="mentor" /></MentorPageShell>;
}
