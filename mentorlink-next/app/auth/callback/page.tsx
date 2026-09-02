"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getDashboardPath } from "../../../lib/auth-routing";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatus text="משלים את הפעולה..." />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("");
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    async function finish() {
      const flow = searchParams.get("flow");
      const tokenHash = searchParams.get("token_hash");

      if (flow === "password_recovery" && tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (error || !data.session?.user) {
          console.error("Password recovery verification failed", error);
          setErrorMessage(
            "\u05e7\u05d9\u05e9\u05d5\u05e8 \u05d4\u05d0\u05d9\u05e4\u05d5\u05e1 \u05d0\u05d9\u05e0\u05d5 \u05ea\u05e7\u05e3 \u05d0\u05d5 \u05e9\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e4\u05d5. \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d1\u05e7\u05e9 \u05e7\u05d9\u05e9\u05d5\u05e8 \u05d7\u05d3\u05e9."
          );
          return;
        }

        router.replace("/account/reset-password");
        return;
      }

      const code = searchParams.get("code");
      if (!code) {
        setErrorMessage(
          "\u05e7\u05d5\u05d3 \u05d4\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05d7\u05e1\u05e8 \u05d0\u05d5 \u05d0\u05d9\u05e0\u05d5 \u05ea\u05e7\u05d9\u05df."
        );
        return;
      }

      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);
      const user = data.session?.user;

      if (error || !user) {
        console.error("Google OAuth callback failed", error);
        setErrorMessage(
          "\u05dc\u05d0 \u05e0\u05d9\u05ea\u05df \u05dc\u05d4\u05e9\u05dc\u05d9\u05dd \u05d0\u05ea \u05d4\u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea \u05e2\u05dd Google."
        );
        return;
      }

      const isMentorRegistration = flow === "mentor_register";
      const isParentRegistration = flow === "parent_register";

      const [ownershipResult, mentorProfileResult] = await Promise.all([
        supabase
          .from("mentor_account_ownership")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("mentor_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (ownershipResult.error || mentorProfileResult.error) {
        console.error(
          "Account role lookup failed",
          ownershipResult.error || mentorProfileResult.error,
        );
        setErrorMessage("לא ניתן לבדוק את סוג החשבון. נסו שוב מאוחר יותר.");
        return;
      }

      const hasMentorAccount = Boolean(
        ownershipResult.data || mentorProfileResult.data,
      );
      const createdAt = Date.parse(user.created_at);
      const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
      const isNewOAuthAccount =
        Number.isFinite(createdAt) &&
        Number.isFinite(lastSignInAt) &&
        Math.abs(lastSignInAt - createdAt) < 10_000;
      const hasExistingParentAccount = !hasMentorAccount && !isNewOAuthAccount;

      if (
        (isMentorRegistration && hasExistingParentAccount) ||
        (isParentRegistration && hasMentorAccount)
      ) {
        setErrorMessage(
          "כתובת המייל כבר משויכת לחשבון מסוג אחר. יש להתחבר באמצעות סוג החשבון הקיים.",
        );
        return;
      }

      if (isMentorRegistration) {
        const ownerType =
          searchParams.get("owner_type") === "parent_guardian"
            ? "parent_guardian"
            : "mentor";
        const firstName =
          searchParams.get("first_name")?.trim() ||
          user.user_metadata?.first_name ||
          user.user_metadata?.full_name?.split(" ")[0] ||
          "";
        const lastName =
          searchParams.get("last_name")?.trim() ||
          user.user_metadata?.last_name ||
          "";

        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name: firstName,
            last_name: lastName,
            role: "mentor",
            account_owner_type: ownerType,
          },
        });
        if (metadataError) {
          console.error("Google metadata update failed", metadataError);
        }

        if (!ownershipResult.data) {
          const { error: ownershipError } = await supabase
            .from("mentor_account_ownership")
            .insert({ user_id: user.id, owner_type: ownerType });
          if (ownershipError && ownershipError.code !== "23505") {
            console.error("Account ownership creation failed", ownershipError);
            setErrorMessage("לא ניתן להשלים את הגדרת חשבון החונך.");
            return;
          }
        }
      } else if (isParentRegistration) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name:
              searchParams.get("first_name")?.trim() ||
              user.user_metadata?.first_name ||
              "",
            last_name:
              searchParams.get("last_name")?.trim() ||
              user.user_metadata?.last_name ||
              "",
            role: "parent",
          },
        });
        if (metadataError) {
          console.error("Parent Google metadata update failed", metadataError);
        }
      }

      const dashboardPath = isMentorRegistration
        ? "/register/mentor"
        : isParentRegistration
          ? "/dashboard/parent"
          : await getDashboardPath(user.id);
      const returnTo = searchParams.get("returnTo");
      router.replace(returnTo?.startsWith("/") && !returnTo.startsWith("//") && (isParentRegistration || user.user_metadata?.role === "parent") ? returnTo : dashboardPath);
    }

    void finish();
  }, [router, searchParams]);

  return (
    <CallbackStatus
      text={errorMessage || "משלים את ההתחברות עם Google..."}
      error={Boolean(errorMessage)}
    />
  );
}

function CallbackStatus({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6"
    >
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className={error ? "text-red-700" : "font-bold text-slate-700"}>
          {text}
        </p>
      </div>
    </main>
  );
}
