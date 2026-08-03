import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request:Request){
 try{
  await authorizeAdministrator(request.headers.get("authorization"));
  const admin=createSupabaseAdmin();
  const result=await admin.from("mentor_activity_feedback").select("*").order("submitted_at",{ascending:false});
  if(result.error)throw result.error;
  const rows=result.data??[],activityIds=[...new Set(rows.map(row=>row.activity_id))],mentorIds=[...new Set(rows.map(row=>row.mentor_user_id))],parentIds=[...new Set(rows.map(row=>row.parent_user_id))],childIds=[...new Set(rows.map(row=>row.child_id))];
  const [activities,mentors,parents,children]=await Promise.all([activityIds.length?admin.from("mentor_activities").select("id,title").in("id",activityIds):Promise.resolve({data:[]}),mentorIds.length?admin.from("mentor_profiles").select("user_id,first_name,last_name").in("user_id",mentorIds):Promise.resolve({data:[]}),parentIds.length?admin.from("parent_profiles").select("user_id,first_name,last_name,phone").in("user_id",parentIds):Promise.resolve({data:[]}),childIds.length?admin.from("parent_children").select("id,first_name,last_name,grade").in("id",childIds):Promise.resolve({data:[]})]);
  return adminApiSuccess({feedback:rows.map(row=>({...row,activity:(activities.data??[]).find(item=>item.id===row.activity_id)??null,mentor:(mentors.data??[]).find(item=>item.user_id===row.mentor_user_id)??null,parent:(parents.data??[]).find(item=>item.user_id===row.parent_user_id)??null,child:(children.data??[]).find(item=>item.id===row.child_id)??null}))});
 }catch(error){return adminApiError(error)}
}

export async function PATCH(request:Request){
 try{
  const administrator=await authorizeAdministrator(request.headers.get("authorization"));
  const body=await request.json();
  if(typeof body.id!=="string"||!['new','reviewing','resolved'].includes(body.handlingStatus)||!['not_requested','pending','approved','rejected'].includes(body.publicationStatus))return Response.json({error:"בקשה לא תקינה."},{status:400});
  const admin=createSupabaseAdmin();
  const current=await admin.from("mentor_activity_feedback").select("allow_public_quote").eq("id",body.id).maybeSingle();
  if(current.error||!current.data)return Response.json({error:"המשוב לא נמצא."},{status:404});
  if(body.publicationStatus==="approved"&&!current.data.allow_public_quote)return Response.json({error:"לא ניתן לפרסם משוב ללא הסכמת ההורה."},{status:422});
  const result=await admin.from("mentor_activity_feedback").update({admin_handling_status:body.handlingStatus,publication_status:body.publicationStatus,admin_notes:typeof body.adminNotes==="string"?body.adminNotes.trim().slice(0,2000):null,reviewed_at:new Date().toISOString(),reviewed_by:administrator.id}).eq("id",body.id);
  if(result.error)throw result.error;return adminApiSuccess({ok:true});
 }catch(error){return adminApiError(error)}
}
