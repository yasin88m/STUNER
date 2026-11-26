/* Dedicated multi-school teacher workspace for STUNER. All reads respect Supabase RLS. */
(function(){
"use strict";
const state={client:null,user:null,root:null,members:[],schools:[],classes:[],links:[],students:[],assignments:[],views:[],submissions:[],grades:[],page:"home",joinNote:"",onMembershipsChanged:null,menu:false,schoolId:"",classId:"",busy:false,flashMessage:"",flashType:""};
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
 ["create","ثبت فعالیت جدید","clipboard-plus"],
 ["work","فعالیت‌های ثبت‌شده","notebook-tabs"],["grades","ثبت نمرات","graduation-cap"]
];
function schoolOptions(){
 return state.schools.map(s=>'<option value="'+esc(s.school_id)+'" '+(s.school_id===state.schoolId?"selected":"")+'>'+displaySchool(s.school_id)+'</option>').join("");
}
function gradeOptions(id){
 const grades=[...new Set(schoolClasses(id).map(c=>c.grade).filter(Boolean))];
 return grades.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join("");
}
function classChoices(id){
 const list=schoolClasses(id);
 return list.length?list.map(c=>'<label class="teacher-class-option"><input type="checkbox" name="class_ids" value="'+esc(c.id)+'"><span><strong>'+esc(c.name)+'</strong><small>پایه '+esc(c.grade)+' · '+state.students.filter(s=>s.class_id===c.id&&s.school_id===id).length+' دانش‌آموز</small></span></label>').join(""):'<p class="teacher-empty">برای این مدرسه کلاسی به شما اختصاص داده نشده است.</p>';
}
function studentChoices(id){
 const list=schoolStudents(id);
 return list.length?list.map(s=>'<label class="teacher-class-option"><input type="checkbox" name="student_ids" value="'+esc(s.user_id)+'"><span><strong>'+esc(s.display_name||"دانش‌آموز")+'</strong><small>'+esc(schoolClasses(id).find(c=>c.id===s.class_id)?.name||"کلاس نامشخص")+' · پایه '+esc(schoolClasses(id).find(c=>c.id===s.class_id)?.grade||"—")+'</small></span></label>').join(""):'<p class="teacher-empty">دانش‌آموزی در کلاس‌های اختصاص‌یافته ثبت نشده است.</p>';
}
function targetChoices(id,audience,grade){
 if(audience==="students")return studentChoices(id);
 if(audience==="classes")return classChoices(id);
 const list=schoolClasses(id).filter(c=>!grade||c.grade===grade);
 return list.length?'<p class="teacher-target-hint">همه دانش‌آموزان کلاس‌های پایه انتخاب‌شده تکلیف را دریافت می‌کنند.</p>'+list.map(c=>'<div class="teacher-class-option teacher-class-readonly"><span><strong>'+esc(c.name)+'</strong><small>پایه '+esc(c.grade)+' · '+state.students.filter(s=>s.class_id===c.id&&s.school_id===id).length+' دانش‌آموز</small></span></div>').join(""):'<p class="teacher-empty">کلاسی برای این پایه در دسترس نیست.</p>';
}
function home(){
 const schools=state.schools.length,classes=granted().length,students=new Set(state.students.filter(s=>granted().some(c=>c.id===s.class_id)).map(s=>s.user_id)).size;
 return '<section class="teacher-welcome"><div><span>'+icon("sparkles")+' فضای معلم</span><h2>مدیریت کلاس‌ها، ساده و منظم</h2><p>تکلیف‌ها، امتحان‌ها و پروژه‌ها را برای کلاس‌های خود ثبت و پیگیری کنید.</p></div><button data-teacher-page="create">'+icon("plus")+' ثبت فعالیت جدید</button></section>'+
 '<div class="teacher-stats"><div>'+icon("school")+'<span>مدارس</span><strong>'+schools+'</strong></div><div>'+icon("users-round")+'<span>کلاس‌های من</span><strong>'+classes+'</strong></div><div>'+icon("graduation-cap")+'<span>دانش‌آموزان</span><strong>'+students+'</strong></div></div>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>مدارس محل تدریس</h2><p>برای مشاهده همه مدارس، وارد بخش مدارس من شوید.</p></div><button class="portal-secondary" data-teacher-page="schools">مشاهده همه '+icon("arrow-left")+'</button></div>'+
 '<div class="teacher-school-grid">'+state.schools.slice(0,4).map(s=>schoolCard(s)).join("")+'</div></section>'+
 '<section class="portal-card"><div class="teacher-card-heading"><div><h2>آخرین فعالیت‌ها</h2><p>تکالیف، امتحانات و پروژه‌های ثبت‌شده توسط شما</p></div><button class="portal-secondary" data-teacher-page="work">همه فعالیت‌ها</button></div>'+workRows(state.assignments.slice(0,4))+'</section>';
}

function gradePage(){
 const classes=schoolClasses(state.schoolId);
 const initialClass=classes[0]?.id||"";
 const studentCount=state.students.filter(s=>s.class_id===initialClass).length;
 return '<section class="portal-card teacher-grades-card"><div class="teacher-card-heading"><div><h2>'+icon("graduation-cap")+' ثبت و ویرایش نمرات</h2><p>نمره‌های هر آزمون را برای دانش‌آموزان کلاس ثبت و مدیریت کن.</p></div><span class="portal-kind">'+classes.length+' کلاس</span></div>'+
 '<div class="teacher-grade-intro"><span class="teacher-grade-intro-icon">'+icon("clipboard-check")+'</span><div><strong>دفتر ثبت نمرات</strong><small>نمره‌ها از صفر تا ۲۰ ثبت می‌شوند؛ می‌توانی دستی وارد کنی یا از اکسل بخوانی.</small></div></div>'+
 '<form id="teacherGradesForm" class="portal-form teacher-grades-form"><section class="teacher-grade-section"><h3>'+icon("sliders-horizontal")+' مشخصات آزمون</h3><div class="teacher-fields-grid"><label>مدرسه<select id="teacherGradeSchool">'+schoolOptions()+'</select></label><label>کلاس<select name="class_id" id="teacherGradeClass">'+classes.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' · پایه '+esc(x.grade)+'</option>').join("")+'</select></label></div>'+
 '<div class="teacher-fields-grid"><label>درس<input name="subject" required maxlength="100" placeholder="مثلاً ریاضی"></label><label>عنوان آزمون<input name="title" maxlength="150" placeholder="مثلاً امتحان فصل اول"></label></div>'+
 (window.STUNER_JALALI?.field("graded_on","تاریخ ثبت نمره",undefined,{shortcuts:false}) || '<label>تاریخ<input name="graded_on" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></label>')+
 '</section><section class="teacher-grade-section teacher-grade-import"><div><h3>'+icon("file-spreadsheet")+' ورود گروهی از اکسل</h3><p>ستون اول: نام کامل دانش‌آموز · ستون دوم: نمره از ۲۰</p></div><label class="teacher-grade-file">انتخاب فایل اکسل<input id="teacherGradeExcel" type="file" accept=".xlsx,.xls"></label><button type="button" class="portal-secondary" data-teacher-import-grades>'+icon("upload")+' خواندن و ثبت فایل</button></section>'+
 '<section class="teacher-grade-section"><div class="teacher-grade-list-heading"><div><h3>'+icon("users-round")+' نمرات دانش‌آموزان</h3><p>نمره هر دانش‌آموز را در کادر مقابل نامش وارد کن.</p></div><span class="portal-kind">'+studentCount+' دانش‌آموز</span></div><div id="teacherGradeRows">'+gradeRows(initialClass)+'</div></section><div class="teacher-form-footer teacher-grade-footer"><p>فقط خانه‌های دارای نمره ذخیره می‌شوند. نمره می‌تواند اعشاری و با گام ۰٫۲۵ باشد.</p><button class="portal-primary" type="submit">'+icon("save")+' ذخیره نمرات</button></div><p id="teacherGradesMessage" class="portal-error" role="status" aria-live="polite"></p></form></section>';
}
function gradeRows(classId){
 const subject=String(state.root.querySelector('[name="subject"]')?.value||"").trim(),title=String(state.root.querySelector('[name="title"]')?.value||"").trim(),date=state.root.querySelector('[name="graded_on"]')?.value||"";
 return state.students.filter(s=>s.class_id===classId).map((s,index)=>{
  const old=state.grades.find(g=>g.student_id===s.user_id&&g.class_id===classId&&g.subject===subject&&g.title===title&&g.graded_on===date);
  return '<label class="teacher-grade-row"><span class="teacher-grade-index">'+(index+1)+'</span><span class="teacher-grade-avatar">'+esc((s.display_name||"؟").trim().charAt(0)||"؟")+'</span><span class="teacher-grade-student"><strong>'+esc(s.display_name||"دانش‌آموز")+'</strong><small>دانش‌آموز</small></span><span class="teacher-grade-input-wrap"><input type="number" name="grade_'+esc(s.user_id)+'" min="0" max="20" step="0.25" inputmode="decimal" placeholder="—" aria-label="نمره '+esc(s.display_name||"دانش‌آموز")+' از ۲۰" value="'+(old?esc(old.score):"")+'"><small>از ۲۰</small></span></label>';
 }).join("")||'<p class="teacher-empty">دانش‌آموزی در این کلاس نیست.</p>';
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
 return '<section class="portal-card teacher-create-card"><div class="teacher-card-heading"><div><h2>'+icon("clipboard-plus")+' ثبت تکلیف، امتحان یا پروژه</h2><p>مدرسه را انتخاب کنید؛ تنها کلاس‌های مجاز همان مدرسه نمایش داده می‌شوند.</p></div></div><form id="teacherMultiAssignmentForm" class="portal-form">'+
 '<div class="teacher-fields-grid"><label>مدرسه<select name="school_id" id="teacherAssignmentSchool" required>'+schoolOptions()+'</select></label><label>نوع فعالیت<select name="kind" required><option value="task">تکلیف</option><option value="exam">امتحان</option><option value="project">پروژه</option></select></label></div>'+
 '<label class="teacher-target-mode">ارسال برای<select name="audience" id="teacherAudience"><option value="grade">همه دانش‌آموزان یک پایه</option><option value="classes">یک یا چند کلاس مشخص</option><option value="students">دانش‌آموزان انتخابی</option></select></label>'+
 '<div id="teacherGradeField" class="teacher-target-mode"><label>پایه تحصیلی<select name="target_grade" id="teacherTargetGrade">'+gradeOptions(state.schoolId)+'</select></label></div>'+
 '<fieldset class="teacher-fieldset" id="teacherTargetField" hidden><legend id="teacherTargetLegend">انتخاب مخاطبان</legend><p id="teacherTargetHelp"></p><div id="teacherClassChoices" class="teacher-class-checks"></div></fieldset>'+
 '<div class="teacher-fields-grid"><label>درس<input name="subject" maxlength="100" placeholder="مثلاً ریاضی" required></label><label>عنوان<input name="title" minlength="2" maxlength="150" placeholder="مثلاً تمرین فصل سوم" required></label></div>'+
 ''+window.STUNER_JALALI.field("due_date","مهلت انجام یا تحویل")+'<label>توضیحات برای دانش‌آموزان<textarea name="description" rows="4" maxlength="3000" placeholder="جزئیات درس، محدوده صفحات، نکات و راهنمای انجام"></textarea></label>'+
 '<div class="teacher-form-footer"><p>پس از ثبت، فعالیت در بخش مربوط به خودِ دانش‌آموزان انتخاب‌شده نمایش داده می‌شود.</p><button class="portal-primary" type="submit">'+icon("send")+' ثبت و ارسال</button></div></form><p class="portal-error" id="teacherFormMessage" role="status" aria-live="polite"></p></section>';
}
function viewTime(value){
 try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date(value))}
 catch{return value||"—"}
}
function assignmentViewReport(a){
 if(a.kind!=="task")return "";
 const targets=a.student_id?state.students.filter(s=>s.user_id===a.student_id&&s.school_id===a.school_id):state.students.filter(s=>s.school_id===a.school_id&&s.class_id===a.class_id);
 const records=state.views.filter(v=>v.assignment_id===a.id);
 const viewed=new Map(records.map(v=>[v.student_id,v]));
 const lines=targets.map(student=>{
  const record=viewed.get(student.user_id);
  return '<div class="teacher-work-row"><div><strong>'+esc(student.display_name||"دانش‌آموز")+'</strong><small>'+(record?'مشاهده در '+esc(viewTime(record.first_viewed_at)):'هنوز مشاهده نکرده')+'</small></div><span class="portal-kind '+(record?'view-status-seen':'view-status-unseen')+'">'+(record?'مشاهده شده':'مشاهده نشده')+'</span></div>';
 }).join("");
 return '<details class="teacher-view-report"><summary>گزارش مشاهده · '+records.length+' از '+targets.length+' نفر</summary><div class="principal-list">'+(lines||'<p class="teacher-empty">دانش‌آموزی برای این تکلیف پیدا نشد.</p>')+'</div></details>';
}
function projectSubmissionRows(a){
 const targets=a.student_id?state.students.filter(s=>s.user_id===a.student_id&&s.school_id===a.school_id):state.students.filter(s=>s.school_id===a.school_id&&s.class_id===a.class_id);
 const submitted=state.submissions.filter(x=>x.assignment_id===a.id);
 return '<section class="teacher-project-submissions"><div class="teacher-project-submission-heading"><strong>'+icon("file-text")+' فایل‌های تحویلی</strong><span>'+submitted.length+' از '+targets.length+' نفر</span></div>'+
 (targets.map(student=>{const file=submitted.find(x=>x.student_id===student.user_id);return '<div class="teacher-project-submission"><div><strong>'+esc(student.display_name||"دانش‌آموز")+'</strong><small>'+(file?esc(file.file_name)+' · '+esc(viewTime(file.submitted_at)):'هنوز فایلی ارسال نکرده')+'</small></div>'+(file?'<button type="button" class="portal-secondary teacher-project-file-text" data-project-file-text="'+esc(file.id)+'">'+icon("file-text")+' دریافت فایل</button>':'<span class="portal-kind view-status-unseen">تحویل نشده</span>')+'</div>'}).join("")||'<p class="teacher-empty">دانش‌آموزی برای این پروژه پیدا نشد.</p>')+'</section>';
}
function workRows(rows){
 return rows.length?rows.map(a=>{
  const target=a.student_id?("دانش‌آموز: "+(state.students.find(s=>s.user_id===a.student_id)?.display_name||"دانش‌آموز انتخابی")):(state.classes.find(c=>c.id===a.class_id)?.name||"کلاس");
  const kindLabel=a.kind==="task"?"تکلیف":a.kind==="project"?"پروژه":"امتحان";
  const kindIcon=a.kind==="task"?"clipboard-check":a.kind==="project"?"file-text":"graduation-cap";
  return '<div class="teacher-work-row"><span class="teacher-work-icon">'+icon(kindIcon)+'</span><div><strong>'+esc(a.title)+'</strong><small>'+kindLabel+' · '+esc(a.subject)+' · '+displaySchool(a.school_id)+' · '+esc(target)+'</small></div><span class="teacher-work-date">'+esc(window.STUNER_JALALI.formatted(a.due_date))+'</span><button type="button" class="portal-secondary teacher-delete-work" data-teacher-delete-work="'+esc(a.id)+'">حذف</button></div>'+(a.kind==="project"?projectSubmissionRows(a):assignmentViewReport(a));
 }).join(""):'<p class="teacher-empty">هنوز تکلیف، امتحان یا پروژه‌ای ثبت نشده است.</p>';
}
function workPage(){
 const notice=state.flashMessage?'<div class="teacher-work-feedback '+(state.flashType==="success"?"is-success":"is-error")+'" role="status" aria-live="polite">'+icon(state.flashType==="success"?"check-circle":"alert-circle")+'<span>'+esc(state.flashMessage)+'</span></div>':"";
 return '<section class="portal-card"><div class="teacher-card-heading"><div><h2>فعالیت‌های ثبت‌شده</h2><p>فهرست تکالیف، امتحانات و پروژه‌هایی که ارسال کرده‌اید</p></div><div class="teacher-work-actions"><button type="button" data-teacher-refresh class="portal-secondary">به‌روزرسانی گزارش‌ها</button><button data-teacher-page="create" class="portal-secondary">'+icon("plus")+' ثبت جدید</button></div></div>'+notice+workRows(state.assignments)+'</section>';
}
function render(){
 if(!state.root)return;
 const pages={home:home,schools:schoolsPage,classes:classesPage,create:createPage,work:workPage,grades:gradePage};
 const label=nav.find(n=>n[0]===state.page)?.[1]||"پنل معلم";
 state.root.innerHTML='<div class="teacher-shell"><header class="teacher-appbar"><button type="button" class="portal-hamburger" data-teacher-menu="toggle" aria-label="باز کردن منوی معلم" aria-expanded="'+state.menu+'"><i data-lucide="menu"></i></button><div class="teacher-page-title"><small>STUNER · پنل معلم</small><h1>'+esc(label)+'</h1></div><span class="teacher-appbar-school">'+icon("school")+' '+displaySchool(state.schoolId)+'</span></header>'+
 (state.menu?'<div class="portal-director-nav"><button type="button" class="portal-nav-scrim" data-teacher-menu="close" aria-label="بستن منو"></button><nav class="portal-nav-menu" aria-label="منوی معلم"><div class="portal-nav-title"><strong>'+icon("graduation-cap")+' پنل معلم</strong><button data-teacher-menu="close" aria-label="بستن">×</button></div>'+nav.map(n=>'<button class="'+(n[0]===state.page?"active":"")+'" data-teacher-page="'+n[0]+'">'+icon(n[2])+' '+n[1]+'</button>').join("")+'<button data-action="picker">'+icon("repeat")+' تغییر نقش یا مدرسه</button><button data-action="logout">'+icon("log-out")+' خروج از حساب</button></nav></div>':"")+
 '<main class="teacher-page">'+pages[state.page]()+'</main></div>';
 window.STUNER_ICONS?.refresh?.();
 if(state.page==="create"){
  const audience=state.root.querySelector("#teacherAudience")?.value||"grade";
  renderTargetControls(audience,state.root.querySelector("#teacherTargetGrade")?.value||"");
 }
}
async function load(){
 const ids=state.schools.map(s=>s.school_id);
 if(!ids.length)throw Error("هیچ مدرسه‌ای به حساب شما اختصاص نیافته است.");
 const [c,l,s,a,g]=await Promise.all([
  state.client.from("school_classes").select("id,school_id,name,grade").in("school_id",ids),
  state.client.from("class_teachers").select("school_id,class_id,teacher_id").eq("teacher_id",state.user.id).in("school_id",ids),
  state.client.from("school_memberships").select("school_id,user_id,role,display_name,class_id").eq("role","student").in("school_id",ids),
  state.client.from("school_assignments").select("id,school_id,class_id,student_id,teacher_id,kind,title,subject,description,due_date,created_at").eq("teacher_id",state.user.id).in("school_id",ids).order("created_at",{ascending:false}),
  state.client.from("school_student_grades").select("id,school_id,class_id,student_id,teacher_id,subject,title,score,graded_on").eq("teacher_id",state.user.id).in("school_id",ids)
 ]);
 for(const response of [c,l,s,a,g])if(response.error)throw response.error;
 state.classes=c.data||[];state.links=l.data||[];state.students=s.data||[];state.assignments=a.data||[];state.grades=g.data||[];
 const projectIds=state.assignments.filter(x=>x.kind==="project").map(x=>x.id);
 if(projectIds.length){
  const submissions=await state.client.from("project_submissions").select("id,assignment_id,student_id,file_name,file_path,file_size,mime_type,submitted_at").in("assignment_id",projectIds);
  if(submissions.error)throw submissions.error;
  state.submissions=submissions.data||[];
 }else state.submissions=[];
 const taskIds=state.assignments.filter(x=>x.kind==="task").map(x=>x.id);
 if(taskIds.length){
  const viewed=await state.client.from("assignment_views").select("assignment_id,student_id,first_viewed_at").in("assignment_id",taskIds);
  if(viewed.error)throw viewed.error;
  state.views=viewed.data||[];
 }else state.views=[];
}
const refresh=async()=>{await load();render()};
async function onClick(e){
 if(window.STUNER_JALALI?.handleClick(e))return;
 const downloadBtn=e.target.closest("[data-project-file-text]");
 if(downloadBtn){
  const file=state.submissions.find(x=>x.id===downloadBtn.dataset.projectFileText);if(!file)return;
  downloadBtn.disabled=true;const tab=window.open("about:blank","_blank");
  try{const signed=await state.client.storage.from("stuner-project-submissions").createSignedUrl(file.file_path,600);if(signed.error)throw signed.error;if(tab){tab.opener=null;tab.location.href=signed.data.signedUrl}else window.location.href=signed.data.signedUrl}
  catch(err){if(tab)tab.close();alert("دریافت فایل انجام نشد: "+(err.message||"خطای نامشخص"))}
  finally{downloadBtn.disabled=false}
  return;
 }
 const deleteWork=e.target.closest("[data-teacher-delete-work]");
 if(deleteWork){
  const id=deleteWork.dataset.teacherDeleteWork;
  const assignment=state.assignments.find(a=>a.id===id&&a.teacher_id===state.user.id);
  if(!assignment)return;
  if(!confirm("این تکلیف یا امتحان برای همه دانش‌آموزان دریافت‌کننده حذف شود؟ این کار قابل بازگشت نیست."))return;
  deleteWork.disabled=true;deleteWork.textContent="در حال حذف…";
  try{
   const result=await state.client.from("school_assignments").delete().eq("id",id).eq("teacher_id",state.user.id);
   if(result.error)throw result.error;
   await refresh();
  }catch(err){alert("حذف فعالیت انجام نشد: "+(err.message||"خطای نامشخص"));deleteWork.disabled=false;deleteWork.textContent="حذف تکلیف"}
  return;
 }
 const refreshButton=e.target.closest("[data-teacher-refresh]");
 if(refreshButton){
  refreshButton.disabled=true;refreshButton.textContent="در حال به‌روزرسانی…";
  try{await refresh()}catch(err){refreshButton.disabled=false;refreshButton.textContent="خطا؛ دوباره تلاش کن"}
  return;
 }
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
 if(e.target.matches("#teacherGradeSchool")){const id=e.target.value;if(!state.schools.some(s=>s.school_id===id))return;state.schoolId=id;render();}
  else if(e.target.matches("#teacherGradeClass,#teacherGradesForm [name=subject],#teacherGradesForm [name=title],#teacherGradesForm [name=graded_on]")){const box=state.root.querySelector("#teacherGradeRows");const classId=state.root.querySelector("#teacherGradeClass")?.value;if(box&&classId){box.innerHTML=gradeRows(classId);const count=state.students.filter(s=>s.class_id===classId).length;const badge=state.root.querySelector(".teacher-grade-list-heading .portal-kind");if(badge)badge.textContent=count+" دانش‌آموز";}}
  else if(e.target.matches("#teacherAssignmentSchool")){
  const id=e.target.value;if(!state.schools.some(s=>s.school_id===id))return;
  state.schoolId=id;
  const audience=state.root.querySelector("#teacherAudience")?.value||"grade";
  const gradeSelect=state.root.querySelector("#teacherTargetGrade");
  gradeSelect.innerHTML=gradeOptions(id);
  renderTargetControls(audience,gradeSelect.value||"");
  const msg=state.root.querySelector("#teacherFormMessage");if(msg)msg.textContent="";
 }else if(e.target.matches("#teacherAudience")){
  renderTargetControls(e.target.value,state.root.querySelector("#teacherTargetGrade")?.value||"");
 }else if(e.target.matches("#teacherTargetGrade")){
  renderTargetControls("grade",e.target.value);
 }else if(e.target.matches("#teacherClassesSchool")){
  if(!state.schools.some(s=>s.school_id===e.target.value))return;state.schoolId=e.target.value;state.classId="";render();
 }
}
function renderTargetControls(audience,grade){
 const field=state.root.querySelector("#teacherTargetField"),gradeField=state.root.querySelector("#teacherGradeField");
 const legend=state.root.querySelector("#teacherTargetLegend"),help=state.root.querySelector("#teacherTargetHelp"),choices=state.root.querySelector("#teacherClassChoices");
 if(!field||!choices)return;
 if(gradeField)gradeField.hidden=audience!=="grade";
 field.hidden=audience==="grade";
 if(audience==="classes"){legend.textContent="کلاس‌های دریافت‌کننده";help.textContent="یک یا چند کلاس از کلاس‌های اختصاص‌یافته به خودت انتخاب کن.";choices.innerHTML=classChoices(state.schoolId);}
 if(audience==="students"){legend.textContent="دانش‌آموزان دریافت‌کننده";help.textContent="یک یا چند دانش‌آموز از کلاس‌هایی که به تو اختصاص داده شده انتخاب کن.";choices.innerHTML=studentChoices(state.schoolId);}
 if(audience==="grade"){choices.innerHTML=targetChoices(state.schoolId,"grade",grade);}
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
 
const gradeForm=e.target.closest("#teacherGradesForm");
 if(gradeForm){
  e.preventDefault();if(state.busy)return;
  const d=new FormData(gradeForm),classId=String(d.get("class_id")||""),subject=String(d.get("subject")||"").trim(),title=String(d.get("title")||"").trim(),graded_on=String(d.get("graded_on")||"");
  if(!schoolClasses(state.schoolId).some(x=>x.id===classId)||!subject||!graded_on){state.root.querySelector("#teacherGradesMessage").textContent="کلاس، درس و تاریخ را کامل کن.";return}
  const rows=[];
  for(const s of state.students.filter(x=>x.class_id===classId)){const raw=d.get("grade_"+s.user_id);if(raw==null||String(raw).trim()==="")continue;const score=Number(raw);if(!Number.isFinite(score)||score<0||score>20){state.root.querySelector("#teacherGradesMessage").textContent="نمره باید بین صفر تا ۲۰ باشد.";return}rows.push({school_id:state.schoolId,class_id:classId,student_id:s.user_id,teacher_id:state.user.id,subject,title,score,graded_on})}
  if(!rows.length){state.root.querySelector("#teacherGradesMessage").textContent="حداقل یک نمره وارد کن.";return}
  state.busy=true;const btn=gradeForm.querySelector('button[type="submit"]');btn.disabled=true;
  try{const r=await state.client.from("school_student_grades").upsert(rows,{onConflict:"school_id,class_id,student_id,subject,title,graded_on"});if(r.error)throw r.error;await refresh();const m=state.root.querySelector("#teacherGradesMessage");if(m)m.textContent=rows.length+" نمره ذخیره شد."}
  catch(err){state.root.querySelector("#teacherGradesMessage").textContent=err.message||"ذخیره انجام نشد."}
  finally{state.busy=false;if(btn?.isConnected)btn.disabled=false}
  return;
 }
const importBtn=e.target.closest("[data-teacher-import-grades]");
 if(importBtn){
  const file=state.root.querySelector("#teacherGradeExcel")?.files?.[0],msg=state.root.querySelector("#teacherGradesMessage");
  if(!file){msg.textContent="ابتدا فایل اکسل را انتخاب کن.";return}
  if(typeof window.readXlsxFile!=="function"){msg.textContent="ابزار اکسل بارگذاری نشده است.";return}
  importBtn.disabled=true;
  try{const rows=await window.readXlsxFile(file),classId=state.root.querySelector("#teacherGradeClass").value,students=state.students.filter(x=>x.class_id===classId),norm=x=>String(x??"").trim().replace(/\s+/g," ").toLowerCase(),batch=[];
   for(const row of rows){const name=norm(row?.[0]);if(!name||name.includes("نام"))continue;const student=students.find(x=>norm(x.display_name)===name),score=Number(String(row?.[1]??"").replace(",","."));if(!student||!Number.isFinite(score)||score<0||score>20)continue;batch.push({school_id:state.schoolId,class_id:classId,student_id:student.user_id,teacher_id:state.user.id,subject:String(state.root.querySelector('[name="subject"]').value||"").trim(),title:String(state.root.querySelector('[name="title"]').value||"").trim(),score,graded_on:state.root.querySelector('[name="graded_on"]').value})}
   if(!batch.length)throw Error("ردیف معتبری در فایل پیدا نشد.");const r=await state.client.from("school_student_grades").upsert(batch,{onConflict:"school_id,class_id,student_id,subject,title,graded_on"});if(r.error)throw r.error;await refresh();const m=state.root.querySelector("#teacherGradesMessage");if(m)m.textContent=batch.length+" نمره از اکسل ذخیره شد.";
  }catch(err){msg.textContent=err.message||"ورود اکسل ناموفق بود."}finally{if(importBtn.isConnected)importBtn.disabled=false}
  return;
 }
 const form=e.target.closest("#teacherMultiAssignmentForm");if(!form)return;
 e.preventDefault();
 if(state.busy)return;
 const data=new FormData(form),schoolId=String(data.get("school_id")||""),audience=String(data.get("audience")||"grade");
 const classIds=[...new Set(data.getAll("class_ids").map(String))];
 const studentIds=[...new Set(data.getAll("student_ids").map(String))];
 const msg=state.root.querySelector("#teacherFormMessage");
 if(!state.schools.some(s=>s.school_id===schoolId)){msg.textContent="مدرسه معتبر نیست.";return}
 let targets=[];
 if(audience==="grade"){
  const grade=String(data.get("target_grade")||"");
  targets=schoolClasses(schoolId).filter(c=>c.grade===grade).map(c=>({class_id:c.id,student_id:null}));
 }else if(audience==="classes"){
  if(!classIds.length){msg.textContent="حداقل یک کلاس را انتخاب کنید.";return}
  if(classIds.some(id=>!schoolClasses(schoolId).some(c=>c.id===id))){msg.textContent="به یکی از کلاس‌های انتخاب‌شده دسترسی ندارید.";return}
  targets=classIds.map(id=>({class_id:id,student_id:null}));
 }else if(audience==="students"){
  if(!studentIds.length){msg.textContent="حداقل یک دانش‌آموز را انتخاب کنید.";return}
  if(studentIds.some(id=>!schoolStudents(schoolId).some(s=>s.user_id===id))){msg.textContent="به یکی از دانش‌آموزان انتخاب‌شده دسترسی ندارید.";return}
  targets=studentIds.map(id=>({class_id:schoolStudents(schoolId).find(student=>student.user_id===id)?.class_id||null,student_id:id}));
 }else{msg.textContent="نوع مخاطب معتبر نیست.";return}
 if(!targets.length){msg.textContent="برای این مخاطب کلاسی یا دانش‌آموزی پیدا نشد.";return}
 const kind=String(data.get("kind")||"");
 if(!["task","exam","project"].includes(kind)){msg.textContent="نوع فعالیت معتبر نیست.";return}
 const subject=String(data.get("subject")||"").trim(),title=String(data.get("title")||"").trim(),dueDate=String(data.get("due_date")||"");
 if(!subject||!title||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dueDate)){msg.textContent=kind==="project"?"برای ثبت پروژه، درس، عنوان و مهلت تحویل را کامل کنید.":"برای ثبت فعالیت، درس، عنوان و تاریخ را کامل کنید.";return}
 const rows=targets.map(target=>({school_id:schoolId,...target,teacher_id:state.user.id,kind,subject,title,description:String(data.get("description")||"").trim(),due_date:dueDate}));
 if(rows.some(x=>!x.class_id||!x.teacher_id)){msg.textContent="کلاس یا اطلاعات معلم معتبر نیست؛ مخاطبان را دوباره انتخاب کنید.";return}
 msg.textContent="";msg.classList.remove("teacher-form-error","teacher-form-success");
 state.busy=true;const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const result=await state.client.from("school_assignments").insert(rows);
  if(result.error)throw result.error;
  const kind=String(data.get("kind")||"task");
  state.flashType="success";
  state.flashMessage=kind==="project"?"پروژه ثبت شده":"فعالیت با موفقیت ثبت شده";
  state.schoolId=schoolId;state.page="work";
  try{await refresh()}catch(refreshError){state.flashMessage+=(kind==="project"?"؛ پروژه ذخیره شده، اما به‌روزرسانی فهرست با خطا مواجه شد: ":"؛ فعالیت ذخیره شده، اما به‌روزرسانی فهرست با خطا مواجه شد: ")+(refreshError?.message||"خطای نامشخص");render()}
 }catch(err){
  const kind=String(data.get("kind")||"task");
  state.flashType="error";
  state.flashMessage=(kind==="project"?"ثبت پروژه با خطا مواجه شد: ":"ثبت فعالیت با خطا مواجه شد: ")+(err?.message||"خطای نامشخص");
  console.error("STUNER teacher activity insert failed:",err);
  const details=[err?.message,err?.details,err?.hint,err?.code].filter(Boolean).join(" · ");
  if(msg){msg.classList.remove("teacher-form-success");msg.classList.add("teacher-form-error");msg.textContent=state.flashMessage+(details?" ["+details+"]":"");}
  btn.disabled=false;
 }
 finally{state.busy=false}
}
window.STUNER_TEACHER_UI={
 async start({client,user,members,active,root,onMembershipsChanged}){
  state.client=client;state.user=user;state.root=root;state.onMembershipsChanged=onMembershipsChanged;
  state.schools=members.filter(m=>m.role==="teacher");
  state.schoolId=state.schools.some(m=>m.school_id===active.school_id)?active.school_id:state.schools[0]?.school_id||"";
  state.page="home";state.menu=false;state.classId="";
  if(!window.__stunerTeacherFocusRefresh){
   window.__stunerTeacherFocusRefresh=true;
   window.addEventListener("focus",()=>{if(state.root&&state.page==="work")refresh().catch(()=>{})});
  }
  if(!root.dataset.teacherEvents){root.dataset.teacherEvents="1";root.addEventListener("click",onClick);root.addEventListener("change",onChange);root.addEventListener("submit",onSubmit)}
  try{await load();render()}catch(err){root.innerHTML='<section class="portal-card"><h2>اشکال در دریافت اطلاعات مدارس</h2><p>'+esc(err.message)+'</p><button class="portal-secondary" data-action="picker">بازگشت</button></section>'}
 },
 refresh
};
})();