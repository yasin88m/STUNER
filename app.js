(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY="stuner.app.v1:"+window.STUNER_ACTIVE_USER.id+":"+window.STUNER_ACTIVE_USER.schoolId, IRAN_TZ="Asia/Tehran", days=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
const THEME_PALETTES=[{"name":"سبز جنگلی","main":"#126246","dark":"#0b3e2c","light":"#e6f4eb","soft":"#cce8d7"},{"name":"آبی اقیانوسی","main":"#176b87","dark":"#10475d","light":"#e6f3f8","soft":"#c9e5ef"},{"name":"بنفش","main":"#7355a6","dark":"#49356f","light":"#f0ebf8","soft":"#ddd1ef"},{"name":"آبی سلطنتی","main":"#356acb","dark":"#23498e","light":"#eaf1fc","soft":"#cfdef8"},{"name":"فیروزه‌ای","main":"#0f887f","dark":"#075a55","light":"#e5f5f3","soft":"#c6e9e5"},{"name":"سبز زمردی","main":"#16875b","dark":"#0d5a3d","light":"#e7f5ed","soft":"#c9e9d7"},{"name":"صورتی","main":"#bd5274","dark":"#81364f","light":"#faedf2","soft":"#f0cfda"},{"name":"نارنجی","main":"#c56b2d","dark":"#85471e","light":"#fbf0e7","soft":"#f2d8c3"},{"name":"طلایی","main":"#a87917","dark":"#70500f","light":"#f8f2e3","soft":"#eadcb7"},{"name":"نیلی","main":"#4c56a8","dark":"#343b76","light":"#eceefa","soft":"#d2d6f2"},{"name":"آبی آسمانی","main":"#167f9d","dark":"#10566a","light":"#e7f4f8","soft":"#cbe7ef"},{"name":"ارغوانی","main":"#8a4e91","dark":"#5c3561","light":"#f4ebf5","soft":"#e4cfe6"},{"name":"قرمز یاقوتی","main":"#b94d4d","dark":"#7d3434","light":"#faecec","soft":"#f0cece"},{"name":"خاکستری آبی","main":"#536779","dark":"#394957","light":"#edf1f4","soft":"#d5dfe6"},{"name":"ذغالی","main":"#37474f","dark":"#263238","light":"#edf0f1","soft":"#d5dcdf"}];
const base=()=>({student:null,tasks:[],exams:[],grades:[],plans:[],sessions:[],subjects:["ریاضی","علوم","فارسی","عربی","زبان انگلیسی","مطالعات اجتماعی","دینی","ادبیات"],preferences:{notifyTasks:true,notifyStudy:true,notifyBreak:true,taskReminderTime:"08:00",studyReminderTime:"16:00",theme:"سبز جنگلی"},timer:{mode:"study",remaining:1500,running:false,subject:"ریاضی",activity:"study",activityId:""},konkuriaFocus:{subject:"",seconds:0,running:false,startedAt:0}});
let state=base(),page="home",taskFilter="all",taskView="tasks",planDay=(dateObj(isoToday()).getUTCDay()+1)%7,calAnchor=isoToday(),calSelected=isoToday(),ticker=null,deadline=null,konkuriaTicker=null;
function save(){if(cloudLoaded)cloudStore?.schedule(state)}
function isoToday(){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:IRAN_TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const g=k=>p.find(x=>x.type===k)?.value||"00";
 return g("year")+"-"+g("month")+"-"+g("day");
}
function isoFromDate(d){return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,"0"),String(d.getUTCDate()).padStart(2,"0")].join("-")}
function dateObj(s){let [y,m,d]=String(s||isoToday()).split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12))}
function isoAdd(n){let d=dateObj(isoToday());d.setUTCDate(d.getUTCDate()+Number(n||0));return isoFromDate(d)}
function iranClock(){
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:IRAN_TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 const g=k=>p.find(x=>x.type===k)?.value||"00";
 return g("hour")+":"+g("minute");
}
function iranHour(){return Number(iranClock().slice(0,2))}
function iranWeekDay(){return dateObj(isoToday()).getUTCDay()}
function normalTime(v,fallback=""){
 const digits=String(v??"").replace(/[۰-۹]/g,c=>"۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/[٠-٩]/g,c=>"٠١٢٣٤٥٦٧٨٩".indexOf(c)).trim();
 const m=digits.match(/^(\d{1,2})\s*[:٫.]\s*(\d{1,2})$/);
 if(!m)return fallback;
 const h=Number(m[1]),mi=Number(m[2]);
 if(h<0||h>23||mi<0||mi>59)return fallback;
 return String(h).padStart(2,"0")+":"+String(mi).padStart(2,"0");
}
function fa(v){return String(v).replace(/[0-9]/g,d=>"۰۱۲۳۴۵۶۷۸۹"[+d])}
function esc(s=""){return String(s).replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(s,opt={weekday:"short",day:"numeric",month:"long"}){try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{...opt,timeZone:IRAN_TZ}).format(dateObj(s))}catch{return s||"بدون تاریخ"}}

