"use client";
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicMentor } from "@/lib/public-mentor-core";
import MeetingRequestFlow from "./MeetingRequestFlow";
import MentorInquiryFlow from "./MentorInquiryFlow";
import { ALL_CITIES, ALL_MODES, ALL_SUBJECTS, MAX_MENTOR_AGE, MEETING_MODES, MIN_MENTOR_AGE, REGIONAL_CITIES, filterPublicMentors, getOfferedSubjectOptions, normalizeCity, parseOptionalAge, validateAgeInputs } from "@/lib/public-mentor-filter";
type DirectoryAction="details"|"inquiry"|"meeting";type ActiveInteraction={mentor:PublicMentor;action:DirectoryAction};const INITIAL_BATCH=8;
export type MentorPublicActivity={id:string;title:string;subjectName:string;nextStartAt:string|null;registrationOpen:boolean};
export default function PublicMentorDirectory(props:{mentors:PublicMentor[];expandableFilters?:boolean;interactionMode?:"parent"|"read-only";mentorActivities?:Record<string,MentorPublicActivity[]>}){return <Suspense fallback={<DirectoryLoading/>}><DirectoryWithParams {...props}/></Suspense>}
function DirectoryWithParams(props:{mentors:PublicMentor[];expandableFilters?:boolean;interactionMode?:"parent"|"read-only";mentorActivities?:Record<string,MentorPublicActivity[]>}){const searchParams=useSearchParams();return <DirectoryContent key={searchParams.toString()} {...props} queryString={searchParams.toString()}/>}
function unique(values:string[]){return [...new Set(values)]}
function DirectoryContent({mentors,expandableFilters=false,interactionMode="parent",mentorActivities={},queryString}:{mentors:PublicMentor[];expandableFilters?:boolean;interactionMode?:"parent"|"read-only";mentorActivities?:Record<string,MentorPublicActivity[]>;queryString:string}){
 const router=useRouter(),pathname=usePathname(),params=useMemo(()=>new URLSearchParams(queryString),[queryString]);
 const subjectOptions=useMemo(()=>getOfferedSubjectOptions(mentors),[mentors]);
 const appliedCities=unique(params.getAll("city").map((value)=>REGIONAL_CITIES.find((city)=>normalizeCity(city)===normalizeCity(value))).filter((value):value is typeof REGIONAL_CITIES[number]=>Boolean(value)));
 const appliedSubjects=unique(params.getAll("subject").filter((value)=>subjectOptions.includes(value)));
 const appliedModes=unique(params.getAll("mode").filter((value)=>MEETING_MODES.includes(value as typeof MEETING_MODES[number])));
 const rawMin=parseOptionalAge(params.get("minAge")),rawMax=parseOptionalAge(params.get("maxAge")),validUrlRange=rawMin===null||rawMax===null||rawMin<=rawMax,appliedMin=validUrlRange?rawMin:null,appliedMax=validUrlRange?rawMax:null,explicit=params.get("search")==="1";
 const [cities,setCities]=useState<string[]>(appliedCities),[subjects,setSubjects]=useState<string[]>(appliedSubjects),[modes,setModes]=useState<string[]>(appliedModes),[minAge,setMinAge]=useState(appliedMin===null?"":String(appliedMin)),[maxAge,setMaxAge]=useState(appliedMax===null?"":String(appliedMax)),[ageError,setAgeError]=useState("");
 const [visibleCount,setVisibleCount]=useState(INITIAL_BATCH),[activeInteraction,setActiveInteraction]=useState<ActiveInteraction|null>(null);const originRef=useRef<HTMLButtonElement|null>(null);
 const openInteraction=useCallback((mentor:PublicMentor,action:DirectoryAction,origin:HTMLButtonElement|null=null)=>{originRef.current=origin;setActiveInteraction({mentor,action})},[]);const closeInteraction=useCallback(()=>{setActiveInteraction(null);queueMicrotask(()=>originRef.current?.focus())},[]);
 useEffect(()=>{const action=params.get("action");if(interactionMode==="read-only"&&action!=="details")return;if(action!=="details"&&action!=="inquiry"&&action!=="meeting")return;const mentor=mentors.find((candidate)=>candidate.bookingId===params.get("mentor"));if(mentor)queueMicrotask(()=>openInteraction(mentor,action))},[interactionMode,mentors,openInteraction,params]);
 const matching=explicit?filterPublicMentors(mentors,appliedCities,appliedSubjects,appliedModes,appliedMin,appliedMax):mentors;
 const visible=matching.slice(0,visibleCount);
 function submit(){setVisibleCount(INITIAL_BATCH);const error=validateAgeInputs(minAge,maxAge);setAgeError(error??"");if(error)return;const next=new URLSearchParams();next.set("search","1");for(const city of unique(cities))next.append("city",city);for(const subject of unique(subjects))next.append("subject",subject);for(const mode of unique(modes))next.append("mode",mode);if(minAge)next.set("minAge",minAge);if(maxAge)next.set("maxAge",maxAge);router.push(`${pathname}?${next}`,{scroll:false})}
 function clearSearch(){router.push(pathname,{scroll:false})}
 function remove(group:"city"|"subject"|"mode",value:string){if(group==="city")setCities((items)=>items.filter((item)=>item!==value));if(group==="subject")setSubjects((items)=>items.filter((item)=>item!==value));if(group==="mode")setModes((items)=>items.filter((item)=>item!==value))}
 const chips=[...cities.map((value)=>({group:"city" as const,value})),...subjects.map((value)=>({group:"subject" as const,value})),...modes.map((value)=>({group:"mode" as const,value}))];
 return <section dir="rtl" aria-label="גילוי חונכים" className="mx-auto w-full max-w-7xl overflow-x-clip">
  {expandableFilters&&<div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><MultiSelectPanel id="cities" label="עיר או יישוב" allLabel={ALL_CITIES} options={[...REGIONAL_CITIES]} values={cities} onApply={setCities}/>{subjectOptions.length>0&&<MultiSelectPanel id="subjects" label="מקצוע או תחום" allLabel={ALL_SUBJECTS} options={subjectOptions} values={subjects} onApply={setSubjects}/>}<MultiSelectPanel id="modes" label="אופן מפגש" allLabel={ALL_MODES} options={[...MEETING_MODES]} values={modes} onApply={setModes}/><div className="rounded-xl border border-slate-200 bg-white p-3"><span className="block text-sm font-black text-slate-700">מרחק מהבית</span><button type="button" disabled className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-right text-slate-500">ללא הגבלת מרחק</button><p className="mt-2 text-xs text-slate-500">סינון מרחק יהיה זמין לאחר הוספת נתוני מיקום מדויקים ובטוחים.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label htmlFor="mentor-min-age" className="text-sm font-black text-slate-700">גיל מינימלי<input id="mentor-min-age" inputMode="numeric" type="number" min={MIN_MENTOR_AGE} max={MAX_MENTOR_AGE} step="1" value={minAge} onChange={(event)=>setMinAge(event.target.value)} aria-describedby={ageError?"mentor-age-error":undefined} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label><label htmlFor="mentor-max-age" className="text-sm font-black text-slate-700">גיל מקסימלי<input id="mentor-max-age" inputMode="numeric" type="number" min={MIN_MENTOR_AGE} max={MAX_MENTOR_AGE} step="1" value={maxAge} onChange={(event)=>setMaxAge(event.target.value)} aria-describedby={ageError?"mentor-age-error":undefined} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label></div>{ageError&&<p id="mentor-age-error" role="alert" className="mt-2 font-bold text-red-700">{ageError}</p>}<div aria-label="מסננים שנבחרו" className="mt-4 flex flex-wrap gap-2">{chips.map((chip)=><button key={`${chip.group}-${chip.value}`} type="button" onClick={()=>remove(chip.group,chip.value)} className="min-h-10 rounded-full bg-blue-100 px-3 text-sm font-bold text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{chip.value} ×</button>)}{minAge&&<button type="button" onClick={()=>setMinAge("")} className="min-h-10 rounded-full bg-blue-100 px-3 text-sm font-bold text-blue-800">מגיל {minAge} ×</button>}{maxAge&&<button type="button" onClick={()=>setMaxAge("")} className="min-h-10 rounded-full bg-blue-100 px-3 text-sm font-bold text-blue-800">עד גיל {maxAge} ×</button>}</div><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={submit} className="min-h-12 rounded-xl bg-blue-700 px-8 font-black text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">חיפוש</button>{explicit&&<button type="button" onClick={clearSearch} className="min-h-12 rounded-xl border border-blue-200 bg-white px-6 font-black text-blue-700">ניקוי החיפוש</button>}</div></div>}
  <div className="mt-6"><h2 className="text-2xl font-black">{explicit?"תוצאות החיפוש":expandableFilters?"חונכים מוצעים עבורכם":"חונכים זמינים"}</h2>{!explicit&&expandableFilters&&<p className="mt-1 text-sm text-slate-600">המלצות כלליות מתוך החונכים שפורסמו, עד שיושלמו פרטי הילד והעדפות החיפוש.</p>}<p role="status" aria-live="polite" className="mt-1 text-sm font-bold text-slate-600">נמצאו {matching.length} חונכים</p></div>
  {matching.length?<><div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),17.5rem))] justify-center gap-4">{visible.map((mentor,index)=><MentorCard key={`${mentor.bookingId}-${index}`} mentor={mentor} activities={mentorActivities[mentor.bookingId]??[]} onOpen={openInteraction} readOnly={interactionMode==="read-only"}/>)}</div>{visible.length<matching.length&&<div className="mt-7 text-center"><button type="button" onClick={()=>setVisibleCount((count)=>count+INITIAL_BATCH)} className="min-h-12 rounded-xl border border-blue-700 px-6 font-black text-blue-700">הצגת חונכים נוספים</button></div>}</>:<EmptyState hasMentors={mentors.length>0} onReset={clearSearch}/>}
  {activeInteraction?.action==="details"&&<MentorDetailsDialog mentor={activeInteraction.mentor} activities={mentorActivities[activeInteraction.mentor.bookingId]??[]} onClose={closeInteraction}/>} {interactionMode==="parent"&&activeInteraction?.action==="inquiry"&&<MentorInquiryFlow mentorBookingId={activeInteraction.mentor.bookingId} mentorDisplayName={activeInteraction.mentor.displayName} subjects={activeInteraction.mentor.subjects} open onClose={closeInteraction}/>} {interactionMode==="parent"&&activeInteraction?.action==="meeting"&&<MeetingRequestFlow mentorBookingId={activeInteraction.mentor.bookingId} mentorDisplayName={activeInteraction.mentor.displayName} open onClose={closeInteraction}/>}
 </section>
}
function MultiSelectPanel({id,label,allLabel,options,values,onApply}:{id:string;label:string;allLabel:string;options:string[];values:string[];onApply:(values:string[])=>void}){const[open,setOpen]=useState(false),[draft,setDraft]=useState(values);return <div className="relative"><button id={`${id}-button`} type="button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={()=>{setDraft(values);setOpen((value)=>!value)}} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-right font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{values.length?`${label}: ${values.length}`:allLabel}</button>{open&&<div id={`${id}-panel`} role="group" aria-labelledby={`${id}-button`} className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"><button type="button" aria-pressed={draft.length===0} onClick={()=>setDraft([])} className={`min-h-11 w-full rounded-xl px-3 text-right font-bold ${draft.length===0?"bg-blue-700 text-white":"hover:bg-slate-100"}`}>{allLabel}</button>{options.map((option)=><label key={option} className={`mt-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 ${draft.includes(option)?"bg-blue-100 text-blue-900":"hover:bg-slate-100"}`}><input type="checkbox" checked={draft.includes(option)} onChange={()=>setDraft((items)=>items.includes(option)?items.filter((item)=>item!==option):[...items,option])} className="h-5 w-5 accent-blue-700"/>{option}</label>)}<div className="sticky bottom-0 mt-3 flex gap-2 bg-white pt-2"><button type="button" onClick={()=>{onApply(unique(draft));setOpen(false)}} className="min-h-11 flex-1 rounded-xl bg-blue-700 font-black text-white">החלה</button><button type="button" onClick={()=>{setDraft([]);onApply([]);setOpen(false)}} className="min-h-11 rounded-xl border px-3 font-bold">ניקוי</button></div></div>}</div>}
function DirectoryLoading(){return <div role="status" className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-600">טוען חונכים...</div>}
function MentorCard({ mentor, activities, onOpen, readOnly }: { mentor: PublicMentor; activities: MentorPublicActivity[]; onOpen: (mentor: PublicMentor, action: DirectoryAction, origin: HTMLButtonElement) => void; readOnly: boolean }) {
  const initial = Array.from(mentor.displayName.trim())[0] || "מ";
  const shortIntroduction = mentor.introduction && mentor.introduction.length > 90 ? `${mentor.introduction.slice(0, 87).trimEnd()}…` : mentor.introduction;
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200">
      <div className="flex min-w-0 items-center gap-3"><Avatar initial={initial} large={false} /><div className="min-w-0"><h3 className="break-words text-xl font-black leading-tight text-slate-950">{mentor.displayName}</h3>{mentor.city && <City city={mentor.city} />}</div></div>
      {mentor.subjects.length > 0 && <ul aria-label="תחומי חונכות" className="mt-3 flex min-w-0 flex-wrap gap-1.5">{mentor.subjects.map((subject) => <li key={subject} className="max-w-full break-words rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold leading-5 text-blue-800 [overflow-wrap:anywhere]">{subject}</li>)}</ul>}
      <div className="mt-3 grid gap-2"><CompactLine label="מתאים לגילאים" values={mentor.ageGroups} /><CompactLine label="אופן המפגש" values={mentor.meetingModes} /></div>
      {shortIntroduction && <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-slate-600">{shortIntroduction}</p>}
      {activities.length>0&&<p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-black text-violet-800">{activities.length} פעילויות פתוחות של החונך</p>}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        {!readOnly && <button type="button" onClick={(event) => onOpen(mentor, "meeting", event.currentTarget)} aria-haspopup="dialog" className="col-span-2 min-h-11 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">בקשת פגישה</button>}
        {!readOnly && <button type="button" onClick={(event) => onOpen(mentor, "inquiry", event.currentTarget)} aria-haspopup="dialog" className="min-h-11 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-black text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">פנייה לחונך</button>}
        <button type="button" onClick={(event) => onOpen(mentor, "details", event.currentTarget)} aria-haspopup="dialog" className="min-h-11 rounded-xl px-3 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">לפרטים</button>
      </div>
    </article>
  );
}
function MentorDetailsDialog({ mentor, activities, onClose }: { mentor: PublicMentor; activities: MentorPublicActivity[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const initial = Array.from(mentor.displayName.trim())[0] || "מ";
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  return (
    <dialog ref={dialogRef} dir="rtl" aria-labelledby={titleId} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} className="m-auto max-h-[90dvh] w-[min(calc(100%_-_2rem),34rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-right text-slate-950 shadow-2xl backdrop:bg-slate-950/55">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur"><h2 id={titleId} className="text-lg font-black">פרטי החונך</h2><button type="button" onClick={() => dialogRef.current?.close()} aria-label="סגירת פרטי החונך" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-2xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">×</button></div>
      <div className="p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-4 rounded-2xl bg-gradient-to-l from-blue-50 to-violet-50 p-4"><Avatar initial={initial} large /><div className="min-w-0"><p className="break-words text-2xl font-black">{mentor.displayName}</p>{mentor.city && <City city={mentor.city} />}</div></div>
        {mentor.subjects.length > 0 && <DetailsSection title="תחומי חונכות"><ul className="flex min-w-0 flex-wrap gap-1.5">{mentor.subjects.map((subject) => <li key={subject} className="max-w-full break-words rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800 [overflow-wrap:anywhere]">{subject}</li>)}</ul></DetailsSection>}
        {mentor.introduction && <DetailsSection title="קצת עליי"><p className="whitespace-pre-wrap break-words leading-7 text-slate-700">{mentor.introduction}</p></DetailsSection>}
        <DetailsValues title="מתאים לגילאים" values={mentor.ageGroups} /><DetailsValues title="ניסיון וסוגי חונכות" values={mentor.experience} /><DetailsValues title="אופן המפגש" values={mentor.meetingModes} /><DetailsValues title="זמינות כללית" values={mentor.availability} />
        {activities.length>0&&<DetailsSection title="הפעילויות של החונך"><div className="grid gap-2">{activities.map(activity=><a key={activity.id} href={`#activity-${activity.id}`} onClick={()=>dialogRef.current?.close()} className="rounded-xl border border-violet-200 bg-violet-50 p-3 font-bold text-violet-900"><span className="block font-black">{activity.title}</span><span className="text-sm">{activity.subjectName}{activity.nextStartAt?` · ${new Intl.DateTimeFormat("he-IL",{day:"numeric",month:"long"}).format(new Date(activity.nextStartAt))}`:""} · {activity.registrationOpen?"פתוחה להרשמה":"ההרשמה נסגרה"}</span></a>)}</div></DetailsSection>}
      </div>
    </dialog>
  );
}
function Avatar({ initial, large }: { initial: string; large: boolean }) {
  return <div aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-600 to-violet-600 font-black text-white shadow-md shadow-blue-200/70 ${large ? "h-16 w-16 rounded-2xl text-2xl" : "h-12 w-12 rounded-xl text-lg"}`}>{initial}</div>;
}

function City({ city }: { city: string }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1 text-sm font-bold text-slate-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
      <span className="truncate">{city}</span>
    </p>
  );
}

function CompactLine({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return <p className="min-w-0 break-words text-sm leading-6 text-slate-700"><span className="font-black text-slate-500">{label}: </span><span className="font-bold">{values.join(" · ")}</span></p>;
}

function DetailsValues({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <DetailsSection title={title}><p className="break-words leading-7 text-slate-700">{values.join(" · ")}</p></DetailsSection>;
}

function DetailsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 border-t border-slate-100 pt-5"><h3 className="mb-2 text-sm font-black text-slate-950">{title}</h3>{children}</section>;
}

function EmptyState({ hasMentors, onReset }: { hasMentors: boolean; onReset: () => void }) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm sm:px-8">
      <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">⌕</div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{hasMentors ? "לא נמצאו חונכים שמתאימים לחיפוש" : "עדיין אין חונכים שפורסמו"}</h3>
      <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">{hasMentors ? "אפשר לנסות תחום אחר, לבחור עיר אחרת או לנקות את הסינון." : "אנחנו בונים את קהילת החונכים בזהירות. כדאי לחזור אלינו בקרוב."}</p>
      {hasMentors && <button type="button" onClick={onReset} className="mt-5 min-h-12 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">ניקוי החיפוש</button>}
    </div>
  );
}
