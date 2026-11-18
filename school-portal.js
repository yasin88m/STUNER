
(function(){
"use strict";
const cfg=window.STUNER_SUPABASE_CONFIG||{};
const el=document.getElementById("portalRoot"),cover=document.getElementById("schoolPortal");
const app=document.getElementById("app"),on=document.getElementById("onboarding");
const ready=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||"")&&/^(sb_publishable_|eyJ)/.test(cfg.publishableKey||"");
let client=null,user=null,role=["student","teacher","principal"].includes(sessionStorage.getItem("stuner.login.role"))?sessionStorage.getItem("stuner.login.role"):"student",members=[],current=null,classes=[],people=[],teacherLinks=[],subjectLinks=[],school=null,assignments=[],accountNames=[];
let directorSection="home",directorMenu=false,viewClassId=null;
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const usernameRx=/^(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})$/;
const loginEmail=(name)=>name.trim().toLowerCase()+"@accounts.stuner.invalid";
async function provision(payload,authenticated=false){
 const headers={"Content-Type":"application/json","apikey":cfg.publishableKey};
 if(authenticated){
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw Error("ابتدا وارد حساب خود شوید.");
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
   (advanced?'<label>رشته‌های موجود (هر رشته در یک خط)<textarea name="majors" rows="4" maxlength="2500" placeholder="شبکه و نرم‌افزار\\nمعماری داخلی\\nفتوگرافیک"></textarea></label>':
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
  if(window.STUNER_SCHOOL_DB_IMPORT?.hasFile()){result.innerHTML='<strong>کلاس‌ها و رشته‌ها از فایل پایگاه داده استخراج می‌شوند.</strong>';return}
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
 el.innerHTML=head("ورود به سامانه مدارس")+'<section class="portal-card"><div class="portal-roles"><button data-role="student">دانش‌آموز</button><button data-role="teacher">معلم</button><button data-role="principal">مدیر مدرسه</button></div><form id="loginForm" class="portal-form"><label>نام کاربری<input name="username" type="text" autocomplete="username" dir="ltr" required minlength="4" maxlength="32" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" placeholder="navid_1405"></label><label>رمز عبور<input name="password" type="password" autocomplete="current-password" dir="ltr" required></label><button class="portal-primary">ورود به استیونر</button></form><div class="portal-actions"><button data-action="signup">ساخت حساب مدیر مدرسه</button></div><p class="portal-note">حساب معلم و دانش‌آموز توسط مدیر مدرسه ساخته می‌شود؛ ایمیل نیاز نیست. دسترسی هر نقش در سرور بررسی می‌شود.</p><p class="portal-error" id="portalMessage" aria-live="polite"></p></section>';
 updateRole();
}
function updateRole(){el.querySelectorAll("[data-role]").forEach(x=>x.classList.toggle("active",x.dataset.role===role))}
function signup(){
 show();role="principal";
 el.innerHTML=head("ثبت‌نام مدیر مدرسه")+'<section class="portal-card"><form id="signupForm" class="portal-form"><label>نام و نام خانوادگی<input name="display_name" type="text" required maxlength="120" minlength="2" autocomplete="name"></label><label>نام کاربری<input name="username" type="text" required maxlength="32" minlength="4" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" dir="ltr" autocomplete="username" placeholder="school_manager"></label><label>رمز عبور (حداقل ۱۰ کاراکتر)<input name="password" type="password" required minlength="10" maxlength="128" dir="ltr" autocomplete="new-password"></label><button class="portal-primary">ایجاد حساب مدیر</button></form><button data-action="back" class="portal-secondary">بازگشت به ورود</button><p class="portal-note">برای ثبت‌نام ایمیل یا شماره تلفن لازم نیست. رمز را در جایی امن نگه دار؛ بازیابی خودکار رمز بدون روش ارتباطی فعال نیست.</p><p id="portalMessage" class="portal-error" aria-live="polite"></p></section>';
}
function initialPasswordPage(){
 show();current=null;
 el.innerHTML=head("تغییر رمز اولیه")+'<section class="portal-card"><h2>برای امنیت حساب، رمز جدید تعیین کن</h2><p class="portal-note">شماره تماس فقط رمز اولیه حساب واردشده از اکسل است. قبل از استفاده از سامانه، رمز شخصی حداقل ۱۲ کاراکتری با حروف و عدد انتخاب کن.</p><form class="portal-form" id="initialPasswordForm"><label>رمز جدید<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" dir="ltr" required></label><label>تکرار رمز جدید<input name="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" dir="ltr" required></label><button class="portal-primary" type="submit">ذخیره رمز و ورود به سامانه</button></form><p id="portalMessage" class="portal-error" aria-live="polite"></p></section>';
}
function picker(){
 show();
 const options=members.filter(m=>m.role===role).map(m=>'<button data-school="'+esc(m.school_id)+'" class="portal-school"><strong>'+esc(m.schools?.name||"مدرسه")+'</strong><small>'+esc(m.role==="principal"?"مدیر":m.role==="teacher"?"معلم":"دانش‌آموز")+'</small></button>').join("");
 el.innerHTML=head("انتخاب مدرسه")+'<section class="portal-card">'+(options||'<p>هنوز مدرسه‌ای برای این نقش ثبت نشده است.</p>')+(role==="principal"?'<button data-action="create" class="portal-primary">ایجاد مدرسه جدید</button>':'<p class="portal-note">اگر به مدرسه دسترسی نداری از مدیر بخواه حساب و کلاس تو را تعیین کند.</p>')+'<button data-action="back" class="portal-secondary">بازگشت به انتخاب نقش</button><p id="portalMessage" class="portal-error"></p></section>';
}
function newSchool(){
 show();window.STUNER_SCHOOL_DB_IMPORT?.startCreation?.();
 el.innerHTML=head("ثبت مدرسه و ساخت خودکار کلاس‌ها")+'<section class="portal-card"><form id="schoolForm" class="portal-form"><label>نام مدرسه<input name="name" required minlength="3" maxlength="160" placeholder="مثلاً هنرستان محمدیان"></label><label>نوع مدرسه<select name="kind" id="schoolKind"><option value="vocational">هنرستان</option><option value="secondary">دبیرستان</option><option value="middle">متوسطه اول</option><option value="elementary">دبستان</option></select></label><label>نام مدیر<input name="manager" required minlength="2" maxlength="120" value="'+esc(user?.user_metadata?.name||"")+'"></label><div id="schoolChoices"></div><div class="school-db-create-helper"><strong>ساخت هنرستان با اطلاعات دستی یا دیتابیس</strong><p>می‌توانید رشته‌ها و پایه‌ها را دستی وارد کنید؛ یا پایگاه داده را انتخاب کنید تا کلاس‌ها و انتساب معلمان شناسایی شوند.</p></div>'+window.STUNER_SCHOOL_DB_IMPORT.render()+'<button class="portal-primary">ساخت هنرستان و ثبت اطلاعات</button></form><button data-action="picker" class="portal-secondary">بازگشت</button><p id="portalMessage" class="portal-error"></p></section>';
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
 if(user.app_metadata?.stuner_initial_password_change===true){initialPasswordPage();return}
 const {data,error}=await client.from("school_memberships").select("school_id,user_id,role,display_name,grade,class_id,schools(name,kind)").eq("user_id",user.id);
 if(error)throw error;members=data||[];
 if(members.length&&!members.some(m=>m.role===role))role=members[0].role;
  if(!members.length&&user.app_metadata?.stuner_role==="principal")role="principal";
 const old=sessionStorage.getItem("stuner.school");
 const last=members.find(m=>m.school_id===old&&m.role===role);
 if(last)await enter(last);else picker();
}
async function enter(member){
  if(member.role!==role)throw Error("این حساب به نقش انتخاب‌شده دسترسی ندارد.");
 if(current?.school_id!==member.school_id){directorSection="home";viewClassId=null;directorMenu=false}
 current=member;sessionStorage.setItem("stuner.school",member.school_id);
 if(member.role==="student"){
  cover.hidden=true;app.style.display="";on.hidden=true;
  window.STUNER_ACTIVE_USER={id:user.id,schoolId:member.school_id};
  const personalParts=String(member.display_name||"دانش‌آموز").trim().split(/\s+/);
  window.STUNER_ACTIVE_STUDENT_PROFILE={
   firstName:personalParts[0]||"دانش‌آموز",lastName:personalParts.slice(1).join(" ")||"",
   grade:"",major:"",educationLevel:"",
   ...(Number.isInteger(Number(user.user_metadata?.stuner_age))&&Number(user.user_metadata?.stuner_age)>=6?{age:Number(user.user_metadata.stuner_age)}:{})
  };
  window.STUNER_STUDENT_ACCOUNT={
   username:String(user.email||"").split("@")[0],
   async updateProfile(values){
    const result=await provision({mode:"update_student_profile",school_id:member.school_id,...values},true);
    if(!result.ok)throw Error("ویرایش حساب انجام نشد.");
    member.display_name=result.display_name;
    window.STUNER_STUDENT_ACCOUNT.username=result.username;
    try{const refreshed=await client.auth.refreshSession();if(refreshed.data?.user)user=refreshed.data.user;}catch{}
    if(user.user_metadata)user.user_metadata.stuner_age=result.age;
    if(window.STUNER_ACTIVE_STUDENT_PROFILE){
     window.STUNER_ACTIVE_STUDENT_PROFILE.firstName=String(values.first_name);
     window.STUNER_ACTIVE_STUDENT_PROFILE.lastName=String(values.last_name);
    }
    return result;
   }
  };
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
    ...(Number.isInteger(Number(user.user_metadata?.stuner_age))&&Number(user.user_metadata?.stuner_age)>=6?{age:Number(user.user_metadata.stuner_age)}:{}),
    educationLevel:level,grade,track,major,fieldGroup:matches?.fieldGroup||""
   };
  }
  window.STUNER_SCHOOL_WORK?.init(client,user,member);
  const src=document.createElement("script");src.src="./app.js?v=34";document.body.appendChild(src);return;
 }
 if(member.role==="teacher"){
  show();
  if(!window.STUNER_TEACHER_UI)throw Error("پنل معلم بارگذاری نشده است.");
  await window.STUNER_TEACHER_UI.start({client,user,members,active:member,root:el,onMembershipsChanged:items=>{members=[...members.filter(x=>x.role!=="teacher"),...items]}});
  return;
 }
 const sid=current.school_id;
 const [s,c,p,t,w,n,ts]=await Promise.all([
  client.from("schools").select("id,name,kind,branch,majors,grades,created_by").eq("id",sid).single(),
  client.from("school_classes").select("id,name,grade,major,school_id").eq("school_id",sid),
  client.from("school_memberships").select("user_id,role,display_name,grade,class_id").eq("school_id",sid),
  client.from("class_teachers").select("class_id,teacher_id").eq("school_id",sid),
  client.from("school_assignments").select("id,school_id,class_id,teacher_id,kind,title,subject,description,due_date,created_at").eq("school_id",sid).order("due_date",{ascending:true}),
  client.from("account_usernames").select("user_id,username"),
  client.from("class_subject_teachers").select("class_id,teacher_id,subject").eq("school_id",sid)
 ]);
 for(const r of [s,c,p,t,w,n,ts])if(r.error)throw r.error;
 school=s.data;classes=c.data||[];people=p.data||[];teacherLinks=t.data||[];subjectLinks=ts.data||[];assignments=w.data||[];accountNames=n.data||[];dashboard();
}

