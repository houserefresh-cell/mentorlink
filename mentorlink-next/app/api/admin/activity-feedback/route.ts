import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request:Request){
 try{
  await authorizeAdministrator(request.headers.get("authorization"));
  const admin=createSupabaseAdmin();
  const [activityResult,meetingResult]=await Promise.all([
   admin.from("mentor_activity_feedback").select("*").order("submitted_at",{ascending:false}),
   admin.from("mentor_meeting_feedback").select("*").order("submitted_at",{ascending:false}),
  ]);
  if(activityResult.error||meetingResult.error)throw activityResult.error??meetingResult.error;
  const activityRows=activityResult.data??[],meetingRows=meetingResult.data??[];
  const activityIds=[...new Set(activityRows.map(row=>row.activity_id))],meetingIds=[...new Set(meetingRows.map(row=>row.meeting_request_id))],mentorIds=[...new Set([...activityRows,...meetingRows].map(row=>row.mentor_user_id))],parentIds=[...new Set([...activityRows,...meetingRows].map(row=>row.parent_user_id))],childIds=[...new Set(activityRows.map(row=>row.child_id))];
  const [activities,meetings,mentors,parents,children]=await Promise.all([
   activityIds.length?admin.from("mentor_activities").select("id,title").in("id",activityIds):Promise.resolve({data:[]}),
   meetingIds.length?admin.from("meeting_requests").select("id,subject,child_first_name,child_grade_or_age,confirmed_start_at,confirmed_end_at").in("id",meetingIds):Promise.resolve({data:[]}),
   mentorIds.length?admin.from("mentor_profiles").select("user_id,first_name,last_name").in("user_id",mentorIds):Promise.resolve({data:[]}),
   parentIds.length?admin.from("parent_profiles").select("user_id,first_name,last_name,phone").in("user_id",parentIds):Promise.resolve({data:[]}),
   childIds.length?admin.from("parent_children").select("id,first_name,last_name,grade").in("id",childIds):Promise.resolve({data:[]}),
  ]);
  const common=(row:Record<string,unknown>)=>({mentor:(mentors.data??[]).find(item=>item.user_id===row.mentor_user_id)??null,parent:(parents.data??[]).find(item=>item.user_id===row.parent_user_id)??null});
  const activityFeedback=activityRows.map(row=>({...row,...common(row),contextType:"activity",contextTitle:(activities.data??[]).find(item=>item.id===row.activity_id)?.title??"פעילות",activity:(activities.data??[]).find(item=>item.id===row.activity_id)??null,child:(children.data??[]).find(item=>item.id===row.child_id)??null}));
  const meetingFeedback=meetingRows.map(row=>{const meeting=(meetings.data??[]).find(item=>item.id===row.meeting_request_id);return{...row,...common(row),contextType:"meeting",contextTitle:meeting?.subject??"פגישה",activity:{title:meeting?.subject??"פגישה"},child:{first_name:meeting?.child_first_name??"ילד/ה",last_name:null,grade:meeting?.child_grade_or_age??null},sessionStart:meeting?.confirmed_start_at??null,sessionEnd:meeting?.confirmed_end_at??null}});
  return adminApiSuccess({feedback:[...activityFeedback,...meetingFeedback].sort((a,b)=>Date.parse(b.submitted_at)-Date.parse(a.submitted_at))});
 }catch(error){return adminApiError(error)}
}

export async function PATCH(request:Request){
 try{
  const administrator=await authorizeAdministrator(request.headers.get("authorization"));
  const body=await request.json();
  if(typeof body.id!=="string"||!["activity","meeting"].includes(body.contextType)||!['new','reviewing','resolved'].includes(body.handlingStatus)||!['not_requested','pending','approved','rejected'].includes(body.publicationStatus))return Response.json({error:"בקשה לא תקינה."},{status:400});
  const admin=createSupabaseAdmin();
  const table=body.contextType==="meeting"?"mentor_meeting_feedback":"mentor_activity_feedback";
  const current=await admin.from(table).select("allow_public_quote").eq("id",body.id).maybeSingle();
  if(current.error||!current.data)return Response.json({error:"המשוב לא נמצא."},{status:404});
  if(body.publicationStatus==="approved"&&!current.data.allow_public_quote)return Response.json({error:"לא ניתן לפרסם משוב ללא הסכמת ההורה."},{status:422});
  const result=await admin.from(table).update({admin_handling_status:body.handlingStatus,publication_status:body.publicationStatus,admin_notes:typeof body.adminNotes==="string"?body.adminNotes.trim().slice(0,2000):null,reviewed_at:new Date().toISOString(),reviewed_by:administrator.id}).eq("id",body.id).select("id,admin_handling_status,publication_status").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)return Response.json({error:"המשוב לא עודכן. יש לרענן ולנסות שוב."},{status:409});
  return adminApiSuccess({ok:true,feedback:result.data});
 }catch(error){return adminApiError(error)}
}
