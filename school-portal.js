
(function(){
"use strict";
const cfg=window.STUNER_SUPABASE_CONFIG||{};
const el=document.getElementById("portalRoot"),cover=document.getElementById("schoolPortal");
const app=document.getElementById("app"),on=document.getElementById("onboarding");
const ready=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||"")&&/^(sb_publishable_|eyJ)/.test(cfg.publishableKey||"");
let client=null,user=null,role="student",members=[],current=null,classes=[],people=[],teacherLinks=[],school=null,assignments=[],accountNames=[];
let directorSection="home",directorMenu=false,viewClassId=null;
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const usernameRx=/^[a-z][a-z0-9_]{3,31}$/;
const loginEmail=(name)=>name.trim().toLowerCase()+"@accounts.stuner.invalid";
async function provision(payload,authenticated=false){
 const headers={"Content-Type":"application/json","apikey":cfg.publishableKey};
 if(authenticated){
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw Error("ابتدا با حساب مدیر وارد شو.");
  headers.Authorization="Bearer "+session.access_token;
 }
 const response=await fetch(cfg.url+"/functions/v1/stuner-provision-user",{
  method:"POST",headers,body:JSON.stringify(payload)
 });
 let result={};
 try{result=await response.json()}catch{}
 if(!response.ok)throw Error(result.error||"ایجاد حساب امکان‌پذیر نشد.");
 return result;
}
const gradeSets={
 elementary:["اول","دوم","سوم","چهارم","پنجم","ششم"],
 middle:["هفتم","هشتم","نهم"],
 secondary:["دهم","یازدهم","دوازدهم"],
 vocational:["دهم","یازدهم","دوازدهم"]
};
const schoolKindName={elementary:"دبستان",middle:"متوسطه اول",secondary:"دبیرستان",vocational:"هنرستان"};
function schoolChoices(kind){
 const vocational=kind==="vocational",advanced=vocational||kind==="secondary";
 const branch=vocational?'<label>شاخه تحصیلی<select name="branch"><option value="فنی‌وحرفه‌ای">فنی‌وحرفه‌ای</option><option value="کاردانش">کاردانش</option></select></label>':
   kind==="secondary"?'<label>شاخه تحصیلی<input name="branch" value="نظری" readonly></label>':"";
 const gradeOptions=(gradeSets[kind]||[]).map(g=>'<label class="portal-grade"><input type="checkbox" name="grades" value="'+g+'" checked><span>'+g+'</span></label>').join("");
 return branch+
   '<fieldset class="portal-grade-set"><legend>پایه‌های موجود در مدرسه</legend><div class="portal-grade-options">'+gradeOptions+'</div></fieldset>'+
   (advanced?'<label>رشته‌های موجود (هر رشته در یک خط)<textarea name="majors" rows="4" required maxlength="2500" placeholder="شبکه و نرم‌افزار\\nمعماری داخلی\\nفتوگرافیک"></textarea></label>':
      '<p class="portal-note">برای این مقطع به ازای هر پایه یک کلاس ساخته می‌شود.</p>')+
   '<div class="portal-preview" id="schoolClassPreview"></div>';
}
function updateSchoolPreview(){
 const form=el.querySelector("#schoolForm");
 if(!form)return;
 const d=new FormData(form),kind=d.get("kind"),
  grades=d.getAll("grades"),
  majors=kind==="vocational"||kind==="secondary"?[...new Set(String(d.get("majors")||"").split(/[\n،,؛;]+/).map(x=>x.trim()).filter(Boolean))]:[];
 const result=document.getElementById("schoolClassPreview");
 if(result){
  const items=grades.flatMap(g=>majors.length?majors.map(m=>g+" - "+m):[g+" - کلاس عمومی"]);
  result.innerHTML='<strong>پیش‌نمایش کلاس‌های خودکار: '+items.length+' کلاس</strong>'+
   (items.length?'<div class="portal-class-chips">'+items.slice(0,70).map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>':"<p>حداقل یک پایه انتخاب کن.</p>");
 }
}

function show(){cover.hidden=false;app.style.display="none";on.hidden=true}
function message(v){const x=document.getElementById("portalMessage");if(x)x.textContent=v}
function head(title){return '<div class="portal-head"><strong>STUNER · استیونر</strong><h1>'+esc(title)+'</h1>'+(user?'<button data-action="logout" class="portal-secondary">خروج</button>':'')+'</div>'}
function login(){
 show();current=null;
 el.innerHTML=head("ورود به سامانه مدارس")+'<section class="portal-card"><div class="portal-roles"><button data-role="student">دانش‌آموز</button><button data-role="teacher">معلم</button><button data-role="principal">مدیر مدرسه</button></div><form id="loginForm" class="portal-form"><label>نام کاربری<input name="username" type="text" autocomplete="username" dir="ltr" required minlength="4" maxlength="32" pattern="[a-z][a-z0-9_]{3,31}" placeholder="navid_1405"></label><label>رمز عبور<input name="password" type="password" autocomplete="current-password" dir="ltr" required></label><button class="portal-primary">ورود به استیونر</button></form><div class="portal-actions"><button data-action="signup">ساخت حساب مدیر مدرسه</button></div><p class="portal-note">حساب معلم و دانش‌آموز توسط مدیر مدرسه ساخته می‌شود؛ ایمیل نیاز نیست. دسترسی هر نقش در سرور بررسی می‌شود.</p><p class="portal-error" id="portalMessage" aria-live="polite"></p></section>';
 updateRole();
}
function updateRole(){el.querySelectorAll("[data-role]").forEach(x=>x.classList.toggle("active",x.dataset.role===role))}
function signup(){
 show();role="principal";
 el.innerHTML=head("ثبت‌نام مدیر مدرسه")+'<section class="portal-card"><form id="signupForm" class="portal-form"><label>نام و نام خانوادگی<input name="display_name" type="text" required maxlength="120" minlength="2" autocomplete="name"></label><label>نام کاربری<input name="username" type="text" required maxlength="32" minlength="4" pattern="[a-z][a-z0-9_]{3,31}" dir="ltr" autocomplete="username" placeholder="school_manager"></label><label>رمز عبور (حداقل ۱۰ کاراکتر)<input name="password" type="password" required minlength="10" maxlength="128" dir="ltr" autocomplete="new-password"></label><button class="portal-primary">ایجاد حساب مدیر</button></form><button data-action="back" class="portal-secondary">بازگشت به ورود</button><p class="portal-note">برای ثبت‌نام ایمیل یا شماره تلفن لازم نیست. رمز را در جایی امن نگه دار؛ بازیابی خودکار رمز بدون روش ارتباطی فعال نیست.</p><p id="portalMessage" class="portal-error" aria-live="polite"></p></section>';
}
function picker(){
 show();
 const options=members.filter(m=>m.role===role).map(m=>'<button data-school="'+esc(m.school_id)+'" class="portal-school"><strong>'+esc(m.schools?.name||"مدرسه")+'</strong><small>'+esc(m.role==="principal"?"مدیر":m.role==="teacher"?"معلم":"دانش‌آموز")+'</small></button>').join("");
 el.innerHTML=head("انتخاب مدرسه")+'<section class="portal-card">'+(options||'<p>هنوز مدرسه‌ای برای این نقش ثبت نشده است.</p>')+(role==="principal"?'<button data-action="create" class="portal-primary">ایجاد مدرسه جدید</button>':'<p class="portal-note">اگر به مدرسه دسترسی نداری از مدیر بخواه حساب و کلاس تو را تعیین کند.</p>')+'<button data-action="back" class="portal-secondary">بازگشت به انتخاب نقش</button><p id="portalMessage" class="portal-error"></p></section>';
}
function newSchool(){
 show();
 el.innerHTML=head("ثبت مدرسه و ساخت خودکار کلاس‌ها")+'<section class="portal-card"><form id="schoolForm" class="portal-form"><label>نام مدرسه<input name="name" required minlength="3" maxlength="160" placeholder="مثلاً هنرستان محمدیان"></label><label>نوع مدرسه<select name="kind" id="schoolKind"><option value="vocational">هنرستان</option><option value="secondary">دبیرستان</option><option value="middle">متوسطه اول</option><option value="elementary">دبستان</option></select></label><label>نام مدیر<input name="manager" required minlength="2" maxlength="120" value="'+esc(user?.user_metadata?.name||"")+'"></label><div id="schoolChoices"></div><button class="portal-primary">ساخت مدرسه و تمام کلاس‌ها</button></form><button data-action="picker" class="portal-secondary">بازگشت</button><p id="portalMessage" class="portal-error"></p></section>';
 renderSchoolFields();
}
function renderSchoolFields(){
 const kind=el.querySelector("#schoolKind")?.value||"vocational";
 const target=el.querySelector("#schoolChoices");
 if(target)target.innerHTML=schoolChoices(kind);
 updateSchoolPreview();
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
 if(current?.school_id!==member.school_id){directorSection="home";viewClassId=null;directorMenu=false}
 current=member;sessionStorage.setItem("stuner.school",member.school_id);
 if(member.role==="student"){
  cover.hidden=true;app.style.display="";on.hidden=true;
  window.STUNER_ACTIVE_USER={id:user.id,schoolId:member.school_id};
  if(!document.getElementById("stunerStudentLogout")){const logout=document.createElement("button");logout.id="stunerStudentLogout";logout.type="button";logout.textContent="خروج از حساب";logout.className="secondary-button small-button";logout.addEventListener("click",async()=>{await client.auth.signOut();location.reload()});document.querySelector(".topbar-actions")?.appendChild(logout);}
  // Enrollment is the source of truth for the student's class and educational profile.
  if(member.class_id){
   const [cl,sch]=await Promise.all([
    client.from("school_classes").select("grade,major,school_id").eq("id",member.class_id).eq("school_id",member.school_id).single(),
    client.from("schools").select("kind,branch").eq("id",member.school_id).single()
   ]);
   if(cl.error||sch.error)throw cl.error||sch.error;
   const selectedGrade=cl.data.grade,major=cl.data.major||"",branch=sch.data.branch||"";
   const level=sch.data.kind==="elementary"?"elementary":sch.data.kind==="middle"?"middle":"secondary";
   const track=level==="secondary"?(branch||"نظری"):"";
   const grade=level==="elementary"?selectedGrade+" ابتدایی":selectedGrade;
   const compact=x=>String(x||"").replace(/[\u200c\s-]/g,"").replace(/ي/g,"ی").replace(/ك/g,"ک");
   const matches=(window.STUNER_CHAP_CATALOG?.categories||[]).find(x=>x.educationLevel===level&&x.grade===grade&&
      compact(x.major)===compact(major)&&compact(x.track)===compact(track));
   const display=String(member.display_name||"دانش‌آموز").trim().split(/\s+/);
   window.STUNER_ACTIVE_STUDENT_PROFILE={
    firstName:display[0],lastName:display.slice(1).join(" ")||"",
    educationLevel:level,grade,track,major,fieldGroup:matches?.fieldGroup||""
   };
  }
  window.STUNER_SCHOOL_WORK?.init(client,user,member);
  const src=document.createElement("script");src.src="./app.js";document.body.appendChild(src);return;
 }
 if(member.role==="teacher"){
  show();
  if(!window.STUNER_TEACHER_UI)throw Error("پنل معلم بارگذاری نشده است.");
  await window.STUNER_TEACHER_UI.start({client,user,members,active:member,root:el,onMembershipsChanged:items=>{members=[...members.filter(x=>x.role!=="teacher"),...items]}});
  return;
 }
 const sid=current.school_id;
 const [s,c,p,t,w,n]=await Promise.all([
  client.from("schools").select("id,name,kind,branch,majors,grades").eq("id",sid).single(),
  client.from("school_classes").select("id,name,grade,major,school_id").eq("school_id",sid),
  client.from("school_memberships").select("user_id,role,display_name,grade,class_id").eq("school_id",sid),
  client.from("class_teachers").select("class_id,teacher_id").eq("school_id",sid),
  client.from("school_assignments").select("id,school_id,class_id,teacher_id,kind,title,subject,description,due_date,created_at").eq("school_id",sid).order("due_date",{ascending:true}),
  client.from("account_usernames").select("user_id,username")
 ]);
 for(const r of [s,c,p,t,w,n])if(r.error)throw r.error;
 school=s.data;classes=c.data||[];people=p.data||[];teacherLinks=t.data||[];assignments=w.data||[];accountNames=n.data||[];dashboard();
}
function dashboard(){
 show();
 const director=current.role==="principal",teacher=current.role==="teacher";
 const visible=teacher?classes.filter(c=>teacherLinks.some(t=>t.class_id===c.id&&t.teacher_id===user.id)):classes;
 const students=people.filter(p=>p.role==="student"&&(!teacher||visible.some(c=>c.id===p.class_id)));
 let body='<div class="portal-stats"><div><small>کلاس‌ها</small><strong>'+visible.length+'</strong></div><div><small>دانش‌آموزان</small><strong>'+students.length+'</strong></div><div><small>معلمان</small><strong>'+people.filter(p=>p.role==="teacher").length+'</strong></div></div>';
 body+='<section class="portal-card"><h2>مشخصات مدرسه</h2><div class="portal-record"><strong>نوع مدرسه</strong><span>'+esc(schoolKindName[school.kind]||school.kind)+'</span></div><div class="portal-record"><strong>شاخه</strong><span>'+esc(school.branch||"—")+'</span></div><div class="portal-record"><strong>رشته‌ها</strong><span>'+esc((school.majors||[]).join("، ")||"عمومی")+'</span></div><div class="portal-record"><strong>پایه‌ها</strong><span>'+esc((school.grades||[]).join("، "))+'</span></div></section>';
 body+='<section class="portal-card"><h2>کلاس‌ها</h2>'+(visible.map(c=>'<div class="portal-record"><strong>'+esc(c.name)+'</strong><span>'+esc(c.grade)+'</span></div>').join("")||'<p>کلاسی ثبت نشده است.</p>')+'</section>';
 if(director){
  const opts=classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+esc(c.grade)+'</option>').join("");
  body+='<section class="portal-card"><h2>ساخت کلاس</h2><form id="classForm" class="portal-form"><label>عنوان کلاس<input name="name" required></label><label>پایه<input name="grade" required></label><button class="portal-primary">ایجاد کلاس</button></form></section>';
  body+='<section class="portal-card"><h2>ساخت حساب معلم و دانش‌آموز</h2><form id="newMemberForm" class="portal-form"><label>نوع حساب<select name="role" id="newMemberRole"><option value="student">دانش‌آموز</option><option value="teacher">معلم</option></select></label><label>نام و نام خانوادگی<input name="display_name" required minlength="2" maxlength="120" placeholder="نام واقعی کاربر"></label><label>نام کاربری<input name="username" dir="ltr" pattern="[a-z][a-z0-9_]{3,31}" minlength="4" maxlength="32" placeholder="student_701" required></label><label>رمز عبور اولیه (حداقل ۱۰ کاراکتر)<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><label>کلاس<select name="class_id" id="newMemberClass"><option value="">انتخاب کلاس</option>'+classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")+'</select></label><p class="portal-note">برای دانش‌آموز انتخاب کلاس الزامی است؛ معلم می‌تواند بعداً به کلاس اختصاص یابد.</p><button class="portal-primary">ایجاد حساب و ثبت در مدرسه</button></form><div id="newMemberResult"></div></section>';
  body+='<section class="portal-card"><h2>تغییر رمز عبور معلم یا دانش‌آموز</h2><form id="resetMemberForm" class="portal-form"><label>نام کاربری حساب<input name="username" dir="ltr" pattern="[a-z][a-z0-9_]{3,31}" required placeholder="student_701"></label><label>رمز عبور جدید (حداقل ۱۰ کاراکتر)<input type="password" name="password" minlength="10" maxlength="128" required autocomplete="new-password"></label><button class="portal-primary">تنظیم رمز جدید</button></form></section>';

 }

 if(teacher){
  const options=visible.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+esc(c.grade)+'</option>').join("");
  body+='<section class="portal-card"><h2>تعیین تکلیف یا امتحان</h2>'+(visible.length?
   '<form id="assignmentForm" class="portal-form"><label>نوع<select name="kind" required><option value="task">تکلیف</option><option value="exam">امتحان</option></select></label><label>کلاس<select name="class_id" required>'+options+'</select></label><label>درس<input name="subject" placeholder="مثلاً ریاضی" required maxlength="100"></label><label>عنوان<input name="title" placeholder="مثلاً تمرین فصل سوم" required maxlength="150" minlength="2"></label><label>تاریخ تحویل یا امتحان<input name="due_date" type="date" required></label><label>شرح فعالیت<textarea name="description" rows="3" maxlength="3000" placeholder="مباحث یا صفحه‌های کتاب"></textarea></label><button class="portal-primary">ثبت و ارسال به کلاس</button></form>':
   '<p>ابتدا مدیر مدرسه باید کلاسی را به شما اختصاص دهد.</p>')+'</section>';
 }
 if(teacher||director){
  const visibleIds=new Set(visible.map(c=>c.id));
  const list=assignments.filter(x=>director||visibleIds.has(x.class_id));
  body+='<section class="portal-card"><h2>تکالیف و امتحانات مدرسه</h2>'+(list.map(x=>
   '<div class="portal-record school-assignment-record"><div><small>'+esc(x.kind==="task"?"تکلیف":"امتحان")+' · '+esc(x.subject)+' · '+esc(classes.find(c=>c.id===x.class_id)?.name||"")+'</small><strong>'+esc(x.title)+'</strong><small>'+esc(x.due_date)+'</small></div>'+
   (teacher&&x.teacher_id===user.id?'<button class="portal-secondary" data-delete-assignment="'+esc(x.id)+'">حذف</button>':'')+'</div>'
  ).join("")||'<p>هنوز تکلیف یا امتحانی ثبت نشده است.</p>')+'</section>';
 }
 if(director&&classes.length&&people.some(x=>x.role==="teacher")){
  const teachers=people.filter(x=>x.role==="teacher");
  body+='<section class="portal-card"><h2>اختصاص معلم به کلاس</h2><form class="portal-form" id="assignTeacherForm"><label>معلم<select name="teacher_id">'+teachers.map(t=>'<option value="'+esc(t.user_id)+'">'+esc(t.display_name)+'</option>').join("")+'</select></label><label>کلاس<select name="class_id">'+classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · '+esc(c.grade)+'</option>').join("")+'</select></label><button class="portal-primary">ثبت انتساب</button></form></section>';
 }
 body+='<section class="portal-card"><h2>'+(director?'اعضای مدرسه':'دانش‌آموزان کلاس‌های من')+'</h2>'+( (director?people:students).map(p=>'<div class="portal-record"><strong>'+esc(p.display_name)+'</strong><span>'+esc(p.role==="principal"?"مدیر":p.role==="teacher"?"معلم":"دانش‌آموز")+' · '+esc(p.grade||"")+' · '+esc(accountNames.find(x=>x.user_id===p.user_id)?.username||"—")+'</span></div>').join("")||'<p>عضوی ثبت نشده است.</p>')+'</section>';
 el.innerHTML=head(school.name)+'<div class="portal-context"><span>'+esc(director?"پنل مدیر": "پنل معلم")+'</span><button data-action="picker">تغییر مدرسه</button></div>'+body+'<p id="portalMessage" class="portal-error"></p>';
 if(director)directorUi();
}