const principalNav=[
 ["home","داشبورد","layout-dashboard"],
 ["students","دانش‌آموزان","users-round"],
 ["teachers","معلمان","graduation-cap"],
 ["database","ورود پایگاه داده","database"],
 ["classes","کلاس‌ها","school"],
 ["work","تکالیف و امتحانات","clipboard-check"],
 ["security","مدیریت رمز عبور","shield-check"]
];
const principalIcon=n=>'<i data-lucide="'+n+'"></i>';
const principalClass=id=>classes.find(c=>c.id===id);
const principalUsername=id=>accountNames.find(a=>a.user_id===id)?.username||"—";
function principalPerson(p,teacher=false){
 const classroom=teacher?teacherLinks.filter(x=>x.teacher_id===p.user_id).map(x=>principalClass(x.class_id)?.name).filter(Boolean).join("، ")||"هنوز کلاسی ندارد":principalClass(p.class_id)?.name||"بدون کلاس";
 const lessons=teacher?[...new Set(subjectLinks.filter(x=>x.teacher_id===p.user_id).map(x=>x.subject))].join("، "):"";
 const major=!teacher?principalClass(p.class_id)?.major||"":"";
 return '<div class="portal-person principal-person"><span class="portal-person-avatar">'+esc(p.display_name?.trim()?.charAt(0)||"؟")+'</span><div><strong>'+esc(p.display_name)+'</strong><small>نام کاربری: <b dir="ltr">'+esc(principalUsername(p.user_id))+'</b></small><small>'+(teacher?"کلاس‌ها: ":"کلاس: ")+esc(classroom)+'</small>'+
 (teacher&&lessons?'<small>درس‌ها: '+esc(lessons)+'</small>':major?'<small>رشته: '+esc(major)+'</small>':"")+'</div></div>';
}
function principalOptions(){
 return classes.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
}
function principalSummary(){
 const students=people.filter(p=>p.role==="student"),teachers=people.filter(p=>p.role==="teacher");
 const detail=(label,value)=>'<div class="principal-summary-item"><small>'+label+'</small><strong>'+esc(value||"—")+'</strong></div>';
 return '<section class="teacher-welcome principal-welcome"><div><span>'+principalIcon("sparkles")+' مدیریت هوشمند مدرسه</span><h2>همه بخش‌های '+esc(school.name)+'، در یک نگاه</h2><p>کلاس‌ها، دانش‌آموزان، معلمان و فعالیت‌های آموزشی را از یک پنل منظم مدیریت کنید.</p></div><button type="button" data-director-page="students">'+principalIcon("user-round")+' مدیریت دانش‌آموزان</button></section>'+
 '<div class="teacher-stats"><div>'+principalIcon("users-round")+'<span>دانش‌آموزان</span><strong>'+students.length+'</strong></div><div>'+principalIcon("graduation-cap")+'<span>معلمان</span><strong>'+teachers.length+'</strong></div><div>'+principalIcon("school")+'<span>کلاس‌ها</span><strong>'+classes.length+'</strong></div></div>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("school")+' مشخصات مدرسه</h2><p>اطلاعات ثبت‌شده هنگام ایجاد مدرسه</p></div><span class="portal-kind">'+esc(schoolKindName[school.kind]||school.kind)+'</span></div>'+
 '<div class="principal-summary-grid">'+detail("نام مدرسه",school.name)+detail("نوع مدرسه",schoolKindName[school.kind]||school.kind)+detail("شاخه تحصیلی",school.branch||"عمومی")+detail("پایه‌ها",(school.grades||[]).join("، "))+detail("رشته‌های موجود",(school.majors||[]).join("، ")||"عمومی")+'</div></section>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>دسترسی سریع</h2><p>بدون شلوغی، مستقیم به بخش مورد نیاز بروید.</p></div></div><div class="teacher-school-grid principal-shortcuts">'+
 [["students","فهرست دانش‌آموزان","users-round",students.length+" دانش‌آموز"],["teachers","مدیریت معلمان","graduation-cap",teachers.length+" معلم"],["classes","کلاس‌های مدرسه","school",classes.length+" کلاس"],["work","تکالیف و امتحانات","clipboard-check",assignments.length+" فعالیت"]].map(x=>
 '<button type="button" class="teacher-school-card" data-director-page="'+x[0]+'"><span class="teacher-school-icon">'+principalIcon(x[2])+'</span><strong>'+x[1]+'</strong><small>'+x[3]+'</small><span>مشاهده بخش '+principalIcon("arrow-left")+'</span></button>').join("")+
 '</div></section>';
}
function principalStudents(){
 const students=people.filter(p=>p.role==="student");
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("users-round")+' فهرست دانش‌آموزان</h2><p>حساب‌ها و کلاس‌های ثبت‌شده در این مدرسه</p></div><span class="portal-kind">'+students.length+' دانش‌آموز</span></div>'+
 '<details class="principal-list-accordion"><summary>نمایش فهرست '+students.length+' دانش‌آموز</summary><div class="principal-list">'+(students.map(p=>principalPerson(p)).join("")||'<p class="teacher-empty">هنوز دانش‌آموزی ثبت نشده است.</p>')+'</div></details></section>'+
 ''+window.STUNER_SCHOOL_IMPORT.render("student")+'<details class="portal-card principal-disclosure"><summary>'+principalIcon("user-round")+' افزودن دانش‌آموز جدید '+principalIcon("plus")+'</summary><form id="newMemberForm" class="portal-form"><input type="hidden" name="role" value="student"><div class="teacher-fields-grid"><label>نام و نام خانوادگی<input name="display_name" minlength="2" maxlength="120" required></label><label>نام کاربری<input name="username" dir="ltr" minlength="4" maxlength="32" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" placeholder="student_701" required></label></div><div class="teacher-fields-grid"><label>رمز اولیه (حداقل ۱۰ کاراکتر)<input type="password" name="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><label>کلاس<select name="class_id" required><option value="">انتخاب کلاس</option>'+principalOptions()+'</select></label></div><button type="submit" class="portal-primary">'+principalIcon("plus")+' ایجاد حساب دانش‌آموز</button></form></details>';
}
function principalTeachers(){
 const teachers=people.filter(p=>p.role==="teacher");
 const checkboxes=classes.map(c=>'<label class="teacher-class-option"><input type="checkbox" name="class_ids" value="'+esc(c.id)+'"><span><strong>'+esc(c.name)+'</strong><small>پایه '+esc(c.grade)+'</small></span></label>').join("");
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("graduation-cap")+' فهرست معلمان</h2><p>مشخصات معلمان و کلاس‌های تدریس</p></div><span class="portal-kind">'+teachers.length+' معلم</span></div><div class="principal-list">'+(teachers.map(p=>principalPerson(p,true)).join("")||'<p class="teacher-empty">هنوز معلمی ثبت نشده است.</p>')+'</div></section>'+
 ''+window.STUNER_SCHOOL_IMPORT.render("teacher")+'<details class="portal-card principal-disclosure"><summary>'+principalIcon("plus")+' ساخت حساب معلم جدید</summary><form id="newMemberForm" class="portal-form"><input type="hidden" name="role" value="teacher"><div class="teacher-fields-grid"><label>نام و نام خانوادگی<input name="display_name" minlength="2" maxlength="120" required></label><label>نام کاربری<input name="username" dir="ltr" minlength="4" maxlength="32" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" placeholder="teacher_101" required></label></div><label>رمز اولیه (حداقل ۱۰ کاراکتر)<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><fieldset class="teacher-fieldset"><legend>انتساب کلاس‌ها به معلم</legend><p>همه کلاس‌هایی که معلم در آن‌ها تدریس می‌کند را انتخاب کنید.</p><div class="teacher-class-checks">'+(checkboxes||'<p class="teacher-empty">کلاسی ثبت نشده است.</p>')+'</div></fieldset><button type="submit" class="portal-primary">'+principalIcon("plus")+' ایجاد حساب و انتساب کلاس‌ها</button></form></details>'+
 '<details class="portal-card principal-disclosure"><summary>'+principalIcon("school")+' دعوت معلم دارای حساب در مدرسه دیگر</summary><p class="portal-note">معلم با نام کاربری فعلی خود و کد دعوت به این مدرسه می‌پیوندد و نیازی به حساب دوم ندارد.</p><form id="inviteExistingTeacherForm" class="portal-form"><div class="teacher-fields-grid"><label>نام کاربری فعلی<input name="username" dir="ltr" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" required></label><label>نام و نام خانوادگی<input name="display_name" minlength="2" maxlength="120" required></label></div><label>کلاس اولیه (اختیاری)<select name="class_id"><option value="">بعداً تعیین می‌کنم</option>'+principalOptions()+'</select></label><button type="submit" class="portal-primary">'+principalIcon("send")+' ایجاد کد دعوت</button></form><div id="existingTeacherInviteResult" role="status" aria-live="polite"></div></details>'+
 (teachers.length&&classes.length?'<details class="portal-card principal-disclosure"><summary>'+principalIcon("plus")+' افزودن کلاس به معلم فعلی</summary><form id="assignTeacherForm" class="portal-form"><div class="teacher-fields-grid"><label>معلم<select name="teacher_id">'+teachers.map(t=>'<option value="'+esc(t.user_id)+'">'+esc(t.display_name)+'</option>').join("")+'</select></label><label>کلاس<select name="class_id">'+principalOptions()+'</select></label></div><button class="portal-primary" type="submit">ثبت انتساب کلاس</button></form></details>':"");
}
function principalClasses(){
 const selected=classes.find(c=>c.id===viewClassId);
 if(selected){
  const students=people.filter(p=>p.role==="student"&&p.class_id===selected.id);
  const teachers=people.filter(p=>p.role==="teacher"&&teacherLinks.some(x=>x.class_id===selected.id&&x.teacher_id===p.user_id));
  return '<button class="portal-secondary teacher-back" type="button" data-class-back>'+principalIcon("arrow-right")+' بازگشت به کلاس‌ها</button><section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("school")+' '+esc(selected.name)+'</h2><p>پایه '+esc(selected.grade)+'</p></div><span class="portal-kind">'+students.length+' دانش‌آموز</span></div><div class="principal-teachers-note"><strong>معلمان کلاس:</strong> '+esc(teachers.map(t=>t.display_name).join("، ")||"هنوز معلمی اختصاص نیافته")+'</div><div class="principal-teachers-note"><strong>دبیران درس‌های کلاس:</strong> '+(subjectLinks.filter(x=>x.class_id===selected.id).map(link=>esc(link.subject)+": "+esc(people.find(t=>t.user_id===link.teacher_id)?.display_name||"—")).join("، ")||"هنوز دبیر درس ثبت نشده")+'</div><h3 class="teacher-subtitle">دانش‌آموزان این کلاس</h3><div class="principal-list">'+(students.map(p=>principalPerson(p)).join("")||'<p class="teacher-empty">هنوز دانش‌آموزی در این کلاس ثبت نشده است.</p>')+'</div></section>';
 }
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("school")+' کلاس‌های مدرسه</h2><p>برای مشاهده اطلاعات و دانش‌آموزان، یک کلاس انتخاب کنید.</p></div><span class="portal-kind">'+classes.length+' کلاس</span></div><div class="teacher-class-grid">'+(classes.map(c=>'<button type="button" class="teacher-class-card" data-class-detail="'+esc(c.id)+'"><span class="teacher-school-icon">'+principalIcon("book-open")+'</span><strong>'+esc(c.name)+'</strong><small>'+esc(c.grade)+' · '+people.filter(p=>p.role==="student"&&p.class_id===c.id).length+' دانش‌آموز</small><span>نمایش دانش‌آموزان '+principalIcon("arrow-left")+'</span></button>').join("")||'<p class="teacher-empty">کلاسی ثبت نشده است.</p>')+'</div></section>'+
 '<details class="portal-card principal-disclosure"><summary>'+principalIcon("plus")+' ایجاد کلاس جدید</summary><form id="classForm" class="portal-form"><div class="teacher-fields-grid"><label>عنوان کلاس<input name="name" minlength="2" maxlength="120" required></label><label>پایه'+(school.grades?.length?'<select name="grade" required>'+school.grades.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join("")+'</select>':'<input name="grade" required maxlength="40">')+'</label></div><button class="portal-primary" type="submit">ایجاد کلاس</button></form></details>';
}
function principalWork(){
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("notebook-tabs")+' تکالیف و امتحانات مدرسه</h2><p>فهرست فعالیت‌هایی که معلمان برای کلاس‌ها ثبت کرده‌اند</p></div><span class="portal-kind">'+assignments.length+' فعالیت</span></div>'+
 (assignments.map(a=>'<div class="teacher-work-row"><span class="teacher-work-icon">'+principalIcon(a.kind==="exam"?"graduation-cap":"clipboard-check")+'</span><div><strong>'+esc(a.title)+'</strong><small>'+esc(a.kind==="exam"?"امتحان":"تکلیف")+' · '+esc(a.subject)+' · '+esc(principalClass(a.class_id)?.name||"—")+'</small></div><span class="teacher-work-date">'+esc(window.STUNER_JALALI?.formatted(a.due_date)||a.due_date)+'</span></div>').join("")||'<p class="teacher-empty">هنوز تکلیف یا امتحانی برای مدرسه ثبت نشده است.</p>')+'</section>';
}
function principalSecurity(){
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+principalIcon("shield-check")+' مدیریت رمز عبور</h2><p>تنظیم رمز جدید برای حساب معلم یا دانش‌آموز همین مدرسه</p></div></div><form id="resetMemberForm" class="portal-form"><label>نام کاربری حساب<input name="username" dir="ltr" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" required></label><label>رمز عبور جدید (حداقل ۱۰ کاراکتر)<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label><button type="submit" class="portal-primary">'+principalIcon("shield-check")+' تغییر رمز عبور</button></form></section>'+principalDeleteSchool();
}

