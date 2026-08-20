"use client";
/* eslint-disable react-hooks/exhaustive-deps -- load runs once on initial dashboard entry */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Update = { id:string; update_type:string; activityTitle:string; mentorName?:string; scheduledStart?:string|null; registeredCount?:number; relevantChildren?:string[]; body:string; delay_minutes?:number|null; proposed_start_at?:string|null; created_at:string; readAt?:string|null; response?:{response:string}|null };
const labels:Record<string,string>={operational:"עדכון",reminder:"תזכורת",equipment:"ציוד",meeting_point:"נקודת מפגש",delay:"עיכוב",postponement:"דחייה",cancellation:"ביטול",general:"עדכון"};

export default function ParentActivityUpdates(){
 const[updates,setUpdates]=useState<Update[]>([]),[message,setMessage]=useState("");
 async function token(){return(await supabase.auth.getSession()).data.session?.access_token??""}
 async function load(){const response=await fetch("/api/parent/activity-updates",{headers:{Authorization:`Bearer ${await token()}`},cache:"no-store"});if(response.ok){const next=(await response.json()).updates??[];setUpdates(next);window.dispatchEvent(new CustomEvent("mentorlink:activity-attention",{detail:{count:next.filter((item:Update)=>!item.readAt).length}}));}}
 useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[]);
 async function send(updateId:string,body:Record<string,string>){const response=await fetch("/api/parent/activity-updates",{method:"POST",headers:{Authorization:`Bearer ${await token()}`,"Content-Type":"application/json"},body:JSON.stringify({updateId,...body})});const result=await response.json().catch(()=>({}));setMessage(response.ok?"העדכון נשמר.":result.error??"לא ניתן לשמור את העדכון.");if(response.ok)await load()}
 const unread=useMemo(()=>updates.filter(update=>!update.readAt),[updates]);
 const history=useMemo(()=>updates.filter(update=>update.readAt),[updates]);
 if(!updates.length)return null;
 return <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/60 p-6">
  <div className="flex items-center justify-between gap-4"><div><p className="font-black text-amber-800">חשוב לדעת</p><h2 className="text-2xl font-black">עדכונים מהחונכים</h2></div>{unread.length>0&&<span className="rounded-full bg-violet-600 px-3 py-1 font-black text-white">{unread.length}</span>}</div>
  {message&&<p role="status" className="mt-4 rounded-xl bg-white p-3 font-bold">{message}</p>}
  <UpdateList rows={unread} empty="אין עדכונים חדשים." send={send}/>
  {history.length>0&&<details className="mt-5 rounded-2xl border bg-white p-4"><summary className="cursor-pointer font-black">עדכונים שקראתי ({history.length})</summary><UpdateList rows={history} send={send}/></details>}
 </section>
}

function UpdateList({rows,empty,send}:{rows:Update[];empty?:string;send:(id:string,body:Record<string,string>)=>Promise<void>}){
 if(!rows.length)return empty?<p className="mt-4 rounded-xl bg-white p-4 text-slate-600">{empty}</p>:null;
 return <div className="mt-5 grid gap-4">{rows.map(update=><article key={update.id} className={`rounded-2xl border p-5 ${update.update_type==="cancellation"?"border-red-400 bg-red-50 ring-2 ring-red-100":"bg-white"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><span className={`rounded-full px-3 py-1 text-sm font-black ${update.update_type==="cancellation"?"bg-red-600 text-white":"bg-violet-100 text-violet-800"}`}>{update.update_type==="cancellation"?"התראה חשובה — ביטול פעילות":labels[update.update_type]??"עדכון"}</span><h3 className="mt-2 text-xl font-black text-slate-950">{update.activityTitle}</h3></div><time className="text-sm font-bold text-slate-700">{new Intl.DateTimeFormat("he-IL",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(update.created_at))}</time></div>{update.update_type==="cancellation"&&<div className="mt-4 grid gap-2 rounded-xl border border-red-200 bg-white p-4 font-bold text-slate-950 sm:grid-cols-2"><p><b>חונך/ת:</b> {update.mentorName||"לא צוין"}</p><p><b>המועד שבוטל:</b> {update.scheduledStart?new Date(update.scheduledStart).toLocaleString("he-IL"):"לא צוין"}</p><p><b>מספר הרשומים:</b> {update.registeredCount??0}</p><p><b>הילדים שלכם:</b> {update.relevantChildren?.join(", ")||"לא צוין"}</p></div>}<p className="mt-3 text-base font-semibold leading-7 text-slate-950">{update.body}</p>{update.delay_minutes&&<p className="mt-2 font-black text-amber-800">עיכוב משוער: {update.delay_minutes} דקות</p>}{update.update_type==="postponement"&&update.proposed_start_at&&<div className="mt-4 rounded-xl bg-blue-50 p-4"><p className="font-black">המועד החלופי המוצע</p><p>{new Intl.DateTimeFormat("he-IL",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(update.proposed_start_at))}</p>{update.response?<p className="mt-2 font-bold text-blue-800">תגובתכם: {update.response.response==="accepted"?"המועד מתאים":"המועד אינו מתאים"}</p>:<div className="mt-3 flex gap-3"><button onClick={()=>send(update.id,{response:"accepted"})} className="rounded-xl bg-green-600 px-4 py-2 font-black text-white">המועד מתאים</button><button onClick={()=>send(update.id,{response:"declined"})} className="rounded-xl border border-red-300 px-4 py-2 font-black text-red-700">המועד אינו מתאים</button></div>}</div>}{!update.readAt&&<button type="button" onClick={()=>send(update.id,{action:"mark_read"})} className="mt-4 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 font-black text-violet-900">קראתי — העברה להיסטוריה</button>}</article>)}</div>
}
