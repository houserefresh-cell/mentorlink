import Link from "next/link";
import { getPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";
import ParentActionSummary from "./_components/ParentActionSummary";
import ParentActivityDiscovery from "./_components/ParentActivityDiscovery";
export default async function ParentHomePage(){let mentors:PublicMentor[]=[];try{mentors=await getPublishedMentors()}catch{console.error("Unable to load the parent mentor directory.")}return <div className="mx-auto max-w-7xl"><ParentActionSummary/><ParentActivityDiscovery mentors={mentors}/><p className="mt-8 text-sm text-slate-500">בקשות שכבר שלחתם זמינות תמיד בעמוד <Link href="/dashboard/parent/requests" className="font-bold text-blue-700 underline">הבקשות והפגישות שלי</Link>.</p></div>}