function principalDeleteSchool(){
 if(!school||school.created_by!==user?.id)return "";
 return '<details class="portal-card principal-disclosure school-danger-card">'+
 '<summary>'+principalIcon("trash-2")+' حذف کامل هنرستان و اطلاعات آن '+principalIcon("chevron-down")+'</summary>'+
 '<p>این اقدام غیرقابل بازگشت است. کلاس‌ها، افراد عضو این مدرسه، تکالیف، امتحانات و انتساب معلمان حذف می‌شوند. حساب مدیر و حساب‌هایی که در مدارس دیگر عضو هستند حفظ می‌شوند.</p>'+
 '<form id="deleteSchoolForm" class="portal-form"><label>نام دقیق هنرستان را برای تأیید وارد کنید: <strong>'+esc(school.name)+'</strong>'+
 '<input name="school_name" required autocomplete="off" placeholder="'+esc(school.name)+'"></label>'+
 '<label class="school-delete-ack"><input name="ack" type="checkbox" value="yes" required><span>می‌دانم این حذف دائمی است و امکان بازگشت ندارد.</span></label>'+
 '<button type="submit" class="school-delete-button">'+principalIcon("trash-2")+' حذف قطعی این هنرستان</button></form></details>';
}
function principalDatabase(){return window.STUNER_SCHOOL_DB_IMPORT?.render?.()||'<p>بخش ورود پایگاه داده بارگذاری نشد؛ صفحه را تازه‌سازی کنید.</p>';}
function dashboard(){show();directorUi()}
function directorUi(){
 const views={home:principalSummary,students:principalStudents,teachers:principalTeachers,classes:principalClasses,database:principalDatabase,work:principalWork,security:principalSecurity};
 if(!views[directorSection])directorSection="home";
 const title=principalNav.find(x=>x[0]===directorSection)?.[1]||"داشبورد";
 const drawer=directorMenu?'<div class="portal-director-nav"><button class="portal-nav-scrim" type="button" data-director-action="close" aria-label="بستن منو"></button><nav class="portal-nav-menu" aria-label="منوی مدیریت مدرسه"><div class="portal-nav-title"><strong>'+principalIcon("school")+' '+esc(school.name)+'</strong><button type="button" data-director-action="close" aria-label="بستن">×</button></div>'+principalNav.map(x=>'<button type="button" data-director-page="'+x[0]+'" class="'+(directorSection===x[0]?"active":"")+'">'+principalIcon(x[2])+' '+x[1]+'</button>').join("")+'<button data-action="picker">'+principalIcon("repeat")+' تغییر مدرسه</button><button data-action="logout">'+principalIcon("log-out")+' خروج از حساب</button></nav></div>':"";
 el.innerHTML='<div class="teacher-shell principal-shell"><header class="teacher-appbar"><button type="button" class="portal-hamburger" data-director-action="menu" aria-label="منوی مدیر مدرسه" aria-expanded="'+directorMenu+'">'+principalIcon("menu")+'</button><div class="teacher-page-title"><small>STUNER · پنل مدیر مدرسه</small><h1>'+esc(title)+'</h1></div><span class="teacher-appbar-school">'+principalIcon("school")+' '+esc(school.name)+'</span></header>'+drawer+'<main class="teacher-page principal-page">'+views[directorSection]()+'<p id="portalMessage" class="portal-error" role="status" aria-live="polite"></p></main></div>';
 window.STUNER_SCHOOL_DB_IMPORT?.configure({
   client,school,classes,
   known:people.map(p=>accountNames.find(a=>a.user_id===p.user_id)?.username).filter(Boolean),
   submitBatch:payload=>provision(payload,true),
   onComplete:async()=>enter(current)
  });
  window.STUNER_SCHOOL_IMPORT?.configure({
  client,school,classes,
  known:people.map(p=>accountNames.find(a=>a.user_id===p.user_id)?.username).filter(Boolean),
  submitBatch:payload=>provision(payload,true),
  onComplete:async()=>enter(current)
 });
 window.STUNER_ICONS?.refresh?.();
}

