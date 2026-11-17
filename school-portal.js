
(function(){
"use strict";
const cfg=window.STUNER_SUPABASE_CONFIG||{};
const el=document.getElementById("portalRoot"),cover=document.getElementById("schoolPortal");
const app=document.getElementById("app"),on=document.getElementById("onboarding");
const ready=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||"")&&/^(sb_publishable_|eyJ)/.test(cfg.publishableKey||"");
let client=null,user=null,role="student",members=[],current=null,classes=[],people=[],teacherLinks=[],school=null;
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function show(){cover.hidden=false;app.style.display="none";on.hidden=true}
function message(v){const x=document.getElementById("portalMessage");if(x)x.textContent=v}
function head(title){return '<div class="portal-head"><strong>STUNER · استیونر</strong><h1>'+esc(title)+'</h1>'+(user?'<button data-action="logout" class="portal-secondary">خروج</button>':'')+'</div>'}
function login(){
 show();current=null;
 el.innerHTML=head("ورود به سامانه مدارس")+'<section class="portal-card"><div class="portal-roles"><button data-role="student">دانش‌آموز</button><button data-role="teacher">معلم</button><button data-role="principal">مدیر</button></div><form id="loginForm" class="portal-form"><label>ایمیل<input name="email" type="email" autocomplete="email" dir="ltr" required></label><label>رمز عبور<input name="password" type="password" autocomplete="current-password" dir="ltr" required></label><button class="portal-primary">ورود</button></form><div class="portal-actions"><button data-action="signup">ساخت حساب</button><button data-action="forgot">بازیابی رمز</button></div><p class="portal-note">انتخاب نقش به تنهایی دسترسی ایجاد نمی‌کند. نقش واقعی از دیتابیس بررسی می‌شود.</p><p class="portal-error" id="portalMessage"></p></section>';
 updateRole();
}
function updateRole(){el.querySelectorAll("[data-role]").forEach(x=>x.classList.toggle("active",x.dataset.role===role))}
function signup(){
 show();el.innerHTML=head("ایجاد حساب")+'<section class="portal-card"><form id="signupForm" class="portal-form"><label>ایمیل<input name="email" type="email" dir="ltr" required></label><label>رمز عبور (حداقل هشت کاراکتر)<input name="password" type="password" minlength="8" dir="ltr" required></label><button class="portal-primary">ثبت نام</button></form><button data-action="back" class="portal-secondary">بازگشت</button><p id="portalMessage" class="portal-error"></p></section>';
}
function forgot(){
 show();el.innerHTML=head("بازیابی رمز عبور")+'<section class="portal-card"><form id="forgotForm" class="portal-form"><label>ایمیل<input name="email" type="email" dir="ltr" required></label><button class="portal-primary">ارسال ایمیل بازیابی</button></form><button data-action="back" class="portal-secondary">بازگشت</button><p id="portalMessage" class="portal-error"></p></section>';
}
function picker(){
 show();
 const options=members.filter(m=>m.role===role).map(m=>'<button data-school="'+esc(m.school_id)+'" class="portal-school"><strong>'+esc(m.schools?.name||"مدرسه")+'</strong><small>'+esc(m.role==="principal"?"مدیر":m.role==="teacher"?"معلم":"دانش‌آموز")+'</small></button>').join("");
 el.innerHTML=head("انتخاب مدرسه")+'<section class="portal-card">'+(options||'<p>با این نقش هنوز عضو هیچ مدرسه‌ای نیستی.</p>')+(role==="principal"?'<button data-action="create" class="portal-primary">ساخت مدرسه جدید</button>':'')+'<form id="redeemForm" class="portal-form"><label>کد دعوت از مدیر مدرسه<input name="code" dir="ltr" required></label><button>ثبت کد دعوت</button></form><button data-action="back" class="portal-secondary">انتخاب نقش دیگر</button><p id="portalMessage" class="portal-error"></p></section>';
}
function newSchool(){
 show();el.innerHTML=head("ساخت مدرسه جدید")+'<section class="portal-card"><form id="schoolForm" class="portal-form"><label>نام مدرسه<input name="name" required minlength="3" maxlength="160"></label><label>نوع مدرسه<select name="kind"><option value="elementary">دبستان</option><option value="middle">متوسطه اول</option><option value="secondary">دبیرستان</option><option value="vocational">هنرستان</option></select></label><label>نام و نام خانوادگی مدیر<input name="manager" required minlength="2"></label><button class="portal-primary">ایجاد مدرسه</button></form><button data-action="picker" class="portal-secondary">بازگشت</button><p id="portalMessage" class="portal-error"></p></section>';
}
async function sync(){
 const {data:session,error:sessionError}=await client.auth.getSession();if(sessionError)throw sessionError;
 user=session.session?.user||null;members=[];current=null;
 if(!user){login();return}
 const {data,error}=await client.from("school_memberships").select("school_id,user_id,role,display_name,grade,class_id,schools(name,kind)").eq("user_id",user.id);
 if(error)throw error;members=data||[];
 if(members.length&&!members.some(m=>m.role===role))role=members[0].role;
 const old=sessionStorage.getItem("stuner.school");
 const last=members.find(m=>m.school_id===old&&m.role===role);
 if(last)await enter(last);else picker();
}
async function enter(member){
 current=member;sessionStorage.setItem("stuner.school",member.school_id);
 if(member.role==="student"){
  cover.hidden=true;app.style.display="";on.hidden=true;
  window.STUNER_ACTIVE_USER={id:user.id,schoolId:member.school_id};
  const src=document.createElement("script");src.src="./app.js";document.body.appendChild(src);return;
 }
 const sid=current.school_id;
 const [s,c,p,t]=await Promise.all([
  client.from("schools").select("id,name,kind").eq("id",sid).single(),
  client.from("school_classes").select("id,name,grade,school_id").eq("school_id",sid),
  client.from("school_memberships").select("user_id,role,display_name,grade,class_id").eq("school_id",sid),
  client.from("class_teachers").select("class_id,teacher_id").eq("school_id",sid)
 ]);
 for(const r of [s,c,p,t])if(r.error)throw r.error;
 school=s.data;classes=c.data||[];people=p.data||[];teacherLinks=t.data||[];dashboard();
}
function dashboard(){
 show();
 const director=current.role==="principal",teacher=current.role==="teacher";
 const visible=teacher?classes.filter(c=>teacherLinks.some(t=>t.class_id===c.id&&t.teacher_id===user.id)):classes;
 const students=people.filter(p=>p.role==="student"&&(!teacher||visible.some(c=>c.id===p.class_id)));
 let body='<div class="portal-stats"><div><small>کلاس‌ها</small><strong>'+visible.length+'</strong></div><div><small>دانش‌آموزان</small><strong>'+students.length+'</strong></div><div><small>معلمان</small><strong>'+people.filter(p=>p.role==="teacher").length+'</strong></div></div>';
 body+='<section class="portal-card"><h2>کلاس‌ها</h2>'+(visible.map(c=>'<div class="portal-record"><strong>'+esc(c.name)+'</strong><span>'+esc(c.grade)+'</span></div>').join("")||'<p>کلاسی ثبت نشده است.</p>')+'</section>';
 if(director){
  const opts=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+esc(c.grade)+'</option>').join("");
  body+='<section class="portal-card"><h2>ساخت کلاس</h2><form id="classForm" class="portal-form"><label>عنوان کلاس<input name="name" required></label><label>پایه<input name="grade" required></label><button class="portal-primary">ایجاد کلاس</button></form></section>';
  body+='<section class="portal-card"><h2>دعوت معلم یا دانش‌آموز</h2><form id="inviteForm" class="portal-form"><label>نقش<select name="role"><option value="student">دانش‌آموز</option><option value="teacher">معلم</option></select></label><label>نام کامل<input name="name" required></label><label>ایمیل<input name="email" type="email" dir="ltr" required></label><label>پایه (فقط دانش‌آموز)<input name="grade" placeholder="مثلاً هفتم"></label><label>کلاس<select name="classid"><option value="">بدون کلاس</option>'+opts+'</select></label><button class="portal-primary">ایجاد کد دعوت</button></form><div id="inviteOutput"></div><p class="portal-note">کد دعوت فقط برای ایمیل مشخص‌شده و به مدت ۱۴ روز معتبر است.</p></section>';
 }
 body+='<section class="portal-card"><h2>'+(director?'اعضای مدرسه':'دانش‌آموزان کلاس‌های من')+'</h2>'+( (director?people:students).map(p=>'<div class="portal-record"><strong>'+esc(p.display_name)+'</strong><span>'+esc(p.role==="principal"?"مدیر":p.role==="teacher"?"معلم":"دانش‌آموز")+' · '+esc(p.grade||"")+'</span></div>').join("")||'<p>عضوی ثبت نشده است.</p>')+'</section>';
 el.innerHTML=head(school.name)+'<div class="portal-context"><span>'+esc(director?"پنل مدیر": "پنل معلم")+'</span><button data-action="picker">تغییر مدرسه</button></div>'+body+'<p id="portalMessage" class="portal-error"></p>';
}
async function handle(form){
 const d=new FormData(form);
 try{
  let r;
  if(form.id==="loginForm"){r=await client.auth.signInWithPassword({email:String(d.get("email")).trim(),password:d.get("password")});if(r.error)throw r.error;await sync();return}
  if(form.id==="signupForm"){r=await client.auth.signUp({email:String(d.get("email")).trim(),password:d.get("password")});if(r.error)throw r.error;if(r.data.session)await sync();else message("ایمیل تأیید حساب ارسال شد. پس از تأیید وارد شو.");return}
  if(form.id==="forgotForm"){r=await client.auth.resetPasswordForEmail(String(d.get("email")).trim(),{redirectTo:location.origin+location.pathname});if(r.error)throw r.error;message("اگر حساب وجود داشته باشد، لینک بازیابی ارسال می‌شود.");return}
  if(form.id==="schoolForm"){r=await client.rpc("create_school",{p_name:d.get("name"),p_kind:d.get("kind"),p_manager:d.get("manager")});if(r.error)throw r.error;role="principal";sessionStorage.setItem("stuner.school",r.data);await sync();return}
  if(form.id==="redeemForm"){r=await client.rpc("redeem_school_invite",{p_token:String(d.get("code")).trim()});if(r.error)throw r.error;sessionStorage.setItem("stuner.school",r.data);await sync();return}
  if(form.id==="classForm"){r=await client.from("school_classes").insert({school_id:school.id,name:String(d.get("name")).trim(),grade:String(d.get("grade")).trim()});if(r.error)throw r.error;await enter(current);return}
  if(form.id==="inviteForm"){
   const isStudent=d.get("role")==="student";const cls=classes.find(c=>c.id===d.get("classid"));
   const grade=isStudent?String(d.get("grade")||cls?.grade||"").trim():null;
   if(isStudent&&!grade)throw Error("پایه دانش‌آموز الزامی است.");
   r=await client.rpc("create_school_invite",{p_school:school.id,p_email:String(d.get("email")).trim(),p_name:String(d.get("name")).trim(),p_role:d.get("role"),p_grade:grade||null,p_class:cls?.id||null});
   if(r.error)throw r.error;
   document.getElementById("inviteOutput").innerHTML='<div class="portal-invite"><strong>کد دعوت (این کد را امن ارسال کن):</strong><code dir="ltr">'+esc(r.data)+'</code></div>';
  }
 }catch(e){message(e.message||"خطا در ثبت اطلاعات")}
}
el.addEventListener("click",async e=>{
 const r=e.target.closest("[data-role]");if(r){role=r.dataset.role;updateRole();return}
 const s=e.target.closest("[data-school]");if(s){const m=members.find(x=>x.school_id===s.dataset.school&&x.role===role);if(m)try{await enter(m)}catch(ex){message(ex.message)}return}
 const a=e.target.closest("[data-action]")?.dataset.action;
 if(a==="logout"){await client.auth.signOut();location.reload()}
 if(a==="signup")signup();if(a==="forgot")forgot();if(a==="back")login();
 if(a==="create")newSchool();if(a==="picker")picker();
});
el.addEventListener("submit",async e=>{if(!e.target.matches("form"))return;e.preventDefault();const btn=e.target.querySelector("button");if(btn)btn.disabled=true;await handle(e.target);if(btn?.isConnected)btn.disabled=false});
async function start(){
 show();
 if(!ready){el.innerHTML=head("اتصال Supabase لازم است")+'<section class="portal-card"><p>برای فعال‌سازی سه نوع ورود، ابتدا پروژه Supabase بساز؛ فایل <code>supabase/schema.sql</code> را در SQL Editor اجرا کن و آدرس پروژه و Publishable Key را در <code>supabase-config.js</code> قرار بده.</p><p>ورود نمایشی یا حساب مدیر بدون بررسی سرور فعال نشده است.</p></section>';return}
 if(!window.supabase?.createClient){el.innerHTML=head("کتابخانه Supabase بارگذاری نشد")+'<p>اتصال اینترنت را بررسی کن.</p>';return}
 client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 await sync();client.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")location.reload()});
}
start().catch(e=>{show();el.innerHTML=head("خطای اتصال")+'<section class="portal-card">'+esc(e.message)+'</section>'});
})();
