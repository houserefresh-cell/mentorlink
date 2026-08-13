"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordPanel from "@/app/_components/PasswordPanel";
import { supabase } from "@/lib/supabase";
import { getDashboardPath } from "@/lib/auth-routing";

export default function RequiredPasswordChangePage(){
  const router=useRouter(); const[ready,setReady]=useState(false);
  useEffect(()=>{void supabase.auth.getUser().then(({data})=>{if(!data.user)router.replace("/login");else setReady(true)})},[router]);
  if(!ready)return <main dir="rtl" className="grid min-h-screen place-items-center"><p className="font-bold">טוען...</p></main>;
  return <main dir="rtl" className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-violet-50 p-5"><div className="mx-auto max-w-3xl py-12"><PasswordPanel required/><button type="button" onClick={async()=>{const{data}=await supabase.auth.getUser();if(data.user&&!data.user.user_metadata?.must_change_password)router.replace(await getDashboardPath(data.user.id))}} className="mt-5 w-full rounded-xl bg-blue-700 px-6 py-4 font-black text-white">המשך לאזור האישי</button></div></main>;
}
