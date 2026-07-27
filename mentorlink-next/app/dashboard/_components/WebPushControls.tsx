"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parsePublicVapidKey } from "@/lib/web-push-public-key";

type PushDiagnosticCode =
  | "SW_REGISTER_FAILED"
  | "SW_NOT_READY"
  | "SW_UPDATE_FAILED"
  | "API_GET_FAILED"
  | "VAPID_INVALID"
  | "SUBSCRIBE_FAILED"
  | "API_POST_FAILED";

class PushActivationError extends Error {
  constructor(readonly code: PushDiagnosticCode, cause?: unknown) {
    super(code, { cause });
    this.name = "PushActivationError";
  }
}

function safeErrorName(error: unknown) {
  return error instanceof Error && error.name ? error.name : "UnknownError";
}

function logDiagnostic(code: PushDiagnosticCode, error: unknown) {
  console.warn("MentorLink Web Push activation diagnostic", {
    code,
    errorName: safeErrorName(error),
  });
}

function serviceWorkerReady(timeoutMilliseconds = 10_000) {
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new PushActivationError("SW_NOT_READY")),
      timeoutMilliseconds,
    );
    navigator.serviceWorker.ready.then((registration) => {
      window.clearTimeout(timeout);
      resolve(registration);
    }, (error) => {
      window.clearTimeout(timeout);
      reject(new PushActivationError("SW_NOT_READY", error));
    });
  });
}

export default function WebPushControls({ compact = false }: { compact?: boolean }) {
  const [token, setToken] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [endpoint, setEndpoint] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnosticCode, setDiagnosticCode] = useState<PushDiagnosticCode | "">("");

  useEffect(() => {
    const hasSupport = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    queueMicrotask(() => {
      setSupported(hasSupport);
      setPermission(hasSupport ? Notification.permission : "denied");
      setStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
      void supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? ""));
      if (hasSupport) {
        void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (registration) => {
          if (registration.scope !== new URL("/", window.location.origin).href) {
            throw new PushActivationError("SW_REGISTER_FAILED");
          }
          void registration.update().catch((error) => {
            logDiagnostic("SW_UPDATE_FAILED", error);
          });
          const subscription = await registration.pushManager.getSubscription();
          setEndpoint(subscription?.endpoint ?? "");
        }).catch((error) => {
          logDiagnostic("SW_REGISTER_FAILED", error);
          setDiagnosticCode("SW_REGISTER_FAILED");
          setSupported(false);
        });
      }
    });
  }, []);

  async function enable() {
    if (!token || !supported || (isIos && !standalone)) return;
    setBusy(true);
    setMessage("");
    setDiagnosticCode("");
    try {
      const permissionResult = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setMessage("ההתראות נחסמו בהגדרות המכשיר.");
        return;
      }

      let config: { configured?: boolean; publicKey?: unknown };
      try {
        const configResponse = await fetch("/api/push-subscriptions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!configResponse.ok) throw new Error(`HTTP_${configResponse.status}`);
        config = await configResponse.json();
      } catch (error) {
        throw new PushActivationError("API_GET_FAILED", error);
      }
      const vapidKey = parsePublicVapidKey(config.publicKey);
      if (!config.configured || !vapidKey.ok) {
        throw new PushActivationError("VAPID_INVALID");
      }

      let registration: ServiceWorkerRegistration;
      try {
        registration = await serviceWorkerReady();
      } catch (error) {
        throw error instanceof PushActivationError
          ? error
          : new PushActivationError("SW_NOT_READY", error);
      }

      let subscription: PushSubscription;
      try {
        subscription = await registration.pushManager.getSubscription()
          ?? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey.applicationServerKey,
          });
      } catch (error) {
        throw new PushActivationError("SUBSCRIBE_FAILED", error);
      }

      const json = subscription.toJSON();
      try {
        const response = await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys }),
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
      } catch (error) {
        throw new PushActivationError("API_POST_FAILED", error);
      }

      setEndpoint(subscription.endpoint);
      setMessage("ההתראות פעילות במכשיר זה.");
    } catch (error) {
      const code = error instanceof PushActivationError
        ? error.code
        : "SUBSCRIBE_FAILED";
      logDiagnostic(code, error);
      setDiagnosticCode(code);
      setMessage("לא ניתן להפעיל את ההתראות כרגע. אפשר לנסות שוב בעוד כמה רגעים.");
    } finally {
      setBusy(false);
    }
  }
  async function unsubscribe() {
    if (!token || !endpoint) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      await subscription?.unsubscribe();
      setEndpoint("");
      setMessage("ההתראות הוסרו ממכשיר זה.");
    } finally { setBusy(false); }
  }

  async function testPush() {
    if (!token || !endpoint) return;
    setBusy(true);
    const response = await fetch("/api/push-subscriptions/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(body.message ?? body.error ?? "לא ניתן לשלוח התראה.");
    setBusy(false);
  }

  const state = supported === false
    ? "לא נתמך במכשיר זה"
    : isIos && !standalone
      ? "יש להוסיף את MentorLink למסך הבית"
      : permission === "denied"
        ? "ההתראות נחסמו בהגדרות המכשיר"
        : endpoint
          ? "ההתראות פעילות במכשיר זה"
          : "טרם אושרו התראות";

  return (
    <section dir="rtl" className={compact ? "rounded-2xl border bg-white p-5" : "rounded-3xl border border-blue-100 bg-white p-6 shadow-sm"}>
      <h2 className="text-xl font-black">{compact ? "קבלת עדכונים בזמן אמת" : "התראות בטלפון"}</h2>
      <p className="mt-2 leading-7 text-slate-600">כדי לקבל הודעה מיד כאשר הורה פונה אליך או שולח בקשת פגישה, ניתן להוסיף את MentorLink למסך הבית ולהפעיל התראות.</p>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 font-bold">{state}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowInstall((value) => !value)} className="min-h-11 rounded-xl border px-4 py-2 font-bold">הצג לי כיצד להוסיף למסך הבית</button>
        {!endpoint && <button type="button" onClick={enable} disabled={busy || !supported || (isIos && !standalone)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:bg-slate-400">הפעלת התראות</button>}
        {endpoint && <button type="button" onClick={testPush} disabled={busy} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">שליחת התראת ניסיון</button>}
        {endpoint && <button type="button" onClick={unsubscribe} disabled={busy} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700">הסרת התראות מהמכשיר</button>}
        <button type="button" onClick={() => setMessage("אפשר לחזור ולהפעיל התראות מאוחר יותר מהדשבורד.")} className="min-h-11 rounded-xl px-4 py-2 font-bold text-slate-600">אעשה זאת אחר כך</button>
      </div>
      {showInstall && <ol className="mt-5 list-decimal space-y-2 pr-6 text-slate-700">
        <li>פתחו את MentorLink בדפדפן.</li><li>לחצו על כפתור השיתוף.</li><li>בחרו ״הוספה למסך הבית״.</li><li>אשרו את הוספת MentorLink.</li><li>פתחו את MentorLink דרך האייקון החדש במסך הבית.</li><li>היכנסו לחשבון החונך.</li><li>לחצו ״הפעלת התראות״.</li><li>בחלון של האייפון לחצו ״אפשר״.</li>
      </ol>}
      {(message || diagnosticCode) && <div role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">
        <p>{message || "לא ניתן להכין את שירות ההתראות כרגע."}</p>
        {diagnosticCode && <p className="mt-1 text-xs font-medium text-slate-500" dir="ltr">קוד אבחון: {diagnosticCode}</p>}
      </div>}
    </section>
  );
}