function toast(msg){let el=document.createElement("div");el.className="toast";el.textContent=msg;$("#toastRoot").append(el);setTimeout(()=>el.remove(),3000)}
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)}
function name(){return state.student?.firstName||"دانش‌آموز"}
function fullName(){return [state.student?.firstName,state.student?.lastName].filter(Boolean).join(" ")||"دانش‌آموز"}
function initials(){return state.student?.firstName?.[0]||"؟"}
function sessionSeconds(s){return Number.isFinite(+s.seconds)&&s.seconds!=null?Math.max(0,+s.seconds):Math.max(0,(+s.minutes||0)*60)}
function sumSessionSeconds(items){return Math.round(items.reduce((a,s)=>a+sessionSeconds(s),0))}
function studyTimeStamp(seconds){
 let n=Math.max(0,Math.round(seconds)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),sec=n%60;
 return fa(String(h)+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"));
}
function shortStudyTime(minutes){
 const sec=Math.max(0,Math.round((+minutes||0)*60));
 return sec<60?fa(sec)+" ث":fa(Math.round(sec/60))+" د";
}
function totalMins(){return sumSessionSeconds(state.sessions)/60}
function average(){let rows=state.grades.filter(g=>activeSubject(g.subject));return rows.length?rows.reduce((a,g)=>a+(+g.score),0)/rows.length:null}

const CURRICULUM=window.STUNER_CURRICULUM;
// Keep classroom enrollment consistent with the principal's assignments.
const managed=window.STUNER_ACTIVE_STUDENT_PROFILE||null;
let cloudStore=null,cloudLoaded=false,cloudFailure="",cloudBooting=false;
let editingProfile=false,profileSubmitting=false;
function cloudStatus(status){
 // Only a failed WRITE produces a top-of-screen notification. A successful save
 // removes the warning; normal loading/saving is deliberately silent.
 document.getElementById("studentCloudStatus")?.remove();
 let alert=document.getElementById("studentCloudAlert");
 if(status==="saved"){alert?.remove();return}
 if(status!=="failed")return;
 if(alert)return;
 alert=document.createElement("div");
 alert.id="studentCloudAlert";alert.className="student-cloud-alert";
 alert.setAttribute("role","alert");alert.setAttribute("dir","rtl");
 const message=document.createElement("span");
 message.textContent="اطلاعات ذخیره نشد. اتصالت به اینترنت رو چک کن.";
 const retry=document.createElement("button");
 retry.type="button";retry.dataset.cloudRetry="1";
 retry.className="student-cloud-retry";retry.textContent="تلاش مجدد";
 alert.append(message,retry);document.body.append(alert);
}
function hydrateCloud(data){
 const b=base(),v=data&&typeof data==="object"?data:{};
 state={...b,...v,
  tasks:Array.isArray(v.tasks)?v.tasks:[],exams:Array.isArray(v.exams)?v.exams:[],
  grades:Array.isArray(v.grades)?v.grades:[],plans:Array.isArray(v.plans)?v.plans:[],
  sessions:Array.isArray(v.sessions)?v.sessions:[],subjects:Array.isArray(v.subjects)?v.subjects:b.subjects,
  preferences:{...b.preferences,...(v.preferences||{})},
  timer:{...b.timer,...(v.timer||{}),running:false},
  konkuriaFocus:{...b.konkuriaFocus,...(v.konkuriaFocus||{})}
 };
 const before=JSON.stringify(state);
 if(managed){state.student={...state.student,...managed};syncStudentSubjects();}
 cloudLoaded=true;cloudFailure="";render();
 if(before!==JSON.stringify(state))save();
}
async function bootCloud(){
 if(cloudBooting)return;
 cloudBooting=true;cloudLoaded=false;cloudFailure="";render();
 try{
  if(!window.STUNER_STUDENT_CLOUD||!window.STUNER_STUDENT_DB)throw Error("اتصال به دیتابیس دانش‌آموز در دسترس نیست.");
  if(!cloudStore)cloudStore=window.STUNER_STUDENT_CLOUD.create({
   client:window.STUNER_STUDENT_DB,schoolId:window.STUNER_ACTIVE_USER.schoolId,
   studentId:window.STUNER_ACTIVE_USER.id,legacyKey:KEY,
   onStatus:cloudStatus,onRemote:hydrateCloud
  });
  hydrateCloud(await cloudStore.load(base()));
 }catch(err){
  cloudFailure=err.message||"دریافت اطلاعات حساب انجام نشد.";
  cloudLoaded=false;render();
 }finally{cloudBooting=false}
}
function inferEducationLevel(grade=""){
 if(String(grade).includes("ابتدایی"))return "elementary";
 if(["هفتم","هشتم","نهم"].includes(grade))return "middle";
 return "secondary";
}
function fillSelect(el,items,placeholder,selected=""){
 if(!el)return;
 el.innerHTML='<option value="">'+esc(placeholder)+'</option>'+items.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 el.value=items.includes(selected)?selected:"";
}
function updateMajorFields(preserve=true){
 const level=$("#educationLevel")?.value||"",track=level==="secondary"?($("#trackSelect")?.value||""):"",group=$("#fieldGroupSelect")?.value||"",grade=$("#gradeSelect")?.value||"";
 const groupField=$("#fieldGroupField"),majorField=$("#majorField"),groupSelect=$("#fieldGroupSelect"),majorSelect=$("#majorSelect");
 const isVocational=track==="فنی‌وحرفه‌ای"||track==="کاردانش";
 if(level!=="secondary"){
  if(groupField)groupField.hidden=true;
  if(groupSelect){groupSelect.required=false;groupSelect.disabled=true;fillSelect(groupSelect,[],"ابتدا شاخه را انتخاب کن");}
  if(majorField)majorField.hidden=true;
  if(majorSelect){majorSelect.required=false;majorSelect.disabled=true;fillSelect(majorSelect,[],"ابتدا شاخه را انتخاب کن");}
  return;
 }
 if(!isVocational){
  if(groupField)groupField.hidden=true;
  if(groupSelect){groupSelect.required=false;groupSelect.disabled=true;fillSelect(groupSelect,[],"ابتدا شاخه را انتخاب کن");}
  const showMajor=track==="نظری";
  if(majorField)majorField.hidden=!showMajor;
  if(majorSelect){majorSelect.required=showMajor;majorSelect.disabled=!showMajor;}
  const majors=CURRICULUM.catalogReady?CURRICULUM.getMajors("نظری","",grade):CURRICULUM.theoreticalMajors;
  if(showMajor)fillSelect(majorSelect,majors,"رشته نظری را انتخاب کن",preserve?majorSelect.value:"");
  else if(majorSelect)fillSelect(majorSelect,[],"ابتدا شاخه را انتخاب کن");
  return;
 }
 if(groupField)groupField.hidden=false;
 if(groupSelect){groupSelect.required=true;groupSelect.disabled=false;}
 const groups=CURRICULUM.catalogReady?CURRICULUM.getFieldGroups(track,grade):(CURRICULUM.fieldGroups[track==="فنی‌وحرفه‌ای"?"fanni":"kardanesh"]||[]);
 fillSelect(groupSelect,groups,"زمینه تحصیلی را انتخاب کن",preserve?group:"");
 const selectedGroup=groupSelect?.value||"";
 const majors=CURRICULUM.catalogReady?CURRICULUM.getMajors(track,selectedGroup,grade):((CURRICULUM.majors[track==="فنی‌وحرفه‌ای"?"fanni":"kardanesh"]||{})[selectedGroup]||[]);
 const showMajor=!!selectedGroup;
 if(majorField)majorField.hidden=!showMajor;
 if(majorSelect){majorSelect.required=showMajor;majorSelect.disabled=!showMajor;}
 fillSelect(majorSelect,majors,"رشته تحصیلی را انتخاب کن",preserve?majorSelect.value:"");
}
function updateEducationFields(preserve=true){
 const level=$("#educationLevel")?.value||"",gradeSelect=$("#gradeSelect"),trackField=$("#trackField"),trackSelect=$("#trackSelect");
 fillSelect(gradeSelect,CURRICULUM.grades[level]||[],"پایه تحصیلی را انتخاب کن",preserve?gradeSelect.value:"");
 if(gradeSelect)gradeSelect.disabled=!level;
 const secondary=level==="secondary";
 if(trackField)trackField.hidden=!secondary;
 if(trackSelect){trackSelect.required=secondary;trackSelect.disabled=!secondary;if(!secondary||!preserve)trackSelect.value="";}
 updateMajorFields(preserve);
}
function populateStudentForm(){
 const st=state.student||{},form=$("#onboardingForm");if(!form)return;
 form.elements.firstName.value=st.firstName||"";form.elements.lastName.value=st.lastName||"";form.elements.age.value=st.age||"";
 $("#educationLevel").value=st.educationLevel||inferEducationLevel(st.grade||"");
 updateEducationFields(false);$("#gradeSelect").value=st.grade||"";
 $("#trackSelect").value=st.track||"";updateMajorFields(false);
 if(st.fieldGroup)$("#fieldGroupSelect").value=st.fieldGroup;
 updateMajorFields(true);if(st.major)$("#majorSelect").value=st.major;
}
function profileIsReady(st){
 if(!st||!st.educationLevel||!st.grade)return false;
 if(st.educationLevel!=="secondary")return true;
 if(!st.track||!st.major)return false;
 return st.track==="نظری"||!!st.fieldGroup||!!managed;
}
function syncStudentSubjects(){
 const selected=CURRICULUM.getSubjects(state.student);
 const vocational=state.student&&(state.student.track==="فنی‌وحرفه‌ای"||state.student.track==="کاردانش");
 const registered=managed?(window.STUNER_SCHOOL_WORK?.teacherSubjects?.()||[]).map(x=>x.subject).filter(Boolean):[];
  const defaults=(CURRICULUM.catalogReady||vocational)?selected:(selected.length?selected:base().subjects);
  state.subjects=[...new Set([...defaults,...registered])];
 // Managed students skip onboarding, so the default subject may not exist in their grade.
 // Keep new timer sessions in a valid subject; older sessions are still counted regardless.
 if(state.subjects.length&&!state.subjects.includes(state.timer.subject)){
  state.timer.subject=state.subjects[0];
 }
}
function activeSubject(subject){return !subject||state.subjects.includes(subject)}
function studentBooks(){return CURRICULUM.getBooks(state.student)}



function dueText(s){if(!s)return"بدون مهلت";let d=Math.round((dateObj(s)-dateObj(isoToday()))/86400000);return d<0?"مهلت گذشته":d===0?"امروز":d===1?"فردا":fa(d)+" روز دیگر"}
function subjectOptions(sel){return state.subjects.map(s=>`<option ${s===sel?"selected":""}>${esc(s)}</option>`).join("")}
function heading(t,p,a=""){return `<div class="page-heading"><div><h1>${t}</h1><p>${p}</p></div>${a}</div>`}
function empty(t,p,i="✦"){return `<div class="empty-state"><div class="empty-icon">${i}</div><strong>${t}</strong>${p}</div>`}
function taskRow(t,compact=false){
 if(t.fromSchool)return '<div class="task-row school-inline-item"><button type="button" aria-label="تغییر وضعیت انجام تکلیف" class="check-control '+(t.done?"checked":"")+'" data-school-complete="'+esc(t.schoolId)+'"></button><div class="task-main"><strong>'+esc(t.title)+'</strong><small>'+esc(t.subject||"")+(t.note?" · "+esc(t.note):"")+'</small><span class="school-source">تکلیف معلم · غیرقابل حذف</span></div><span class="task-due">'+dueText(t.due)+'</span><button type="button" class="mini-icon-button timer-start" data-start-task-timer="'+esc(t.id)+'" aria-label="شروع تایمر تکلیف معلم"><i data-lucide="play"></i></button></div>';
 return '<div class="task-row"><button class="check-control '+(t.done?"checked":"")+'" data-toggle-task="'+esc(t.id)+'"></button><div class="task-main"><strong style="'+(t.done?"text-decoration:line-through;color:#9aa69f":"")+'">'+esc(t.title)+'</strong><small>'+esc(t.subject||"بدون درس")+(t.note?" · "+esc(t.note):"")+'</small></div><span class="task-due '+(!t.done&&t.due===isoToday()?"urgent":"")+'">'+dueText(t.due)+'</span><button class="mini-icon-button timer-start" data-start-task-timer="'+esc(t.id)+'" title="شروع تایمر تکلیف" aria-label="شروع تایمر تکلیف">▶</button>'+(compact?"":'<button class="mini-icon-button delete" data-delete-task="'+esc(t.id)+'">×</button>')+'</div>';
}
function examRow(e,withDelete=false){
 if(e.fromSchool)return '<div class="exam-mini school-inline-item"><div class="exam-date"><strong>'+new Intl.DateTimeFormat("fa-IR-u-ca-persian",{day:"numeric",timeZone:IRAN_TZ}).format(dateObj(e.date))+'</strong></div><div class="exam-mini-main"><strong>'+esc(e.title)+'</strong><small>'+esc(e.subject||"")+(e.note?" · "+esc(e.note):"")+'</small><span class="school-source">امتحان معلم · غیرقابل حذف</span></div><span class="pill gray">'+dueText(e.date)+'</span><button type="button" class="mini-icon-button timer-start" data-start-exam-timer="'+esc(e.id)+'" aria-label="شروع تایمر امتحان معلم"><i data-lucide="play"></i></button></div>';
 let d=dateObj(e.date);
 return '<div class="exam-mini"><div class="exam-date"><strong>'+new Intl.DateTimeFormat("fa-IR-u-ca-persian",{day:"numeric",timeZone:IRAN_TZ}).format(d)+'</strong><small>'+new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"short",timeZone:IRAN_TZ}).format(d)+'</small></div><div class="exam-mini-main"><strong>'+esc(e.title)+'</strong><small>'+esc(e.subject||"")+(e.note?" · "+esc(e.note):"")+'</small></div><button class="mini-icon-button timer-start" data-start-exam-timer="'+esc(e.id)+'" title="شروع تایمر آمادگی امتحان" aria-label="شروع تایمر آمادگی امتحان">▶</button><span class="pill '+(e.date===isoToday()?"red":"gray")+'">'+dueText(e.date)+'</span>'+(withDelete?'<button class="mini-icon-button delete" data-delete-exam="'+esc(e.id)+'">×</button>':"")+'</div>';
}
function schoolTasks(){return window.STUNER_SCHOOL_WORK?.snapshot()?.tasks||[]}
function schoolExams(){return window.STUNER_SCHOOL_WORK?.snapshot()?.exams||[]}
function allStudentTasks(){return [...state.tasks.filter(t=>activeSubject(t.subject)),...schoolTasks()]}
function allStudentExams(){return [...state.exams.filter(e=>activeSubject(e.subject)),...schoolExams()]}
function schoolNotice(){
 const x=window.STUNER_SCHOOL_WORK?.status();
 if(!x?.active)return "";
 return '<div class="school-inline-sync">'+(x.loading?"در حال دریافت فعالیت‌های معلم…":x.error?"خطا در دریافت فعالیت‌ها: "+esc(x.error):"تکالیف و امتحانات ارسالی معلم نیز در همین فهرست نمایش داده می‌شوند.")+' <button type="button" data-refresh-school-work>به‌روزرسانی</button></div>';
}
function renderHome(){
 // Tomorrow's dashboard includes both personal work and teacher-assigned items.
 const tomorrow=isoAdd(1);
 const tomorrowTasks=allStudentTasks().filter(t=>t.due===tomorrow);
 const tomorrowExams=allStudentExams().filter(e=>e.date===tomorrow);
 const done=tomorrowTasks.filter(t=>t.done).length,total=tomorrowTasks.length;
 const pct=total?Math.round(done/total*100):0;
 const progressLabel=fa(pct)+"٪",progressDetail=total?fa(done)+" از "+fa(total)+" تکلیف":"برای فردا تکلیفی نداری";
 const tasks=tomorrowTasks.slice().sort((a,b)=>Number(!!a.done)-Number(!!b.done));
 const exams=tomorrowExams.slice().sort((a,b)=>String(a.subject||"").localeCompare(String(b.subject||""),"fa"));
 const visibleSessions=state.sessions;
 let subjects=state.subjects.slice(0,4).map(s=>{let m=state.sessions.filter(x=>x.subject===s).reduce((a,x)=>a+(+x.minutes||0),0);return `<div class="subject-progress"><strong>${esc(s)}</strong><div class="progress-track"><span style="width:${Math.min(100,m/120*100)}%"></span></div><small>${shortStudyTime(m)}</small></div>`}).join("");
 let recordedSeconds=sumSessionSeconds(visibleSessions);
 return `<div class="home-greeting"><h1>سلام ${esc(fullName())}</h1><p>به فضای مطالعه خودت خوش آمدی.</p></div><section class="hero-card"><div class="hero-copy"><p class="eyebrow">${iranHour()<11?"صبح بخیر":iranHour()<17?"روز بخیر":"عصر بخیر"}</p><h2>برای یه روز پربار آماده‌ای؟</h2><p>با یک جلسه کوتاه شروع کن؛ مسیر موفقیت از همین‌جا می‌گذره.</p><button class="primary-button" data-page="timer">▶ شروع مطالعه <span>· ۲۵ دقیقه</span></button></div><div class="hero-orbit" style="background:conic-gradient(var(--mint-300) 0 ${pct}%,rgba(255,255,255,.15) ${pct}% 100%)"><div class="hero-orbit-inner"><strong>${progressLabel}</strong><small>پیشرفت تکالیف فردا</small><span>${progressDetail}</span></div></div></section>
 <section class="stats-grid"><article class="card stat-card"><span class="stat-icon">◷</span><div><strong>${studyTimeStamp(recordedSeconds)}</strong><small>زمان مطالعه ثبت‌شده</small></div></article><article class="card stat-card"><span class="stat-icon">☑</span><div><strong>${fa(total-done)}</strong><small>تکلیف فردا باقی‌مانده</small></div></article><article class="card stat-card"><span class="stat-icon">♜</span><div><strong>${fa(exams.length)}</strong><small>امتحان فردا</small></div></article><article class="card stat-card"><span class="stat-icon">★</span><div><strong>${average()===null?"—":fa(average().toFixed(1))}</strong><small>میانگین نمرات</small></div></article></section>
 <div class="dashboard-grid"><section class="card panel"><div class="section-title" style="margin-top:0"><div><h2>تکالیف فردا</h2><p>${fmt(tomorrow,{weekday:"long",day:"numeric",month:"long"})}</p></div><button class="text-button" data-page="tasks">همه تکالیف ←</button></div>${tasks.length?`<div class="task-list">${tasks.map(t=>taskRow(t,true)).join("")}</div>`:empty("برای فردا تکلیفی ثبت نشده","تکالیف فردا از طرف خودت یا معلم اینجا نمایش داده می‌شوند.","✓")}<button class="soft-button small-button" style="margin-top:12px" data-action="add-task-tomorrow">＋ افزودن تکلیف</button></section>
 <section class="card panel"><div class="section-title" style="margin-top:0"><div><h2>امتحانات فردا</h2><p>${fmt(tomorrow,{weekday:"long",day:"numeric",month:"long"})} · امروز آماده شو</p></div><button class="text-button" data-page="exams">مشاهده همه ←</button></div>${exams.length?exams.map(e=>examRow(e)).join(""):empty("برای فردا امتحانی ثبت نشده","امتحان‌های فردا از طرف خودت یا معلم اینجا نمایش داده می‌شوند.","♜")}<button class="soft-button small-button" style="margin-top:12px" data-action="add-exam-tomorrow">＋ افزودن امتحان</button></section></div>
 `;
}
function timerTarget(){
 if(state.timer.activity==="task")return allStudentTasks().find(x=>x.id===state.timer.activityId&&!x.done)||null;
 if(state.timer.activity==="exam")return allStudentExams().find(x=>x.id===state.timer.activityId)||null;
 return null;
}
function timerTargetSelect(){
 const activity=state.timer.activity||"study",study=state.timer.mode==="study";
 if(activity==="task"){
  const items=allStudentTasks().filter(x=>!x.done);
  return '<label class="timer-subject"><span>تکلیف مورد نظر</span><select id="timerActivityTarget" '+(study?"":"disabled")+'><option value="">'+(items.length?"انتخاب تکلیف":"هنوز تکلیفی ثبت نشده")+'</option>'+items.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===state.timer.activityId?"selected":"")+'>'+esc(x.title)+(x.subject?" · "+esc(x.subject):"")+'</option>').join("")+'</select></label>';
 }
 if(activity==="exam"){
  const items=allStudentExams().sort((a,b)=>a.date.localeCompare(b.date));
  return '<label class="timer-subject"><span>امتحان مورد نظر</span><select id="timerActivityTarget" '+(study?"":"disabled")+'><option value="">'+(items.length?"انتخاب امتحان":"هنوز امتحانی ثبت نشده")+'</option>'+items.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===state.timer.activityId?"selected":"")+'>'+esc(x.title)+(x.subject?" · "+esc(x.subject):"")+'</option>').join("")+'</select></label>';
 }
 return "";
}
function renderTimer(){
 const study=state.timer.mode==="study",activity=state.timer.activity||"study",r=state.timer.remaining;
 const target=timerTarget(),targetName=target?.title||"";
 const note=activity==="task"?"در این جلسه روی تکلیف "+(targetName?("«"+targetName+"»"):"انتخاب‌شده")+" تمرکز کن.":activity==="exam"?"برای امتحان "+(targetName?("«"+targetName+"»"):"انتخاب‌شده")+" آماده شو.":"در این جلسه فقط روی درس "+(state.timer.subject||"انتخاب درس")+" تمرکز کن.";
 return '<section class="timer-page"><div class="timer-top"><button data-page="home" aria-label="بازگشت">→</button><div><h1>تایمر مطالعه</h1><p>'+(study?"زمان تمرکز · ۲۵ دقیقه":"زمان استراحت · ۵ دقیقه")+'</p></div><button data-action="timer-reset" aria-label="تنظیم مجدد">↻</button></div><div class="timer-simple-card"><span class="timer-state '+(study?"study":"break")+'">'+(study?"در حال مطالعه":"زمان استراحت")+'</span><strong class="timer-digits" id="timerDigits" dir="ltr">'+fa(String(Math.floor(r/60)).padStart(2,"0")+":"+String(r%60).padStart(2,"0"))+'</strong><p class="timer-caption">'+(study?"با آرامش و تمرکز پیش برو":"کمی استراحت کن؛ بعد دوباره شروع می‌کنیم")+'</p><div class="timer-controls"><button class="timer-control secondary" data-action="timer-reset" aria-label="شروع مجدد">↺</button><button class="timer-control main" data-action="timer-toggle">'+(state.timer.running?"Ⅱ":"▶")+'</button><button class="timer-control secondary" data-action="timer-skip" aria-label="رفتن به مرحله بعد">»</button></div><div class="timer-control-labels"><span>از نو</span><span>'+(state.timer.running?"توقف":"شروع")+'</span><span>مرحله بعد</span></div>'+(study?'<div class="timer-save-row"><button class="timer-save-button" type="button" data-action="timer-save-study"><i data-lucide="check"></i> ثبت مدت مطالعه</button><p>زمان سپری‌شده در آمار و گزارش مطالعه ذخیره می‌شود.</p></div>':"")+'</div><div class="timer-settings"><label class="timer-subject"><span>نوع فعالیت</span><select id="timerActivity" '+(study?"":"disabled")+'><option value="study" '+(activity==="study"?"selected":"")+'>مطالعه آزاد</option><option value="task" '+(activity==="task"?"selected":"")+'>انجام تکلیف</option><option value="exam" '+(activity==="exam"?"selected":"")+'>آمادگی امتحان</option></select></label>'+timerTargetSelect()+'<label class="timer-subject"><span>درس</span><select id="timerSubject" '+(study?"":"disabled")+'>'+subjectOptions(state.timer.subject)+'</select></label></div><p class="timer-note">'+esc(study?note:"استراحت کوتاه بهت کمک می‌کنه برای دور بعد آماده بشی.")+'</p><div class="timer-saved-total"><span>مجموع زمان مطالعه ثبت‌شده</span><strong dir="ltr">'+studyTimeStamp(sumSessionSeconds(state.sessions))+'</strong></div><div class="timer-footer"><span>در پایان چرخه یا با دکمه «ثبت مدت مطالعه»، زمان مطالعه ذخیره می‌شود.</span><button data-page="stats">گزارش مطالعه</button></div></section>';
}