async function handle(form){
 const d=new FormData(form);
 try{
  let r;
  if(form.id==="initialPasswordForm"){
   const password=String(d.get("password")||""),confirmPassword=String(d.get("confirm")||"");
   if(password!==confirmPassword)throw Error("تکرار رمز با رمز جدید یکسان نیست.");
   if(password.length<12||!/[0-9]/.test(password)||!/\p{L}/u.test(password))throw Error("رمز جدید باید حداقل ۱۲ کاراکتر و شامل حروف و عدد باشد.");
   const email=user?.email;
   if(!email)throw Error("شناسه حساب یافت نشد؛ دوباره وارد شوید.");
   await provision({mode:"change_initial_password",password},true);
   // A password change may revoke the old refresh token. Open a new session directly.
   const fresh=await client.auth.signInWithPassword({email,password});
   if(fresh.error){
    await client.auth.signOut();
    login();message("رمز ذخیره شد، اما اتصال مجدد برقرار نشد. با رمز جدید وارد شوید.");return;
   }
   await sync();return;
  }
  if(form.id==="loginForm"){
   const selectedRole=role,username=String(d.get("username")||"").trim().toLowerCase();
   if(!usernameRx.test(username))throw Error("نام کاربری معتبر نیست.");
   r=await client.auth.signInWithPassword({email:loginEmail(username),password:String(d.get("password")||"")});
   if(r.error)throw Error("نام کاربری یا رمز عبور نادرست است.");
   try{
    // Server verifies school memberships / principal status using the authenticated token.
    await provision({mode:"verify_login_role",role:selectedRole},true);
   }catch(error){
    await client.auth.signOut();
    login();message(error.message||"حساب برای این تب مجاز نیست.");return;
   }
   sessionStorage.setItem("stuner.login.role",selectedRole);
   await sync();return;
  }
  if(form.id==="signupForm"){const username=String(d.get("username")||"").trim().toLowerCase(),password=String(d.get("password")||"");await provision({mode:"register_manager",username,password,display_name:String(d.get("display_name")||"").trim()});r=await client.auth.signInWithPassword({email:loginEmail(username),password});if(r.error)throw r.error;role="principal";sessionStorage.setItem("stuner.login.role","principal");await sync();return}
  if(form.id==="schoolForm"){
 const kind=String(d.get("kind")||""),grades=d.getAll("grades"),
  majors=(kind==="vocational"||kind==="secondary")?[...new Set(String(d.get("majors")||"").split(/[\n،,؛;]+/).map(x=>x.trim()).filter(Boolean))]:[],
  name=String(d.get("name")||"").trim(),manager=String(d.get("manager")||"").trim(),
  branch=kind==="vocational"?d.get("branch"):kind==="secondary"?"نظری":null,
  dbImport=window.STUNER_SCHOOL_DB_IMPORT;
 if(dbImport?.hasFile()){
  if(!dbImport.canCreate())throw Error("ابتدا فایل دیتابیس را پیش‌نمایش و بررسی کنید.");
  r=await client.rpc("create_school_from_database",{p_name:name,p_kind:kind,p_branch:branch,p_manager:manager});
  if(r.error)throw r.error;
  const schoolId=r.data;
  sessionStorage.setItem("stuner.school",schoolId);
  const skipped=dbImport.summary()?.errors||0;
  const completed=await dbImport.importCreatedSchool({
   school:{id:schoolId,name,kind,branch,grades:[],majors:[]},classes:[],known:[],client,
   submitBatch:payload=>provision(payload,true),onComplete:async()=>{}
  });
  role="principal";await sync();
  message(completed?"هنرستان ساخته شد و اطلاعات معتبر دیتابیس ثبت شدند."+(skipped?" "+skipped+" ردیف نامعتبر یا نیازمند بررسی شناسایی شد.":""):"هنرستان ساخته شد ولی ورود بخشی از اطلاعات تکمیل نشد؛ صفحه ورود پایگاه داده را بررسی کنید.");
  return;
 }
 if(!grades.length)throw Error("حداقل یک پایه یا فایل دیتابیس انتخاب کنید.");
 if((kind==="vocational"||kind==="secondary")&&!majors.length)throw Error("رشته‌های مدرسه یا فایل دیتابیس را وارد کنید.");
 r=await client.rpc("create_school_with_classes",{p_name:name,p_kind:kind,p_branch:branch,p_manager:manager,p_grades:grades,p_majors:majors});
 if(r.error)throw r.error;
 role="principal";sessionStorage.setItem("stuner.school",r.data);await sync();return;
}
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
  if(form.id==="deleteSchoolForm"){
 if(!school||school.created_by!==user?.id)throw Error("مجوز حذف این هنرستان را ندارید.");
 const name=String(d.get("school_name")||"").trim();
 if(name!==school.name)throw Error("نام واردشده با نام هنرستان مطابقت ندارد.");
 if(d.get("ack")!=="yes")throw Error("ابتدا تأیید حذف را انتخاب کنید.");
 if(!window.confirm("آیا از حذف دائمی «"+school.name+"» و همه اطلاعات وابسته به آن اطمینان دارید؟"))return;
 const deleted=await provision({mode:"delete_school",school_id:school.id,confirm_name:name,confirm_delete:true},true);
 sessionStorage.removeItem("stuner.school");
 await sync();
 message(deleted.remaining_orphan_accounts?
 "مدرسه و اطلاعات آن حذف شد؛ پاکسازی "+deleted.remaining_orphan_accounts+" حساب بدون مدرسه کامل نشد.":
 "هنرستان و تمام اطلاعات وابسته به آن حذف شدند.");
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
 const r=e.target.closest("[data-role]");if(r){role=r.dataset.role;sessionStorage.setItem("stuner.login.role",role);updateRole();return}
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
el.addEventListener("change",e=>{if(e.target.id==="schoolKind"){window.STUNER_SCHOOL_DB_IMPORT?.invalidate?.();renderSchoolFields();return}if(e.target.closest("#schoolForm"))updateSchoolPreview()});
el.addEventListener("input",e=>{if(e.target.closest("#schoolForm"))updateSchoolPreview()});
el.addEventListener("submit",async e=>{if(!e.target.matches("form"))return;e.preventDefault();const btn=e.target.querySelector("button");if(btn)btn.disabled=true;await handle(e.target);if(btn?.isConnected)btn.disabled=false});
async function start(){
 show();
 if(!ready){el.innerHTML=head("اتصال Supabase لازم است")+'<section class="portal-card"><p>برای فعال‌سازی سه نوع ورود، ابتدا پروژه Supabase بساز؛ فایل <code>supabase/schema.sql</code> را در SQL Editor اجرا کن و آدرس پروژه و Publishable Key را در <code>supabase-config.js</code> قرار بده.</p><p>ورود نمایشی یا حساب مدیر بدون بررسی سرور فعال نشده است.</p></section>';return}
 if(!window.supabase?.createClient){el.innerHTML=head("کتابخانه Supabase بارگذاری نشد")+'<p>اتصال اینترنت را بررسی کن.</p>';return}
 client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 await sync();client.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT"&&!el.querySelector("#loginForm")&&!el.querySelector("#initialPasswordForm"))location.reload()});
}
start().catch(e=>{show();el.innerHTML=head("خطای اتصال")+'<section class="portal-card">'+esc(e.message)+'</section>'});
})();
