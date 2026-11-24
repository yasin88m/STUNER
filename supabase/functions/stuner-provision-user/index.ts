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
const usernameOk=(x:unknown):x is string=>typeof x==="string"&&/^(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})$/.test(x);
const validName=(x:unknown)=>typeof x==="string"&&x.trim().length>=2&&x.trim().length<=120;
const validPassword=(x:unknown)=>typeof x==="string"&&x.length>=6&&x.length<=128;
function authAddress(username:string){return username+"@accounts.stuner.invalid"}

/* Resolve the signed-in account's role from trusted server-side account metadata and memberships. */
async function verifyLoginRole(req:Request,admin:ReturnType<typeof createClient>){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
 if(!token)return respond(401,{error:"نشست ورود معتبر نیست."});
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"نشست ورود معتبر نیست."});
 const account=auth.data.user;
 const result=await admin.from("school_memberships").select("role").eq("user_id",account.id);
 if(result.error)return respond(503,{error:"بررسی نقش حساب فعلاً ممکن نیست."});
 const memberships=(result.data||[]).map(x=>x.role).filter(x=>["student","teacher","principal"].includes(x));
 const appRole=account.app_metadata?.stuner_role;
 const uniqueRoles=[...new Set(memberships)];
 const resolved=["student","teacher","principal"].includes(appRole)?appRole:uniqueRoles.length===1?uniqueRoles[0]:null;
 if(!resolved)return respond(409,{error:"برای این حساب نقش یکتایی ثبت نشده است؛ با مدیر سامانه تماس بگیرید."});
 if(resolved==="student"||resolved==="teacher"){
  if(!memberships.includes(resolved))return respond(403,{error:"دسترسی این حساب معتبر نیست."});
 }else{
  let authorized=account.app_metadata?.stuner_role==="principal"||memberships.includes("principal");
  if(!authorized){
   const owned=await admin.from("schools").select("id").eq("created_by",account.id).limit(1);
   if(owned.error)return respond(503,{error:"بررسی حساب مدیر فعلاً ممکن نیست."});
   authorized=!!owned.data?.length;
  }
  if(!authorized)return respond(403,{error:"دسترسی مدیر برای این حساب ثبت نشده است."});
 }
 return respond(200,{ok:true,role:resolved});
}