function directorUi(){
 const sections=[["home","صفحه اصلی"],["students","دانش‌آموزان"],["teachers","معلمان"],["classes","کلاس‌ها"],["work","تکالیف و امتحانات"],["security","تغییر رمز عبور"]];
 const cards=[...el.querySelectorAll(".portal-card")];
 const find=title=>cards.find(c=>c.querySelector("h2")?.textContent.trim()===title);
 cards.forEach(c=>c.hidden=true);
 const stats=el.querySelector(".portal-stats");if(stats)stats.hidden=directorSection!=="home";
 const context=el.querySelector(".portal-context");if(context)context.hidden=true;
 const header=el.querySelector(".portal-head");
 if(header)header.innerHTML='<button class="portal-hamburger" type="button" data-director-action="menu" aria-label="منوی مدیریت" aria-expanded="'+directorMenu+'"><i data-lucide="menu"></i></button><div><small>STUNER · '+esc(school.name)+'</small><h1>'+sections.find(x=>x[0]===directorSection)[1]+'</h1></div>';
 const old=el.querySelector(".portal-director-nav");if(old)old.remove();
 if(directorMenu)el.insertAdjacentHTML("afterbegin",'<div class="portal-director-nav"><button class="portal-nav-scrim" data-director-action="close" aria-label="بستن منو"></button><nav class="portal-nav-menu" aria-label="منوی مدیر"><div class="portal-nav-title"><strong>مدیریت '+esc(school.name)+'</strong><button data-director-action="close" aria-label="بستن">×</button></div>'+sections.map(x=>'<button class="'+(directorSection===x[0]?"active":"")+'" data-director-page="'+x[0]+'"><i data-lucide="'+({home:"layout-dashboard",students:"users-round",teachers:"graduation-cap",classes:"school",work:"clipboard-check",security:"shield-check"}[x[0]])+'"></i> '+x[1]+'</button>').join("")+'<button data-action="picker">تغییر مدرسه</button><button data-action="logout">خروج</button></nav></div>');
 if(directorSection==="home"){find("مشخصات مدرسه").hidden=false;return}
 if(directorSection==="classes"){
  const card=find("کلاس‌ها");card.hidden=false;
  const selected=classes.find(c=>c.id===viewClassId);
  if(selected){
   const students=people.filter(p=>p.role==="student"&&p.class_id===selected.id);
   card.innerHTML='<button class="portal-secondary" data-class-back>بازگشت به کلاس‌ها</button><h2>'+esc(selected.name)+'</h2><p>پایه '+esc(selected.grade)+' · '+students.length+' دانش‌آموز</p><h3>دانش‌آموزان این کلاس</h3>'+(students.map(p=>'<div class="portal-record"><strong>'+esc(p.display_name)+'</strong><span>نام کاربری: '+esc(accountNames.find(a=>a.user_id===p.user_id)?.username||"—")+'</span></div>').join("")||'<p>هنوز دانش‌آموزی ندارد.</p>');
  }else{
   card.innerHTML='<h2>کلاس‌ها</h2><p>روی هر کلاس بزن تا دانش‌آموزان آن را ببینی.</p><div class="portal-class-grid">'+classes.map(c=>'<button class="portal-class-tile" data-class-detail="'+esc(c.id)+'"><strong>'+esc(c.name)+'</strong><small>'+people.filter(p=>p.role==="student"&&p.class_id===c.id).length+' دانش‌آموز · پایه '+esc(c.grade)+'</small><span>مشاهده ←</span></button>').join("")+'</div>';
   const add=find("ساخت کلاس");if(add)add.hidden=false;
  }
  return;
 }
 if(directorSection==="students"||directorSection==="teachers"){
  const isTeacher=directorSection==="teachers",kind=isTeacher?"teacher":"student";
  const formCard=find("ساخت حساب معلم و دانش‌آموز");
  formCard.hidden=false;formCard.querySelector("h2").textContent=isTeacher?"افزودن معلم جدید":"افزودن دانش‌آموز جدید";
  const roleControl=formCard.querySelector("#newMemberRole");
  roleControl.value=kind;roleControl.closest("label").hidden=true;
  const classControl=formCard.querySelector("#newMemberClass");
  classControl.closest("label").hidden=isTeacher;
  classControl.required=!isTeacher;
  if(isTeacher){
   const group=document.createElement("fieldset");
   group.className="portal-grade-set";
   group.innerHTML='<legend>کلاس‌های این معلم (انتخاب چندتایی)</legend><p class="portal-note">همه کلاس‌های مورد نظر را انتخاب کن.</p><div class="portal-class-checks">'+classes.map(c=>'<label class="portal-class-check"><input type="checkbox" name="class_ids" value="'+esc(c.id)+'"><span>'+esc(c.name)+'</span></label>').join("")+'</div>';
   classControl.closest("label").after(group);
  }
  const entries=people.filter(p=>p.role===kind);
  formCard.insertAdjacentHTML("beforebegin",'<section class="portal-card portal-list-card"><h2>لیست '+(isTeacher?"معلمان":"دانش‌آموزان")+' ('+entries.length+')</h2>'+(entries.map(p=>'<div class="portal-person"><div class="portal-person-avatar">'+esc(p.display_name?.trim()?.charAt(0)||"؟")+'</div><div><strong>'+esc(p.display_name)+'</strong><small>نام کاربری: '+esc(accountNames.find(a=>a.user_id===p.user_id)?.username||"—")+'</small><small>'+(isTeacher?"کلاس‌ها: "+esc(teacherLinks.filter(t=>t.teacher_id===p.user_id).map(t=>classes.find(c=>c.id===t.class_id)?.name||"").filter(Boolean).join("، ")||"تعیین نشده"):"کلاس: "+esc(classes.find(c=>c.id===p.class_id)?.name||"—"))+'</small></div></div>').join("")||'<p>هنوز حسابی ثبت نشده است.</p>')+'</section>');
  if(isTeacher){
   const assign=find("اختصاص معلم به کلاس");if(assign)assign.hidden=false;
   formCard.insertAdjacentHTML("afterend",'<section class="portal-card"><h2>دعوت معلمی که از قبل حساب دارد</h2><p class="portal-note">برای معلمی که در مدرسه دیگری نیز تدریس دارد، حساب تکراری نساز. کد دعوت را به او بده تا خودش عضویت در این مدرسه را تأیید کند.</p><form id="inviteExistingTeacherForm" class="portal-form"><label>نام کاربری فعلی معلم<input name="username" dir="ltr" pattern="[a-z][a-z0-9_]{3,31}" required></label><label>نام و نام خانوادگی معلم<input name="display_name" minlength="2" maxlength="120" required></label><label>کلاس اولیه (اختیاری)<select name="class_id"><option value="">بعداً تعیین می‌کنم</option>'+classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("")+'</select></label><button class="portal-primary">ایجاد کد دعوت معلم</button></form><div id="existingTeacherInviteResult" role="status" aria-live="polite"></div></section>');
  }
  return;
 }
 if(directorSection==="work"){const card=find("تکالیف و امتحانات مدرسه");if(card)card.hidden=false}
 if(directorSection==="security"){const card=find("تغییر رمز عبور معلم یا دانش‌آموز");if(card)card.hidden=false}
}

