import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scores=["professionalism","patienceListening","clarity","ageLevelFit","childEnjoyment","expectations","recommendation"] as const;
const attendance=new Set(["attended","partially_attended","did_not_attend","activity_did_not_happen"]);
const punctuality=new Set(["on_time","slightly_late_notified","late_without_notice","activity_did_not_happen"]);

export async function GET(request:Request){
 const user=await authenticateMeetingUser(request.headers.get("authorization"));
 if(!user)return Response.json({error:"נדרשת התחברות."},{status:401});
 if(user.role!=="parent")return Response.json({error:"הגישה מיועדת להורים בלבד."},{status:403});
 const admin=createSupabaseAdmin();
 const registrations=await admin.from("mentor_activity_registrations").select("id, activity_id, child_id, status").eq("parent_user_id",user.id).eq("status","registered");
 if(registrations.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const activityIds=[...new Set((registrations.data??[]).map(row=>row.activity_id))];
 const childIds=[...new Set((registrations.data??[]).map(row=>row.child_id).filter(Boolean))];
 const registrationIds=(registrations.data??[]).map(row=>row.id);
 const [activities,sessions,children,feedback]=await Promise.all([
  activityIds.length?admin.from("mentor_activities").select("id, title, mentor_user_id").in("id",activityIds):Promise.resolve({data:[],error:null}),
  activityIds.length?admin.from("mentor_activity_sessions").select("activity_id, ends_at").in("activity_id",activityIds):Promise.resolve({data:[],error:null}),
  childIds.length?admin.from("parent_children").select("id, first_name, last_name").in("id",childIds):Promise.resolve({data:[],error:null}),
  registrationIds.length?admin.from("mentor_activity_feedback").select("*").in("registration_id",registrationIds):Promise.resolve({data:[],error:null}),
 ]);
 if(activities.error||sessions.error||children.error||feedback.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const now=Date.now(),feedbackByRegistration=new Map((feedback.data??[]).map(row=>[row.registration_id,row]));
 const tasks=(registrations.data??[]).filter(row=>{
  const ends=(sessions.data??[]).filter(session=>session.activity_id===row.activity_id).map(session=>Date.parse(session.ends_at));
  return ends.length>0&&Math.max(...ends)<now&&!feedbackByRegistration.has(row.id);
 }).map(row=>{const activity=(activities.data??[]).find(item=>item.id===row.activity_id);const child=(children.data??[]).find(item=>item.id===row.child_id);return{registrationId:row.id,activityId:row.activity_id,activityTitle:activity?.title??"פעילות",mentorUserId:activity?.mentor_user_id,childName:[child?.first_name,child?.last_name].filter(Boolean).join(" ")||"ילד/ה"};});
 const submitted=(feedback.data??[]).map(item=>{const registration=(registrations.data??[]).find(row=>row.id===item.registration_id);const activity=(activities.data??[]).find(row=>row.id===item.activity_id);const child=(children.data??[]).find(row=>row.id===registration?.child_id);return{...item,activityTitle:activity?.title??"פעילות",childName:[child?.first_name,child?.last_name].filter(Boolean).join(" ")||"ילד/ה"};});
 return Response.json({tasks,feedback:submitted,pendingCount:tasks.length},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
 const user=await authenticateMeetingUser(request.headers.get("authorization"));
 if(!user)return Response.json({error:"נדרשת התחברות."},{status:401});
 if(user.role!=="parent")return Response.json({error:"הגישה מיועדת להורים בלבד."},{status:403});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:"בקשה לא תקינה."},{status:400})}
 const registrationId=typeof body.registrationId==="string"?body.registrationId:"";
 if(!uuid.test(registrationId)||!attendance.has(String(body.attendance))||!punctuality.has(String(body.punctuality)))return Response.json({error:"יש להשלים את שדות החובה."},{status:400});
 const values=Object.fromEntries(scores.map(key=>[key,Number(body[key])]));
 if(Object.values(values).some(value=>!Number.isInteger(value)||value<1||value>5))return Response.json({error:"יש לדרג כל סעיף בין 1 ל־5."},{status:400});
 const admin=createSupabaseAdmin();
 const registration=await admin.from("mentor_activity_registrations").select("id, activity_id, child_id, parent_user_id, status").eq("id",registrationId).eq("parent_user_id",user.id).eq("status","registered").maybeSingle();
 if(registration.error||!registration.data)return Response.json({error:"ההרשמה אינה מתאימה למשוב."},{status:403});
 const [activity,sessions]=await Promise.all([admin.from("mentor_activities").select("mentor_user_id").eq("id",registration.data.activity_id).single(),admin.from("mentor_activity_sessions").select("ends_at").eq("activity_id",registration.data.activity_id)]);
 if(activity.error||sessions.error||!(sessions.data??[]).length||Math.max(...(sessions.data??[]).map(row=>Date.parse(row.ends_at)))>=Date.now())return Response.json({error:"ניתן למלא משוב רק לאחר סיום הפעילות."},{status:422});
 const text=(key:string,maximum:number)=>typeof body[key]==="string"?body[key].trim().slice(0,maximum):null;
 const allowPublic=body.allowPublicQuote===true;
 const result=await admin.from("mentor_activity_feedback").insert({registration_id:registrationId,activity_id:registration.data.activity_id,mentor_user_id:activity.data.mentor_user_id,parent_user_id:user.id,child_id:registration.data.child_id,attendance:body.attendance,professionalism:values.professionalism,patience_listening:values.patienceListening,clarity:values.clarity,age_level_fit:values.ageLevelFit,child_enjoyment:values.childEnjoyment,expectations:values.expectations,recommendation:values.recommendation,punctuality:body.punctuality,worked_well:text("workedWell",1500),could_improve:text("couldImprove",1500),felt_uncomfortable:body.feltUncomfortable===true,safety_incident:body.safetyIncident===true,requests_admin_contact:body.requestsAdminContact===true,private_safety_details:text("privateSafetyDetails",2500),allow_public_quote:allowPublic,publication_status:allowPublic?"pending":"not_requested"}).select("id").single();
 if(result.error?.code==="23505")return Response.json({error:"כבר נשלח משוב עבור הרשמה זו."},{status:409});
 if(result.error)return Response.json({error:"לא ניתן לשמור את המשוב."},{status:500});
 return Response.json({feedbackId:result.data.id},{status:201});
}
