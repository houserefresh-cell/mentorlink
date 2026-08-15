import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try { await authorizeAdministrator(request.headers.get("authorization")); const admin=createSupabaseAdmin(); const result=await admin.from("admin_deleted_accounts").select("user_id,account_type,email,display_name,reason,warnings,deleted_at").is("restored_at",null).order("deleted_at",{ascending:false}); if(result.error)throw result.error; return adminApiSuccess({accounts:result.data??[]}); }
  catch(error){return adminApiError(error)}
}
export async function PATCH(request: Request) {
  try { const administrator=await authorizeAdministrator(request.headers.get("authorization")); const payload=await request.json() as Record<string,unknown>; const userId=typeof payload.userId==="string"?payload.userId:""; if(!/^[0-9a-f-]{36}$/i.test(userId))return Response.json({error:"חשבון לא תקין."},{status:400}); const admin=createSupabaseAdmin(); const deleted=await admin.from("admin_deleted_accounts").select("account_type").eq("user_id",userId).is("restored_at",null).maybeSingle(); if(deleted.error||!deleted.data)return Response.json({error:"החשבון המחוק לא נמצא."},{status:404}); const user=await admin.auth.admin.getUserById(userId); if(user.error||!user.data.user) return Response.json({error:"חשבון ההתחברות המקורי לא נמצא ולכן לא ניתן לשחזר אותו."},{status:409}); const { administratively_deleted_at: _removed, ...metadata }=user.data.user.user_metadata??{}; const auth=await admin.auth.admin.updateUserById(userId,{ban_duration:"none",user_metadata:metadata}); if(auth.error)throw auth.error; const restored=await admin.from("admin_deleted_accounts").update({restored_at:new Date().toISOString(),restored_by:administrator.id}).eq("user_id",userId).is("restored_at",null); if(restored.error)throw restored.error; if(deleted.data.account_type==="mentor"){const control=await admin.from("mentor_account_controls").upsert({user_id:userId,status:"active",reason:null,suspended_until:null,acted_by:administrator.id,acted_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(control.error)throw control.error;} return adminApiSuccess({restored:true}); }
  catch(error){return adminApiError(error)}
}
