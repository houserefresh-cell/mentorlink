import MeetingRequestsPanel from "../../_components/MeetingRequestsPanel";
import MentorInquiriesPanel from "../../_components/MentorInquiriesPanel";
export default function ParentRequestsPage() { return <div className="mx-auto max-w-5xl"><h1 className="text-3xl font-black">הבקשות והפגישות שלי</h1><p className="mt-2 text-slate-600">כל הבקשות הפעילות, הפגישות וההיסטוריה מרוכזות כאן.</p><MeetingRequestsPanel role="parent" /><MentorInquiriesPanel role="parent" /></div>; }
