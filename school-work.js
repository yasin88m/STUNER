(function(){
"use strict";
let db=null,user=null,member=null,assignments=[],completed=new Set(),teacherSubjects=[],projectSubmissions=new Map(),loading=false,loaded=false,loadError="",pendingViewRecord=false,pendingViewIds=new Set(),viewRecordError="",uploadingProject="",uploadProgress=0,viewAttempted=new Set();
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
  assignments=a.data||[];
  const projectIds=assignments.filter(x=>x.kind==="project").map(x=>x.id);
  // Load independent student data in parallel to reduce the wait after opening the school-work tabs.
  const [completionResult,submissionResult,teacherResult]=await Promise.all([
   db.from("assignment_completions").select("assignment_id").eq("student_id",user.id),
   projectIds.length
    ?db.from("project_submissions").select("id,assignment_id,student_id,file_name,file_path,file_size,mime_type,submitted_at,is_updated").in("assignment_id",projectIds).eq("student_id",user.id)
    :Promise.resolve({data:[],error:null}),
   member.class_id
    ?db.rpc("list_student_class_subjects",{p_school:member.school_id,p_class:member.class_id})
    :Promise.resolve({data:[],error:null})
  ]);
  if(completionResult.error)throw completionResult.error;
  if(submissionResult.error)throw submissionResult.error;
  if(teacherResult.error)throw teacherResult.error;
  completed=new Set((completionResult.data||[]).map(x=>x.assignment_id));
  projectSubmissions=new Map((submissionResult.data||[]).map(row=>[row.assignment_id,row]));
  teacherSubjects=(teacherResult.data||[]).filter(x=>x.subject&&x.teacher_name);
  loaded=true;
 }catch(e){loadError=e.message||"ارتباط با مدرسه برقرار نشد."}
 finally{loading=false;update();if(loaded&&!loadError){if(pendingViewRecord){pendingViewRecord=false;recordFirstViews(assignments.filter(a=>a.kind==="task"))}else if(pendingViewIds.size){const ids=[...pendingViewIds];pendingViewIds.clear();recordFirstViews(assignments.filter(a=>a.kind==="task"&&ids.includes(a.id)))}}}
}
async function recordFirstViews(rows){
 if(!db||!user||!rows.length)return;
 // Prevent repeated INSERT requests every time the student changes tabs or the UI re-renders.
 const fresh=rows.filter(a=>a?.id&&!viewAttempted.has(a.id));
 if(!fresh.length)return true;
 fresh.forEach(a=>viewAttempted.add(a.id));
 // One batched INSERT replaces one network request per assignment.
 const result=await db.from("assignment_views").insert(fresh.map(a=>({assignment_id:a.id,student_id:user.id})));
 if(result.error&&result.error.code!=="23505"){
  fresh.forEach(a=>viewAttempted.delete(a.id));
  viewRecordError=result.error.message||"خطای نامشخص";
  console.error("ثبت زمان مشاهده تکلیف انجام نشد:",result.error);
  return false;
 }
 viewRecordError="";
 return true;
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
 if(page!=="home"&&page!=="tasks"&&page!=="exams"&&page!=="projects")return "";
 const list=assignments.filter(x=>page==="tasks"?x.kind==="task":page==="exams"?x.kind==="exam":page==="projects"?x.kind==="project":true);
 const content=loading&&!loaded?"<p>دریافت تکالیف و امتحانات مدرسه…</p>":loadError?'<p class="school-work-error">'+esc(loadError)+'</p>':list.length?list.map(a=>{
  const task=a.kind==="task",project=a.kind==="project",done=completed.has(a.id),submission=projectSubmissions.get(a.id);
  const assignedTo=a.student_id?"ارسالی ویژه شما":"ارسالی برای کلاس";
  const submissionUI=project?'<div class="school-project-submit"><div class="school-project-status">'+(submission?'<strong>فایل شما ارسال شده است</strong><small>'+esc(submission.file_name)+'</small>':'<strong>هنوز فایلی ارسال نکرده‌ای</strong><small>فایل پروژه را تا تاریخ مقرر بارگذاری کن.</small>')+'</div><label class="school-project-file-label">'+(uploadingProject===a.id?"در حال آپلود…":submission?"ارسال نسخه جدید":"انتخاب فایل پروژه")+'<input type="file" accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png" data-project-file="'+esc(a.id)+'" '+(uploadingProject===a.id?"disabled":"")+'></label><div class="school-project-progress" data-project-progress="'+esc(a.id)+'" '+(uploadingProject===a.id?"":"hidden")+'><div class="school-project-progress-track" role="progressbar" aria-label="درصد آپلود فایل" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(uploadingProject===a.id?uploadProgress:0)+'"><span style="width:'+(uploadingProject===a.id?uploadProgress:0)+'%"></span></div><strong data-project-progress-label>'+fa(uploadingProject===a.id?uploadProgress:0)+'٪</strong></div><span class="school-project-upload-status" data-project-upload-status="'+esc(a.id)+'">حداکثر حجم فایل: ۵۰ مگابایت</span></div>':"";
  return '<article class="school-work-row school-project-row '+(task&&done?"is-done":"")+'" data-school-assignment="'+esc(a.id)+'"><div class="school-work-text"><small class="school-work-label">'+(project?"پروژه":task?"تکلیف":"امتحان")+' · '+esc(a.subject)+' · '+assignedTo+'</small><strong class="'+(task&&done?"is-done":"")+'">'+esc(a.title)+'</strong><span>'+esc(when(a.due_date))+'</span>'+(a.description?'<p>'+esc(a.description)+'</p>':"")+'</div>'+(task?'<button type="button" class="school-work-done '+(done?"is-done":"")+'" data-school-complete="'+esc(a.id)+'">'+(done?"✓ انجام شده":"ثبت انجام تکلیف")+'</button>':"")+submissionUI+'</article>';
 }).join(""):"<p>هنوز موردی از طرف معلم برای کلاس شما ثبت نشده است.</p>";
 if(page==="tasks"&&loaded&&!loadError)recordFirstViews(list.filter(a=>a.kind==="task"));
 const title=page==="tasks"?"تکالیف ارسالی معلم":page==="exams"?"امتحانات تعیین‌شده مدرسه":page==="projects"?"پروژه‌های ارسالی معلم":"برنامه ارسالی معلمان";
 return '<section class="card panel stuner-schoolwork"><div class="school-work-head"><div><h2>'+title+'</h2><p>مربوط به کلاس شما · همگام با مدرسه</p></div><button class="secondary-button small-button" data-refresh-school-work type="button">به‌روزرسانی</button></div>'+content+'</section>';
}
function renderTeachers(){
 if(!db||!member||!member.class_id)return "";
 const items=teacherSubjects.map(x=>'<div class="school-subject-teacher"><strong>'+esc(x.subject)+'</strong><span>'+esc(x.teacher_name)+'</span></div>').join("");
 return '<section class="card panel stuner-schoolwork school-course-teachers"><div class="school-work-head"><div><h2>درس‌ها و دبیران کلاس من</h2><p>اطلاعات ثبت‌شده توسط هنرستان</p></div></div>'+
 (items||'<p>هنوز اطلاعات دبیران درس‌های این کلاس ثبت نشده است.</p>')+'</section>';
}
async function uploadStorageFile(path,file,onProgress){
 const {data,error}=await db.auth.getSession();
 if(error)throw error;
 if(!data?.session?.access_token)throw Error("نشست کاربری معتبر نیست؛ دوباره وارد حساب شو.");
 const config=window.STUNER_SUPABASE_CONFIG;
 if(!config?.url||!config?.publishableKey)throw Error("تنظیمات فضای ذخیره‌سازی پیدا نشد.");
 const encodedPath=path.split("/").map(encodeURIComponent).join("/");
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open("POST",config.url+"/storage/v1/object/stuner-project-submissions/"+encodedPath);
  xhr.setRequestHeader("apikey",config.publishableKey);
  xhr.setRequestHeader("Authorization","Bearer "+data.session.access_token);
  xhr.setRequestHeader("Content-Type",file.type||"application/octet-stream");
  xhr.setRequestHeader("x-upsert","false");
  xhr.upload.addEventListener("progress",event=>{
   if(!event.lengthComputable)return;
   onProgress(Math.min(100,Math.round(event.loaded/event.total*100)));
  });
  xhr.onload=()=>{let payload={};try{payload=JSON.parse(xhr.responseText||"{}")}catch{}
   if(xhr.status>=200&&xhr.status<300)resolve(payload);
   else reject(Error(payload.message||payload.error||"آپلود فایل ناموفق بود (HTTP "+xhr.status+")."));
  };
  xhr.onerror=()=>reject(Error("ارتباط هنگام آپلود فایل قطع شد."));
  xhr.onabort=()=>reject(Error("آپلود فایل لغو شد."));
  xhr.send(file);
 });
}
async function uploadProjectFile(input){
 const assignmentId=input.dataset.projectFile,assignment=assignments.find(x=>x.id===assignmentId&&x.kind==="project");
 const file=input.files&&input.files[0];if(!assignment||!file)return;
 const status=document.querySelector('[data-project-upload-status="'+CSS.escape(assignmentId)+'"]');
 const progress=document.querySelector('[data-project-progress="'+CSS.escape(assignmentId)+'"]');
 const track=progress?.querySelector(".school-project-progress-track"),fill=track?.querySelector("span");
 const percentLabel=progress?.querySelector("[data-project-progress-label]");
 const label=input.closest(".school-project-file-label");
 const hadPrevious=projectSubmissions.has(assignmentId);
 const showProgress=percent=>{
  uploadProgress=percent;if(progress)progress.hidden=false;
  if(fill)fill.style.width=percent+"%";
  if(track)track.setAttribute("aria-valuenow",String(percent));
  if(percentLabel)percentLabel.textContent=fa(percent)+"٪";
  if(status)status.textContent=percent>=100?"فایل آپلود شد؛ در حال ثبت تحویل…":"در حال آپلود فایل…";
 };
 if(!/\.(pptx?|pdf|docx?|xlsx?|zip|jpe?g|png)$/i.test(file.name)){if(status)status.textContent="فرمت فایل پشتیبانی نمی‌شود.";input.value="";return}
 if(file.size>50*1024*1024){if(status)status.textContent="حجم فایل نباید بیشتر از ۵۰ مگابایت باشد.";input.value="";return}
 uploadingProject=assignmentId;uploadProgress=0;input.disabled=true;if(label?.firstChild?.nodeType===3)label.firstChild.textContent="در حال آپلود…";showProgress(0);
 try{
  const previous=projectSubmissions.get(assignmentId);
  const safeName=file.name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu,"_").slice(-120)||"project-file";
  const path=assignmentId+"/"+user.id+"/"+Date.now()+"_"+safeName;
  await uploadStorageFile(path,file,showProgress);
  const saved=await db.from("project_submissions").upsert({assignment_id:assignmentId,student_id:user.id,file_name:file.name.slice(0,255),file_path:path,file_size:file.size,mime_type:file.type||"application/octet-stream",submitted_at:new Date().toISOString(),is_updated:!!previous},{onConflict:"assignment_id,student_id"}).select("id,assignment_id,student_id,file_name,file_path,file_size,mime_type,submitted_at,is_updated").single();
  if(saved.error){await db.storage.from("stuner-project-submissions").remove([path]);throw saved.error}
  projectSubmissions.set(assignmentId,saved.data);
  if(previous?.file_path)await db.storage.from("stuner-project-submissions").remove([previous.file_path]);
  uploadingProject="";uploadProgress=100;update();
 }catch(err){
  uploadingProject="";uploadProgress=0;
  if(status)status.textContent="ارسال انجام نشد: "+(err.message||"خطای نامشخص");
  input.disabled=false;if(label?.firstChild?.nodeType===3)label.firstChild.textContent=hadPrevious?"ارسال نسخه جدید":"انتخاب فایل پروژه";if(progress)progress.hidden=true;
 }
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
 if(e.target.closest("[data-refresh-school-work]")){e.preventDefault();refresh();return}
 });