/* Excel onboarding: authenticate principal on the server and check every class assignment. */
function normalized(value:unknown){
 return String(value??"").replace(/فتوگرافیگ/g,"فتوگرافیک").normalize("NFKC").replace(/ي/g,"ی").replace(/ك/g,"ک")
  .replace(/[\u064b-\u065f\u0670\u200c\u200d\s_\-–—():.،,]/g,"").toLowerCase();
}
function normalizedGrade(value:unknown){
 const original=normalized(String(value??"").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/^پایه\s*/,"").replace(/\s*ابتدایی$/,""));
 const map:Record<string,string>={"1":"اول","2":"دوم","3":"سوم","4":"چهارم","5":"پنجم","6":"ششم","7":"هفتم","8":"هشتم","9":"نهم","10":"دهم","11":"یازدهم","12":"دوازدهم"};
 return normalized(map[original]||original);
}
async function importMembers(req:Request,admin:ReturnType<typeof createClient>,body:Record<string,unknown>){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"برای ورود گروهی باید با حساب مدیر وارد شوید."});
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"نشست مدیر معتبر نیست؛ دوباره وارد شوید."});
 const schoolId=String(body.school_id||""),role=body.role;
 if(!/^[0-9a-f-]{36}$/i.test(schoolId)||!["student","teacher"].includes(String(role)))return respond(400,{error:"مدرسه یا نقش معتبر نیست."});
 const principal=await admin.from("school_memberships").select("school_id")
  .eq("school_id",schoolId).eq("user_id",auth.data.user.id).eq("role","principal").maybeSingle();
 if(principal.error||!principal.data)return respond(403,{error:"فقط مدیر همین مدرسه مجاز به وارد کردن گروهی کاربران است."});
 if(!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>20)return respond(400,{error:"در هر مرحله بین ۱ تا ۲۰ نفر قابل ثبت است."});
 const list=body.rows as Record<string,unknown>[];
 if(list.some(x=>!x||typeof x!=="object"||Array.isArray(x)))return respond(400,{error:"ساختار ردیف‌های ورودی معتبر نیست."});
 const isStudent=role==="student";
 const cls=await admin.from("school_classes").select("id,grade,major").eq("school_id",schoolId);
 if(cls?.error)return respond(503,{error:"امکان بررسی کلاس‌های مدرسه نیست."});
 const classes=cls?.data||[];
 async function createRow(raw:Record<string,unknown>){
  const username=String(raw.username||"").trim(),password=String(raw.password||""),displayName=String(raw.display_name||"").trim();
  if(!/^\d{10}$/.test(username))return {created:false,error:"کد ملی باید ده رقم باشد."};
  if(!/^0[1-9]\d{9}$/.test(password))return {created:false,error:"شماره تماس معتبر نیست."};
  if(!validName(displayName))return {created:false,error:"نام و نام خانوادگی معتبر نیست."};
  let classId:string|null=null,grade:string|null=null,teacherClassIds:string[]=[];
  if(isStudent){
   classId=String(raw.class_id||"");
   const classroom=classes.find(c=>c.id===classId);
   if(!classroom)return {created:false,error:"کلاس انتخابی متعلق به مدرسه نیست."};
   if(normalizedGrade(classroom.grade)!==normalizedGrade(raw.grade)||normalized(classroom.major||"")!==normalized(raw.major||""))
    return {created:false,error:"پایه یا رشته با کلاس انتخابی هماهنگ نیست."};
   grade=classroom.grade;
   }else{
   if(raw.class_id)return {created:false,error:"برای معلم باید فهرست کلاس‌ها را ارسال کنید."};
   if(raw.class_ids!==undefined && (!Array.isArray(raw.class_ids) || raw.class_ids.length>100 ||
       raw.class_ids.some((x:unknown)=>typeof x!=="string")))return {created:false,error:"فهرست کلاس‌های معلم معتبر نیست."};
   teacherClassIds=[...new Set((raw.class_ids as string[]||[]))];
   if(teacherClassIds.some(id=>!classes.some(c=>c.id===id)))return {created:false,error:"بعضی از کلاس‌های معلم در این مدرسه وجود ندارند."};
  }
  const created=await admin.auth.admin.createUser({
   email:authAddress(username),password,email_confirm:true,
   app_metadata:{stuner_account:true,stuner_role:role,created_from_excel:true,stuner_initial_password_change:true}
  });
  if(created.error||!created.data.user)return {created:false,error:"این کد ملی قبلاً ثبت شده یا ایجاد حساب ممکن نیست."};
  const userId=created.data.user.id;
  try{
   const mapped=await admin.from("account_usernames").insert({username,user_id:userId});
   if(mapped.error)throw mapped.error;
   const member=await admin.from("school_memberships").insert({
    user_id:userId,school_id:schoolId,role,display_name:displayName,grade,class_id:classId
   });
   if(member.error)throw member.error;
   if(!isStudent && teacherClassIds.length){
    const assigned=await admin.from("class_teachers").insert(teacherClassIds.map(id=>({school_id:schoolId,class_id:id,teacher_id:userId})));
    if(assigned.error)throw assigned.error;
   }
   return {created:true};
  }catch{
   await admin.auth.admin.deleteUser(userId);
   return {created:false,error:"ثبت اطلاعات کاربر ناقص بود؛ این ردیف را بررسی کنید."};
  }
 }
 const results: {created:boolean,error?:string}[]=[];
 for(let i=0;i<list.length;i+=3){
  const partial=await Promise.all(list.slice(i,i+3).map(x=>createRow(x)));
  results.push(...partial);
 }
 return respond(200,{ok:true,results});
}

