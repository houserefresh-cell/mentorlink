import WebPushControls from "../../_components/WebPushControls";
import { MentorPageShell } from "../_components/MentorPageShell";

export default function MentorNotificationsPage() {
  return <MentorPageShell title="התראות בטלפון" description="הפעלת התראות אופציונלית לכל מכשיר."><WebPushControls /></MentorPageShell>;
}
