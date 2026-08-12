import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request:Request){
 const user=await authenticateMeetingUser(request.headers.get("authorization"));
 if(!user)return Response.json({error:"נדרשת התחברות."},{status:401});
 if(user.role!=="mentor")return Response.json({error:"הגישה מיועדת לחונכים בלבד."},{status:403});
 const admin=createSupabaseAdmin();
 const [activityFeedback,meetingFeedback]=await Promise.all([
  admin.from("mentor_activity_feedback").select("id, activity_id, parent_user_id, child_id, attendance, professionalism, patience_listening, clarity, age_level_fit, child_enjoyment, expectations, recommendation, punctuality, worked_well, could_improve, submitted_at").eq("mentor_user_id",user.id),
  admin.from("mentor_meeting_feedback").select("id, meeting_request_id, parent_user_id, attendance, professionalism, patience_listening, clarity, age_level_fit, child_enjoyment, expectations, recommendation, punctuality, worked_well, could_improve, submitted_at").eq("mentor_user_id",user.id),
 ]);
 if(activityFeedback.error||meetingFeedback.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const activityIds=[...new Set((activityFeedback.data??[]).map(row=>row.activity_id))];
 const meetingIds=[...new Set((meetingFeedback.data??[]).map(row=>row.meeting_request_id))];
 const parentIds=[...new Set([...(activityFeedback.data??[]),...(meetingFeedback.data??[])].map(row=>row.parent_user_id))];
 const childIds=[...new Set((activityFeedback.data??[]).map(row=>row.child_id))];
 const [activities,sessions,registrations,meetings,parents,children]=await Promise.all([
  activityIds.length?admin.from("mentor_activities").select("id,title,venue_name,location_type,location_details,max_participants").in("id",activityIds):Promise.resolve({data:[]}),
  activityIds.length?admin.from("mentor_activity_sessions").select("activity_id,starts_at,ends_at").in("activity_id",activityIds).order("starts_at"):Promise.resolve({data:[]}),
  activityIds.length?admin.from("mentor_activity_registrations").select("activity_id,status").in("activity_id",activityIds).eq("status","registered"):Promise.resolve({data:[]}),
  meetingIds.length?admin.from("meeting_requests").select("id,subject,child_first_name,child_grade_or_age,meeting_mode,confirmed_start_at,confirmed_end_at").in("id",meetingIds):Promise.resolve({data:[]}),
  parentIds.length?admin.from("parent_profiles").select("user_id,first_name,last_name,phone,city,street,wants_home_mentoring,house_number,entrance,apartment,address_notes").in("user_id",parentIds):Promise.resolve({data:[]}),
  childIds.length?admin.from("parent_children").select("id,first_name,last_name,grade,school_name").in("id",childIds):Promise.resolve({data:[]}),
 ]);
 const activityRows=(activityFeedback.data??[]).map(row=>{const activity=(activities.data??[]).find(item=>item.id===row.activity_id);const activitySessions=(sessions.data??[]).filter(item=>item.activity_id===row.activity_id);return{...row,contextType:"activity",contextTitle:activity?.title??"פעילות",activityTitle:activity?.title??"פעילות",sessionStart:activitySessions[0]?.starts_at??null,sessionEnd:activitySessions.at(-1)?.ends_at??null,participantCount:(registrations.data??[]).filter(item=>item.activity_id===row.activity_id).length,capacity:activity?.max_participants??null,location:[activity?.venue_name,activity?.location_details].filter(Boolean).join(" · ")||null,parent:(parents.data??[]).find(item=>item.user_id===row.parent_user_id)??null,child:(children.data??[]).find(item=>item.id===row.child_id)??null}});
 const meetingRows=(meetingFeedback.data??[]).map(row=>{const meeting=(meetings.data??[]).find(item=>item.id===row.meeting_request_id);return{...row,contextType:"meeting",contextTitle:meeting?.subject??"פגישה",activityTitle:meeting?.subject??"פגישה",sessionStart:meeting?.confirmed_start_at??null,sessionEnd:meeting?.confirmed_end_at??null,participantCount:1,capacity:1,location:meeting?.meeting_mode==="online"?"מפגש מקוון":null,parent:(parents.data??[]).find(item=>item.user_id===row.parent_user_id)??null,child:{first_name:meeting?.child_first_name??"ילד/ה",last_name:null,grade:meeting?.child_grade_or_age??null,school_name:null}};});
 return Response.json({feedback:[...activityRows,...meetingRows].sort((a,b)=>Date.parse(b.submitted_at)-Date.parse(a.submitted_at))},{headers:{"Cache-Control":"no-store"}});
}
