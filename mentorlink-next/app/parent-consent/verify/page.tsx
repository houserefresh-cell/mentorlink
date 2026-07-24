"use client";

import { useEffect, useRef, useState } from "react";

type RequestDetails = {
  state: "open" | "invalid" | "used" | "expired";
  mentorName: string;
  parentName: string;
  parentRelationship: string;
  consentVersion: string;
};

export default function ParentConsentVerifyPage() {
  const loadStarted = useRef(false);
  const [token, setToken] = useState("");
  const [details, setDetails] = useState<RequestDetails | null>(null);
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [participationConfirmed, setParticipationConfirmed] = useState(false);
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    async function load() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const fragmentToken = fragment.get("token") ?? "";
      window.history.replaceState(null, "", window.location.pathname);

      if (!fragmentToken) {
        setDetails({
          state: "invalid",
          mentorName: "",
          parentName: "",
          parentRelationship: "",
          consentVersion: "",
        });
        return;
      }

      setToken(fragmentToken);

      try {
        const response = await fetch("/api/parent-consent/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action: "lookup",
            token: fragmentToken,
          }),
        });
        const data = (await response.json()) as RequestDetails;
        setDetails(data);
      } catch {
        setError("לא ניתן לטעון את בקשת האישור. נסו שוב מאוחר יותר.");
      }
    }

    void load();
  }, []);

  async function respond(decision: "approved" | "declined") {
    if (
      decision === "approved" &&
      (!detailsConfirmed || !participationConfirmed || !contactConfirmed)
    ) {
      setError("כדי לאשר יש לסמן את כל שלוש ההצהרות.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/parent-consent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          token,
          decision,
          detailsConfirmed,
          participationConfirmed,
          contactConfirmed,
        }),
      });
      const data = (await response.json()) as { state?: string; error?: string };
      if (!response.ok) {
        setError(data.error || "לא ניתן לטפל בבקשה.");
        return;
      }

      if (data.state === "approved") {
        setResult("האישור נקלט בהצלחה. תודה!");
      } else if (data.state === "declined") {
        setResult("הסירוב נקלט. פרופיל החונך לא יישלח לאישור.");
      } else if (data.state === "expired") {
        setDetails((current) =>
          current ? { ...current, state: "expired" } : current,
        );
      } else {
        setDetails((current) =>
          current ? { ...current, state: "used" } : current,
        );
      }
    } catch {
      setError("לא ניתן לטפל בבקשה. נסו שוב מאוחר יותר.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !details) {
    return <StatusCard text={error} error />;
  }
  if (!details) {
    return <StatusCard text="טוען את בקשת האישור..." />;
  }
  if (details.state === "expired") {
    return (
      <StatusCard text="קישור האישור פג תוקף. יש לבקש מהחונך לשלוח בקשה חדשה." error />
    );
  }
  if (details.state === "used") {
    return <StatusCard text="בקשת האישור כבר טופלה ולא ניתן להשתמש בקישור שוב." />;
  }
  if (details.state !== "open") {
    return <StatusCard text="קישור האישור אינו תקין או בוטל." error />;
  }
  if (result) {
    return <StatusCard text={result} />;
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-xl md:p-10">
        <p className="font-bold text-blue-600">MentorLink</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
          אישור הורה לחונך קטין
        </h1>
        <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-blue-950">
          <p><strong>שם החונך:</strong> {details.mentorName}</p>
          <p><strong>שם ההורה:</strong> {details.parentName}</p>
          <p><strong>קרבה לחונך:</strong> {details.parentRelationship}</p>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 p-5">
          <h2 className="text-xl font-extrabold">נוסח ההסכמה</h2>
          <p className="mt-3 leading-8 text-slate-700">
            אני מאשר/ת כי פרטי החונך והפרטים המוצגים בבקשה נכונים, כי אני
            מסכים/ה להשתתפות החונך הקטין בפלטפורמת MentorLink, וכי ניתן ליצור
            עמי קשר בנושאים הקשורים לפעילות החונכות, לבטיחות ולתפעול
            הפלטפורמה. פרטי ההורה ישמשו לצורכי אימות וקשר בלבד ולא יוצגו
            בפרופיל הציבורי.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            גרסת הסכמה: {details.consentVersion}
          </p>
        </section>

        <div className="mt-6 space-y-3">
          <ConsentCheck checked={detailsConfirmed} onChange={setDetailsConfirmed}>
            הפרטים נכונים.
          </ConsentCheck>
          <ConsentCheck
            checked={participationConfirmed}
            onChange={setParticipationConfirmed}
          >
            אני מאשר/ת את השתתפות החונך בפלטפורמה.
          </ConsentCheck>
          <ConsentCheck checked={contactConfirmed} onChange={setContactConfirmed}>
            אני מאשר/ת יצירת קשר בנוגע לפעילות החונכות.
          </ConsentCheck>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void respond("approved")}
            className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            אני מאשר/ת
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void respond("declined")}
            className="flex-1 rounded-xl border border-red-300 px-5 py-3 font-bold text-red-700 disabled:opacity-60"
          >
            אינני מאשר/ת
          </button>
        </div>
      </div>
    </main>
  );
}

function ConsentCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 font-bold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-blue-600"
      />
      {children}
    </label>
  );
}

function StatusCard({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className={error ? "font-bold text-red-700" : "font-bold text-slate-800"}>
          {text}
        </p>
      </div>
    </main>
  );
}