function isGradeTwelve(){return String(state.student?.grade||"").includes("دوازدهم")}
function konkuriaElapsed(){const f=state.konkuriaFocus;return Math.max(0,Math.floor((+f.seconds||0)+(f.running&&f.startedAt?(Date.now()-f.startedAt)/1000:0)))}
function konkuriaClock(n){const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return fa([h,m,s].map(x=>String(x).padStart(2,"0")).join(":"))}
function paintKonkuriaClock(){const el=$("#konkuriaClock");if(el)el.textContent=konkuriaClock(konkuriaElapsed())}
function renderKonkuria(){
 const f=state.konkuriaFocus,active=f.running||konkuriaElapsed()>0,groups={};
 state.sessions.forEach(x=>{const k=x.subject||"بدون درس";groups[k]=(groups[k]||0)+sessionSeconds(x)});
 const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]),total=sumSessionSeconds(state.sessions);
 const recent=[...state.sessions].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8);
 const subjectOptionsHtml=state.subjects.map(x=>'<option value="'+esc(x)+'" '+(x===f.subject?"selected":"")+'>'+esc(x)+'</option>').join("");
 return `<div class="page-heading"><div><p class="eyebrow">ویژه پایه دوازدهم</p><h1>کنکوریا</h1><p>مسیر مطالعه‌ات رو ببین و هر وقت آماده‌ای شروع کن.</p></div></div>
 <section class="konkuria-summary"><div><small>مجموع مطالعه ثبت‌شده</small><strong>${studyTimeStamp(total)}</strong></div><div><small>تعداد جلسه‌ها</small><strong>${fa(state.sessions.length)}</strong></div><div><small>بیشترین مطالعه</small><strong>${sorted.length?esc(sorted[0][0]):"—"}</strong><em>${sorted.length?studyTimeStamp(sorted[0][1]):"هنوز ثبت نشده"}</em></div></section>
 <section class="card panel konkuria-panel"><div class="section-title" style="margin-top:0"><div><h2>${active?"جلسه مطالعه":"شروع مطالعه"}</h2><p>${active?"هر وقت خواستی می‌تونی مکث کنی یا جلسه رو تموم کنی.":"درس مورد نظرت رو انتخاب کن."}</p></div></div>
 ${active?`<div class="konkuria-focus"><div class="focus-orbit"><div><small>در حال مطالعه</small><strong id="konkuriaClock">${konkuriaClock(konkuriaElapsed())}</strong><span>${esc(f.subject)}</span></div></div><div class="focus-actions">${f.running?'<button class="secondary-button" data-focus-action="pause">Ⅱ توقف موقت</button>':'<button class="primary-button" data-focus-action="resume">▶ ادامه مطالعه</button>'}<button class="danger-button" data-focus-action="stop">پایان و ثبت جلسه</button></div></div>`:`<div class="konkuria-start"><label class="field"><span>نام درس</span><select id="konkuriaSubject">${subjectOptionsHtml}</select></label><button class="primary-button full-button" data-focus-action="start">شروع مطالعه <span>←</span></button></div>`}
 </section>
 <section class="card panel konkuria-panel"><div class="section-title" style="margin-top:0"><div><h2>بیشترین مطالعه‌ها</h2><p>بر اساس مجموع زمان ثبت‌شده برای هر درس</p></div></div>${sorted.length?'<div class="konkuria-subject-list">'+sorted.map(([name,seconds])=>'<div class="konkuria-subject-row"><strong>'+esc(name)+'</strong><div class="konkuria-bar"><span style="width:'+Math.max(3,seconds/Math.max(1,sorted[0][1])*100)+'%"></span></div><small>'+studyTimeStamp(seconds)+'</small></div>').join("")+'</div>':empty("هنوز مطالعه‌ای ثبت نکردی","بعد از اولین جلسه، آمار درس‌ها اینجا نمایش داده می‌شه.","◷")}</section>
 <section class="card panel konkuria-panel"><div class="section-title" style="margin-top:0"><div><h2>مطالعه‌های قبلی</h2><p>آخرین جلسه‌های ثبت‌شده</p></div></div>${recent.length?'<div class="konkuria-history">'+recent.map(x=>'<div class="konkuria-history-row"><span class="history-dot"></span><div><strong>'+esc(x.subject||"بدون درس")+'</strong><small>'+fmt(x.date,{day:"numeric",month:"long"})+'</small></div><b>'+studyTimeStamp(sessionSeconds(x))+'</b></div>').join("")+'</div>':empty("هنوز جلسه‌ای نداری","اولین مطالعه‌ات رو شروع کن تا اینجا ذخیره بشه.","◷")}</section>`;
}
function startKonkuria(){const subject=$("#konkuriaSubject")?.value||state.subjects[0]||"مطالعه آزاد";state.konkuriaFocus={subject,seconds:0,running:true,startedAt:Date.now()};save();render();toast("جلسه مطالعه شروع شد.")}
function pauseKonkuria(){const f=state.konkuriaFocus;if(!f.running)return;f.seconds=konkuriaElapsed();f.running=false;f.startedAt=0;save();render();toast("مطالعه متوقف شد.")}
function resumeKonkuria(){const f=state.konkuriaFocus;if(!f.subject)return;f.running=true;f.startedAt=Date.now();save();render();toast("ادامه مطالعه شروع شد.")}
function stopKonkuria(){const f=state.konkuriaFocus,seconds=konkuriaElapsed();if(seconds<1){toast("مدت مطالعه هنوز ثبت‌کردنی نیست.");return}state.sessions.push({id:uid(),subject:f.subject,seconds,minutes:seconds/60,date:isoToday(),createdAt:Date.now(),activity:"study",activityTitle:"مطالعه کنکوریا"});state.konkuriaFocus={subject:"",seconds:0,running:false,startedAt:0};save();render();toast("جلسه مطالعه با موفقیت ثبت شد.")}

