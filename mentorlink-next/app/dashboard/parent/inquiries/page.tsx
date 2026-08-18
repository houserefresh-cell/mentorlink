import MentorInquiriesPanel from "../../_components/MentorInquiriesPanel";

export default function ParentInquiriesPage() {
  return <div className="mx-auto max-w-5xl" dir="rtl">
    <h1 className="text-3xl font-black">פניות לחונך</h1>
    <p className="mt-2 text-slate-600">כאן נמצאות השיחות והפניות הכלליות שאינן בקשת פגישה.</p>
    <MentorInquiriesPanel role="parent" />
  </div>;
}
