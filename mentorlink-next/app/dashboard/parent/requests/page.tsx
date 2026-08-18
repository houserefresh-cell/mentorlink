import MeetingRequestsPanel from "../../_components/MeetingRequestsPanel";

export default function ParentRequestsPage() {
  return <div className="mx-auto max-w-5xl" dir="rtl">
    <h1 className="text-3xl font-black">הפגישות שלי</h1>
    <p className="mt-2 text-slate-600">כל בקשות הפגישה והפגישות שאושרו, מסודרות לפי ילד ומצב.</p>
    <MeetingRequestsPanel role="parent" />
  </div>;
}
