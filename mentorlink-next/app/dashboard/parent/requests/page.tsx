"use client";

import { useState } from "react";
import MeetingRequestsPanel from "../../_components/MeetingRequestsPanel";
import MentorInquiriesPanel from "../../_components/MentorInquiriesPanel";

export default function ParentRequestsPage() {
  const [view, setView] = useState<"meetings" | "inquiries">("meetings");
  return <div className="mx-auto max-w-5xl" dir="rtl">
    <h1 className="text-3xl font-black">הבקשות והפגישות שלי</h1>
    <p className="mt-2 text-slate-600">בקשות לפגישה ופניות כלליות מופרדות כדי שיהיה קל למצוא כל שיחה.</p>
    <nav className="mt-6 flex gap-2 rounded-2xl border bg-white p-2" aria-label="סוג הבקשות">
      <button onClick={() => setView("meetings")} className={`flex-1 rounded-xl px-4 py-3 font-black ${view === "meetings" ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-blue-50"}`}>בקשות ופגישות</button>
      <button onClick={() => setView("inquiries")} className={`flex-1 rounded-xl px-4 py-3 font-black ${view === "inquiries" ? "bg-violet-700 text-white" : "text-slate-700 hover:bg-violet-50"}`}>פניות לחונכים</button>
    </nav>
    {view === "meetings" ? <MeetingRequestsPanel role="parent" /> : <MentorInquiriesPanel role="parent" />}
  </div>;
}