/* The phone number is an initial credential only. Mandatory first-login replacement. */
async function changeInitialPassword(req:Request,admin:ReturnType<typeof createClient>,payload:Record<string,unknown>){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"ابتدا وارد حساب شوید."});
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"نشست معتبر نیست."});
 const user=auth.data.user;
 if(user.app_metadata?.stuner_initial_password_change!==true)return respond(403,{error:"این عملیات برای این حساب لازم نیست."});
 const password=payload.password;
 if(typeof password!=="string"||password.length<6||password.length>128||!/[\p{L}]/u.test(password)||!/[0-9]/.test(password))
  return respond(400,{error:"رمز جدید باید حداقل ۶ کاراکتر و شامل حروف و عدد باشد."});
 const changed=await admin.auth.admin.updateUserById(user.id,{
  password,app_metadata:{...user.app_metadata,stuner_initial_password_change:false}
 });
 if(changed.error)return respond(503,{error:"تغییر رمز انجام نشد؛ دوباره تلاش کنید."});
 return respond(200,{ok:true,updated:true});
}


/* Account-owned student profile edit. Academic enrollment is deliberately immutable here. */
async function updateStudentProfile(req:Request,admin:ReturnType<typeof createClient>,data:Record<string,unknown>){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"برای ویرایش پروفایل ابتدا وارد شوید."});
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"نشست کاربری معتبر نیست."});
 const user=auth.data.user,schoolId=String(data.school_id||"");
 if(!/^[0-9a-f-]{36}$/i.test(schoolId))return respond(400,{error:"مدرسه معتبر نیست."});
 const membership=await admin.from("school_memberships").select("display_name")
  .eq("school_id",schoolId).eq("user_id",user.id).eq("role","student").maybeSingle();
 if(membership.error||!membership.data)return respond(403,{error:"ویرایش مشخصات فقط برای دانش‌آموز همین مدرسه مجاز است."});
 const firstName=String(data.first_name||"").trim(),lastName=String(data.last_name||"").trim();
 const displayName=firstName+" "+lastName;
 const age=Number(data.age);
 const username=String(data.username||"").trim().toLowerCase();
 if(firstName.length<2||firstName.length>40||lastName.length<2||lastName.length>60||!validName(displayName))
  return respond(400,{error:"نام و نام خانوادگی معتبر وارد کنید."});
 if(!Number.isInteger(age)||age<6||age>30)return respond(400,{error:"سن باید بین ۶ تا ۳۰ سال باشد."});
 if(!usernameOk(username))return respond(400,{error:"آیدی باید ۱۰ رقم یا ۴ تا ۳۲ کاراکتر لاتینِ مجاز باشد."});
 const account=await admin.from("account_usernames").select("username").eq("user_id",user.id).maybeSingle();
 if(account.error||!account.data)return respond(404,{error:"آیدی حساب پیدا نشد."});
 const previousUsername=account.data.username;
 const changedId=username!==previousUsername;
 if(changedId){
  const used=await admin.from("account_usernames").select("user_id").eq("username",username).maybeSingle();
  if(used.error)return respond(503,{error:"بررسی آیدی جدید ممکن نیست."});
  if(used.data)return respond(409,{error:"این آیدی قبلاً استفاده شده است."});
 }
 const previousName=membership.data.display_name;
 const previousEmail=user.email||authAddress(previousUsername);
 const previousMeta=user.user_metadata||{};
 const membershipUpdate=await admin.from("school_memberships").update({display_name:displayName})
  .eq("school_id",schoolId).eq("user_id",user.id).eq("role","student").select("user_id").maybeSingle();
 if(membershipUpdate.error||!membershipUpdate.data)return respond(503,{error:"ثبت نام دانش‌آموز ممکن نشد."});
 if(changedId){
  const mapping=await admin.from("account_usernames").update({username})
   .eq("user_id",user.id).eq("username",previousUsername).select("user_id").maybeSingle();
  if(mapping.error||!mapping.data){
   await admin.from("school_memberships").update({display_name:previousName}).eq("school_id",schoolId).eq("user_id",user.id);
   return respond(409,{error:"این آیدی قبلاً ثبت شده یا قابل تغییر نیست."});
  }
 }
 const authUpdate=await admin.auth.admin.updateUserById(user.id,{
  ...(changedId?{email:authAddress(username),email_confirm:true}:{}),
  user_metadata:{...previousMeta,stuner_age:age}
 });
 if(authUpdate.error){
  if(changedId)await admin.from("account_usernames").update({username:previousUsername}).eq("user_id",user.id).eq("username",username);
  await admin.from("school_memberships").update({display_name:previousName}).eq("school_id",schoolId).eq("user_id",user.id);
  return respond(503,{error:"تغییر اطلاعات حساب انجام نشد؛ دوباره تلاش کنید."});
 }
 return respond(200,{ok:true,username,display_name:displayName,age});
}


