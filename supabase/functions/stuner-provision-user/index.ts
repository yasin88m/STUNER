// STUNER username-only account provisioning. Backend-only admin privileges.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const originHeaders={
 "Access-Control-Allow-Origin":"https://yasin88m.github.io",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Vary":"Origin"
};
function respond(status:number,data:unknown){
 return new Response(JSON.stringify(data),{status,headers:{...originHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
}
const usernameOk=(x:unknown):x is string=>typeof x==="string"&&/^[a-z][a-z0-9_]{3,31}$/.test(x);
const validName=(x:unknown)=>typeof x==="string"&&x.trim().length>=2&&x.trim().length<=120;
const validPassword=(x:unknown)=>typeof x==="string"&&x.length>=10&&x.length<=128;
function authAddress(username:string){return username+"@accounts.stuner.invalid"}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:originHeaders});
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 const origin=req.headers.get("origin");
 if(origin&&origin!=="https://yasin88m.github.io")return respond(403,{error:"Origin not allowed"});
 const apiUrl=Deno.env.get("SUPABASE_URL")||"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!apiUrl||!serviceKey)return respond(503,{error:"Server auth configuration unavailable"});
 const admin=createClient(apiUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 let data:Record<string,unknown>;
 try{data=await req.json();if(!data||typeof data!=="object"||Array.isArray(data))throw Error()}catch{return respond(400,{error:"Invalid request"})}
 const mode=data.mode;
 const username=String(data.username||"").trim().toLowerCase();
 const name=String(data.display_name||"").trim();
 const password=data.password;
 if(!usernameOk(username)||(mode!=="reset_member"&&!validName(name))||!validPassword(password)){
  return respond(400,{error:"نام کاربری باید ۴ تا ۳۲ کاراکتر لاتین و عدد یا _ باشد. رمز عبور حداقل ۱۰ کاراکتر لازم دارد."});
 }
 if(mode!=="register_manager"&&mode!=="create_member"&&mode!=="reset_member")return respond(400,{error:"Unknown operation"});
 let principalId:string|null=null,schoolId:string|null=null,role:"principal"|"teacher"|"student"="principal";
 let membershipGrade:string|null=null,classId:string|null=null,teacherClassIds:string[]=[];
 if(mode==="create_member"||mode==="reset_member"){
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token||token==="")return respond(401,{error:"Authentication required"});
  const auth=await admin.auth.getUser(token);
  if(auth.error||!auth.data.user)return respond(401,{error:"Invalid session"});
  principalId=auth.data.user.id;
  schoolId=String(data.school_id||"");
  role=data.role==="teacher"?"teacher":data.role==="student"?"student":"principal";
  if(mode==="create_member"&&role==="principal")return respond(400,{error:"Only teacher and student accounts can be created here"});
  const principal=await admin.from("school_memberships").select("school_id")
   .eq("school_id",schoolId).eq("user_id",principalId).eq("role","principal").maybeSingle();
  if(principal.error||!principal.data)return respond(403,{error:"Only the school principal may manage accounts"});
  if(mode==="reset_member"){
   const lookup=await admin.from("account_usernames").select("user_id").eq("username",username).maybeSingle();
   if(lookup.error||!lookup.data)return respond(404,{error:"کاربری با این نام در این مدرسه پیدا نشد."});
   const target=await admin.from("school_memberships").select("role").eq("school_id",schoolId).eq("user_id",lookup.data.user_id).in("role",["student","teacher"]).maybeSingle();
   if(target.error||!target.data)return respond(404,{error:"کاربری با این نام در این مدرسه پیدا نشد."});
   const changed=await admin.auth.admin.updateUserById(lookup.data.user_id,{password:String(password)});
   if(changed.error)return respond(409,{error:"تغییر رمز عبور انجام نشد."});
   return respond(200,{ok:true,username,updated:true});
  }
  classId=typeof data.class_id==="string"&&data.class_id?data.class_id:null;
  if(role==="student"&&!classId)return respond(400,{error:"A class is required for every student"});
  if(role==="teacher"){
   if(data.class_ids!==undefined&&(!Array.isArray(data.class_ids)||data.class_ids.some(x=>typeof x!=="string")))
    return respond(400,{error:"فهرست کلاس‌های معلم معتبر نیست."});
   teacherClassIds=[...new Set([...(data.class_ids as string[]||[]),...(classId?[classId]:[])])];
   if(teacherClassIds.length>100)return respond(400,{error:"تعداد کلاس‌های انتخاب‌شده بیش از حد مجاز است."});
  }
  const ids=role==="student"?[classId!]:teacherClassIds;
  if(ids.length){
   const found=await admin.from("school_classes").select("id,grade").eq("school_id",schoolId).in("id",ids);
   if(found.error||found.data?.length!==ids.length)return respond(400,{error:"تمام کلاس‌های انتخاب‌شده باید متعلق به همین مدرسه باشند."});
   if(role==="student")membershipGrade=found.data[0].grade;
  }
  if(role==="teacher")classId=null;
 }else{
  // Public manager registration has an IP-based hourly limit. Prevent cheap mass account creation.
  const remote=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").trim().slice(0,100);
  const bytes=new TextEncoder().encode("stuner-registration:"+remote);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const fingerprint=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
  const since=new Date(Date.now()-3600000).toISOString();
  const count=await admin.from("manager_registration_attempts").select("id",{count:"exact",head:true}).eq("fingerprint",fingerprint).gte("attempted_at",since);
  if(count.error)return respond(503,{error:"Unable to verify registration limit"});
  if((count.count||0)>=3)return respond(429,{error:"ثبت حساب جدید از این اتصال موقتاً محدود شده است."});
  const attempt=await admin.from("manager_registration_attempts").insert({fingerprint});
  if(attempt.error)return respond(503,{error:"Registration temporarily unavailable"});
 }
 // Email is an internal Supabase Auth identifier; no user email is requested or sent.
 const created=await admin.auth.admin.createUser({
  email:authAddress(username),password:String(password),email_confirm:true,
  app_metadata:{stuner_account:true}
 });
 if(created.error||!created.data.user){
  return respond(409,{error:"این نام کاربری قبلاً ثبت شده یا ایجاد حساب ممکن نیست."});
 }
 const newId=created.data.user.id;
 try{
  const mapped=await admin.from("account_usernames").insert({username,user_id:newId});
  if(mapped.error)throw mapped.error;
  if(mode==="create_member"){
   const added=await admin.from("school_memberships").insert({
    user_id:newId,school_id:schoolId,role,display_name:name,
    grade:membershipGrade,class_id:classId
   });
   if(added.error)throw added.error;
   if(role==="teacher"&&teacherClassIds.length){
    const t=await admin.from("class_teachers").insert(teacherClassIds.map(id=>({teacher_id:newId,class_id:id,school_id:schoolId})));
    if(t.error)throw t.error;
   }
  }
 }catch(e){
  // No orphaned login accounts in case membership creation fails.
  await admin.auth.admin.deleteUser(newId);
  return respond(409,{error:"امکان ایجاد این کاربر وجود ندارد؛ نام کاربری یا عضویت را بررسی کن."});
 }
 return respond(201,{ok:true,username,role,created:true});
});
