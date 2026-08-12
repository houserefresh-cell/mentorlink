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
 const [registrations,meetings,meetingFeedback]=await Promise.all([
  admin.from("mentor_activity_registrations").select("id, activity_id, child_id, status").eq("parent_user_id",user.id).eq("status","registered"),
  admin.from("meeting_requests").select("id, mentor_user_id, subject, child_first_name, child_grade_or_age, meeting_mode, confirmed_start_at, confirmed_end_at, status").eq("parent_user_id",user.id).eq("status","accepted"),
  admin.from("mentor_meeting_feedback").select("*").eq("parent_user_id",user.id),
 ]);
 if(registrations.error||meetings.error||meetingFeedback.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const activityIds=[...new Set((registrations.data??[]).map(row=>row.activity_id))];
 const childIds=[...new Set((registrations.data??[]).map(row=>row.child_id).filter(Boolean))];
 const registrationIds=(registrations.data??[]).map(row=>row.id);
 const [activities,sessions,children,activityFeedback,activityParticipants]=await Promise.all([
  activityIds.length?admin.from("mentor_activities").select("id, title, mentor_user_id, venue_name, location_details, max_participants").in("id",activityIds):Promise.resolve({data:[],error:null}),
  activityIds.length?admin.from("mentor_activity_sessions").select("activity_id, starts_at, ends_at").in("activity_id",activityIds).order("starts_at"):Promise.resolve({data:[],error:null}),
  childIds.length?admin.from("parent_children").select("id, first_name, last_name, grade").in("id",childIds):Promise.resolve({data:[],error:null}),
  registrationIds.length?admin.from("mentor_activity_feedback").select("*").in("registration_id",registrationIds):Promise.resolve({data:[],error:null}),
  activityIds.length?admin.from("mentor_activity_registrations").select("activity_id,status").in("activity_id",activityIds).eq("status","registered"):Promise.resolve({data:[],error:null}),
 ]);
 if(activities.error||sessions.error||children.error||activityFeedback.error||activityParticipants.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const now=Date.now();
 const activityFeedbackByRegistration=new Set((activityFeedback.data??[]).map(row=>row.registration_id));
 const meetingFeedbackByRequest=new Set((meetingFeedback.data??[]).map(row=>row.meeting_request_id));
 const activityTasks=(registrations.data??[]).filter(row=>{
  const ends=(sessions.data??[]).filter(session=>session.activity_id===row.activity_id).map(session=>Date.parse(session.ends_at));
  return ends.length>0&&Math.max(...ends)<now&&!activityFeedbackByRegistration.has(row.id);
 }).map(row=>{const activity=(activities.data??[]).find(item=>item.id===row.activity_id);const child=(children.data??[]).find(item=>item.id===row.child_id);const activitySessions=(sessions.data??[]).filter(item=>item.activity_id===row.activity_id);return{contextType:"activity",contextId:row.id,registrationId:row.id,title:activity?.title??"פעילות",activityTitle:activity?.title??"פעילות",childName:[child?.first_name,child?.last_name].filter(Boolean).join(" ")||"ילד/ה",childGrade:child?.grade??null,sessionStart:activitySessions[0]?.starts_at??null,sessionEnd:activitySessions.at(-1)?.ends_at??null};});
 const meetingTasks=(meetings.data??[]).filter(row=>row.confirmed_end_at&&Date.parse(row.confirmed_end_at)<now&&!meetingFeedbackByRequest.has(row.id)).map(row=>({contextType:"meeting",contextId:row.id,meetingRequestId:row.id,title:row.subject||"פגישה עם חונך",activityTitle:row.subject||"פגישה עם חונך",childName:row.child_first_name||"ילד/ה",childGrade:row.child_grade_or_age||null,sessionStart:row.confirmed_start_at,sessionEnd:row.confirmed_end_at}));
 const submittedActivities=(activityFeedback.data??[]).map(item=>{const registration=(registrations.data??[]).find(row=>row.id===item.registration_id);const activity=(activities.data??[]).find(row=>row.id===item.activity_id);const child=(children.data??[]).find(row=>row.id===registration?.child_id);const activitySessions=(sessions.data??[]).filter(row=>row.activity_id===item.activity_id);return{...item,contextType:"activity",contextId:item.registration_id,title:activity?.title??"פעילות",activityTitle:activity?.title??"פעילות",childName:[child?.first_name,child?.last_name].filter(Boolean).join(" ")||"ילד/ה",childGrade:child?.grade??null,sessionStart:activitySessions[0]?.starts_at??null,sessionEnd:activitySessions.at(-1)?.ends_at??null,participantCount:(activityParticipants.data??[]).filter(row=>row.activity_id===item.activity_id).length,capacity:activity?.max_participants??null,location:[activity?.venue_name,activity?.location_details].filter(Boolean).join(" · ")||null};});
 const submittedMeetings=(meetingFeedback.data??[]).map(item=>{const meeting=(meetings.data??[]).find(row=>row.id===item.meeting_request_id);return{...item,contextType:"meeting",contextId:item.meeting_request_id,registration_id:item.meeting_request_id,title:meeting?.subject||"פגישה עם חונך",activityTitle:meeting?.subject||"פגישה עם חונך",childName:meeting?.child_first_name||"ילד/ה",childGrade:meeting?.child_grade_or_age??null,sessionStart:meeting?.confirmed_start_at??null,sessionEnd:meeting?.confirmed_end_at??null,participantCount:1,capacity:1,location:meeting?.meeting_mode==="online"?"מפגש מקוון":null};});
 const tasks=[...activityTasks,...meetingTasks].sort((a,b)=>Date.parse(b.sessionEnd??"")-Date.parse(a.sessionEnd??""));
 const feedback=[...submittedActivities,...submittedMeetings].sort((a,b)=>Date.parse(b.submitted_at)-Date.parse(a.submitted_at));
 return Response.json({tasks,feedback,pendingCount:tasks.length},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
 const user=await authenticateMeetingUser(request.headers.get("authorization"));
 if(!user)return Response.json({error:"נדרשת התחברות."},{status:401});
 if(user.role!=="parent")return Response.json({error:"הגישה מיועדת להורים בלבד."},{status:403});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:"בקשה לא תקינה."},{status:400})}
 const contextType=body.contextType==="meeting"?"meeting":"activity";
 const contextId=typeof body.contextId==="string"?body.contextId:typeof body.registrationId==="string"?body.registrationId:"";
 if(!uuid.test(contextId)||!attendance.has(String(body.attendance))||!punctuality.has(String(body.punctuality)))return Response.json({error:"יש להשלים את שדות החובה."},{status:400});
 const values=Object.fromEntries(scores.map(key=>[key,Number(body[key])]));
 if(Object.values(values).some(value=>!Number.isInteger(value)||value<1||value>5))return Response.json({error:"יש לדרג כל סעיף בין 1 ל־5."},{status:400});
 const admin=createSupabaseAdmin();
 const text=(key:string,maximum:number)=>typeof body[key]==="string"?body[key].trim().slice(0,maximum):null;
 const common={attendance:body.attendance,professionalism:values.professionalism,patience_listening:values.patienceListening,clarity:values.clarity,age_level_fit:values.ageLevelFit,child_enjoyment:values.childEnjoyment,expectations:values.expectations,recommendation:values.recommendation,punctuality:body.punctuality,worked_well:text("workedWell",1500),could_improve:text("couldImprove",1500),felt_uncomfortable:body.feltUncomfortable===true,safety_incident:body.safetyIncident===true,requests_admin_contact:body.requestsAdminContact===true,private_safety_details:text("privateSafetyDetails",2500),allow_public_quote:body.allowPublicQuote===true,publication_status:body.allowPublicQuote===true?"pending":"not_requested"};
 if(contextType==="meeting"){
  const meeting=await admin.from("meeting_requests").select("id,mentor_user_id,parent_user_id,confirmed_end_at,status").eq("id",contextId).eq("parent_user_id",user.id).eq("status","accepted").maybeSingle();
  if(meeting.error||!meeting.data)return Response.json({error:"הפגישה אינה מתאימה למשוב."},{status:403});
  if(!meeting.data.confirmed_end_at||Date.parse(meeting.data.confirmed_end_at)>=Date.now())return Response.json({error:"ניתן למלא משוב רק לאחר סיום הפגישה."},{status:422});
  const result=await admin.from("mentor_meeting_feedback").insert({meeting_request_id:contextId,mentor_user_id:meeting.data.mentor_user_id,parent_user_id:user.id,...common}).select("id").single();
  if(result.error?.code==="23505")return Response.json({error:"כבר נשלח משוב עבור פגישה זו."},{status:409});
  if(result.error)return Response.json({error:"לא ניתן לשמור את המשוב."},{status:500});
  return Response.json({feedbackId:result.data.id},{status:201});
 }
 const registration=await admin.from("mentor_activity_registrations").select("id, activity_id, child_id, parent_user_id, status").eq("id",contextId).eq("parent_user_id",user.id).eq("status","registered").maybeSingle();
 if(registration.error||!registration.data)return Response.json({error:"ההרשמה אינה מתאימה למשוב."},{status:403});
 const [activity,sessions]=await Promise.all([admin.from("mentor_activities").select("mentor_user_id").eq("id",registration.data.activity_id).single(),admin.from("mentor_activity_sessions").select("ends_at").eq("activity_id",registration.data.activity_id)]);
 if(activity.error||sessions.error||!(sessions.data??[]).length||Math.max(...(sessions.data??[]).map(row=>Date.parse(row.ends_at)))>=Date.now())return Response.json({error:"ניתן למלא משוב רק לאחר סיום הפעילות."},{status:422});
 const result=await admin.from("mentor_activity_feedback").insert({registration_id:contextId,activity_id:registration.data.activity_id,mentor_user_id:activity.data.mentor_user_id,parent_user_id:user.id,child_id:registration.data.child_id,...common}).select("id").single();
 if(result.error?.code==="23505")return Response.json({error:"כבר נשלח משוב עבור הרשמה זו."},{status:409});
 if(result.error)return Response.json({error:"לא ניתן לשמור את המשוב."},{status:500});
 return Response.json({feedbackId:result.data.id},{status:201});
}