async function handle(form){
 const d=new FormData(form);
 try{
  let r;
  if(form.id==="loginForm"){const username=String(d.get("username")||"").trim().toLowerCase();if(!usernameRx.test(username))throw Error("نام کاربری معتبر نیست.");r=await client.auth.signInWithPassword({email:loginEmail(username),password:String(d.get("password")||"")});if(r.error)throw Error("نام کاربری یا رمز عبور نادرست است.");await sync();return}
  if(form.id==="signupForm"){const username=String(d.get("username")||"").trim().toLowerCase(),password=String(d.get("password")||"");await provision({mode:"register_manager",username,password,display_name:String(d.get("display_name")||"").trim()});r=await client.auth.signInWithPassword({email:loginEmail(username),password});if(r.error)throw r.error;role="principal";await sync();return}
  if(form.id==="schoolForm"){const kind=String(d.get("kind")||""),grades=d.getAll("grades"),majors=(kind==="vocational"||kind==="secondary")?[...new Set(String(d.get("majors")||"").split(/[\n،,؛;]+/).map(x=>x.trim()).filter(Boolean))]:[];if(!grades.length)throw Error("حداقل یک پایه انتخاب کن.");if((kind==="vocational"||kind==="secondary")&&!majors.length)throw Error("حداقل یک رشته وارد کن.");r=await client.rpc("create_school_with_classes",{p_name:String(d.get("name")||"").trim(),p_kind:kind,p_branch:kind==="vocational"?d.get("branch"):kind==="secondary"?"نظری":null,p_manager:String(d.get("manager")||"").trim(),p_grades:grades,p_majors:majors});if(r.error)throw r.error;role="principal";sessionStorage.setItem("stuner.school",r.data);await sync();return}
  if(form.id==="inviteExistingTeacherForm"){
   const username=String(d.get("username")||"").trim().toLowerCase(),name=String(d.get("display_name")||"").trim();
   if(!usernameRx.test(username))throw Error("نام کاربری معلم معتبر نیست.");
   const classroom=String(d.get("class_id")||"");
   if(classroom&&!classes.some(c=>c.id===classroom))throw Error("کلاس انتخاب‌شده به این مدرسه تعلق ندارد.");
   const invite=await client.rpc("create_school_invite",{p_school:school.id,p_email:loginEmail(username),p_name:name,p_role:"teacher",p_grade:null,p_class:classroom||null});
   if(invite.error)throw invite.error;
   const result=document.getElementById("existingTeacherInviteResult");
   if(result)result.innerHTML='<div class="portal-invite"><strong>کد دعوت معلم ساخته شد.</strong><p>این کد را فقط به همان معلم بده تا در صفحه «مدارس من» وارد کند. کد تا ۱۴ روز معتبر است.</p><code dir="ltr">'+esc(invite.data)+'</code></div>';
   return;
  }
  if(form.id==="resetMemberForm"){
   const username=String(d.get("username")||"").trim().toLowerCase();
   await provision({mode:"reset_member",school_id:school.id,username,password:String(d.get("password")||"")},true);
   message("رمز عبور حساب "+username+" با موفقیت تغییر کرد.");return;
  }
  if(form.id==="newMemberForm"){
   const username=String(d.get("username")||"").trim().toLowerCase();
   const modeRole=d.get("role"),classId=String(d.get("class_id")||"");
   const classIds=modeRole==="teacher"?d.getAll("class_ids").map(String):[];
   if(modeRole==="student"&&!classId)throw Error("ابتدا کلاس دانش‌آموز را انتخاب کن.");
   const result=await provision({mode:"create_member",school_id:school.id,role:modeRole,class_id:modeRole==="student"?classId:null,class_ids:classIds,display_name:String(d.get("display_name")||"").trim(),username,password:String(d.get("password")||"")},true);
   await enter(current);
   message("حساب "+(modeRole==="teacher"?"معلم":"دانش‌آموز")+" با نام کاربری "+result.username+" ساخته شد.");
   return;
  }
  if(form.id==="assignmentForm"){
   const classId=String(d.get("class_id")||"");
   if(!teacherLinks.some(x=>x.teacher_id===user.id&&x.class_id===classId))throw Error("به این کلاس دسترسی نداری.");
   r=await client.from("school_assignments").insert({
    school_id:school.id,class_id:classId,teacher_id:user.id,
    kind:d.get("kind"),subject:String(d.get("subject")||"").trim(),
    title:String(d.get("title")||"").trim(),description:String(d.get("description")||"").trim(),
    due_date:d.get("due_date")
   });
   if(r.error)throw r.error;await enter(current);message("تکلیف یا امتحان به کلاس ارسال شد.");return;
  }
  if(form.id==="assignTeacherForm"){
   const classId=String(d.get("class_id")||""),teacherId=String(d.get("teacher_id")||"");
   if(!people.some(x=>x.role==="teacher"&&x.user_id===teacherId)||!classes.some(x=>x.id===classId))throw Error("معلم یا کلاس معتبر نیست.");
   r=await client.from("class_teachers").upsert({school_id:school.id,class_id:classId,teacher_id:teacherId},{onConflict:"class_id,teacher_id",ignoreDuplicates:true});
   if(r.error)throw r.error;await enter(current);message("معلم به کلاس اختصاص یافت.");return;
  }
  if(form.id==="classForm"){r=await client.from("school_classes").insert({school_id:school.id,name:String(d.get("name")).trim(),grade:String(d.get("grade")).trim()});if(r.error)throw r.error;await enter(current);return}

 }catch(e){message(e.message||"خطا در ثبت اطلاعات")}
}
el.addEventListener("click",async e=>{
  const nav=e.target.closest("[data-director-page]");if(nav){directorSection=nav.dataset.directorPage;viewClassId=null;directorMenu=false;dashboard();return}
  const c=e.target.closest("[data-class-detail]");if(c){viewClassId=c.dataset.classDetail;directorSection="classes";dashboard();return}
  if(e.target.closest("[data-class-back]")){viewClassId=null;dashboard();return}
  const ui=e.target.closest("[data-director-action]")?.dataset.directorAction;
  if(ui==="menu"||ui==="close"){directorMenu=ui==="menu"?!directorMenu:false;dashboard();return}
 const r=e.target.closest("[data-role]");if(r){role=r.dataset.role;updateRole();return}
 const s=e.target.closest("[data-school]");if(s){const m=members.find(x=>x.school_id===s.dataset.school&&x.role===role);if(m)try{await enter(m)}catch(ex){message(ex.message)}return}

 const deletion=e.target.closest("[data-delete-assignment]");
 if(deletion){
  const row=assignments.find(x=>x.id===deletion.dataset.deleteAssignment&&x.teacher_id===user?.id);
  if(!row)return;
  if(!confirm("این مورد از صفحه تمام دانش‌آموزان این کلاس حذف شود؟"))return;
  const r=await client.from("school_assignments").delete().eq("id",row.id).eq("teacher_id",user.id);
  if(r.error){message(r.error.message);return}
  await enter(current);message("مورد حذف شد.");return;
 }
 const a=e.target.closest("[data-action]")?.dataset.action;
 if(a==="logout"){await client.auth.signOut();location.reload()}
 if(a==="signup")signup();if(a==="back")login();
 if(a==="create")newSchool();if(a==="picker"){directorMenu=false;viewClassId=null;directorSection="home";picker()}
});
el.addEventListener("change",e=>{if(e.target.id==="schoolKind"){renderSchoolFields();return}if(e.target.closest("#schoolForm"))updateSchoolPreview()});
el.addEventListener("input",e=>{if(e.target.closest("#schoolForm"))updateSchoolPreview()});
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
