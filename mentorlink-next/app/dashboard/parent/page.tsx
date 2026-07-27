"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getDashboardPath } from "../../../lib/auth-routing";
import MeetingRequestsPanel from "../_components/MeetingRequestsPanel";
import MentorInquiriesPanel from "../_components/MentorInquiriesPanel";

export default function ParentDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const dashboardPath = await getDashboardPath(data.user.id);
      if (dashboardPath !== "/dashboard/parent") {
        router.replace(dashboardPath);
        return;
      }
      setName(data.user.user_metadata?.first_name ?? "");
    }
    load();
  }, [router]);

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-extrabold text-blue-600">MentorLink</Link>
          <button type="button" onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="rounded-xl border border-slate-300 px-4 py-2 font-bold">התנתקות</button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-bold text-blue-600">האזור האישי להורים</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900">שלום {name || "הורה"}</h1>
        <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-extrabold">ברוכים הבאים ל־MentorLink</h2>
          <p className="mt-3 text-slate-600">כלי החיפוש וההתאמה להורים יתווספו בהמשך הפיילוט.</p>
        </div>
        <MentorInquiriesPanel role="parent" />
        <MeetingRequestsPanel role="parent" />
      </section>
    </main>
  );
}
