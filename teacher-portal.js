/* Dedicated multi-school teacher workspace for STUNER. All reads respect Supabase RLS. */
(function(){
"use strict";
const state={client:null,user:null,root:null,members:[],schools:[],classes:[],links:[],students:[],assignments:[],page:"home",joinNote:"",onMembershipsChanged:null,menu:false,schoolId:"",classId:"",busy:false};
const esc=x=>String(x??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[a]));
const icon=n=>'<i data-lucide="'+n+'"></i>';
const schoolName=id=>state.schools.find(x=>x.school_id===id)?.schools?.name||"مدرسه";
const granted=()=>state.classes.filter(c=>state.links.some(l=>l.school_id===c.school_id&&l.class_id===c.id&&l.teacher_id===state.user.id));
const schoolClasses=id=>granted().filter(c=>c.school_id===id);
const schoolStudents=id=>state.students.filter(s=>s.school_id===id&&schoolClasses(id).some(c=>c.id===s.class_id));
const countWork=id=>state.assignments.filter(a=>a.school_id===id).length;
const activeSchool=()=>state.schools.find(s=>s.school_id===state.schoolId)||state.schools[0];
const displaySchool=id=>esc(schoolName(id));
const nav=[
 ["home","داشبورد","layout-dashboard"],
 ["schools","مدارس من","school"],
 ["classes","کلاس‌های من","users-round"],
 ["create","ثبت تکلیف یا امتحان","clipboard-plus"],
 ["work","فعالیت‌های ثبت‌شده","notebook-tabs"]
];
function schoolOptions(){
 return state.schools.map(s=>'<option value="'+esc(s.school_id)+'" '+(s.school_id===state.schoolId?"selected":"")+'>'+displaySchool(s.school_id)+'</option>').join("");
}
function classChoices(id){
 const list=schoolClasses(id);
 return list.length?list.map(c=>'<label class="teacher-class-option"><input type="checkbox" name="class_ids" value="'+esc(c.id)+'"><span><strong>'+esc(c.name)+'</strong><small>پایه '+esc(c.grade)+' · '+state.students.filter(s=>s.class_id===c.id&&s.school_id===id).length+' دانش‌آموز</small></span></label>').join(""):'<p class="teacher-empty">برای این مدرسه کلاسی به شما اختصاص داده نشده است.</p>';
}
function home(){
 const schools=state.schools.length,classes=granted().length,students=new Set(state.students.filter(s=>granted().some(c=>c.id===s.class_id)).map(s=>s.user_id)).size;
 return '<section class="teacher-welcome"><div><span>'+icon("sparkles")+' فضای معلم</span><h2>مدیریت کلاس‌ها، ساده و منظم</h2><p>تکلیف‌ها و امتحانات را برای هر کدام از مدارسی که در آن تدریس می‌کنید، ثبت کنید.</p></div><button data-teacher-page="create">'+icon("plus")+' ثبت فعالیت جدید</button></section>'+
 '<div class="teacher-stats"><div>'+icon("school")+'<span>مدارس</span><strong>'+schools+'</strong></div><div>'+icon("users-round")+'<span>کلاس‌های من</span><strong>'+classes+'</strong></div><div>'+icon("graduation-cap")+'<span>دانش‌آموزان</span><strong>'+students+'</strong></div></div>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>مدارس محل تدریس</h2><p>برای مشاهده همه مدارس، وارد بخش مدارس من شوید.</p></div><button class="portal-secondary" data-teacher-page="schools">مشاهده همه '+icon("arrow-left")+'</button></div>'+
 '<div class="teacher-school-grid">'+state.schools.slice(0,4).map(s=>schoolCard(s)).join("")+'</div></section>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>آخرین فعالیت‌ها</h2><p>تکالیف و امتحانات ثبت‌شده توسط شما</p></div><button class="portal-secondary" data-teacher-page="work">همه فعالیت‌ها</button></div>'+workRows(state.assignments.slice(0,4))+'</section>';
}
function schoolCard(s){
 const id=s.school_id;
 return '<button class="teacher-school-card" data-teacher-school="'+esc(id)+'"><span class="teacher-school-icon">'+icon("school")+'</span><strong>'+displaySchool(id)+'</strong><small>'+esc(schoolClasses(id).length)+' کلاس · '+esc(schoolStudents(id).length)+' دانش‌آموز</small><span>مشاهده کلاس‌ها '+icon("arrow-left")+'</span></button>';
}
function schoolsPage(){
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>مدارس من</h2><p>همه مدارسی که با همین حساب معلم در آن‌ها تدریس می‌کنید.</p></div><span class="portal-kind">'+state.schools.length+' مدرسه</span></div><div class="teacher-school-grid">'+state.schools.map(s=>schoolCard(s)).join("")+'</div></section>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>'+icon("plus")+' عضویت در مدرسه جدید</h2><p>مدیر مدرسه جدید کد دعوت مخصوص نام کاربری شما را می‌سازد.</p></div></div><form id="teacherJoinSchoolForm" class="portal-form"><label>کد دعوت ۴۸ کاراکتری<input type="text" name="invite" dir="ltr" autocomplete="off" spellcheck="false" minlength="48" maxlength="48" pattern="[0-9a-fA-F]{48}" placeholder="کد ارسال‌شده توسط مدیر مدرسه" required></label><button class="portal-primary" type="submit">'+icon("check")+' تأیید عضویت در مدرسه</button></form><p id="teacherJoinMessage" class="portal-error" role="status" aria-live="polite">'+esc(state.joinNote)+'</p></section>';
}
function classesPage(){
 const list=schoolClasses(state.schoolId);
 if(state.classId){
  const chosen=list.find(c=>c.id===state.classId);
  if(chosen){
   const children=state.students.filter(s=>s.class_id===chosen.id&&s.school_id===chosen.school_id);
   return '<button type="button" class="portal-secondary teacher-back" data-teacher-back>'+icon("arrow-right")+' بازگشت به کلاس‌ها</button><section class="portal-card"><div class="teacher-card-heading"><div><h2>'+esc(chosen.name)+'</h2><p>'+displaySchool(chosen.school_id)+' · پایه '+esc(chosen.grade)+'</p></div><span class="portal-kind">'+children.length+' دانش‌آموز</span></div>'+
   '<h3 class="teacher-subtitle">دانش‌آموزان این کلاس</h3>'+(children.map(s=>'<div class="portal-person"><span class="portal-person-avatar">'+esc(s.display_name?.charAt(0)||"؟")+'</span><div><strong>'+esc(s.display_name)+'</strong><small>دانش‌آموز</small></div></div>').join("")||'<p class="teacher-empty">هنوز دانش‌آموزی در این کلاس ثبت نشده است.</p>')+'</section>';
  }
  state.classId="";
 }
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>کلاس‌های من</h2><p>انتخاب کلاس برای مشاهده دانش‌آموزان</p></div></div>'+
 '<label class="teacher-filter-label">مدرسه<select id="teacherClassesSchool">'+schoolOptions()+'</select></label><div class="teacher-class-grid">'+
 (list.map(c=>'<button class="teacher-class-card" data-teacher-class="'+esc(c.id)+'"><span class="teacher-school-icon">'+icon("book-open")+'</span><strong>'+esc(c.name)+'</strong><small>'+state.students.filter(s=>s.class_id===c.id&&s.school_id===c.school_id).length+' دانش‌آموز · پایه '+esc(c.grade)+'</small><span>دانش‌آموزان کلاس '+icon("arrow-left")+'</span></button>').join("")||'<p class="teacher-empty">کلاسی برای این مدرسه ثبت نشده است.</p>')+'</div></section>';
}
function createPage(){
 return '<section class="portal-card teacher-create-card"><div class="teacher-card-heading"><div><h2>'+icon("clipboard-plus")+' ثبت تکلیف یا امتحان</h2><p>مدرسه را انتخاب کنید؛ تنها کلاس‌های مجاز همان مدرسه نمایش داده می‌شوند.</p></div></div><form id="teacherMultiAssignmentForm" class="portal-form">'+
 '<div class="teacher-fields-grid"><label>مدرسه<select name="school_id" id="teacherAssignmentSchool" required>'+schoolOptions()+'</select></label><label>نوع فعالیت<select name="kind" required><option value="task">تکلیف</option><option value="exam">امتحان</option></select></label></div>'+
 '<fieldset class="teacher-fieldset"><legend>کلاس‌های دریافت‌کننده</legend><p>می‌توانید هم‌زمان چند کلاس از یک مدرسه را انتخاب کنید.</p><div id="teacherClassChoices" class="teacher-class-checks">'+classChoices(state.schoolId)+'</div></fieldset>'+
 '<div class="teacher-fields-grid"><label>درس<input name="subject" maxlength="100" placeholder="مثلاً ریاضی" required></label><label>عنوان<input name="title" minlength="2" maxlength="150" placeholder="مثلاً تمرین فصل سوم" required></label></div>'+
 ''+window.STUNER_JALALI.field("due_date","تاریخ امتحان یا مهلت تحویل")+'<label>توضیحات برای دانش‌آموزان<textarea name="description" rows="4" maxlength="3000" placeholder="جزئیات درس، محدوده صفحات، نکات و راهنمای انجام"></textarea></label>'+
 '<div class="teacher-form-footer"><p>پس از ثبت، این فعالیت مستقیماً در بخش تکالیف یا امتحانات دانش‌آموزان کلاس‌های انتخاب‌شده نمایش داده می‌شود.</p><button class="portal-primary" type="submit">'+icon("send")+' ثبت و ارسال</button></div></form><p class="portal-error" id="teacherFormMessage" role="status" aria-live="polite"></p></section>';
}
function workRows(rows){
 return rows.length?rows.map(a=>'<div class="teacher-work-row"><span class="teacher-work-icon">'+icon(a.kind==="task"?"clipboard-check":"graduation-cap")+'</span><div><strong>'+esc(a.title)+'</strong><small>'+esc(a.subject)+' · '+displaySchool(a.school_id)+' · '+esc(state.classes.find(c=>c.id===a.class_id)?.name||"—")+'</small></div><span class="teacher-work-date">'+esc(window.STUNER_JALALI.formatted(a.due_date))+'</span></div>').join(""):'<p class="teacher-empty">هنوز تکلیف یا امتحانی ثبت نشده است.</p>';
}
function workPage(){
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>فعالیت‌های ثبت‌شده</h2><p>فهرست تکالیف و امتحاناتی که ارسال کرده‌اید</p></div><button data-teacher-page="create" class="portal-secondary">'+icon("plus")+' ثبت جدید</button></div>'+workRows(state.assignments)+'</section>';
}
function render(){
 if(!state.root)return;
 const pages={home:home,schools:schoolsPage,classes:classesPage,create:createPage,work:workPage};
 const label=nav.find(n=>n[0]===state.page)?.[1]||"پنل معلم";
 state.root.innerHTML='<div class="teacher-shell"><header class="teacher-appbar"><button type="button" class="portal-hamburger" data-teacher-menu="toggle" aria-label="باز کردن منوی معلم" aria-expanded="'+state.menu+'"><i data-lucide="menu"></i></button><div class="teacher-page-title"><small>STUNER · پنل معلم</small><h1>'+esc(label)+'</h1></div><span class="teacher-appbar-school">'+icon("school")+' '+displaySchool(state.schoolId)+'</span></header>'+
 (state.menu?'<div class="portal-director-nav"><button type="button" class="portal-nav-scrim" data-teacher-menu="close" aria-label="بستن منو"></button><nav class="portal-nav-menu" aria-label="منوی معلم"><div class="portal-nav-title"><strong>'+icon("graduation-cap")+' پنل معلم</strong><button data-teacher-menu="close" aria-label="بستن">×</button></div>'+nav.map(n=>'<button class="'+(n[0]===state.page?"active":"")+'" data-teacher-page="'+n[0]+'">'+icon(n[2])+' '+n[1]+'</button>').join("")+'<button data-action="picker">'+icon("repeat")+' تغییر نقش یا مدرسه</button><button data-action="logout">'+icon("log-out")+' خروج از حساب</button></nav></div>':"")+
 '<main class="teacher-page">'+pages[state.page]()+'</main></div>';
 window.STUNER_ICONS?.refresh?.();
}
async function load(){
 const ids=state.schools.map(s=>s.school_id);
 if(!ids.length)throw Error("هیچ مدرسه‌ای به حساب شما اختصاص نیافته است.");
 const [c,l,s,a]=await Promise.all([
  state.client.from("school_classes").select("id,school_id,name,grade").in("school_id",ids),
  state.client.from("class_teachers").select("school_id,class_id,teacher_id").eq("teacher_id",state.user.id).in("school_id",ids),
  state.client.from("school_memberships").select("school_id,user_id,role,display_name,class_id").eq("role","student").in("school_id",ids),
  state.client.from("school_assignments").select("id,school_id,class_id,teacher_id,kind,title,subject,description,due_date,created_at").eq("teacher_id",state.user.id).in("school_id",ids).order("created_at",{ascending:false})
 ]);
 for(const response of [c,l,s,a])if(response.error)throw response.error;
 state.classes=c.data||[];state.links=l.data||[];state.students=s.data||[];state.assignments=a.data||[];
}
const refresh=async()=>{await load();render()};
async function onClick(e){
 if(window.STUNER_JALALI?.handleClick(e))return;
 const page=e.target.closest("[data-teacher-page]");
 if(page){state.page=page.dataset.teacherPage;state.menu=false;state.classId="";render();return}
 const menu=e.target.closest("[data-teacher-menu]");
 if(menu){state.menu=menu.dataset.teacherMenu==="toggle"?!state.menu:false;render();return}
 const school=e.target.closest("[data-teacher-school]");
 if(school){const id=school.dataset.teacherSchool;if(!state.schools.some(s=>s.school_id===id))return;state.schoolId=id;state.page="classes";state.classId="";state.menu=false;render();return}
 const c=e.target.closest("[data-teacher-class]");
 if(c){if(!schoolClasses(state.schoolId).some(x=>x.id===c.dataset.teacherClass))return;state.classId=c.dataset.teacherClass;render();return}
 if(e.target.closest("[data-teacher-back]")){state.classId="";render()}
}
function onChange(e){
 if(e.target.matches("#teacherAssignmentSchool")){
  const id=e.target.value;if(!state.schools.some(s=>s.school_id===id))return;
  state.schoolId=id;
  state.root.querySelector("#teacherClassChoices").innerHTML=classChoices(id);
  const msg=state.root.querySelector("#teacherFormMessage");if(msg)msg.textContent="";
 }else if(e.target.matches("#teacherClassesSchool")){
  if(!state.schools.some(s=>s.school_id===e.target.value))return;state.schoolId=e.target.value;state.classId="";render();
 }
}
async function onSubmit(e){
 const join=e.target.closest("#teacherJoinSchoolForm");
 if(join){
  e.preventDefault();if(state.busy)return;
  const code=String(new FormData(join).get("invite")||"").trim().toLowerCase();
  const msg=state.root.querySelector("#teacherJoinMessage");
  if(!/^[0-9a-f]{48}$/.test(code)){msg.textContent="کد دعوت معتبر نیست.";return}
  state.busy=true;const btn=join.querySelector('button[type="submit"]');btn.disabled=true;
  try{
   const redeemed=await state.client.rpc("redeem_school_invite",{p_token:code});
   if(redeemed.error)throw redeemed.error;
   const linked=await state.client.from("school_memberships").select("school_id,user_id,role,display_name,grade,class_id,schools(name,kind)").eq("user_id",state.user.id).eq("role","teacher");
   if(linked.error)throw linked.error;
   state.schools=linked.data||[];
   state.onMembershipsChanged?.(state.schools);
   state.schoolId=redeemed.data;state.page="schools";state.joinNote="عضویت در مدرسه جدید با موفقیت ثبت شد.";
   await refresh();
  }catch(err){msg.textContent=err.message||"عضویت انجام نشد.";btn.disabled=false}
  finally{state.busy=false}
  return;
 }
 const form=e.target.closest("#teacherMultiAssignmentForm");if(!form)return;
 e.preventDefault();
 if(state.busy)return;
 const data=new FormData(form),schoolId=String(data.get("school_id")||"");
 const ids=[...new Set(data.getAll("class_ids").map(String))];
 const msg=state.root.querySelector("#teacherFormMessage");
 if(!state.schools.some(s=>s.school_id===schoolId)){msg.textContent="مدرسه معتبر نیست.";return}
 if(!ids.length){msg.textContent="حداقل یک کلاس را انتخاب کنید.";return}
 if(ids.some(id=>!schoolClasses(schoolId).some(c=>c.id===id))){msg.textContent="به یکی از کلاس‌های انتخاب‌شده دسترسی ندارید.";return}
 const rows=ids.map(classId=>({school_id:schoolId,class_id:classId,teacher_id:state.user.id,kind:data.get("kind"),subject:String(data.get("subject")||"").trim(),title:String(data.get("title")||"").trim(),description:String(data.get("description")||"").trim(),due_date:data.get("due_date")}));
 if(rows.some(x=>!x.title||!x.subject||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(x.due_date||"")))){msg.textContent="اطلاعات تکلیف یا امتحان را کامل کنید.";return}
 state.busy=true;const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const result=await state.client.from("school_assignments").insert(rows);
  if(result.error)throw result.error;
  state.schoolId=schoolId;state.page="work";await refresh();
 }catch(err){msg.textContent=err.message||"ارسال فعالیت انجام نشد.";btn.disabled=false}
 finally{state.busy=false}
}
window.STUNER_TEACHER_UI={
 async start({client,user,members,active,root,onMembershipsChanged}){
  state.client=client;state.user=user;state.root=root;state.onMembershipsChanged=onMembershipsChanged;
  state.schools=members.filter(m=>m.role==="teacher");
  state.schoolId=state.schools.some(m=>m.school_id===active.school_id)?active.school_id:state.schools[0]?.school_id||"";
  state.page="home";state.menu=false;state.classId="";
  if(!root.dataset.teacherEvents){root.dataset.teacherEvents="1";root.addEventListener("click",onClick);root.addEventListener("change",onChange);root.addEventListener("submit",onSubmit)}
  try{await load();render()}catch(err){root.innerHTML='<section class="portal-card"><h2>اشکال در دریافت اطلاعات مدارس</h2><p>'+esc(err.message)+'</p><button class="portal-secondary" data-action="picker">بازگشت</button></section>'}
 },
 refresh
};
})();