function renderPlan(){
 let list=state.plans.filter(p=>p.day===planDay&&activeSubject(p.subject)).sort((a,b)=>(a.time||"").localeCompare(b.time));
 return `${heading("برنامه‌ریز درسی","برنامه هفتگی‌ات رو بچین و قدم‌به‌قدم پیش برو.",'<button class="primary-button small-button" data-action="add-plan">＋ جلسه جدید</button>')}<div class="plan-week">${days.map((d,i)=>`<button class="day-chip ${i===planDay?"active":""}" data-plan-day="${i}"><small>${d}</small><strong>${i===(iranWeekDay()+1)%7?"امروز":["ش","ی","د","س","چ","پ","ج"][i]}</strong></button>`).join("")}</div><section class="card panel"><div class="section-title" style="margin-top:0"><div><h2>جلسه‌های ${days[planDay]}</h2><p>${fa(list.length)} جلسه برنامه‌ریزی‌شده</p></div></div>${list.length?list.map(p=>`<div class="schedule-item"><div class="schedule-time">${fa(p.time)}</div><div class="schedule-line"></div><div class="schedule-info"><strong>${esc(p.subject)}</strong><small>${esc(p.note||"زمان مطالعه")}</small></div><div class="row-actions"><span class="schedule-duration">${fa(p.duration)} دقیقه</span><button class="mini-icon-button delete" data-delete-plan="${p.id}">×</button></div></div>`).join(""):empty("هنوز جلسه‌ای برای این روز نداری","با دکمه «جلسه جدید» برنامه مطالعه‌ات رو بساز.","▦")}</section><section class="card panel" style="margin-top:15px"><div class="section-title" style="margin-top:0"><div><h2>شروع یک جلسه تمرکز</h2><p>با تایمر پومودورو زمان مطالعه‌ات رو ثبت کن.</p></div></div><button class="primary-button" data-page="timer">شروع تایمر ۲۵ دقیقه‌ای ←</button></section>`;
}
function renderTasks(){
 const tasks=allStudentTasks().sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
 const exams=allStudentExams().sort((a,b)=>a.date.localeCompare(b.date));
 const isExam=taskView==="exams";
 const buttons='<button type="button" role="tab" aria-selected="'+(!isExam)+'" class="'+(!isExam?"active":"")+'" data-work-tab="tasks"><i data-lucide="clipboard-check"></i> تکالیف <span>'+fa(tasks.length)+'</span></button><button type="button" role="tab" aria-selected="'+isExam+'" class="'+(isExam?"active":"")+'" data-work-tab="exams"><i data-lucide="graduation-cap"></i> امتحانات <span>'+fa(exams.length)+'</span></button>';
 const top=heading("تکالیف و امتحانات","برنامه‌های شخصی و ارسالی معلمان در یک صفحه.",'<button class="primary-button small-button" data-action="'+(isExam?"add-exam":"add-task")+'"><i data-lucide="plus"></i> '+(isExam?"امتحان جدید":"تکلیف جدید")+'</button>')+'<div class="work-main-tabs" role="tablist" aria-label="نوع فعالیت">'+buttons+'</div>'+schoolNotice();
 if(isExam){
  return top+'<div class="stats-grid work-exam-stats"><article class="card stat-card"><span class="stat-icon"><i data-lucide="calendar-check"></i></span><div><strong>'+fa(exams.filter(e=>e.date>=isoToday()).length)+'</strong><small>امتحان پیش رو</small></div></article><article class="card stat-card"><span class="stat-icon"><i data-lucide="calendar-days"></i></span><div><strong>'+fa(exams.filter(e=>e.date<isoToday()).length)+'</strong><small>امتحان گذشته</small></div></article></div><section class="card list-card">'+(exams.length?exams.map(e=>examRow(e,true)).join(""):empty("امتحانی ثبت نشده","می‌توانی امتحان شخصی اضافه کنی.","calendar-days"))+'</section>';
 }
 const filtered=tasks.filter(t=>taskFilter==="all"||(taskFilter==="pending"&&!t.done)||(taskFilter==="done"&&t.done));
 return top+'<div class="toolbar work-subfilter"><div class="filter-tabs"><button class="filter-tab '+(taskFilter==="all"?"active":"")+'" data-task-filter="all">همه ('+fa(tasks.length)+')</button><button class="filter-tab '+(taskFilter==="pending"?"active":"")+'" data-task-filter="pending">باقی‌مانده ('+fa(tasks.filter(t=>!t.done).length)+')</button><button class="filter-tab '+(taskFilter==="done"?"active":"")+'" data-task-filter="done">انجام‌شده ('+fa(tasks.filter(t=>t.done).length)+')</button></div></div><section class="card list-card">'+(filtered.length?filtered.map(t=>taskRow(t)).join(""):empty("تکلیفی برای نمایش نیست","تکلیف‌های شخصی و مدرسه اینجا دیده می‌شوند.","clipboard-check"))+'</section>';
}
function renderExams(){return renderTasks()}
function jalali(d){
 let ps=new Intl.DateTimeFormat("en-US-u-ca-persian",{year:"numeric",month:"numeric",day:"numeric",timeZone:IRAN_TZ}).formatToParts(d),g=k=>Number(ps.find(p=>p.type===k)?.value||0);
 return {y:g("year"),m:g("month"),d:g("day")};
}
function monthStartISO(s){
 let d=dateObj(s),p=jalali(d);
 for(let i=0;i<31;i++){let x=new Date(d);x.setUTCDate(x.getUTCDate()-1);let q=jalali(x);if(q.y!==p.y||q.m!==p.m)break;d=x}
 return isoFromDate(d);
}
function monthEndISO(s){
 let d=dateObj(s),p=jalali(d);
 for(let i=0;i<31;i++){let x=new Date(d);x.setUTCDate(x.getUTCDate()+1);let q=jalali(x);if(q.y!==p.y||q.m!==p.m)break;d=x}
 return isoFromDate(d);
}
function pickerMarkup(selected,anchor){
 let firstISO=monthStartISO(anchor),lastISO=monthEndISO(anchor),first=dateObj(firstISO),last=dateObj(lastISO);
 let label=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric",timeZone:IRAN_TZ}).format(first),cells=[];
 for(let i=0;i<(first.getUTCDay()+1)%7;i++)cells.push("<span></span>");
 for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1)){
  let iso=isoFromDate(d),day=jalali(d).d;
  cells.push('<button type="button" class="calendar-day '+(iso===isoToday()?"today ":"")+(iso===selected?"selected":"")+'" data-picker-date="'+iso+'">'+fa(day)+'</button>');
 }
 while(cells.length%7)cells.push("<span></span>");
 return '<div class="jalali-picker-head"><button type="button" data-picker-move="-1" aria-label="ماه قبل">→</button><strong>'+label+'</strong><button type="button" data-picker-move="1" aria-label="ماه بعد">←</button></div><div class="calendar-grid jalali-picker-grid">'+["ش","ی","د","س","چ","پ","ج"].map(x=>'<div class="calendar-weekday">'+x+'</div>').join("")+cells.join("")+'</div>';
}
function dateField(name,label,value=isoToday()){
 return window.STUNER_JALALI.field(name,label,value);
}
function updateDateField(field,value){
 window.STUNER_JALALI.setDate(field,value);
}
function moveDatePicker(field,delta){
 window.STUNER_JALALI.move(field,delta);
}

