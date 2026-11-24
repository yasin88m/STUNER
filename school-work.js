(function(){
"use strict";
let db=null,user=null,member=null,assignments=[],completed=new Set(),teacherSubjects=[],loading=false,loaded=false,loadError="",pendingViewRecord=false,pendingViewIds=new Set(),viewRecordError="";
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa=v=>String(v).replace(/[0-9]/g,n=>"۰۱۲۳۴۵۶۷۸۹"[+n]);
const when=v=>{try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(v+"T12:00:00Z"))}catch{return v||"—"}};
function update(){document.dispatchEvent(new Event("stuner-school-work-updated"))}
async function refresh(){
 if(!db||!member||!user||loading)return;
 loading=true;loadError="";
 try{
  // Fetch class assignments and individual assignments separately.
  // This avoids relying on a combined PostgREST OR filter for student visibility.
  const columns="id,school_id,class_id,student_id,teacher_id,kind,title,subject,description,due_date,created_at";
  const classQuery=member.class_id
   ?db.from("school_assignments").select(columns).eq("school_id",member.school_id).eq("class_id",member.class_id).order("due_date",{ascending:true})
   :Promise.resolve({data:[],error:null});
  const personalQuery=db.from("school_assignments").select(columns).eq("school_id",member.school_id).eq("student_id",user.id).order("due_date",{ascending:true});
  const [classResult,personalResult]=await Promise.all([classQuery,personalQuery]);
  if(classResult.error)throw classResult.error;
  if(personalResult.error)throw personalResult.error;
  const merged=new Map();
  for(const row of [...(classResult.data||[]),...(personalResult.data||[])])merged.set(row.id,row);
  const a={data:[...merged.values()].sort((x,y)=>String(x.due_date||"").localeCompare(String(y.due_date||"")))};
  const c=await db.from("assignment_completions").select("assignment_id").eq("student_id",user.id);
  if(c.error)throw c.error;
  assignments=a.data||[];
  completed=new Set((c.data||[]).map(x=>x.assignment_id));
  teacherSubjects=[];
  if(member.class_id){
   const teachers=await db.rpc("list_student_class_subjects",{p_school:member.school_id,p_class:member.class_id});
   if(teachers.error)throw teachers.error;
   teacherSubjects=(teachers.data||[]).filter(x=>x.subject&&x.teacher_name);
  }
  loaded=true;
 }catch(e){loadError=e.message||"ارتباط با مدرسه برقرار نشد."}
 finally{loading=false;update();if(loaded&&!loadError){if(pendingViewRecord){pendingViewRecord=false;recordFirstViews(assignments.filter(a=>a.kind==="task"))}else if(pendingViewIds.size){const ids=[...pendingViewIds];pendingViewIds.clear();recordFirstViews(assignments.filter(a=>a.kind==="task"&&ids.includes(a.id)))}}}
}
async function recordFirstViews(rows){
 if(!db||!user||!rows.length)return;
 const payload=rows.map(a=>({assignment_id:a.id,student_id:user.id}));
 const result=await db.from("assignment_views").upsert(payload,{onConflict:"assignment_id,student_id",ignoreDuplicates:true});
 if(result.error){viewRecordError=result.error.message||"خطای نامشخص";console.error("ثبت زمان مشاهده تکلیف انجام نشد:",result.error);return false;}viewRecordError="";return true;
}
async function recordVisibleTaskViews(){
 if(!db||!user)return;
 if(loading||!loaded){pendingViewRecord=true;return;}
 if(loadError)return;
 return recordFirstViews(assignments.filter(a=>a.kind==="task"));
}
async function recordAssignmentView(id){
 if(!db||!user||!id)return;
 if(loading||!loaded){pendingViewIds.add(id);return;}
 if(loadError)return;
 const row=assignments.find(a=>a.id===id&&a.kind==="task");
 if(row)return recordFirstViews([row]);
}
function render(page){
 if(!db||!member)return "";
 if(!member.class_id&&!assignments.some(a=>a.student_id===user?.id))return '<section class="card panel stuner-schoolwork"><h2>برنامه مدرسه</h2><p>هنوز در هیچ کلاسی ثبت نشده‌ای؛ مدیر مدرسه باید تو را به کلاس اختصاص دهد.</p></section>';
 if(page!=="home"&&page!=="tasks"&&page!=="exams")return "";
 const list=assignments.filter(x=>page==="tasks"?x.kind==="task":page==="exams"?x.kind==="exam":true);
 const content=loading&&!loaded?"<p>دریافت تکالیف و امتحانات مدرسه…</p>":loadError?'<p class="school-work-error">'+esc(loadError)+'</p>':list.length?list.map(a=>{
  const task=a.kind==="task",done=completed.has(a.id);
  const assignedTo=a.student_id?"ارسالی ویژه شما":"ارسالی برای کلاس";
  return '<article class="school-work-row" data-school-assignment="'+esc(a.id)+'"><div class="school-work-text"><small class="school-work-label">'+(task?"تکلیف":"امتحان")+' · '+esc(a.subject)+' · '+assignedTo+'</small><strong>'+esc(a.title)+'</strong><span>'+esc(when(a.due_date))+'</span>'+(a.description?'<p>'+esc(a.description)+'</p>':"")+'</div>'+(task?'<button type="button" class="school-work-done '+(done?"is-done":"")+'" data-school-complete="'+esc(a.id)+'">'+(done?"✓ انجام شده":"ثبت انجام تکلیف")+'</button>':"")+'</article>';
 }).join(""):"<p>هنوز موردی از طرف معلم برای کلاس شما ثبت نشده است.</p>";
 if(page==="tasks"&&loaded&&!loadError)recordFirstViews(list.filter(a=>a.kind==="task"));
 const title=page==="tasks"?"تکالیف ارسالی معلم":page==="exams"?"امتحانات تعیین‌شده مدرسه":"برنامه ارسالی معلمان";
 return '<section class="card panel stuner-schoolwork"><div class="school-work-head"><div><h2>'+title+'</h2><p>مربوط به کلاس شما · همگام با مدرسه</p></div><button class="secondary-button small-button" data-refresh-school-work type="button">به‌روزرسانی</button></div>'+content+'</section>';
}
function renderTeachers(){
 if(!db||!member||!member.class_id)return "";
 const items=teacherSubjects.map(x=>'<div class="school-subject-teacher"><strong>'+esc(x.subject)+'</strong><span>'+esc(x.teacher_name)+'</span></div>').join("");
 return '<section class="card panel stuner-schoolwork school-course-teachers"><div class="school-work-head"><div><h2>درس‌ها و دبیران کلاس من</h2><p>اطلاعات ثبت‌شده توسط هنرستان</p></div></div>'+
 (items||'<p>هنوز اطلاعات دبیران درس‌های این کلاس ثبت نشده است.</p>')+'</section>';
}
async function toggle(id,button){
 if(!db||!user||!assignments.some(a=>a.id===id&&a.kind==="task"))return;
 if(button)button.disabled=true;
 const done=completed.has(id);
 const result=done?await db.from("assignment_completions").delete().eq("assignment_id",id).eq("student_id",user.id):
  await db.from("assignment_completions").insert({assignment_id:id,student_id:user.id});
 if(result.error){alert("ثبت وضعیت انجام نشد: "+result.error.message);if(button)button.disabled=false;return}
 if(done)completed.delete(id);else completed.add(id);
 update();
}
document.addEventListener("click",e=>{
 const button=e.target.closest("[data-school-complete]");
 if(button){e.preventDefault();toggle(button.dataset.schoolComplete,button);return}
 if(e.target.closest("[data-refresh-school-work]")){e.preventDefault();refresh()}
});
window.STUNER_SCHOOL_WORK={
 init(client,account,m){db=client;user=account;member=m;assignments=[];teacherSubjects=[];completed=new Set();pendingViewRecord=false;pendingViewIds.clear();loaded=false;refresh()},
 render,refresh,renderTeachers,recordFirstViews:recordVisibleTaskViews,recordAssignmentView,
 teacherSubjects(){return teacherSubjects.map(x=>({subject:x.subject,teacher:x.teacher_name}))},
 snapshot(){
  return {tasks:assignments.filter(a=>a.kind==="task").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,due:a.due_date,createdAt:a.created_at,
   note:a.description,done:completed.has(a.id),fromSchool:true
  })),exams:assignments.filter(a=>a.kind==="exam").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,date:a.due_date,createdAt:a.created_at,
   note:a.description,fromSchool:true
  }))};
 },
 status(){return {loading:loading&&!loaded,error:loadError,viewError:viewRecordError,loaded:loaded,active:!!db&&!!member}}
};
})();