/* School deletion uses a single atomic database procedure, followed by removal of orphan Auth accounts. */
async function deleteSchool(req:Request,admin:ReturnType<typeof createClient>,body:Record<string,unknown>){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"برای حذف باید وارد حساب مدیر شوید."});
 const auth=await admin.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"نشست مدیر معتبر نیست."});
 const schoolId=String(body.school_id||""),name=String(body.confirm_name||"");
 if(!/^[0-9a-f-]{36}$/i.test(schoolId)||!name||body.confirm_delete!==true)
  return respond(400,{error:"شناسه مدرسه و تأیید نهایی ضروری است."});
 const result=await admin.rpc("delete_school_records",{
  p_school:schoolId,p_actor:auth.data.user.id,p_confirmation:name
 });
 if(result.error){
  const failure=String(result.error.message||"");
  return respond(failure.includes("may delete")?403:409,{error:"حذف مدرسه انجام نشد. نام مدرسه، مالکیت حساب و مجوز مدیر را بررسی کنید."});
 }
 const userIds:Array<string>=Array.isArray(result.data?.orphan_users)?result.data.orphan_users:[];
 const failed:string[]=[];
 // Bounded concurrency avoids long-running cleanup for 250+ person schools.
 for(let at=0;at<userIds.length;at+=5){
  const group=userIds.slice(at,at+5);
  await Promise.all(group.map(async id=>{
   if(id===auth.data.user!.id)return;
   let success=false;
   for(let attempt=0;attempt<2&&!success;attempt++){
    try{const removed=await admin.auth.admin.deleteUser(id);success=!removed.error}catch{success=false}
   }
   if(!success)failed.push(id);
  }));
 }
 return respond(200,{ok:true,deleted:true,member_count:result.data?.member_count||0,removed_accounts:userIds.length-failed.length,
  remaining_orphan_accounts:failed.length,
  warning:failed.length?"مدرسه و تمام اطلاعات وابسته حذف شدند، ولی پاکسازی تعدادی حساب بدون مدرسه کامل نشد.":null});
}

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
 if(mode==="verify_login_role")return await verifyLoginRole(req,admin);
 if(mode==="import_members")return await importMembers(req,admin,data);
 if(mode==="delete_school")return await deleteSchool(req,admin,data);
 if(mode==="change_initial_password")return await changeInitialPassword(req,admin,data);
 if(mode==="update_student_profile")return await updateStudentProfile(req,admin,data);
 const username=String(data.username||"").trim().toLowerCase();
 const name=String(data.display_name||"").trim();
 const password=data.password;
 if(!usernameOk(username)||(mode!=="reset_member"&&!validName(name))||!validPassword(password)){
  return respond(400,{error:"نام کاربری باید با حرف لاتین شروع شود یا کد ملی ۱۰ رقمی باشد. رمز عبور حداقل ۶ کاراکتر لازم دارد."});
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
  app_metadata:{stuner_account:true,stuner_role:role}
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
