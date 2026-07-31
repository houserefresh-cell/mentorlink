"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { getDashboardPath } from "@/lib/auth-routing";
import { supabase } from "@/lib/supabase";
import { isActiveGeneralInquiry, isUpcomingApprovedMeeting, requiresMentorAction, waitsForParentAction } from "@/lib/mentor-dashboard-status";

export const mentorNavigation = [
 {href:"/dashboard/mentor",label:"עמוד הבית"},
 {href:"/dashboard/mentor/meetings",label:"בקשות ופגישות",badge:"meetings"},
 {href:"/dashboard/mentor/inquiries",label:"פניות מהורים",badge:"inquiries"},
 {href:"/dashboard/mentor/scheduling",label:"הזמינות שלי"},
 {href:"/dashboard/mentor/profile",label:"הפרופיל שלי"},
 {href:"/dashboard/mentor/activities/new",label:"פתיחת פעילות חדשה"},
 {href:"/dashboard/mentor/activities",label:"הפעילויות שלי"},
 {href:"/dashboard/mentor/discover",label:"חיפוש חונכים ופעילויות"},
 {href:"/dashboard/mentor/account",label:"החשבון שלי"},
] as const;
type Summary={mentorActionMeetings:number;waitingForParent:number;activeInquiries:number;upcomingMeetings:number;availabilityConfigured:boolean|null;profileConfigured:boolean|null;summaryState:"loading"|"loaded"|"error"};
const empty:Summary={mentorActionMeetings:0,waitingForParent:0,activeInquiries:0,upcomingMeetings:0,availabilityConfigured:null,profileConfigured:null,summaryState:"loading"};
const Context=createContext(empty);
export function useMentorDashboard(){return useContext(Context)}

export default function MentorDashboardShell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter();const[ready,setReady]=useState(false),[name,setName]=useState(""),[email,setEmail]=useState(""),[summary,setSummary]=useState(empty);
 useEffect(()=>{let active=true;async function load(){
  const{data}=await supabase.auth.getUser();if(!active)return;if(!data.user){router.replace("/login");return}
  const destination=await getDashboardPath(data.user.id);if(!active)return;if(destination!=="/dashboard/mentor"){router.replace(destination);return}
  setName(data.user.user_metadata?.first_name??"");setEmail(data.user.email??data.user.phone??"");
  const token=(await supabase.auth.getSession()).data.session?.access_token;if(token){const headers={Authorization:`Bearer ${token}`};const safeFetch=(input:string,init:RequestInit)=>fetch(input,init).catch(()=>new Response(null,{status:503}));const responses=await Promise.all([safeFetch("/api/meeting-requests",{headers,cache:"no-store"}),safeFetch("/api/mentor-inquiries",{headers,cache:"no-store"}),safeFetch("/api/mentor-availability",{headers,cache:"no-store"}),safeFetch("/api/mentor-profile",{headers,cache:"no-store"})]);const bodies=await Promise.all(responses.map((response)=>response.ok?response.json():Promise.resolve({})));const meetings=bodies[0].requests??[],inquiries=bodies[1].inquiries??[],now=Date.now();setSummary({
   mentorActionMeetings:meetings.filter(requiresMentorAction).length,
   waitingForParent:meetings.filter(waitsForParentAction).length,
   activeInquiries:inquiries.filter(isActiveGeneralInquiry).length,
   upcomingMeetings:meetings.filter((item:{status:string;confirmed_start_at?:string|null})=>isUpcomingApprovedMeeting(item,now)).length,
   availabilityConfigured:responses[2].ok?(bodies[2].windows??[]).some((item:{is_active?:boolean})=>item.is_active!==false):null,
   profileConfigured:responses[3].ok?Boolean(bodies[3].profile?.first_name&&bodies[3].profile?.bio):null,
   summaryState:responses[0].ok&&responses[1].ok?"loaded":"error",
  })}
  if(active)setReady(true)
 }void load();return()=>{active=false}},[router,pathname]);
 if(!ready)return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p role="status" className="font-bold text-slate-600">טוען את אזור החונכים...</p></main>;
 const nav=(mobile=false)=><nav aria-label={mobile?"ניווט חונכים בנייד":"ניווט חונכים"} className="grid gap-1">{mentorNavigation.map((item)=>{const exact=item.href==="/dashboard/mentor"||item.href==="/dashboard/mentor/activities";const selected=exact?pathname===item.href:pathname.startsWith(item.href);const badge="badge" in item?item.badge:undefined;const count=badge==="meetings"?summary.mentorActionMeetings:badge==="inquiries"?summary.activeInquiries:0;return <Link key={item.href} href={item.href} aria-current={selected?"page":undefined} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected?"bg-blue-700 text-white":"text-slate-700 hover:bg-blue-50 hover:text-blue-800"}`}><span>{item.label}</span>{count>0&&<span aria-label={`${count} פריטים דורשים תשומת לב`} className={`rounded-full px-2 py-0.5 text-xs font-black ${selected?"bg-white text-blue-800":"bg-red-600 text-white"}`}>{count}</span>}</Link>})}</nav>;
 return <Context.Provider value={summary}><div dir="rtl" className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-3 sm:px-6"><Link href="/dashboard/mentor" aria-label="MentorLink – עמוד הבית לחונכים" className="flex items-center gap-3 font-black text-blue-700"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl text-white">M</span><span className="text-xl">MentorLink</span></Link><div className="flex items-center gap-3"><span className="hidden text-left sm:block"><span className="block font-bold text-slate-700">{name?`שלום, ${name}`:"אזור החונכים"}</span>{email&&<span className="block text-xs text-slate-500">{email}</span>}</span><button type="button" onClick={async()=>{await supabase.auth.signOut();router.push("/login")}} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-bold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">התנתקות</button><details className="relative lg:hidden"><summary aria-label="פתיחת תפריט החונכים" className="cursor-pointer list-none rounded-xl border border-slate-300 px-4 py-2.5 font-black marker:content-none">תפריט</summary><div className="absolute left-0 top-14 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">{nav(true)}</div></details></div></div></header>
  <div className="mx-auto grid max-w-[96rem] lg:grid-cols-[18rem_minmax(0,1fr)]"><aside className="sticky top-[69px] hidden h-[calc(100vh-69px)] overflow-y-auto border-l border-slate-200 bg-white p-5 lg:block"><p className="mb-4 px-4 text-sm font-black text-slate-500">האזור האישי לחונכים</p>{nav()}</aside><main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10">{children}</main></div>
 </div></Context.Provider>
}