function renderCalendar(){
 let startISO=monthStartISO(calAnchor),endISO=monthEndISO(calAnchor),start=dateObj(startISO),end=dateObj(endISO);
 let label=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric",timeZone:IRAN_TZ}).format(start),cells=[],offset=(start.getUTCDay()+1)%7;
 for(let i=0;i<offset;i++)cells.push("<span></span>");
 for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
  let x=new Date(d),s=isoFromDate(x),n=jalali(x).d;
  cells.push('<button class="calendar-day '+(s===isoToday()?"today ":"")+(s===calSelected?"selected ":"")+([...state.tasks.filter(t=>activeSubject(t.subject)).map(t=>t.due),...state.exams.filter(e=>activeSubject(e.subject)).map(e=>e.date)].includes(s)?"has-event":"")+'" data-calendar-date="'+s+'">'+fa(n)+'</button>');
 }
 while(cells.length%7)cells.push("<span></span>");
 let events=[...state.tasks.filter(t=>activeSubject(t.subject)&&t.due===calSelected).map(t=>({title:t.title,sub:t.subject,kind:"تکلیف",done:t.done})),...state.exams.filter(e=>activeSubject(e.subject)&&e.date===calSelected).map(e=>({title:e.title,sub:e.subject,kind:"امتحان"}))];
 return heading("تقویم تحصیلی","تکالیف، امتحان‌ها و برنامه‌ات رو در یک نگاه دنبال کن.")+'<section class="card calendar-card"><div class="calendar-head"><button data-calendar-move="-1">→</button><strong>'+label+'</strong><button data-calendar-move="1">←</button></div><div class="calendar-grid">'+["ش","ی","د","س","چ","پ","ج"].map(x=>'<div class="calendar-weekday">'+x+'</div>').join("")+cells.join("")+'</div><div class="calendar-events"><div class="section-title" style="margin:0 0 9px"><div><h2>'+fmt(calSelected,{weekday:"long",day:"numeric",month:"long"})+'</h2><p>رویدادهای این روز</p></div><button class="text-button" data-action="add-task">＋ تکلیف</button></div>'+(events.length?events.map(e=>'<div class="exam-mini"><div class="stat-icon">'+(e.kind==="امتحان"?"♜":"☑")+'</div><div class="exam-mini-main"><strong>'+esc(e.title)+'</strong><small>'+esc(e.sub||"")+'</small></div><span class="pill gray">'+e.kind+'</span></div>').join(""):empty("رویدادی ثبت نشده","برای این روز تکلیف یا امتحانی نداری.","◷"))+'</div></section>';
}
function renderStats(){
 let visibleGrades=state.grades.filter(g=>activeSubject(g.subject)),visibleSessions=state.sessions,visibleTasks=state.tasks.filter(t=>activeSubject(t.subject));let avg=visibleGrades.length?visibleGrades.reduce((a,g)=>a+(+g.score),0)/visibleGrades.length:null,mins=visibleSessions.reduce((a,x)=>a+(+x.minutes||0),0),rows=[...new Set([...state.subjects,...visibleSessions.map(x=>x.subject).filter(Boolean)])].map(s=>{let gs=visibleGrades.filter(g=>g.subject===s),score=gs.length?gs.reduce((a,g)=>a+ +g.score,0)/gs.length:null,study=visibleSessions.filter(x=>x.subject===s).reduce((a,x)=>a+(+x.minutes||0),0);return {s,score,study}}).filter(x=>x.score!==null||x.study);
 return `${heading("آمار و کارنامه","پیشرفتت رو ببین و برای قدم بعدی انگیزه بگیر.",'<button class="primary-button small-button" data-action="add-grade">＋ ثبت نمره</button>')}<div class="grade-summary"><div><small>میانگین نمرات ثبت‌شده</small><strong>${avg===null?"—":fa(avg.toFixed(2))}</strong><em>${avg===null?"هنوز نمره‌ای ثبت نشده":avg>=18?"عالیه، همین‌طور ادامه بده":avg>=15?"روندت خوبه، ادامه بده":"با برنامه‌ریزی می‌تونی بهتر بشی"}</em></div><div class="grade-badge">★</div></div><div class="stats-grid"><article class="card stat-card"><span class="stat-icon">◷</span><div><strong>${fa((mins/60).toFixed(1))}</strong><small>ساعت مطالعه</small></div></article><article class="card stat-card"><span class="stat-icon">✓</span><div><strong>${fa(visibleTasks.filter(t=>t.done).length)}</strong><small>تکلیف انجام‌شده</small></div></article></div><section class="card panel" style="margin-top:16px"><div class="section-title" style="margin-top:0"><div><h2>عملکرد درس‌ها</h2><p>میانگین نمره و زمان مطالعه هر درس</p></div></div>${rows.length?`<div class="grade-list">${rows.map(x=>`<div class="grade-row"><strong>${esc(x.s)}</strong><div class="grade-track"><span style="width:${x.score===null?Math.min(100,x.study/120*100):Math.min(100,x.score/20*100)}%"></span></div><small>${x.score===null?shortStudyTime(x.study):fa(x.score.toFixed(1))}</small></div>`).join("")}</div>`:empty("هنوز داده‌ای برای تحلیل نداریم","بعد از ثبت نمره یا زمان مطالعه، گزارش اینجا نمایش داده می‌شه.","▥")}</section><section class="card panel" style="margin-top:15px"><div class="section-title" style="margin-top:0"><div><h2>نمرات دروس</h2><p>نمره‌های ثبت‌شده خودت</p></div><button class="text-button" data-action="add-grade">＋ افزودن نمره</button></div>${visibleGrades.length?visibleGrades.slice().sort((a,b)=>b.createdAt-a.createdAt).map(g=>`<div class="task-row"><div class="stat-icon">✎</div><div class="task-main"><strong>${esc(g.subject)}</strong><small>${esc(g.title||"نمره ثبت‌شده")} · ${fmt(g.date,{day:"numeric",month:"short"})}</small></div><strong>${fa(g.score)}</strong><button class="mini-icon-button delete" data-delete-grade="${g.id}">×</button></div>`).join(""):empty("نمره‌ای ثبت نشده","نمره‌های امتحان‌هات رو وارد کن تا میانگینت محاسبه بشه.","★")}</section>`;
}
function renderMore(){return `${heading("تنظیمات","رنگ‌بندی برنامه، یادآوری‌ها و ابزارهای بیشتر.")}${renderThemePicker()}<div class="more-grid"><button class="more-tile" data-page="books"><span class="tile-icon">▤</span><span><strong>کتابخانه درسی</strong><small>کتاب‌های پایه و رشته خودت</small></span></button><button class="more-tile" data-page="exams"><span class="tile-icon">♜</span><span><strong>امتحانات</strong><small>تاریخ و مهلت آزمون‌ها</small></span></button><button class="more-tile" data-page="calendar"><span class="tile-icon">▣</span><span><strong>تقویم</strong><small>نمای روزانه و ماهانه</small></span></button><button class="more-tile" data-page="stats"><span class="tile-icon">▥</span><span><strong>نمرات و کارنامه</strong><small>معدل و عملکرد دروس</small></span></button><button class="more-tile" data-page="profile"><span class="tile-icon">◉</span><span><strong>پروفایل دانش‌آموز</strong><small>مشخصات شخصی و تحصیلی</small></span></button></div><section class="card panel" style="margin-top:16px"><div class="section-title" style="margin-top:0"><div><h2>یادآوری‌ها</h2><p>اعلان‌های تکالیف و زمان مطالعه</p></div></div><div class="settings-row"><div><strong>اعلان تکالیف امروز</strong><small>یادآوری کارهایی که مهلتشان امروز است</small></div><input class="switch" type="checkbox" data-pref="notifyTasks" ${state.preferences.notifyTasks?"checked":""}></div><div class="settings-row"><div><strong>اعلان‌های تایمر مطالعه</strong><small>پایان زمان مطالعه و استراحت</small></div><input class="switch" type="checkbox" data-pref="notifyStudy" ${state.preferences.notifyStudy?"checked":""}></div><div class="settings-row"><div><strong>یادآوری استراحت</strong><small>اعلان پایان زمان استراحت</small></div><input class="switch" type="checkbox" data-pref="notifyBreak" ${state.preferences.notifyBreak?"checked":""}></div><div class="settings-row"><div><strong>زمان یادآوری تکالیف</strong><small>یادآوری تکالیف امروز و فردا</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۰۸:۰۰" data-pref-time="taskReminderTime" value="${fa(state.preferences.taskReminderTime||"08:00")}"></div><div class="settings-row"><div><strong>زمان پیشنهادی مطالعه</strong><small>یادآوری روزانه برای شروع مطالعه</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۱۶:۰۰" data-pref-time="studyReminderTime" value="${fa(state.preferences.studyReminderTime||"16:00")}"></div><button class="secondary-button small-button" style="margin-top:14px" data-action="enable-notifications">فعال‌سازی اعلان‌های گوشی</button></section>`}
function officialBookUrl(value){
 const raw=String(value||"").trim(),official="http://chap.oerp.ir/";
 if(!raw)return official;
 try{
  const url=new URL(raw,official),host=url.hostname.toLowerCase();
  if(["chap.sch.ir","www.chap.sch.ir","chap.oerp.ir","www.chap.oerp.ir"].includes(host)){
   url.hostname="chap.oerp.ir";
   url.protocol="http:";
  }
  if(url.protocol!=="http:"&&url.protocol!=="https:")return official;
  return url.href;
 }catch{return official}
}
function bookQuestionsUrl(title){
 const name=String(title||"").replace(/[\\u200c\\u200f]/g,"").replace(/\\s+/g,"");
 const links=[
  ["هویتا جتماعی","230"],["هویتاجتماعی","230"],
  ["مدیریتخانواده","303"],["سلامتبهداشت","302"],["سلامتوب هداشت","302"],
  ["اخلاقحرفه","300"],["عربی","297"],["ریاضی","299"],
  ["دانشفنیتخصصی","236"],["تجهیزاتشبکه","237"],["تجارتالکترونیک","238"],
  ["فارسی","203"],["آمادگیدفاعی","304"],["دینوزندگی","298"]
 ];
 const key=links.find(([word])=>name.includes(word));
 return key?'https://www.kanoon.ir/Public/ExamQuestions?group=12&lesson='+key[1]:'';
}
function renderBooks(){
 const books=studentBooks(),student=state.student;
 const cards=books.length?books.map(b=>{
  const direct=!!b.pdfUrl,downloadUrl=officialBookUrl(b.pdfUrl||b.url),bookPageUrl=officialBookUrl(b.url);
  return '<article class="card panel book-card"><span class="pill">کد کتاب: '+esc(b.code||"ثبت نشده")+'</span><strong>'+esc(b.title)+'</strong><small class="book-meta">پایه '+esc(b.grade)+' · چاپ '+esc(CURRICULUM.academicYear)+'</small><a class="primary-button small-button book-download" href="'+esc(downloadUrl)+'" '+'target="_blank" rel="noopener noreferrer"'+'>' +(direct?'↓ دانلود PDF کتاب':'دریافت PDF از پایگاه رسمی')+'</a>'+(direct?'':'<small class="book-meta">برای دریافت فایل، صفحه رسمی کتاب باز می‌شود.</small>')+'<a class="secondary-button small-button" href="'+esc(bookPageUrl)+'" target="_blank" rel="noopener noreferrer">مشاهده مشخصات کتاب ↗</a>'+(bookQuestionsUrl(b.title)?'<a class="secondary-button small-button" href="'+esc(bookQuestionsUrl(b.title))+'" target="_blank" rel="noopener noreferrer">نمونه سؤال‌های کتاب ↗</a>':'')+'</article>';
 }).join(""):empty("کتابی برای این انتخاب پیدا نشد","برای این پایه و رشته در فهرست چاپ سال جاری کتاب ثبت نشده است. مشخصات تحصیلی را بررسی کن یا فهرست رسمی را ببین.","▤");
 const trackLine=student.educationLevel==="secondary"?(student.track+" · "+(student.fieldGroup?student.fieldGroup+" · ":"")+student.major):student.grade;
 return heading("کتابخانه درسی","کتاب‌های رسمی متناسب با پایه و رشته خودت.")+'<section class="card panel" style="margin-bottom:15px"><strong>'+esc(trackLine)+'</strong><p class="book-meta">سال تحصیلی '+esc(CURRICULUM.academicYear)+' · منبع: پایگاه رسمی کتاب‌های درسی</p></section><div class="section-title"><div><h2>کتاب‌های رسمی در chap.oerp.ir</h2><p>'+fa(books.length)+' کتاب رسمی برای این پایه و رشته</p></div></div><div class="dashboard-grid">'+cards+'</div>';
}
function renderInlineProfileEditor(){
 const s=state.student||{},username=window.STUNER_STUDENT_ACCOUNT?.username||s.username||"";
 return '<section class="card panel profile-inline-editor" id="profileEditBox" aria-label="ویرایش اطلاعات شخصی"><div class="section-title"><div><h2><i data-lucide="pen-line"></i> ویرایش مشخصات شخصی</h2><p>اطلاعات تحصیلی توسط مدرسه تعیین می‌شود و قابل تغییر نیست.</p></div></div>'+
 '<form id="profileForm" class="profile-inline-form"><div class="field-row"><label class="field"><span>نام</span><input name="firstName" autocomplete="given-name" value="'+esc(s.firstName||"")+'" minlength="2" maxlength="40" required></label><label class="field"><span>نام خانوادگی</span><input name="lastName" autocomplete="family-name" value="'+esc(s.lastName||"")+'" minlength="2" maxlength="60" required></label></div>'+
 '<div class="field-row"><label class="field"><span>سن</span><input name="age" type="number" inputmode="numeric" min="6" max="30" value="'+esc(s.age||"")+'" required></label><label class="field"><span>آیدی (نام کاربری ورود)</span><input name="username" dir="ltr" autocapitalize="off" spellcheck="false" autocomplete="username" value="'+esc(username)+'" pattern="(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})" minlength="4" maxlength="32" required></label></div>'+
 '<p class="profile-inline-help">آیدی می‌تواند ۱۰ رقم یا یک نام کاربری لاتین معتبر باشد. در صورت تغییر، برای ورود بعدی از آیدی جدید استفاده کن.</p>'+
 '<p class="form-error" id="profileEditMessage" role="status" aria-live="polite"></p><div class="profile-edit-actions"><button class="primary-button" type="submit"><i data-lucide="check"></i> ذخیره تغییرات</button><button class="secondary-button" type="button" data-action="cancel-profile-edit">انصراف</button></div></form></section>';
}
function applyStudentTheme(){
 const app=$("#app");if(!app)return;
 const chosen=THEME_PALETTES.find(x=>x.name===state.preferences.theme)||THEME_PALETTES[0];
 const rgb=c=>{const h=c.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)].join(",")};
 const vars={"--green-950":chosen.dark,"--green-900":chosen.dark,"--green-800":chosen.main,"--green-700":chosen.main,"--green-600":chosen.main,"--green-500":chosen.main,"--mint-100":chosen.light,"--mint-150":chosen.light,"--mint-200":chosen.soft,"--mint-300":chosen.soft,"--bg":chosen.light,"--muted":"#6f7b88","--theme-rgb":rgb(chosen.main),"--theme-dark-rgb":rgb(chosen.dark),"--ink":chosen.dark,"--line":chosen.soft,"--shadow":"0 12px 32px rgba("+rgb(chosen.main)+",.07)","--shadow-soft":"0 5px 18px rgba("+rgb(chosen.main)+",.055)"};
 // Modal and toast roots are siblings of #app; applying variables to #app alone
 // left task/exam forms using the default green palette.
 [app,$("#modalRoot"),$("#toastRoot"),$("#stunerSplash"),$("#onboarding")].filter(Boolean).forEach(node=>{
  Object.entries(vars).forEach(([k,v])=>node.style.setProperty(k,v));
 });
 app.style.backgroundColor=chosen.light;
 document.body.style.backgroundColor=chosen.light;
 const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.setAttribute("content",chosen.main);
}
function renderThemePicker(){
 const active=state.preferences.theme||"سبز جنگلی";
 return '<section class="card panel theme-panel"><div class="section-title" style="margin-top:0"><div><h2>رنگ‌بندی استیونر</h2><p>تم دلخواهت رو انتخاب کن؛ این تغییر فقط در پنل دانش‌آموز اعمال می‌شه.</p></div></div><div class="theme-swatches">'+THEME_PALETTES.map(x=>'<button type="button" class="theme-swatch '+(x.name===active?"selected":"")+'" data-theme="'+esc(x.name)+'" aria-label="انتخاب تم '+esc(x.name)+'" aria-pressed="'+(x.name===active)+'"><span style="--swatch:'+x.main+';--swatch-light:'+x.light+'"><i data-lucide="check"></i></span><small>'+esc(x.name)+'</small></button>').join("")+'</div></section>';
}
function renderProfile(){
 let s=state.student,level=s.educationLevel||inferEducationLevel(s.grade||""),isSecondary=level==="secondary";
 let levelLabel=level==="elementary"?"ابتدایی":level==="middle"?"متوسطه اول":"متوسطه دوم";
 let trackLine=isSecondary?[s.track,s.fieldGroup,s.major].filter(Boolean).join(" · "):levelLabel;
 let academicFields=isSecondary?'<div class="data-box"><small>شاخه</small><strong>'+esc(s.track||"—")+'</strong></div>'+(s.fieldGroup?'<div class="data-box"><small>زمینه</small><strong>'+esc(s.fieldGroup)+'</strong></div>':'')+'<div class="data-box"><small>رشته</small><strong>'+esc(s.major||"—")+'</strong></div>':"";
 return `${heading("پروفایل دانش‌آموز","مشخصات شخصی و تحصیلی‌ات را مشاهده و ویرایش کن.",'<button class="secondary-button small-button" data-action="edit-profile">'+(editingProfile?"بستن ویرایش":"ویرایش مشخصات")+'</button>')}<section class="profile-hero"><div><h2>${esc(s.firstName+" "+s.lastName)}</h2><p>${esc(s.grade)}${s.age?" · "+fa(s.age)+" ساله":""}</p><span class="pill" style="margin-top:9px">${esc(trackLine)}</span></div></section>${editingProfile?renderInlineProfileEditor():""}<div class="profile-data"><div class="data-box"><small>نام</small><strong>${esc(s.firstName)}</strong></div><div class="data-box"><small>نام خانوادگی</small><strong>${esc(s.lastName)}</strong></div><div class="data-box"><small>پایه تحصیلی</small><strong>${esc(s.grade)}</strong></div><div class="data-box"><small>سن</small><strong>${s.age?fa(s.age)+" سال":"ثبت نشده"}</strong></div><div class="data-box"><small>آیدی (نام کاربری)</small><strong dir="ltr">${esc(window.STUNER_STUDENT_ACCOUNT?.username||s.username||"—")}</strong></div>${academicFields}</div>${managed?(window.STUNER_SCHOOL_WORK?.renderTeachers?.()||""):""}<p style="text-align:center;color:#a1ada5;font-size:10px;margin-top:22px">STUNER · نسخه آزمایشی ۰.۲</p>`;
}
function ensureStudentHeader(){
 // Fix the old header even when a previously cached index.html is displayed.
 const settings=document.getElementById("notificationButton");
 if(settings&&!settings.dataset.stunerSettings){
  settings.dataset.stunerSettings="1";
  settings.classList.remove("notification-button");
  settings.classList.add("settings-button");
  settings.setAttribute("aria-label","تنظیمات و امکانات بیشتر");
  settings.setAttribute("title","تنظیمات و امکانات بیشتر");
  settings.innerHTML='<i data-lucide="settings"></i>';
 }
 document.getElementById("topAvatar")?.remove();
}
function render(){
 let app=$("#app"),on=$("#onboarding");
 if(!cloudLoaded){
  app.style.display="";on.hidden=true;
  $("#mainContent").innerHTML='<section class="card panel"><h2>اطلاعات حساب دانش‌آموز</h2><p>'+esc(cloudFailure||"در حال دریافت اطلاعات از دیتابیس استیونر…")+'</p><button class="primary-button" type="button" data-cloud-retry>تلاش مجدد</button></section>';
  return;
 }
 if(!profileIsReady(state.student)){
  if(managed){app.style.display="";on.hidden=true;$("#mainContent").innerHTML='<section class="card panel"><h2>اطلاعات تحصیلی ناقص است</h2><p>برای تکمیل پایه یا رشته تحصیلی، با مدیر مدرسه تماس بگیر. تغییر این اطلاعات از حساب دانش‌آموز مجاز نیست.</p></section>';return}
  app.style.display="none";on.hidden=false;populateStudentForm();return;
 }
 app.style.display="";on.hidden=true;applyStudentTheme();ensureStudentHeader();
 let views={home:renderHome,konkuria:renderKonkuria,plan:renderPlan,timer:renderTimer,tasks:renderTasks,exams:renderExams,calendar:renderCalendar,stats:renderStats,more:renderMore,profile:renderProfile,books:renderBooks};
 $("#mainContent").innerHTML=(views[page]||renderHome)();
 document.querySelectorAll(".sidebar [data-page], .bottom-nav [data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 const konkNav=document.querySelector(".bottom-item[data-page=konkuria]");if(konkNav)konkNav.hidden=!isGradeTwelve();document.querySelector(".bottom-nav")?.classList.toggle("has-konkuria",isGradeTwelve());
 window.STUNER_ICONS?.refresh?.();
 if(state.timer.running){tickerStart();paintTimer()}else if(ticker){clearInterval(ticker);ticker=null}
 if(page==="konkuria"&&state.konkuriaFocus.running){if(!konkuriaTicker)konkuriaTicker=setInterval(paintKonkuriaClock,250);paintKonkuriaClock()}else if(konkuriaTicker){clearInterval(konkuriaTicker);konkuriaTicker=null}
}
function openModal(title,body){$("#modalRoot").innerHTML=`<div class="modal-backdrop" data-modal-backdrop><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="close-button" data-close-modal>×</button></div>${body}</section></div>`;let f=$("input,select,textarea",$("#modalRoot"));if(f)setTimeout(()=>f.focus(),50)}
function closeModal(){$("#modalRoot").innerHTML=""}

function taskModal(initialDue=isoToday()){openModal("افزودن تکلیف جدید",`<form id="taskForm" class="modal-form"><label class="field"><span>عنوان تکلیف</span><input name="title" placeholder="مثلاً حل تمرین‌های ریاضی" required maxlength="90"></label><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label>${dateField("due","مهلت تحویل",initialDue)}<label class="field"><span>توضیحات (اختیاری)</span><textarea name="note" placeholder="جزئیات تکلیف..."></textarea></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت تکلیف</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function examModal(initialDate=isoAdd(3)){openModal("افزودن امتحان",`<form id="examForm" class="modal-form"><label class="field"><span>عنوان امتحان</span><input name="title" placeholder="مثلاً آزمون فصل دوم" required maxlength="90"></label><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label>${dateField("date","تاریخ امتحان",initialDate)}<label class="field"><span>توضیحات (اختیاری)</span><textarea name="note" placeholder="محدوده امتحان یا نکته مهم..."></textarea></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت امتحان</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function planModal(){openModal("افزودن جلسه مطالعه",`<form id="planForm" class="modal-form"><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label><label class="field"><span>روز هفته</span><select name="day">${days.map((d,i)=>`<option value="${i}" ${i===planDay?"selected":""}>${d}</option>`).join("")}</select></label><div class="field-row"><label class="field"><span>ساعت شروع</span><input name="time" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۱۶:۰۰" value="۱۶:۰۰" required></label><label class="field"><span>مدت (دقیقه)</span><input name="duration" type="number" min="5" max="300" step="5" value="45" required></label></div><label class="field"><span>توضیح (اختیاری)</span><input name="note" placeholder="مثلاً مرور فصل سوم"></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت جلسه</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function gradeModal(){openModal("ثبت نمره جدید",`<form id="gradeForm" class="modal-form"><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label><label class="field"><span>عنوان آزمون یا فعالیت</span><input name="title" placeholder="مثلاً امتحان میان‌ترم"></label><div class="field-row"><label class="field"><span>نمره از ۲۰</span><input name="score" type="number" min="0" max="20" step=".25" placeholder="مثلاً ۱۸.۵" required></label>${dateField("date","تاریخ")}</div><div class="modal-actions"><button class="primary-button" type="submit">ثبت نمره</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function go(p){if(p==="exams"){taskView="exams";page="tasks"}else{page=p;if(p==="tasks")taskView="tasks"}render();window.scrollTo({top:0,behavior:"smooth"})}
function remove(key,id){state[key]=state[key].filter(x=>x.id!==id);save();render();toast("حذف شد؛ در حال ذخیره در حساب…")}
function notify(title,body){if(!("Notification"in window)||Notification.permission!=="granted")return;try{if("serviceWorker"in navigator&&navigator.serviceWorker.controller)navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body,icon:"./icon.svg",dir:"rtl",lang:"fa"})).catch(()=>new Notification(title,{body,dir:"rtl"}));else new Notification(title,{body,dir:"rtl",lang:"fa"})}catch{}}
async function enableNotifications(){if(!("Notification"in window)){toast("این مرورگر از اعلان گوشی پشتیبانی نمی‌کند.");return}let p=await Notification.requestPermission();toast(p==="granted"?"اعلان‌ها فعال شدند.":"اجازه اعلان‌ها داده نشد.");if(p==="granted")notify("استیونر آماده است","یادآوری‌های درسی‌ات فعال شدند.")}
function reminderCheck(){if(!("Notification"in window)||Notification.permission!=="granted")return;let clock=iranClock();if(state.preferences.notifyTasks&&clock>=(state.preferences.taskReminderTime||"08:00")){let key="stuner.remind.tasks."+isoToday();if(!sessionStorage.getItem(key)){let today=state.tasks.filter(x=>activeSubject(x.subject)&&x.due===isoToday()&&!x.done),tomorrow=state.tasks.filter(x=>activeSubject(x.subject)&&x.due===isoAdd(1)&&!x.done);if(today.length||tomorrow.length){notify("یادآوری تکالیف استیونر",`${fa(today.length)} تکلیف برای امروز و ${fa(tomorrow.length)} تکلیف برای فردا داری.`);sessionStorage.setItem(key,"1")}}}if(state.preferences.notifyStudy&&clock>=(state.preferences.studyReminderTime||"16:00")){let key="stuner.remind.study."+isoToday();if(!sessionStorage.getItem(key)){notify("وقت مطالعه در استیونر", "زمان پیشنهادی مطالعه‌ات رسیده؛ یک جلسه ۲۵ دقیقه‌ای شروع کن.");sessionStorage.setItem(key,"1")}}}
function duration(){return state.timer.mode==="study"?1500:300}
function paintTimer(){if(page!=="timer")return;let r=state.timer.remaining,digits=$("#timerDigits");if(digits)digits.textContent=fa(String(Math.floor(r/60)).padStart(2,"0")+":"+String(r%60).padStart(2,"0"))}
function timerTick(){
 if(!state.timer.running||!deadline)return;
 state.timer.remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
 paintTimer();
 if(state.timer.remaining<=0)timerComplete();
}
function tickerStart(){
 if(!state.timer.running)return;
 if(!deadline)deadline=Date.now()+state.timer.remaining*1000;
 if(ticker){timerTick();return}
 timerTick();
 ticker=setInterval(timerTick,100);
}
function timerStart(){
 if(state.timer.running)return;
 if(state.timer.mode==="study"&&state.timer.activity==="task"&&!timerTarget()){toast("ابتدا تکلیف مورد نظرت را انتخاب کن.");return}
 if(state.timer.mode==="study"&&state.timer.activity==="exam"&&!timerTarget()){toast("ابتدا امتحان مورد نظرت را انتخاب کن.");return}
 if(state.timer.remaining<=0)state.timer.remaining=duration();
 state.timer.running=true;deadline=Date.now()+state.timer.remaining*1000;save();render();toast(state.timer.mode==="study"?"زمان تمرکز شروع شد.":"استراحت شروع شد.");
}
function timerPause(){if(!state.timer.running)return;state.timer.remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));state.timer.running=false;deadline=null;if(ticker)clearInterval(ticker);ticker=null;save();render()}
function timerReset(){state.timer.running=false;state.timer.remaining=duration();deadline=null;if(ticker)clearInterval(ticker);ticker=null;save();render();toast("تایمر به زمان اولیه برگشت.")}
function startTimerForTask(id){let x=allStudentTasks().find(t=>t.id===id&&!t.done);if(!x){toast("این تکلیف در فهرست باقی‌مانده‌ها نیست.");return}if(state.timer.running)timerPause();state.timer.activity="task";state.timer.activityId=id;state.timer.subject=x.subject||state.timer.subject;state.timer.mode="study";state.timer.remaining=1500;page="timer";save();render();timerStart()}
function startTimerForExam(id){let x=allStudentExams().find(t=>t.id===id);if(!x){toast("امتحان مورد نظر پیدا نشد.");return}if(state.timer.running)timerPause();state.timer.activity="exam";state.timer.activityId=id;state.timer.subject=x.subject||state.timer.subject;state.timer.mode="study";state.timer.remaining=1500;page="timer";save();render();timerStart()}
function registerStudyDuration(){
 if(state.timer.mode!=="study"){toast("ثبت مطالعه فقط در حالت تمرکز امکان‌پذیر است.");return}
 const currentRemaining=state.timer.running&&deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):state.timer.remaining;
 if(currentRemaining<=0&&state.timer.running){timerComplete();return}
 const seconds=Math.max(0,Math.min(1500,1500-currentRemaining));
 if(seconds<1){toast("ابتدا تایمر را شروع کن تا مدت مطالعه ثبت شود.");return}
 const activity=state.timer.activity||"study",target=timerTarget();
 if(ticker)clearInterval(ticker);ticker=null;deadline=null;state.timer.running=false;
 state.sessions.push({
  id:uid(),subject:state.timer.subject,
  minutes:seconds/60,seconds,date:isoToday(),createdAt:Date.now(),manual:true,
  activity,activityId:state.timer.activityId||"",
  activityTitle:target?.title||(activity==="exam"?"آمادگی امتحان":activity==="task"?"انجام تکلیف":"مطالعه آزاد")
 });
 state.timer.remaining=1500;
 save();render();
 toast("مدت مطالعه "+shortStudyTime(seconds/60)+" در حال ذخیره در حساب است.");
}
function timerComplete(){
 if(ticker)clearInterval(ticker);ticker=null;deadline=null;
 let study=state.timer.mode==="study";
 if(study){
  let activity=state.timer.activity||"study",target=timerTarget();
  state.sessions.push({id:uid(),subject:state.timer.subject,minutes:25,seconds:1500,date:isoToday(),createdAt:Date.now(),activity,activityId:state.timer.activityId||"",activityTitle:target?.title||(activity==="exam"?"آمادگی امتحان":activity==="task"?"انجام تکلیف":"مطالعه آزاد")});
  state.timer.mode="break";state.timer.remaining=300;
  if(state.preferences.notifyStudy)notify("آفرین! زمان تمرکز تموم شد.","۲۵ دقیقه فعالیت ثبت شد. حالا ۵ دقیقه استراحت کن.");
  toast("۲۵ دقیقه فعالیت ثبت شد؛ وقت استراحته!");
 }else{
  state.timer.mode="study";state.timer.remaining=1500;
  if(state.preferences.notifyBreak)notify("استراحت تموم شد","آماده‌ای یک جلسه تمرکز دیگه شروع کنی؟");
  toast("استراحت تموم شد؛ برای دور بعد آماده‌ای؟");
 }
 state.timer.running=false;save();render();
}
function timerSkip(){if(state.timer.running)state.timer.remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));if(ticker)clearInterval(ticker);ticker=null;deadline=null;state.timer.mode=state.timer.mode==="study"?"break":"study";state.timer.remaining=duration();state.timer.running=false;save();render()}

