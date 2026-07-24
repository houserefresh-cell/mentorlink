"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { ChoicePills, Field, FormMessage, LoadingPage, MentorPageShell, SavePanel, inputClassName, toggleValue } from "../_components/MentorPageShell";

const SCHOOLS = ["בית ספר יסודי", "חטיבת ביניים", "תיכון", "בית ספר אחר"];
const PLACES = ["בבית התלמיד", "בבית החונך", "בבית הספר", "במרכז קהילתי", "אונליין"];

export default function LocationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [city, setCity] = useState("");
  const [areas, setAreas] = useState("");
  const [schools, setSchools] = useState<string[]>([]);
  const [customSchool, setCustomSchool] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);
  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      setUserId(auth.user.id);
      const { data, error } = await supabase.from("mentor_locations").select("*").eq("user_id", auth.user.id).maybeSingle();
      if (error) { console.error(error); setMessage({ type: "error", text: `שגיאה בטעינה: ${error.message}` }); }
      if (data) { setCity(data.city); setAreas((data.activity_areas ?? []).join(", ")); setSchools(data.preferred_schools ?? []); setCustomSchool(data.custom_school ?? ""); setPlaces(data.meeting_places ?? []); }
      setLoading(false);
    } load();
  }, [router]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!schools.length || !places.length) return setMessage({ type: "error", text: "יש לבחור לפחות בית ספר מועדף אחד ומקום מפגש אחד." });
    if (schools.includes("בית ספר אחר") && !customSchool.trim()) return setMessage({ type: "error", text: "יש להזין את שם בית הספר האחר." });
    setSaving(true); setMessage(null);
    const { error } = await supabase.from("mentor_locations").upsert({ user_id: userId, city: city.trim(), activity_areas: areas.split(",").map((v) => v.trim()).filter(Boolean), preferred_schools: schools, custom_school: schools.includes("בית ספר אחר") ? customSchool.trim() : null, meeting_places: places, updated_at: new Date().toISOString() });
    if (error) console.error(error);
    setMessage(error ? { type: "error", text: `שגיאה בשמירה: ${error.message}` } : { type: "success", text: "אזורי הפעילות נשמרו בהצלחה." }); setSaving(false);
  }
  if (loading) return <LoadingPage text="טוען אזורי פעילות..." />;
  return <MentorPageShell title="אזורי פעילות ובתי ספר" description="בחרו היכן תוכלו לקיים את מפגשי החונכות.">
    <form onSubmit={save} className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="עיר מגורים" htmlFor="city"><input id="city" required value={city} onChange={(e) => setCity(e.target.value)} className={inputClassName} /></Field>
        <Field label="שכונות או אזורי פעילות" htmlFor="areas"><input id="areas" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="הפרדה בפסיקים" className={inputClassName} /></Field>
      </div>
      <div className="mt-7"><h2 className="mb-3 font-bold">בתי ספר מועדפים</h2><ChoicePills options={SCHOOLS} selected={schools} onToggle={(v) => setSchools(toggleValue(schools, v))} /></div>
      {schools.includes("בית ספר אחר") && <div className="mt-5"><Field label="שם בית הספר האחר" htmlFor="customSchool"><input id="customSchool" required value={customSchool} onChange={(e) => setCustomSchool(e.target.value)} className={inputClassName} /></Field></div>}
      <div className="mt-7"><h2 className="mb-3 font-bold">מקומות מפגש</h2><ChoicePills options={PLACES} selected={places} onToggle={(v) => setPlaces(toggleValue(places, v))} /></div>
      <SavePanel saving={saving} message={message} label="שמירת אזורי פעילות" />
    </form>
  </MentorPageShell>;
}
