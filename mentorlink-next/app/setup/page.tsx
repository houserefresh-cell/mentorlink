"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getDashboardPath } from "../../lib/auth-routing";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function redirectToKnownDashboard() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }

      const dashboardPath = await getDashboardPath(data.user.id);
      if (dashboardPath !== "/setup") {
        router.replace(dashboardPath);
        return;
      }

      setLoading(false);
    }

    void redirectToKnownDashboard();
  }, [router]);

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">שלב ראשוני</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900">אנחנו מכינים את החשבון שלך</h1>
        <p className="mt-4 text-slate-600">
          נדרשת סיווג ראשוני של סוג החשבון כדי להוביל אותך אל הדשבורד המתאים.
        </p>
        {loading ? (
          <p className="mt-6 font-bold text-slate-700">מכין את הכיוון המתאים…</p>
        ) : null}
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">
            חזרה להתחברות
          </Link>
          <Link href="/register" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">
            בחירת סוג חשבון
          </Link>
        </div>
      </div>
    </main>
  );
}
