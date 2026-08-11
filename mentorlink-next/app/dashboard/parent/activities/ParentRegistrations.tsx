"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Registration = {
  id: string;
  child_first_name: string;
  status: string;
  feedback_submitted: boolean;
  activity: {
    title: string;
    status: string;
    description: string | null;
    venue_name: string | null;
    location_type: string;
    location_details: string | null;
    address: string | null;
    equipment: string | null;
    price: number | null;
    is_free: boolean | null;
    min_participants: number | null;
    max_participants: number | null;
    minimum_age: number | null;
    maximum_age: number | null;
    suitable_grades: string[] | null;
    cancellation_policy: string | null;
    registeredCount: number;
    waitlistedCount: number;
    availablePlaces: number;
    mentor_first_name: string | null;
    mentor_last_name: string | null;
    mentor_phone: string | null;
    mentor_city: string | null;
    pickup_options: string[] | null;
    pickup_details: string | null;
    accessibility_options: string[] | null;
    accessibility_other: string | null;
  } | null;
  sessions: { starts_at: string; ends_at: string; estimated_overrun: string | null }[];
};

type Tabs = "closest" | "awaiting" | "cancelled" | "completed" | "all";

const status: Record<string, { label: string; style: string }> = {
  registered: { label: "רשום/ה", style: "bg-green-100 text-green-800" },
  waitlisted: { label: "רשימת המתנה", style: "bg-amber-100 text-amber-900" },
  cancelled: { label: "בוטלה", style: "bg-red-100 text-red-800" },
};

const tabs: Array<{ key: Tabs; label: string }> = [
  { key: "closest", label: "קרובות" },
  { key: "awaiting", label: "רשימת המתנה" },
  { key: "cancelled", label: "בוטלו" },
  { key: "completed", label: "הסתיימו" },
  { key: "all", label: "הכול" },
];

const locationLabels: Record<string, string> = {
  mentor_home: "בית החונך",
  mentee_home: "בית החניך",
  school: "בית ספר",
  public_place: "מקום ציבורי",
  sports_park: "ספורטק",
  community_center: "מרכז קהילתי",
  sports_complex: "מתחם ספורט",
  online: "מקוון",
  other: "מקום אחר",
};

