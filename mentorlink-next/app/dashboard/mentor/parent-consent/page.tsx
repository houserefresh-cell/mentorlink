"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { getAgeFromBirthDate } from "../../../../lib/mentor-age";
import {
  formatIsraeliPhone,
  normalizeIsraeliPhone,
} from "../../../../lib/phone";
import {
  Field,
  FormMessage,
  LoadingPage,
  MentorPageShell,
  MessageBox,
  SavePanel,
  inputClassName,
} from "../_components/MentorPageShell";

const CONSENT_VERSION = "mentor-parent-consent-v2";

const STATUS_LABELS: Record<string, string> = {
  not_required: "לא נדרש",
  missing: "חסר",
  sent: "ממתין לאישור",
  approved: "אושר",
  declined: "נדחה",
  expired: "פג תוקף",
};

export default function ParentConsentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [mentorEmail, setMentorEmail] = useState("");
  const [mentorPhone, setMentorPhone] = useState("");
  const [accountOwnerType, setAccountOwnerType] = useState("mentor");
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [parentName, setParentName] = useState("");
  const [relationship, setRelationship] = useState("אמא");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [participationConfirmed, setParticipationConfirmed] = useState(false);
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [status, setStatus] = useState("missing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      setUserId(auth.user.id);
      setMentorEmail(auth.user.email?.trim().toLowerCase() ?? "");

      const [profile, consent, ownership] = await Promise.all([
        supabase
          .from("mentor_profiles")
          .select("birth_date, phone")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
        supabase
          .from("mentor_parent_consents")
          .select("*")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
        supabase
          .from("mentor_account_ownership")
          .select("owner_type")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
      ]);

      if (profile.error || consent.error || ownership.error) {
        const error = profile.error ?? consent.error ?? ownership.error;
        console.error(error);
        setMessage({
          type: "error",
          text: `שגיאה בטעינת אישור ההורה: ${error?.message}`,
        });
      }

      const age = profile.data?.birth_date
        ? getAgeFromBirthDate(profile.data.birth_date)
        : null;
      setIsMinor(age === null ? null : age < 18);
      setAccountOwnerType(ownership.data?.owner_type ?? "mentor");
      setMentorPhone(
        normalizeIsraeliPhone(
          auth.user.phone ?? profile.data?.phone ?? "",
        ) ?? "",
      );

      if (consent.data) {
        setParentName(consent.data.parent_name);
        setRelationship(consent.data.parent_relationship);
        setParentPhone(formatIsraeliPhone(consent.data.parent_phone));
        setParentEmail(consent.data.parent_email);
        setDetailsConfirmed(consent.data.details_confirmed);
        setParticipationConfirmed(consent.data.participation_confirmed);
        setContactConfirmed(consent.data.contact_confirmed);
        setStatus(consent.data.status);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isMinor) {
      return;
    }

    if (
      !detailsConfirmed ||
      !participationConfirmed ||
      !contactConfirmed
    ) {
      setMessage({
        type: "error",
        text: "יש לסמן את כל הצהרות ההסכמה לפני שמירת הפרטים.",
      });
      return;
    }

    const normalizedParentEmail = parentEmail.trim().toLowerCase();
    const normalizedParentPhone = normalizeIsraeliPhone(parentPhone);

    if (!normalizedParentPhone) {
      setMessage({
        type: "error",
        text: "מספר הטלפון אינו תקין. יש להזין מספר נייד ישראלי.",
      });
      return;
    }

    if (
      accountOwnerType !== "parent_guardian" &&
      normalizedParentEmail &&
      normalizedParentEmail === mentorEmail
    ) {
      setMessage({
        type: "error",
        text: "מייל ההורה אינו יכול להיות זהה למייל החונך.",
      });
      return;
    }

    if (mentorPhone && normalizedParentPhone === mentorPhone) {
      setMessage({
        type: "error",
        text: "טלפון ההורה אינו יכול להיות זהה לטלפון החונך.",
      });
      return;
    }

    if (!["missing", "sent"].includes(status)) {
      setMessage({
        type: "error",
        text: "לא ניתן לערוך בקשה שכבר הוכרעה. יש לפנות למנהל המערכת.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("mentor_parent_consents")
      .upsert({
        user_id: userId,
        parent_name: parentName.trim(),
        parent_relationship: relationship,
        parent_phone: normalizedParentPhone,
        parent_email: normalizedParentEmail || null,
        details_confirmed: detailsConfirmed,
        participation_confirmed: participationConfirmed,
        contact_confirmed: contactConfirmed,
        status,
        consent_version: CONSENT_VERSION,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error(error);
    }

    setMessage(
      error
        ? { type: "error", text: `שגיאה בשמירה: ${error.message}` }
        : { type: "success", text: "פרטי ההורה נשמרו בהצלחה." },
    );
    setSaving(false);
  }

  async function sendConsentRequest() {
    if (!["missing", "expired", "declined"].includes(status)) {
      setMessage({
        type: "error",
        text: "לא ניתן לשלוח בקשה חדשה בסטטוס הנוכחי.",
      });
      return;
    }

    setSending(true);
    setMessage(null);
    setCooldownSeconds(60);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/parent-consent/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setMessage({
          type: "error",
          text: result.error || "שליחת בקשת האישור נכשלה.",
        });
        return;
      }

      setStatus("sent");
      setMessage({
        type: "success",
        text: result.message || "בקשת האישור נשלחה להורה.",
      });
    } catch (error) {
      console.error("Parent consent request failed", error);
      setMessage({
        type: "error",
        text: "שליחת בקשת האישור נכשלה. נסו שוב מאוחר יותר.",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <LoadingPage text="טוען את שלב אישור ההורה..." />;
  }

  if (isMinor === null) {
    return (
      <MentorPageShell
        title="אישור הורה"
        description="לא ניתן לקבוע אם נדרש אישור הורה ללא תאריך לידה."
      >
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-bold text-amber-900">
            יש להשלים תחילה את תאריך הלידה בפרטים האישיים.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/mentor/profile")}
            className="mt-5 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
          >
            מעבר לפרטים האישיים
          </button>
        </div>
      </MentorPageShell>
    );
  }

  if (!isMinor) {
    return (
      <MentorPageShell
        title="אישור הורה"
        description="שלב זה מיועד לחונכים שטרם מלאו להם 18."
      >
        <div className="rounded-3xl border border-green-200 bg-green-50 p-8 text-center">
          <span className="rounded-full bg-green-100 px-4 py-2 font-bold text-green-700">
            לא נדרש
          </span>
          <p className="mt-5 text-lg text-green-900">
            לפי תאריך הלידה השמור בפרופיל, אין צורך באישור הורה.
          </p>
        </div>
      </MentorPageShell>
    );
  }

  const locked = !["missing", "sent"].includes(status);

  return (
    <MentorPageShell
      title="אישור הורה לחונך קטין"
      description="פרטי ההורה נשמרים באופן פרטי ולא יוצגו בפרופיל הציבורי."
    >
      <div className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-blue-950">
            סטטוס האישור
          </h2>
          <span className="rounded-full bg-white px-4 py-2 font-bold text-blue-700">
            {STATUS_LABELS[status]}
          </span>
        </div>
        <p className="mt-3 text-blue-900">
          האישור מתקבל רק לאחר שההורה פותח את הקישור המאובטח שנשלח אליו
          במייל ובוחר במפורש לאשר. סימון ההצהרות בטופס אינו מהווה אישור הורה
          מאומת.
        </p>
        {accountOwnerType === "parent_guardian" && (
          <p className="mt-3 rounded-xl bg-white p-3 font-bold text-blue-900">
            זהו חשבון חונך קטין המנוהל בידי הורה. לכן ניתן להשתמש באימייל
            הכניסה גם כאימייל ההורה.
          </p>
        )}
      </div>

      <form
        onSubmit={save}
        className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl"
      >
        <fieldset disabled={locked || saving} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="שם מלא של ההורה" htmlFor="parentName" required>
              <input
                id="parentName"
                required
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field label="קרבה לחונך" htmlFor="relationship" required>
              <select
                id="relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                className={inputClassName}
              >
                <option>אמא</option>
                <option>אבא</option>
                <option>אפוטרופוס/ית</option>
                <option>אחר</option>
              </select>
            </Field>

            <Field label="מספר טלפון" htmlFor="parentPhone" required>
              <input
                id="parentPhone"
                type="tel"
                required
                dir="ltr"
                value={parentPhone}
                onChange={(event) => setParentPhone(event.target.value)}
                className={`${inputClassName} text-left`}
              />
            </Field>

            <Field label="כתובת אימייל" htmlFor="parentEmail" required>
              <input
                id="parentEmail"
                type="email"
                required
                dir="ltr"
                value={parentEmail}
                onChange={(event) => setParentEmail(event.target.value)}
                className={`${inputClassName} text-left`}
              />
              <p className="mt-2 text-sm text-slate-500">
                {accountOwnerType === "parent_guardian"
                  ? "ניתן להשתמש באימייל שמנהל את החשבון. עדיין תידרש לחיצה מפורשת על קישור האישור."
                  : "האימייל חייב להיות שונה מאימייל החונך."}
              </p>
            </Field>
          </div>

          <section className="rounded-2xl bg-slate-50 p-6">
            <h2 className="text-xl font-extrabold text-slate-900">
              נוסח ההסכמה
            </h2>
            <p className="mt-3 leading-7 text-slate-700">
              ההורה מאשר כי פרטי החונך והפרטים שנמסרו בטופס נכונים, כי הוא
              מסכים להשתתפות החונך הקטין בפלטפורמת MentorLink, וכי ניתן ליצור
              עמו קשר בנושאים הקשורים לפעילות החונכות, לבטיחות ולתפעול
              הפלטפורמה. פרטי ההורה יישמרו לצורכי אימות וקשר בלבד ולא יוצגו
              בפרופיל הציבורי.
            </p>
            <p className="mt-3 leading-7 text-slate-700">
              MentorLink משמשת כפלטפורמה להיכרות ולתיאום. ההורה יתבקש לאשר
              שהוא יבחן את ההתאמה ויהיה מעורב בתיאום מפגשים שבהם משתתף החונך
              הקטין. בנוסף תוצג לו בחירה נפרדת ולא-חובה אם להתיר הצגה ציבורית
              של תמונת הפרופיל; ללא אישור מפורש התמונה לא תוצג לציבור.
            </p>
          </section>

          <div className="space-y-3">
            <ConsentCheckbox
              checked={detailsConfirmed}
              onChange={setDetailsConfirmed}
              label="אני מאשר/ת שהפרטים שנמסרו נכונים."
            />
            <ConsentCheckbox
              checked={participationConfirmed}
              onChange={setParticipationConfirmed}
              label="נמסר לי שההורה מסכים להשתתפות החונך בפלטפורמה."
            />
            <ConsentCheckbox
              checked={contactConfirmed}
              onChange={setContactConfirmed}
              label="נמסר לי שההורה מסכים ליצירת קשר בנוגע לפעילות החונכות."
            />
          </div>
        </fieldset>

        {!locked && (
          <SavePanel
            saving={saving}
            message={message}
            label="שמירת פרטי ההורה"
          />
        )}

        {locked && (
          <MessageBox
            message={{
              type: status === "approved" ? "success" : "error",
              text:
                status === "approved"
                  ? "אישור ההורה התקבל ואומת."
                  : "לא ניתן לערוך אישור שהוכרע. יש לפנות למנהל המערכת.",
            }}
          />
        )}
      </form>

      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <button
          type="button"
          onClick={() => void sendConsentRequest()}
          disabled={
            sending ||
            cooldownSeconds > 0 ||
            !["missing", "expired", "declined"].includes(status)
          }
          className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {sending
            ? "שולח בקשה..."
            : cooldownSeconds > 0
              ? `ניתן לשלוח שוב בעוד ${cooldownSeconds} שניות`
              : "שליחת בקשת אישור להורה"}
        </button>
        <p className="mt-3 text-sm text-slate-600">
          הקישור נשלח באימייל, תקף ל־48 שעות וניתן לשימוש פעם אחת בלבד.
          בקשה חדשה מבטלת קישורים קודמים שעדיין פתוחים.
        </p>
        <div className="mt-4">
          <MessageBox message={message} />
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/mentor/onboarding?step=summary")}
          className="mt-5 rounded-xl border border-blue-300 bg-white px-6 py-3 font-extrabold text-blue-800 transition hover:border-blue-500 hover:bg-blue-50"
        >
          חזרה לסיכום ההרשמה
        </button>
      </div>
    </MentorPageShell>
  );
}

function ConsentCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 font-bold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-blue-600"
      />
      {label}
    </label>
  );
}
