import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request:Request){
 const user=await authenticateMeetingUser(request.headers.get("authorization"));
 if(!user)return Response.json({error:"נדרשת התחברות."},{status:401});
 if(user.role!=="mentor")return Response.json({error:"הגישה מיועדת לחונכים בלבד."},{status:403});
 const admin=createSupabaseAdmin();
 const feedback=await admin.from("mentor_activity_feedback").select("id, activity_id, parent_user_id, child_id, attendance, professionalism, patience_listening, clarity, age_level_fit, child_enjoyment, expectations, recommendation, punctuality, worked_well, could_improve, submitted_at").eq("mentor_user_id",user.id).order("submitted_at",{ascending:false});
 if(feedback.error)return Response.json({error:"לא ניתן לטעון את המשובים."},{status:500});
 const activityIds=[...new Set((feedback.data??[]).map(row=>row.activity_id))],parentIds=[...new Set((feedback.data??[]).map(row=>row.parent_user_id))],childIds=[...new Set((feedback.data??[]).map(row=>row.child_id))];
 const [activities,parents,children]=await Promise.all([activityIds.length?admin.from("mentor_activities").select("id,title").in("id",activityIds):Promise.resolve({data:[]}),parentIds.length?admin.from("parent_profiles").select("user_id,first_name,last_name,phone,city,street,wants_home_mentoring,house_number,entrance,apartment,address_notes").in("user_id",parentIds):Promise.resolve({data:[]}),childIds.length?admin.from("parent_children").select("id,first_name,last_name,grade,school_name").in("id",childIds):Promise.resolve({data:[]})]);
 return Response.json({feedback:(feedback.data??[]).map(row=>({...row,activityTitle:(activities.data??[]).find(item=>item.id===row.activity_id)?.title??"פעילות",parent:(parents.data??[]).find(item=>item.user_id===row.parent_user_id)??null,child:(children.data??[]).find(item=>item.id===row.child_id)??null}))},{headers:{"Cache-Control":"no-store"}});
}
