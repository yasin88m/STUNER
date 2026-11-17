(function(){
"use strict";
let db=null,user=null,member=null,assignments=[],completed=new Set(),loading=false,loaded=false,loadError="";
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa=v=>String(v).replace(/[0-9]/g,n=>"۰۱۲۳۴۵۶۷۸۹"[+n]);
const when=v=>{try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(v+"T12:00:00Z"))}catch{return v||"—"}};
function update(){document.dispatchEvent(new Event("stuner-school-work-updated"))}
async function refresh(){
 if(!db||!member||!user||loading)return;
 loading=true;loadError="";
 try{
  // RLS enforces that only students in this class can read the assignments.
  const a=await db.from("school_assignments").select("id,school_id,class_id,teacher_id,kind,title,subject,description,due_date,created_at").eq("school_id",member.school_id).eq("class_id",member.class_id).order("due_date",{ascending:true});
  if(a.error)throw a.error;
  const c=await db.from("assignment_completions").select("assignment_id").eq("student_id",user.id);
  if(c.error)throw c.error;
  assignments=a.data||[];
  completed=new Set((c.data||[]).map(x=>x.assignment_id));
  loaded=true;
 }catch(e){loadError=e.message||"ارتباط با مدرسه برقرار نشد."}
 finally{loading=false;update()}
}
function render(page){
 if(!db||!member)return "";
 if(!member.class_id)return '<section class="card panel stuner-schoolwork"><h2>برنامه مدرسه</h2><p>هنوز در هیچ کلاسی ثبت نشده‌ای؛ مدیر مدرسه باید تو را به کلاس اختصاص دهد.</p></section>';
 if(page!=="home"&&page!=="tasks"&&page!=="exams")return "";
 const list=assignments.filter(x=>page==="tasks"?x.kind==="task":page==="exams"?x.kind==="exam":true);
 const content=loading&&!loaded?"<p>دریافت تکالیف و امتحانات مدرسه…</p>":loadError?'<p class="school-work-error">'+esc(loadError)+'</p>':list.length?list.map(a=>{
  const task=a.kind==="task",done=completed.has(a.id);
  return '<article class="school-work-row"><div class="school-work-text"><small class="school-work-label">'+(task?"تکلیف":"امتحان")+' · '+esc(a.subject)+'</small><strong>'+esc(a.title)+'</strong><span>'+esc(when(a.due_date))+'</span>'+(a.description?'<p>'+esc(a.description)+'</p>':"")+'</div>'+(task?'<button type="button" class="school-work-done '+(done?"is-done":"")+'" data-school-complete="'+esc(a.id)+'">'+(done?"✓ انجام شده":"ثبت انجام تکلیف")+'</button>':"")+'</article>';
 }).join(""):"<p>هنوز موردی از طرف معلم برای کلاس شما ثبت نشده است.</p>";
 const title=page==="tasks"?"تکالیف ارسالی معلم":page==="exams"?"امتحانات تعیین‌شده مدرسه":"برنامه ارسالی معلمان";
 return '<section class="card panel stuner-schoolwork"><div class="school-work-head"><div><h2>'+title+'</h2><p>مربوط به کلاس شما · همگام با مدرسه</p></div><button class="secondary-button small-button" data-refresh-school-work type="button">به‌روزرسانی</button></div>'+content+'</section>';
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
 init(client,account,m){db=client;user=account;member=m;assignments=[];completed=new Set();loaded=false;refresh()},
 render,refresh,
 snapshot(){
  return {tasks:assignments.filter(a=>a.kind==="task").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,due:a.due_date,
   note:a.description,done:completed.has(a.id),fromSchool:true
  })),exams:assignments.filter(a=>a.kind==="exam").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,date:a.due_date,
   note:a.description,fromSchool:true
  }))};
 },
 status(){return {loading:loading&&!loaded,error:loadError,loaded:loaded,active:!!db&&!!member}}
};
})();
