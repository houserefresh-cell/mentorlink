"use client";

import { useEffect, useState } from "react";
import { MentorPageShell } from "../_components/MentorPageShell";
import { supabase } from "@/lib/supabase";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DURATIONS = [30, 45, 60, 75, 90];
type WindowRow = {
  id: string; weekday: number; start_time: string; end_time: string;
  meeting_mode: string; supported_durations: number[]; is_active: boolean;
};
type Blackout = { id: string; starts_at: string; ends_at: string; reason: string | null };

export default function SchedulingAvailabilityPage() {
  const [token, setToken] = useState("");
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [editingId, setEditingId] = useState("");
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [form, setForm] = useState({ weekday: 0, startTime: "16:00", endTime: "18:00", meetingMode: "אונליין", durations: [60], effectiveStartDate: "", effectiveEndDate: "" });
  const [blockedDate, setBlockedDate] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [blockedEndDate, setBlockedEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(accessToken: string) {
    const response = await fetch("/api/mentor-availability", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(`${body.error ?? "לא ניתן לטעון את הזמינות."} (${body.code ?? "AVAILABILITY_LOAD_FAILED"})`);
      return;
    }
    setWindows(body.windows ?? []);
    setBlackouts(body.blackouts ?? []);
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
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/mentor-availability", {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: editingId || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(`${body.error ?? "לא ניתן לשמור את הזמינות."} (${body.code ?? "AVAILABILITY_SAVE_FAILED"})`);
        return;
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
  async function addBlackout() {
    if (!blockedDate) return;
    const response = await fetch("/api/mentor-availability", {
      method: editingId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "blackout", startsOn: blockedDate, endsOn: blockedEndDate || blockedDate, reason: "חסימה אישית" }),
    });
    setMessage(response.ok ? "התאריך נחסם." : "לא ניתן לחסום את התאריך.");
    if (response.ok) { setEditingId(""); await load(token); }
  }
  async function remove(id: string, type: "window" | "blackout") {
    const response = await fetch(`/api/mentor-availability?id=${id}&type=${type}`, {
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
        <Select label="יום" value={String(form.weekday)} onChange={(value) => setForm({ ...form, weekday: Number(value) })} options={DAYS.map((label, value) => ({ label, value: String(value) }))} />
        <Select label="אופן פגישה" value={form.meetingMode} onChange={(meetingMode) => setForm({ ...form, meetingMode })} options={["אונליין", "פרונטלי"].map((value) => ({ label: value, value }))} />
        <label className="grid gap-2 font-bold">משעה<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="rounded-xl border p-3" /></label>
        <label className="grid gap-2 font-bold">עד שעה<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="rounded-xl border p-3" /></label>
<label className="grid gap-2 font-bold">מתאריך (לא חובה)<input type="date" value={form.effectiveStartDate} onChange={(event) => setForm({ ...form, effectiveStartDate: event.target.value })} className="rounded-xl border p-3" /></label><label className="grid gap-2 font-bold">עד תאריך (לא חובה)<input type="date" value={form.effectiveEndDate} onChange={(event) => setForm({ ...form, effectiveEndDate: event.target.value })} className="rounded-xl border p-3" /></label>
        <fieldset className="sm:col-span-2"><legend className="font-bold">משכים נתמכים</legend><div className="mt-2 flex flex-wrap gap-2">{DURATIONS.map((duration) => <button type="button" key={duration} onClick={() => setForm({ ...form, durations: form.durations.includes(duration) ? form.durations.filter((item) => item !== duration) : [...form.durations, duration] })} className={`min-h-11 rounded-xl border px-4 py-2 font-bold ${form.durations.includes(duration) ? "bg-blue-700 text-white" : ""}`}>{duration} דקות</button>)}</div>
          <div className="mt-3 flex flex-wrap items-end gap-2"><label className="grid gap-1 font-bold">משך מותאם אישית (15–180 דקות, בקפיצות של 5)<input type="number" min={15} max={180} step={5} value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} className="min-h-11 rounded-xl border p-3" /></label><button type="button" onClick={() => { const value = Number(customDuration); if (!Number.isInteger(value) || value < 15 || value > 180 || value % 5 !== 0) { setMessage("משך מותאם חייב להיות בין 15 ל־180 דקות ובקפיצות של 5. (INVALID_DURATION)"); return; } setForm({ ...form, durations: [...new Set([...form.durations, value])] }); setCustomDuration(""); }} className="min-h-11 rounded-xl border px-4 py-2 font-bold">הוספת משך</button></div>
        </fieldset>
        <button type="button" onClick={addWindow} disabled={busy} className="min-h-12 rounded-xl bg-blue-700 font-black text-white disabled:bg-slate-400 sm:col-span-2">{busy ? "שומר..." : editingId ? "עדכון חלון זמינות" : "הוספת חלון זמינות"}</button>
      </div>
      <div className="mt-6 grid gap-3">{windows.map((window) => <div key={window.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"><p className="font-bold">{DAYS[window.weekday]} · {window.start_time.slice(0, 5)}–{window.end_time.slice(0, 5)} · {window.meeting_mode} · {window.supported_durations.join(", ")} דקות</p><div className="flex gap-2"><button type="button" onClick={() => { setEditingId(window.id); setForm({ weekday: window.weekday, startTime: window.start_time.slice(0, 5), endTime: window.end_time.slice(0, 5), meetingMode: window.meeting_mode, durations: window.supported_durations, effectiveStartDate: "", effectiveEndDate: "" }); }} className="rounded-xl border px-3 py-2">עריכה</button><button type="button" onClick={() => toggle(window)} className="rounded-xl border px-3 py-2">{window.is_active ? "השבתה" : "הפעלה"}</button><button type="button" onClick={() => remove(window.id, "window")} className="rounded-xl border border-red-200 px-3 py-2 text-red-700">מחיקה</button></div></div>)}</div>
      <div className="mt-8 rounded-3xl border bg-white p-5"><h2 className="text-xl font-black">חסימת תאריך</h2><div className="mt-3 flex flex-wrap gap-3"><label className="grid gap-1">מתאריך<input type="date" value={blockedDate} onChange={(event) => setBlockedDate(event.target.value)} className="min-h-12 rounded-xl border p-3" /></label><label className="grid gap-1">עד תאריך<input type="date" value={blockedEndDate} onChange={(event) => setBlockedEndDate(event.target.value)} className="min-h-12 rounded-xl border p-3" /></label><button type="button" onClick={addBlackout} className="rounded-xl bg-slate-900 px-5 font-bold text-white">חסימה</button></div><div className="mt-4 grid gap-2">{blackouts.map((blackout) => <div key={blackout.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{new Date(blackout.starts_at).toLocaleDateString("he-IL")}</span><button type="button" onClick={() => remove(blackout.id, "blackout")} className="text-red-700">הסרה</button></div>)}</div></div>

    </MentorPageShell>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }) {
  return <label className="grid gap-2 font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border p-3">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