export default function ParentRegistrations() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<Registration | null>(null);
  const [view, setView] = useState<Tabs>("closest");
  const [selectedChild, setSelectedChild] = useState("all");

  async function load() {
    setLoading(true);
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch("/api/parent/activity-registrations", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (response.ok) setRows((await response.json()).registrations ?? []);
    else setMessage("לא ניתן לטעון את ההרשמות כרגע.");
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextByRow = useMemo(() => {
    return Object.fromEntries(rows.map((row) => [row.id, row.sessions.find((session) => new Date(session.starts_at) > new Date()) ?? null]));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const sorted = [...rows].sort((left, right) => {
      const leftNext = nextByRow[left.id];
      const rightNext = nextByRow[right.id];
      if (leftNext && rightNext) return new Date(leftNext.starts_at).getTime() - new Date(rightNext.starts_at).getTime();
      if (leftNext && !rightNext) return -1;
      if (!leftNext && rightNext) return 1;
      return (left.activity?.title ?? "").localeCompare(right.activity?.title ?? "");
    });

    const childRows = selectedChild === "all" ? sorted : sorted.filter((row) => row.child_first_name === selectedChild);
    const tabbed = childRows.filter((row) => {
      const next = nextByRow[row.id];
      const cancelled = row.status === "cancelled" || row.activity?.status === "cancelled";
      const completed = !cancelled && (
        row.activity?.status === "completed" ||
        (row.sessions.length > 0 && row.sessions.every((session) => new Date(session.ends_at).getTime() < Date.now()))
      );
      if (view === "closest") return Boolean(next) && !completed && row.status === "registered";
      if (view === "awaiting") return row.status === "waitlisted";
      if (view === "cancelled") return cancelled;
      if (view === "completed") return completed;
      return true;
    });

    return tabbed;
  }, [nextByRow, rows, selectedChild, view]);

  const childNames = useMemo(() => [...new Set(rows.map((row) => row.child_first_name).filter(Boolean))], [rows]);

  async function cancel(id: string) {
    if (!confirm("לבטל את ההרשמה של הילד/ה לפעילות?")) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(`/api/parent/activity-registrations?registrationId=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setMessage(response.ok ? "ההרשמה בוטלה." : "לא ניתן לבטל את ההרשמה.");
    if (response.ok) await load();
  }

  if (loading) return <p className="mt-8 rounded-2xl bg-white p-6 font-bold">טוען הרשמות...</p>;

  return (
    <div className="mt-8">
      {message && <p role="status" className="mb-4 rounded-xl bg-blue-50 p-4 font-bold text-blue-900">{message}</p>}
      {rows.length ? (
        <div className="space-y-5">
          {childNames.length > 1 && <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 shadow-sm">
            <p className="mb-2 text-sm font-black text-violet-900">הצגת פעילויות לפי ילד/ה</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedChild("all")} className={`rounded-full px-4 py-2 text-sm font-black ${selectedChild === "all" ? "bg-violet-700 text-white" : "bg-white text-violet-900"}`}>כל הילדים</button>
              {childNames.map((child) => <button key={child} type="button" onClick={() => setSelectedChild(child)} className={`rounded-full px-4 py-2 text-sm font-black ${selectedChild === child ? "bg-violet-700 text-white" : "bg-white text-violet-900"}`}>{child}</button>)}
            </div>
          </div>}
          <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setView(tab.key)} className={`rounded-full px-4 py-2 text-sm font-black transition ${view === tab.key ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {visibleRows.map((row) => {
              const next = nextByRow[row.id];
              const cancelled = row.status === "cancelled" || row.activity?.status === "cancelled";
              const completed = !cancelled && (row.activity?.status === "completed" || (row.sessions.length > 0 && row.sessions.every(session => new Date(session.ends_at).getTime() < Date.now())));
              const badge = cancelled ? status.cancelled : completed ? { label: "הפעילות הסתיימה", style: "bg-slate-200 text-slate-900" } : status[row.status] ?? status.cancelled;
              return (
                <article key={row.id} className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-violet-700">עבור {row.child_first_name}</p>
                      <h2 className="mt-1 text-2xl font-black">{row.activity?.title ?? "פעילות"}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${badge.style}`}>{badge.label}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Info label="מקומות פנויים" value={String(row.activity?.availablePlaces ?? 0)} />
                    <Info label="מעמד" value={`${row.activity?.registeredCount ?? 0} רשומים · ${row.activity?.availablePlaces ?? 0} פנויים מתוך ${row.activity?.max_participants ?? 0}`} />
                  </div>

                  {next && (
                    <div className="mt-5 rounded-2xl bg-blue-700 p-4 text-white">
                      <p className="font-black">המפגש הקרוב</p>
                      <p className="mt-1 text-lg font-black">{dateLabel(next.starts_at)}</p>
                      <p className="text-xl font-black" dir="ltr">{timeLabel(next.starts_at)}–{timeLabel(next.ends_at)}</p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => setDetails(row)} className="rounded-xl border border-blue-300 px-4 py-2 font-black text-blue-800">פרטי הפעילות</button>
                    {row.activity?.mentor_phone && !completed && <ContactButtons phone={row.activity.mentor_phone} />}
                    {completed && row.status === "registered" && (row.feedback_submitted
                      ? <Link href={`/dashboard/parent/feedback#feedback-${row.id}`} className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 font-black text-violet-800">צפייה במשוב שמילאתי</Link>
                      : <Link href={`/dashboard/parent/feedback?registrationId=${row.id}`} className="rounded-xl bg-violet-700 px-4 py-2 font-black text-white">מילוי משוב</Link>)}
                    {!cancelled && !completed && (
                      <button type="button" onClick={() => cancel(row.id)} className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700">ביטול הרשמה לילד/ה</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!visibleRows.length && <div className="rounded-3xl border border-dashed bg-white p-8 text-center"><h2 className="text-xl font-black">אין פעילויות בקטגוריה הזו</h2><p className="mt-2 text-slate-600">אפשר לבחור ילד אחר או לעבור ל״הכול״.</p></div>}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
          <h2 className="text-xl font-black">עדיין אין הרשמות לפעילויות</h2>
          <p className="mt-2 text-slate-600">הפעילויות שתבחרו יופיעו כאן לפי הילדים.</p>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}>
          <section role="dialog" aria-modal="true" aria-label="פרטי הפעילות" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
              <h2 className="text-2xl font-black">{details.activity?.title ?? "פרטי פעילות"}</h2>
              <button onClick={() => setDetails(null)} aria-label="סגירת החלון" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-2xl font-black">×</button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
              <Detail title="תיאור" value={details.activity?.description ?? "לא צוינו פרטי פעילות."} wide />
              <Detail title="מועד" value={details.sessions.map((session) => `${dateLabel(session.starts_at)}, ${timeLabel(session.starts_at)}–${timeLabel(session.ends_at)}`).join("\n")} wide ltr />
              <Detail title="מיקום" value={[locationLabels[details.activity?.location_type ?? "other"] ?? "מקום אחר", details.activity?.venue_name, details.activity?.location_details].filter(Boolean).join(" · ")} />
              <Detail title="חונך" value={[details.activity?.mentor_first_name, details.activity?.mentor_last_name].filter(Boolean).join(" ") || "לא נקבע"} />
              <Detail title="מחיר" value={details.activity?.is_free ? "ללא עלות" : `${details.activity?.price ?? 0} ₪`} />
              <Detail title="ציוד" value={details.activity?.equipment || "לא נדרש להביא ציוד"} />
              <Detail title="איסוף" value={details.activity?.pickup_options?.length ? `${details.activity.pickup_options.join(", ")}${details.activity.pickup_details ? ` · ${details.activity.pickup_details}` : ""}` : "לא מוצע איסוף"} />
              <Detail title="נגישות והתאמות" value={[...(details.activity?.accessibility_options ?? []), details.activity?.accessibility_other].filter(Boolean).join(", ") || "לא סומנו התאמות"} />
              <Detail title="כמות" value={`${details.activity?.min_participants ?? 0}–${details.activity?.max_participants ?? 0}`} />
              <Detail title="סטטוס" value={details.activity?.status === "published" ? "פורסם" : details.activity?.status ?? "לא ידוע"} />
              <Detail title="רשומים" value={`${details.activity?.registeredCount ?? 0}`} />
              <Detail title="מקומות פנויים" value={`${details.activity?.availablePlaces ?? 0}`} />
              <Detail title="טלפון לחונך" value={details.activity?.mentor_phone || "מספר הטלפון מוסתר על פי מדיניות הפעילות"} wide />
              {details.activity?.mentor_phone && <div className="sm:col-span-2"><ContactButtons phone={details.activity.mentor_phone} /></div>}
              <Detail title="מדיניות ביטול" value={details.activity?.cancellation_policy || "לא צוינה מדיניות ביטול"} wide />
              <button type="button" onClick={() => setDetails(null)} className="sm:col-span-2 mt-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white">סגירת הפרטים</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Detail({ title, value, wide, ltr=false }: { title: string; value: string; wide?: boolean; ltr?:boolean }) {
  return <div className={`rounded-2xl border border-blue-100 bg-blue-50/60 p-4 ${wide ? "sm:col-span-2" : ""}`}><h3 className="font-black text-blue-900">{title}</h3><p dir={ltr?"ltr":undefined} className={`mt-1 whitespace-pre-line leading-7 text-slate-700 ${ltr?"text-right":""}`}>{value}</p></div>;
}

function ContactButtons({phone}:{phone:string}){const normalized=phone.replace(/[^0-9+]/g,"");const whatsapp=normalized.replace(/^0/,"972").replace(/^\+/,"");return <div className="flex flex-wrap gap-2"><a href={`tel:${normalized}`} className="rounded-xl bg-blue-700 px-4 py-2 font-black text-white">התקשרות לחונך</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-700 px-4 py-2 font-black text-white">WhatsApp לחונך</a></div>}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">{label}</span><strong className="block">{value}</strong></div>;
}

function dateLabel(value: string) { return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function timeLabel(value: string) { return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
