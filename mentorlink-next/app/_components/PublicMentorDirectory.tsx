"use client";

import { useMemo, useState } from "react";
import type { PublicMentor } from "@/lib/public-mentor-core";

export default function PublicMentorDirectory({ mentors }: { mentors: PublicMentor[] }) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("הכול");
  const cities = useMemo(
    () => [...new Set(mentors.map((mentor) => mentor.city).filter((value): value is string => Boolean(value)))].sort(),
    [mentors],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("he");
    return mentors.filter((mentor) => {
      const searchable = [
        mentor.displayName,
        mentor.city,
        mentor.introduction,
        ...mentor.subjects,
        ...mentor.experience,
        ...mentor.ageGroups,
      ].filter(Boolean).join(" ").toLocaleLowerCase("he");
      return (!query || searchable.includes(query)) && (city === "הכול" || mentor.city === city);
    });
  }, [city, mentors, search]);

  if (!mentors.length) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <h3 className="text-xl font-black">עדיין אין חונכים שפורסמו</h3>
        <p className="mt-2 text-slate-600">אנחנו בונים את הקהילה בזהירות. חזרו אלינו בקרוב.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-9 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px]">
        <label className="font-bold text-slate-700">
          חיפוש לפי שם או תחום
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-blue-500" />
        </label>
        <label className="font-bold text-slate-700">
          אזור
          <select value={city} onChange={(event) => setCity(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal">
            <option>הכול</option>
            {cities.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {filtered.length ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((mentor, index) => (
            <article key={`${mentor.displayName}-${mentor.city ?? ""}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-xl font-black text-white">{Array.from(mentor.displayName)[0]}</div>
              <h3 className="mt-5 text-xl font-black">{mentor.displayName}</h3>
              {mentor.city ? <p className="mt-1 font-bold text-slate-500">{mentor.city}</p> : null}
              {mentor.introduction ? <p className="mt-4 line-clamp-4 leading-7 text-slate-700">{mentor.introduction}</p> : null}
              <CardList label="תחומי חונכות" values={mentor.subjects} />
              <CardList label="גילים מתאימים" values={mentor.ageGroups} />
              <CardList label="אופן המפגש" values={mentor.meetingModes} />
              <CardList label="זמינות כללית" values={mentor.availability} />
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h3 className="text-xl font-black">לא נמצאו חונכים מתאימים</h3>
          <button type="button" onClick={() => { setSearch(""); setCity("הכול"); }} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">ניקוי החיפוש</button>
        </div>
      )}
    </>
  );
}

function CardList({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return <div className="mt-4"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-800">{values.join(" · ")}</p></div>;
}
