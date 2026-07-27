"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Inquiry = {
  id: string;
  mentor_display_name?: string;
  subject: string | null;
  child_grade_or_age: string | null;
  message: string;
  status: string;
  mentor_response: string | null;
  created_at: string;
};

const STATUS: Record<string, string> = {
  pending: "ממתינה",
  responded: "נענתה",
  closed: "טופלה",
  cancelled: "בוטלה",
};

export default function MentorInquiriesPanel({ role }: { role: "parent" | "mentor" }) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/mentor-inquiries", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json();
    setItems(body.inquiries ?? []);
  }, []);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token ?? "";
      setToken(accessToken);
      if (accessToken) void load(accessToken);
    });
  }, [load]);
  async function act(id: string, action: string) {
    if (!confirm("להמשיך בפעולה?")) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/mentor-inquiries/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, response: responses[id] ?? "" }),
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "הפנייה עודכנה." : body.error ?? "לא ניתן לעדכן.");
      if (response.ok) await load(token);
    } finally {
      setBusyId("");
    }
  }
  return (
    <section dir="rtl" className="mt-8">
      <h2 className="text-2xl font-black">{role === "mentor" ? "פניות מהורים" : "הפניות שלי"}</h2>
      {!items.length ? <p className="mt-4 rounded-2xl bg-white p-5 text-slate-600">אין פניות להצגה.</p> : (
        <div className="mt-4 grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-black">{role === "parent" ? item.mentor_display_name : item.subject || "פנייה כללית"}</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">{STATUS[item.status] ?? item.status}</span>
              </div>
              {role === "parent" && item.subject && <p className="mt-2 font-bold">{item.subject}</p>}
              {item.child_grade_or_age && <p className="mt-2 text-sm text-slate-600">כיתה או גיל: {item.child_grade_or_age}</p>}
              <p className="mt-3 whitespace-pre-wrap text-slate-800">{item.message}</p>
              {item.mentor_response && <p className="mt-3 rounded-xl bg-green-50 p-4"><strong>תשובת החונך:</strong> {item.mentor_response}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {role === "mentor" && ["pending", "responded"].includes(item.status) && (
                  <>
                    <textarea aria-label="תשובה לפנייה" value={responses[item.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} className="min-h-20 w-full rounded-xl border p-3" />
                    <button type="button" disabled={busyId === item.id || (responses[item.id] ?? "").trim().length < 2} onClick={() => act(item.id, "respond")} className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">שליחת תשובה</button>
                    <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "close")} className="rounded-xl border px-4 py-2 font-bold">סימון כטופל</button>
                  </>
                )}
                {role === "parent" && ["pending", "responded"].includes(item.status) && (
                  <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, "cancel")} className="rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700">ביטול הפנייה</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 font-bold">{message}</p>}
    </section>
  );
}
