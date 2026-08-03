import type { ReactNode } from "react";

export type ActivityInfoKind = "subject" | "location" | "audience" | "participants" | "equipment" | "pickup" | "accessibility" | "cancellation" | "price" | "date" | "description" | "phone";

export type ActivityInfoItem = { kind: ActivityInfoKind; title: string; content: ReactNode };

const tones: Record<ActivityInfoKind, string> = {
  subject: "border-blue-300 bg-blue-50", location: "border-emerald-300 bg-emerald-50",
  audience: "border-violet-300 bg-violet-50", participants: "border-amber-300 bg-amber-50",
  equipment: "border-cyan-300 bg-cyan-50", pickup: "border-indigo-300 bg-indigo-50",
  accessibility: "border-teal-300 bg-teal-50", cancellation: "border-rose-300 bg-rose-50",
  price: "border-lime-300 bg-lime-50", date: "border-sky-300 bg-sky-50",
  description: "border-slate-300 bg-slate-50",
  phone: "border-fuchsia-300 bg-fuchsia-50",
};

export function ActivityInfoGrid({ items }: { items: ActivityInfoItem[] }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{items.map((item) => (
    <section key={`${item.kind}-${item.title}`} className={`flex min-h-32 gap-3 rounded-2xl border border-r-4 p-4 ${tones[item.kind]}`}>
      <span aria-hidden="true" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-white/80 text-slate-700"><ActivityIcon kind={item.kind} /></span>
      <div className="min-w-0"><h3 className="font-black text-slate-950">{item.title}</h3><div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.content}</div></div>
    </section>
  ))}</div>;
}

function ActivityIcon({ kind }: { kind: ActivityInfoKind }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<ActivityInfoKind, ReactNode> = {
    subject: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h6"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></>,
    audience: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2"/><path d="M3 21a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 5"/></>,
    participants: <><path d="M5 4v16M19 4v16M5 8h14M5 16h14"/><path d="M9 8v8M15 8v8"/></>,
    equipment: <><path d="M4 8h16v11H4zM9 8V5h6v3"/><path d="M4 13h16M10 13v2h4v-2"/></>,
    pickup: <><path d="M3 16V7h13l4 5v4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M16 8v4h4"/></>,
    accessibility: <><circle cx="12" cy="4" r="2"/><path d="M8 8h8l-2 5h-4zM12 8v13M8 21h8M7 13l-3 5M17 13l3 5"/></>,
    cancellation: <><circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/></>,
    price: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.6-.9-2.7-.9-1.5 0-2.6.8-2.6 2s1 1.8 2.7 2.2 2.7 1 2.7 2.4-1.2 2.2-2.9 2.2c-1.2 0-2.3-.4-3.1-1.1M12 6v12"/></>,
    date: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></>,
    description: <><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></>,
    phone: <><path d="M6.5 3h3l1.5 5-2 1.5a15 15 0 0 0 5.5 5.5l1.5-2 5 1.5v3A3.5 3.5 0 0 1 17.5 21C9.5 21 3 14.5 3 6.5A3.5 3.5 0 0 1 6.5 3z"/></>,
  };
  return <svg {...common}>{paths[kind]}</svg>;
}