document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.timer.running)timerTick()});
$("#onboardingForm").addEventListener("submit",e=>{e.preventDefault();if(managed){toast("پایه و رشته را فقط مدیر مدرسه تغییر می‌دهد.");render();return;}let d=new FormData(e.currentTarget),f=String(d.get("firstName")||"").trim(),l=String(d.get("lastName")||"").trim(),a=Number(d.get("age")),level=d.get("educationLevel"),grade=d.get("grade"),track=d.get("track")||"",fieldGroup=d.get("fieldGroup")||"",major=d.get("major")||"";if(!f||!l||a<6||a>30||!level||!grade||(level==="secondary"&&(!track||!major||(track!=="نظری"&&!fieldGroup)))){$("#onboardingError").textContent="لطفاً دوره، پایه و رشته تحصیلی را کامل انتخاب کن.";return}state.student={...(state.student||{}),firstName:f,lastName:l,age:a,educationLevel:level,grade,track:level==="secondary"?track:"",fieldGroup:level==="secondary"&&track!=="نظری"?fieldGroup:"",major:level==="secondary"?major:""};syncStudentSubjects();state.timer.subject=state.subjects[0]||"";save();page="home";render();toast(`اطلاعات تحصیلی ذخیره شد، ${f}!`)});
document.addEventListener("click",e=>{
 if(e.target.closest("[data-cloud-retry]")){if(!cloudLoaded)bootCloud();else if(cloudStore?.isDirty())cloudStore.flush();else if(!state.timer.running&&!state.konkuriaFocus.running)cloudStore?.refresh();else toast("ابتدا مطالعه فعال را متوقف کن تا اطلاعات بازخوانی شود.");return}
 if(!cloudLoaded)return;
 let themeChoice=e.target.closest("[data-theme]")?.dataset.theme;if(themeChoice){state.preferences.theme=themeChoice;save();applyStudentTheme();render();toast("تم رنگی استیونر تغییر کرد.");return}
 let focusAction=e.target.closest("[data-focus-action]")?.dataset.focusAction;if(focusAction){if(focusAction==="start")startKonkuria();else if(focusAction==="pause")pauseKonkuria();else if(focusAction==="resume")resumeKonkuria();else if(focusAction==="stop")stopKonkuria();return}
 let p=e.target.closest("[data-page]");if(p){e.preventDefault();go(p.dataset.page);return}
 let a=e.target.closest("[data-action]")?.dataset.action;if(a){if(a==="timer-toggle"){state.timer.running?timerPause():timerStart();return}({"add-task":taskModal,"add-exam":examModal,"add-task-tomorrow":()=>taskModal(isoAdd(1)),"add-exam-tomorrow":()=>examModal(isoAdd(1)),"add-plan":planModal,"add-grade":gradeModal,"edit-profile":()=>{editingProfile=!editingProfile;render();if(editingProfile)document.getElementById("profileEditBox")?.scrollIntoView({behavior:"smooth",block:"nearest"})},"cancel-profile-edit":()=>{editingProfile=false;render()},"enable-notifications":enableNotifications,"timer-reset":timerReset,"timer-skip":timerSkip,"timer-save-study":registerStudyDuration})[a]?.();return}
  let startTask=e.target.closest("[data-start-task-timer]");if(startTask){startTimerForTask(startTask.dataset.startTaskTimer);return}
  let startExam=e.target.closest("[data-start-exam-timer]");if(startExam){startTimerForExam(startExam.dataset.startExamTimer);return}
  let quick=e.target.closest("[data-date-quick]");if(quick){let field=quick.closest("[data-jalali-field]");if(field)updateDateField(field,isoAdd(Number(quick.dataset.dateQuick)));return}
  let pickerMove=e.target.closest("[data-picker-move]");if(pickerMove){let field=pickerMove.closest("[data-jalali-field]");if(field)moveDatePicker(field,Number(pickerMove.dataset.pickerMove));return}
  let pickerDate=e.target.closest("[data-picker-date]");if(pickerDate){let field=pickerDate.closest("[data-jalali-field]");if(field)updateDateField(field,pickerDate.dataset.pickerDate);return}
 if(e.target.closest("[data-close-modal]")||e.target.matches("[data-modal-backdrop]")){closeModal();return}
 let t=e.target.closest("[data-toggle-task]");if(t){let x=state.tasks.find(z=>z.id===t.dataset.toggleTask);if(x){x.done=!x.done;save();render();toast(x.done?"آفرین! تکلیف انجام‌شده ثبت شد.":"وضعیت تکلیف تغییر کرد.")}return}
 for(let [attr,key] of [["data-delete-task","tasks"],["data-delete-exam","exams"],["data-delete-plan","plans"],["data-delete-grade","grades"]]){let x=e.target.closest("["+attr+"]");if(x){remove(key,x.getAttribute(attr));return}}
 let workTab=e.target.closest("[data-work-tab]");if(workTab){taskView=workTab.dataset.workTab;page="tasks";taskFilter="all";render();return}
 let filter=e.target.closest("[data-task-filter]");if(filter){taskFilter=filter.dataset.taskFilter;render();return}
 let day=e.target.closest("[data-plan-day]");if(day){planDay=+day.dataset.planDay;render();return}
 let cal=e.target.closest("[data-calendar-date]");if(cal){calSelected=cal.dataset.calendarDate;render();return}
 let move=e.target.closest("[data-calendar-move]");if(move){let d=dateObj(monthStartISO(calAnchor));d.setUTCDate(d.getUTCDate()+(Number(move.dataset.calendarMove)>0?32:-1));calAnchor=monthStartISO(isoFromDate(d));render();return}
 if(e.target.closest("#notificationButton")){go("more");return}
});
document.addEventListener("change",e=>{
 if(!cloudLoaded)return;
 if(e.target.id==="educationLevel"){updateEducationFields(false);return}
 if(e.target.id==="gradeSelect"){updateMajorFields(false);return}
 if(e.target.id==="trackSelect"){updateMajorFields(false);return}
 if(e.target.id==="fieldGroupSelect"){updateMajorFields(true);return}
 if(e.target.id==="timerSubject"){state.timer.subject=e.target.value;save();render();return}
 if(e.target.id==="timerActivity"){
  let activity=e.target.value;if(state.timer.running)timerPause();
  state.timer.activity=activity;
  let items=activity==="task"?allStudentTasks().filter(x=>!x.done):activity==="exam"?allStudentExams().sort((a,b)=>a.date.localeCompare(b.date)):[];
  state.timer.activityId=items[0]?.id||"";
  let target=activity==="task"?allStudentTasks().find(x=>x.id===state.timer.activityId):activity==="exam"?allStudentExams().find(x=>x.id===state.timer.activityId):null;
  if(target?.subject)state.timer.subject=target.subject;
  save();render();return;
 }
 if(e.target.id==="timerActivityTarget"){
  let id=e.target.value;if(state.timer.running)timerPause();
  state.timer.activityId=id;
  let target=timerTarget();if(target?.subject)state.timer.subject=target.subject;
  save();render();return;
 }
 if(e.target.dataset.pref){state.preferences[e.target.dataset.pref]=e.target.checked;save();toast("تنظیمات یادآوری ذخیره شد.");return}
 if(e.target.dataset.prefTime){
  let key=e.target.dataset.prefTime,value=normalTime(e.target.value,"");
  if(!value){e.target.value=fa(state.preferences[key]||"08:00");toast("ساعت را به شکل ۱۶:۰۰ وارد کن.");return}
  state.preferences[key]=value;e.target.value=fa(value);save();toast("زمان یادآوری ذخیره شد.");
 }
});
document.addEventListener("submit",async e=>{
 if(!cloudLoaded)return;
 let f=e.target;if(f.id==="taskForm"){e.preventDefault();let d=new FormData(f);state.tasks.push({id:uid(),title:String(d.get("title")).trim(),subject:d.get("subject"),due:d.get("due"),note:String(d.get("note")||"").trim(),done:false,createdAt:Date.now()});save();closeModal();render();toast("تکلیف اضافه شد؛ در حال ذخیره در حساب…")}
 if(f.id==="examForm"){e.preventDefault();let d=new FormData(f);state.exams.push({id:uid(),title:String(d.get("title")).trim(),subject:d.get("subject"),date:d.get("date"),note:String(d.get("note")||"").trim(),createdAt:Date.now()});save();closeModal();render();toast("امتحان اضافه شد؛ در حال ذخیره در حساب…")}
 if(f.id==="planForm"){e.preventDefault();let d=new FormData(f),time=normalTime(d.get("time"),"");if(!time){toast("ساعت را به شکل ۱۶:۰۰ وارد کن.");return}state.plans.push({id:uid(),subject:d.get("subject"),day:+d.get("day"),time,duration:+d.get("duration"),note:String(d.get("note")||"").trim()});planDay=+d.get("day");save();closeModal();go("plan");toast("جلسه اضافه شد؛ در حال ذخیره در حساب…")}
 if(f.id==="gradeForm"){e.preventDefault();let d=new FormData(f),score=+d.get("score");if(score<0||score>20){toast("نمره باید بین صفر تا ۲۰ باشه.");return}state.grades.push({id:uid(),subject:d.get("subject"),title:String(d.get("title")||"").trim(),score,date:d.get("date"),createdAt:Date.now()});save();closeModal();go("stats");toast("نمره اضافه شد؛ در حال ذخیره در حساب…")}
 if(f.id==="profileForm"){
  e.preventDefault();
  if(profileSubmitting)return;
  const d=new FormData(f);
  const firstName=String(d.get("firstName")||"").trim(),lastName=String(d.get("lastName")||"").trim(),age=Number(d.get("age")),username=String(d.get("username")||"").trim().toLowerCase();
  const note=f.querySelector("#profileEditMessage"),button=f.querySelector('button[type="submit"]');
  function report(message){if(note)note.textContent=message;else toast(message)}
  if(firstName.length<2||lastName.length<2||firstName.length>40||lastName.length>60){report("نام و نام خانوادگی معتبر وارد کن.");return}
  if(!Number.isInteger(age)||age<6||age>30){report("سن باید بین ۶ تا ۳۰ سال باشد.");return}
  if(!/^(?:[a-z][a-z0-9_]{3,31}|[0-9]{10})$/.test(username)){report("آیدی را به‌صورت ۱۰ رقم یا نام کاربری لاتین معتبر وارد کن.");return}
  if(!window.STUNER_STUDENT_ACCOUNT?.updateProfile){report("اتصال حساب مدرسه در دسترس نیست. دوباره وارد سامانه شو.");return}
  profileSubmitting=true;if(button)button.disabled=true;report("در حال ذخیره تغییرات…");
  try{
   const result=await window.STUNER_STUDENT_ACCOUNT.updateProfile({first_name:firstName,last_name:lastName,age,username});
   state.student={...state.student,firstName,lastName,age,username:result.username};
   save();editingProfile=false;render();toast("مشخصات شخصی ذخیره شد.");
  }catch(err){report(err.message||"ذخیره مشخصات انجام نشد. دوباره تلاش کن.")}
  finally{profileSubmitting=false;if(button?.isConnected)button.disabled=false}
 }
});
if("serviceWorker"in navigator&&location.protocol!=="file:"){
 let reloadingAfterUpdate=false;
 navigator.serviceWorker.addEventListener("controllerchange",()=>{
  if(reloadingAfterUpdate)return;
  reloadingAfterUpdate=true;
  location.reload();
 });
 const registerCurrentWorker=()=>{
  navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"})
   .then(reg=>reg.update())
   .catch(()=>{});
 };
 // app.js is injected after Supabase student login, possibly AFTER window.load.
 if(document.readyState==="complete")registerCurrentWorker();
 else addEventListener("load",registerCurrentWorker,{once:true});
}
document.addEventListener("stuner-school-work-updated",()=>{if(!cloudLoaded)return;if(managed){syncStudentSubjects();save()}render()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&cloudLoaded&&!state.timer.running&&!state.konkuriaFocus.running)cloudStore?.refresh()});
window.addEventListener("beforeunload",e=>{if(cloudStore?.isDirty()){e.preventDefault();e.returnValue=""}});
bootCloud();
setInterval(()=>{if(cloudLoaded)reminderCheck()},60000);
setInterval(()=>{if(cloudLoaded&&!document.hidden&&!state.timer.running&&!state.konkuriaFocus.running)cloudStore?.refresh()},45000);
})();