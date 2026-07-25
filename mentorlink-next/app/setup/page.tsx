"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getDashboardPath } from "../../lib/auth-routing";
import { persistAccountRole } from "../../lib/account-role-client";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<
    "mentor" | "parent_guardian" | null
  >(null);
  const [error, setError] = useState("");

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

  async function chooseRole(role: "mentor" | "parent_guardian") {
    setSavingRole(role);
    setError("");

    try {
      const destination = await persistAccountRole(
        role,
        role === "mentor",
      );
      router.replace(destination);
    } catch (selectionError) {
      console.error("Account role selection failed", selectionError);
      setError(
        selectionError instanceof Error &&
          selectionError.message === "AUTH_REQUIRED"
          ? "החיבור לחשבון פג. יש להתחבר מחדש."
          : "לא ניתן לשמור את סוג החשבון. נסו שוב.",
      );
      setSavingRole(null);
    }
  }

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
        {!loading && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={savingRole !== null}
              onClick={() => void chooseRole("mentor")}
              className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              {savingRole === "mentor" ? "שומר..." : "אני רוצה להיות חונך/ת"}
            </button>
            <button
              type="button"
              disabled={savingRole !== null}
              onClick={() => void chooseRole("parent_guardian")}
              className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 disabled:opacity-60"
            >
              {savingRole === "parent_guardian"
                ? "שומר..."
                : "אני הורה שמחפש חונך"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
