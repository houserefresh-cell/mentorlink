"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import {
  ChoicePills,
  FormMessage,
  LoadingPage,
  MentorPageShell,
  SavePanel,
  inputClassName,
  toggleValue,
} from "../_components/MentorPageShell";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
const TIME_PREFERENCES = ["בוקר", "צהריים", "אחר הצהריים", "ערב"];
type TimeRange = { start: string; end: string };
type Schedule = Record<string, TimeRange[]>;

export default function AvailabilityPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [schedule, setSchedule] = useState<Schedule>({});
  const [flexible, setFlexible] = useState(false);
  const [holidays, setHolidays] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [oneTime, setOneTime] = useState(false);
  const [timePreferences, setTimePreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      setUserId(auth.user.id);
      const { data, error } = await supabase
        .from("mentor_availability")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        setMessage({ type: "error", text: `שגיאה בטעינת הזמינות: ${error.message}` });
      } else if (data) {
        setSchedule((data.weekly_schedule as Schedule) ?? {});
        setFlexible(data.flexible_availability);
        setHolidays(data.available_on_holidays);
        setRecurring(data.recurring_meetings);
        setOneTime(data.one_time_meetings);
        setTimePreferences(data.time_preferences ?? []);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function setDayEnabled(day: string, enabled: boolean) {
    setSchedule((current) => {
      const next = { ...current };
      if (enabled) next[day] = [{ start: "16:00", end: "18:00" }];
      else delete next[day];
      return next;
    });
  }

  function updateRange(day: string, index: number, field: keyof TimeRange, value: string) {
    setSchedule((current) => ({
      ...current,
      [day]: current[day].map((range, i) =>
        i === index ? { ...range, [field]: value } : range,
      ),
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const invalid = Object.values(schedule).flat().some((range) => range.end <= range.start);
    if (invalid) {
      setMessage({ type: "error", text: "שעת הסיום חייבת להיות מאוחרת משעת ההתחלה." });
      return;
    }
    if (!Object.keys(schedule).length && !flexible) {
      setMessage({ type: "error", text: "יש לבחור לפחות יום אחד או לסמן זמינות גמישה." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("mentor_availability").upsert({
      user_id: userId,
      weekly_schedule: schedule,
      flexible_availability: flexible,
      available_on_holidays: holidays,
      recurring_meetings: recurring,
      one_time_meetings: oneTime,
      time_preferences: timePreferences,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error(error);
    setMessage(error
      ? { type: "error", text: `שגיאה בשמירה: ${error.message}` }
      : { type: "success", text: "הזמינות נשמרה בהצלחה." });
    setSaving(false);
  }

  if (loading) return <LoadingPage text="טוען זמינות..." />;
  return (
    <MentorPageShell title="זמינות" description="בחרו ימים ושעות שבהם תוכלו להיפגש עם חניכים.">
      <form onSubmit={save}>
        <div className="space-y-4">
          {DAYS.map((day) => {
            const ranges = schedule[day];
            return (
              <section key={day} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <label className="flex items-center gap-3 text-xl font-extrabold">
                  <input type="checkbox" checked={Boolean(ranges)} onChange={(e) => setDayEnabled(day, e.target.checked)} className="h-5 w-5 accent-blue-600" />
                  יום {day}
                </label>
                {ranges && (
                  <div className="mt-5 space-y-3">
                    {ranges.map((range, index) => (
                      <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="font-bold">התחלה<input type="time" value={range.start} onChange={(e) => updateRange(day, index, "start", e.target.value)} required className={`${inputClassName} mt-2`} /></label>
                        <label className="font-bold">סיום<input type="time" value={range.end} onChange={(e) => updateRange(day, index, "end", e.target.value)} required className={`${inputClassName} mt-2`} /></label>
                        <button type="button" onClick={() => setSchedule((current) => ({ ...current, [day]: current[day].filter((_, i) => i !== index) }))} disabled={ranges.length === 1} className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700 disabled:opacity-40">מחיקה</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSchedule((current) => ({ ...current, [day]: [...current[day], { start: "18:00", end: "20:00" }] }))} className="font-bold text-blue-600">+ הוספת טווח שעות</button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-extrabold">אפשרויות כלליות</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["זמינות גמישה", flexible, setFlexible], ["זמין בחופשות", holidays, setHolidays], ["זמין למפגש קבוע", recurring, setRecurring], ["זמין למפגש חד־פעמי", oneTime, setOneTime]] .map(([label, value, setter]) => (
              <label key={label as string} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 font-bold">
                <input type="checkbox" checked={value as boolean} onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)} className="h-5 w-5 accent-blue-600" />{label as string}
              </label>
            ))}
          </div>
          <h3 className="mb-3 mt-6 font-bold">שעות מועדפות</h3>
          <ChoicePills options={TIME_PREFERENCES} selected={timePreferences} onToggle={(value) => setTimePreferences(toggleValue(timePreferences, value))} />
        </section>
        <SavePanel saving={saving} message={message} label="שמירת זמינות" />
      </form>
    </MentorPageShell>
  );
}
