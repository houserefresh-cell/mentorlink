"use client";

import { useEffect, useState } from "react";
import { MentorPageShell } from "../_components/MentorPageShell";
import { supabase } from "@/lib/supabase";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DURATIONS = [30, 45, 60, 75, 90];
type WindowRow = {
  id: string; weekday: number; start_time: string; end_time: string;
  meeting_mode: string; supported_durations: number[]; is_active: boolean; subject_ids: number[];
  effective_start_date: string | null; effective_end_date: string | null;
};
type MentorSubject = { id: number; name: string; category: string };

export default function SchedulingAvailabilityPage() {
  const [token, setToken] = useState("");
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [subjects, setSubjects] = useState<MentorSubject[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({ weekdays: [0] as number[], startTime: "16:00", endTime: "18:00", meetingMode: "אונליין", durations: [60], subjectIds: [] as number[], effectiveStartDate: "", effectiveEndDate: "" });
  const [customDuration, setCustomDuration] = useState(10);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(accessToken: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [response, subjectResponse] = await Promise.all([
      fetch("/api/mentor-availability", { headers }),
      fetch("/api/mentor-subjects", { headers, cache: "no-store" }),
    ]);
    const [body, subjectBody] = await Promise.all([
      response.json().catch(() => ({})),
      subjectResponse.json().catch(() => ({})),
    ]);
    if (!response.ok || !subjectResponse.ok) {
      setMessage(`${body.error ?? subjectBody.error ?? "לא ניתן לטעון את הזמינות."} (${body.code ?? "AVAILABILITY_LOAD_FAILED"})`);
      return;
    }
    setWindows(body.windows ?? []);
    const selectedIds = new Set<number>((subjectBody.selected ?? []).map((item: { subject_id: number }) => item.subject_id));
    setSubjects((subjectBody.catalog ?? []).filter((subject: MentorSubject) => selectedIds.has(subject.id)));
  }
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => {
    const accessToken = data.session?.access_token ?? "";
    setToken(accessToken);
    if (accessToken) void load(accessToken);
  }); }, []);

  async function addWindow() {
    if (busy) return;
    if (form.endTime <= form.startTime) {
      setMessage("שעת הסיום חייבת להיות מאוחרת משעת ההתחלה. (INVALID_WINDOW)");
      return;
    }
    if (!form.durations.length) {
      setMessage("יש לבחור משך פגישה אחד לפחות. (INVALID_WINDOW)");
      return;
    }
    if (!form.subjectIds.length) {
      setMessage("יש לבחור לפחות מקצוע או תחום אחד לחלון הזמינות. (INVALID_WINDOW_SUBJECTS)");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (!form.weekdays.length) {
        setMessage("יש לבחור לפחות יום אחד. (INVALID_WINDOW)");
        return;
      }
      for (const weekday of form.weekdays) {
        const response = await fetch("/api/mentor-availability", {
          method: editingId ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, weekday, id: editingId || undefined }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(`${body.error ?? "לא ניתן לשמור את הזמינות."} (${body.code ?? "AVAILABILITY_SAVE_FAILED"})`);
          return;
        }
      }
      setEditingId("");
      await load(token);
      setMessage("הזמינות נשמרה בהצלחה.");
    } catch (error) {
      console.info("Mentor availability UI", { stage: "save", errorName: error instanceof Error ? error.name : "UnknownError" });
      setMessage("לא ניתן לשמור את הזמינות. (AVAILABILITY_API_FAILED)");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    const response = await fetch(`/api/mentor-availability?id=${id}&type=window`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) { setEditingId(""); await load(token); }
  }
  async function toggle(window: WindowRow) {
    await fetch("/api/mentor-availability", {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: window.id, weekday: window.weekday, startTime: window.start_time.slice(0, 5),
        endTime: window.end_time.slice(0, 5), meetingMode: window.meeting_mode,
        durations: window.supported_durations, isActive: !window.is_active,
      }),
    });
    await load(token);
  }

  return (
    <MentorPageShell title="זמינות לפגישות" description="הגדירו חלונות שבועיים מדויקים ותאריכים שאינם זמינים.">
      {message && <p role="status" aria-live="polite" className="mb-5 rounded-xl bg-blue-50 p-4 text-center font-bold">{message}</p>}
      <div className="grid gap-5 rounded-3xl border bg-white p-5 shadow-sm sm:grid-cols-2">
        <fieldset className="sm:col-span-2"><legend className="font-bold">ימים</legend><div className="mt-2 flex flex-wrap gap-2">{DAYS.map((day, weekday) => <button type="button" key={day} aria-pressed={form.weekdays.includes(weekday)} onClick={() => setForm({ ...form, weekdays: editingId ? [weekday] : form.weekdays.includes(weekday) ? form.weekdays.filter((item) => item !== weekday) : [...form.weekdays, weekday] })} className={`min-h-11 rounded-xl border px-4 py-2 font-bold ${form.weekdays.includes(weekday) ? "bg-blue-700 text-white" : ""}`}>{day}</button>)}</div>{editingId && <p className="mt-2 text-sm text-slate-500">בעריכת חלון קיים ניתן לבחור יום אחד. להוספת כמה ימים יחד, צרו חלון חדש.</p>}</fieldset>
        <Select label="אופן פגישה" value={form.meetingMode} onChange={(meetingMode) => setForm({ ...form, meetingMode })} options={["אונליין", "פרונטלי"].map((value) => ({ label: value, value }))} />
        <label className="grid gap-2 font-bold">משעה<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="rounded-xl border p-3" /></label>
        <label className="grid gap-2 font-bold">עד שעה<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="rounded-xl border p-3" /></label>
<label className="grid gap-2 font-bold">מתאריך (לא חובה)<input type="date" value={form.effectiveStartDate} onChange={(event) => setForm({ ...form, effectiveStartDate: event.target.value })} className="rounded-xl border p-3" /></label><label className="grid gap-2 font-bold">עד תאריך (לא חובה)<input type="date" value={form.effectiveEndDate} onChange={(event) => setForm({ ...form, effectiveEndDate: event.target.value })} className="rounded-xl border p-3" /></label>
        <fieldset className="sm:col-span-2"><legend className="font-bold">משכים נתמכים</legend><div className="mt-2 flex flex-wrap gap-2">{DURATIONS.map((duration) => <button type="button" key={duration} onClick={() => setForm({ ...form, durations: form.durations.includes(duration) ? form.durations.filter((item) => item !== duration) : [...form.durations, duration] })} className={`min-h-11 rounded-xl border px-4 py-2 font-bold ${form.durations.includes(duration) ? "bg-blue-700 text-white" : ""}`}>{duration} דקות</button>)}</div>
          <div className="mt-3 flex flex-wrap items-end gap-3"><label className="grid gap-1 font-bold">משך מותאם אישית<input type="number" min="10" max="180" step="1" value={customDuration} onChange={(event) => setCustomDuration(Number(event.target.value))} className="min-h-11 w-36 rounded-xl border p-3" /></label><button type="button" disabled={!Number.isInteger(customDuration) || customDuration < 10 || customDuration > 180 || form.durations.includes(customDuration)} onClick={() => setForm({ ...form, durations: [...form.durations, customDuration].sort((a, b) => a - b) })} className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-4 font-bold text-blue-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500">{form.durations.includes(customDuration) ? "המשך כבר נוסף" : "הוספת משך"}</button></div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="font-bold">לאילו מקצועות החלון הזה מיועד?</legend>
          {subjects.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{subjects.map((subject) => <label key={subject.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${form.subjectIds.includes(subject.id) ? "border-blue-400 bg-blue-50" : "bg-white"}`}><span><span className="block font-bold">{subject.name}</span><span className="text-xs text-slate-500">{subject.category}</span></span><input type="checkbox" checked={form.subjectIds.includes(subject.id)} onChange={() => setForm({ ...form, subjectIds: form.subjectIds.includes(subject.id) ? form.subjectIds.filter((id) => id !== subject.id) : [...form.subjectIds, subject.id] })} className="h-5 w-5 accent-blue-700" /></label>)}</div> : <p className="mt-3 rounded-xl bg-amber-50 p-4 font-bold text-amber-900">לפני יצירת חלון זמינות יש לבחור מקצועות במסך „המקצועות והתחומים שלי”.</p>}
        </fieldset>
        <button type="button" onClick={addWindow} disabled={busy} className="min-h-12 rounded-xl bg-blue-700 font-black text-white disabled:bg-slate-400 sm:col-span-2">{busy ? "שומר..." : editingId ? "עדכון חלון זמינות" : "הוספת חלון זמינות"}</button>
      </div>
      <div className="mt-6 grid gap-3">{windows.map((window) => <div key={window.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"><div><p className="font-bold">{DAYS[window.weekday]} · {window.start_time.slice(0, 5)}–{window.end_time.slice(0, 5)} · {window.meeting_mode} · {window.supported_durations.join(", ")} דקות</p><p className={`mt-2 text-sm font-bold ${window.subject_ids.length ? "text-blue-700" : "text-amber-700"}`}>{window.subject_ids.length ? window.subject_ids.map((id) => subjects.find((subject) => subject.id === id)?.name).filter(Boolean).join(", ") : "לא הוגדר מקצוע — החלון אינו מוצג להורים"}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setEditingId(window.id); setForm({ weekdays: [window.weekday], startTime: window.start_time.slice(0, 5), endTime: window.end_time.slice(0, 5), meetingMode: window.meeting_mode, durations: window.supported_durations, subjectIds: window.subject_ids, effectiveStartDate: window.effective_start_date ?? "", effectiveEndDate: window.effective_end_date ?? "" }); }} className="cursor-pointer rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 font-bold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">עריכה</button><button type="button" onClick={() => toggle(window)} className={`cursor-pointer rounded-xl border px-3 py-2 font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${window.is_active ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>{window.is_active ? "השבתה" : "הפעלה"}</button><button type="button" onClick={() => remove(window.id)} className="cursor-pointer rounded-xl border border-red-300 bg-red-50 px-3 py-2 font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50">מחיקה</button></div></div>)}</div>

    </MentorPageShell>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }) {
  return <label className="grid gap-2 font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border p-3">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