document.addEventListener("change",e=>{const projectInput=e.target.closest("[data-project-file]");if(projectInput)uploadProjectFile(projectInput)});
window.STUNER_SCHOOL_WORK={
 init(client,account,m){db=client;user=account;member=m;assignments=[];teacherSubjects=[];projectSubmissions=new Map();completed=new Set();pendingViewRecord=false;pendingViewIds.clear();viewAttempted.clear();loaded=false;refresh()},
 render,refresh,renderTeachers,recordFirstViews:recordVisibleTaskViews,recordAssignmentView,
 teacherSubjects(){return teacherSubjects.map(x=>({subject:x.subject,teacher:x.teacher_name}))},
 snapshot(){
  return {tasks:assignments.filter(a=>a.kind==="task").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,due:a.due_date,createdAt:a.created_at,
   note:a.description,done:completed.has(a.id),fromSchool:true
  })),exams:assignments.filter(a=>a.kind==="exam").map(a=>({
   id:"school-"+a.id,schoolId:a.id,title:a.title,subject:a.subject,date:a.due_date,createdAt:a.created_at,
   note:a.description,fromSchool:true
  })),projects:assignments.filter(a=>a.kind==="project").map(a=>({id:a.id,title:a.title,subject:a.subject,due:a.due_date,submitted:projectSubmissions.has(a.id)}))};
 },
 status(){return {loading:loading&&!loaded,error:loadError,viewError:viewRecordError,loaded:loaded,active:!!db&&!!member}}
};
})();
