(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY="stuner.app.v1:"+window.STUNER_ACTIVE_USER.id+":"+window.STUNER_ACTIVE_USER.schoolId, IRAN_TZ="Asia/Tehran", days=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
const base=()=>({student:null,tasks:[],exams:[],grades:[],plans:[],sessions:[],subjects:["ریاضی","علوم","فارسی","عربی","زبان انگلیسی","مطالعات اجتماعی","دینی","ادبیات"],preferences:{notifyTasks:true,notifyStudy:true,notifyBreak:true,taskReminderTime:"08:00",studyReminderTime:"16:00"},timer:{mode:"study",remaining:1500,running:false,subject:"ریاضی",activity:"study",activityId:""}});
let state=read(),page="home",taskFilter="all",taskView="tasks",planDay=(dateObj(isoToday()).getUTCDay()+1)%7,calAnchor=isoToday(),calSelected=isoToday(),ticker=null,deadline=null;
function read(){try{let s=JSON.parse(localStorage.getItem(KEY)||"null");return s?{...base(),...s,preferences:{...base().preferences,...s.preferences},timer:{...base().timer,...s.timer,running:false}}:base()}catch{return base()}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
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
function initials(){return state.student?.firstName?.[0]||"؟"}
function totalMins(){return state.sessions.reduce((a,s)=>a+(+s.minutes||0),0)}
function average(){let rows=state.grades.filter(g=>activeSubject(g.subject));return rows.length?rows.reduce((a,g)=>a+(+g.score),0)/rows.length:null}

const CURRICULUM=window.STUNER_CURRICULUM;
// Keep classroom enrollment consistent with the principal's assignments.
const managed=window.STUNER_ACTIVE_STUDENT_PROFILE||null;
if(managed){
 state.student={...state.student,...managed};
 syncStudentSubjects();
 save();
}
let editingStudent=false;
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
 if(CURRICULUM.catalogReady){state.subjects=selected;return}
 if(state.student&&(state.student.track==="فنی‌وحرفه‌ای"||state.student.track==="کاردانش")){state.subjects=selected;return}
 state.subjects=selected.length?selected:base().subjects;
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
 let visibleTasks=allStudentTasks(),visibleSessions=state.sessions.filter(x=>activeSubject(x.subject)),mins=visibleSessions.reduce((a,x)=>a+(+x.minutes||0),0),done=visibleTasks.filter(t=>t.done).length,total=visibleTasks.length,pct=total?Math.round(done/total*100):0,progressLabel=fa(pct)+"٪",progressDetail=total?fa(done)+" از "+fa(total)+" تکلیف":"هنوز تکلیفی ثبت نشده";
 let visibleExams=allStudentExams();let tasks=visibleTasks.filter(t=>t.due===isoToday()&&!t.done).slice(0,4), exams=visibleExams.filter(e=>e.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
 let subjects=state.subjects.slice(0,4).map(s=>{let m=state.sessions.filter(x=>x.subject===s).reduce((a,x)=>a+(+x.minutes||0),0);return `<div class="subject-progress"><strong>${esc(s)}</strong><div class="progress-track"><span style="width:${Math.min(100,m/120*100)}%"></span></div><small>${fa(m)} د</small></div>`}).join("");
 let h=Math.floor(mins/60),m=mins%60;
 return `<section class="hero-card"><div class="hero-copy"><p class="eyebrow">${iranHour()<11?"صبح بخیر":iranHour()<17?"روز بخیر":"عصر بخیر"}، ${esc(name())}</p><h2>برای یه روز پربار آماده‌ای؟</h2><p>با یک جلسه کوتاه شروع کن؛ مسیر موفقیت از همین‌جا می‌گذره.</p><button class="primary-button" data-page="timer">▶ شروع مطالعه <span>· ۲۵ دقیقه</span></button></div><div class="hero-orbit" style="background:conic-gradient(#74e2a8 0 ${pct}%,rgba(255,255,255,.15) ${pct}% 100%)"><div class="hero-orbit-inner"><strong>${progressLabel}</strong><small>پیشرفت تکالیف</small><span>${progressDetail}</span></div></div></section>
 <section class="stats-grid"><article class="card stat-card"><span class="stat-icon">◷</span><div><strong>${fa(h)}:${fa(String(m).padStart(2,"0"))}</strong><small>زمان مطالعه ثبت‌شده</small></div></article><article class="card stat-card"><span class="stat-icon">☑</span><div><strong>${fa(visibleTasks.filter(t=>!t.done).length)}</strong><small>تکلیف باقی‌مانده</small></div></article><article class="card stat-card"><span class="stat-icon">♜</span><div><strong>${fa(exams.length)}</strong><small>امتحان پیش رو</small></div></article><article class="card stat-card"><span class="stat-icon">★</span><div><strong>${average()===null?"—":fa(average().toFixed(1))}</strong><small>میانگین نمرات</small></div></article></section>
 <div class="dashboard-grid"><section class="card panel"><div class="section-title" style="margin-top:0"><div><h2>کارهای امروز</h2><p>${fmt(isoToday(),{weekday:"long",day:"numeric",month:"long"})}</p></div><button class="text-button" data-page="tasks">همه تکالیف ←</button></div>${tasks.length?`<div class="task-list">${tasks.map(t=>taskRow(t,true)).join("")}</div>`:empty("برنامه امروزت خالیه","می‌تونی اولین تکلیفت رو اضافه کنی.","✓")}<button class="soft-button small-button" style="margin-top:12px" data-action="add-task">＋ افزودن تکلیف</button></section>
 <section class="card panel"><div class="section-title" style="margin-top:0"><div><h2>امتحانات نزدیک</h2><p>برای امتحان‌ها آماده بمون</p></div><button class="text-button" data-page="exams">مشاهده همه ←</button></div>${exams.length?exams.map(e=>examRow(e)).join(""):empty("هنوز امتحانی ثبت نشده","امتحان بعدی‌ات رو اینجا ثبت کن.","♜")}<button class="soft-button small-button" style="margin-top:12px" data-action="add-exam">＋ افزودن امتحان</button></section></div>
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
 return '<section class="timer-page"><div class="timer-top"><button data-page="home" aria-label="بازگشت">→</button><div><h1>تایمر مطالعه</h1><p>'+(study?"زمان تمرکز · ۲۵ دقیقه":"زمان استراحت · ۵ دقیقه")+'</p></div><button data-action="timer-reset" aria-label="تنظیم مجدد">↻</button></div><div class="timer-simple-card"><span class="timer-state '+(study?"study":"break")+'">'+(study?"در حال مطالعه":"زمان استراحت")+'</span><strong class="timer-digits" id="timerDigits" dir="ltr">'+fa(String(Math.floor(r/60)).padStart(2,"0")+":"+String(r%60).padStart(2,"0"))+'</strong><p class="timer-caption">'+(study?"با آرامش و تمرکز پیش برو":"کمی استراحت کن؛ بعد دوباره شروع می‌کنیم")+'</p><div class="timer-controls"><button class="timer-control secondary" data-action="timer-reset" aria-label="شروع مجدد">↺</button><button class="timer-control main" data-action="timer-toggle">'+(state.timer.running?"Ⅱ":"▶")+'</button><button class="timer-control secondary" data-action="timer-skip" aria-label="رفتن به مرحله بعد">»</button></div><div class="timer-control-labels"><span>از نو</span><span>'+(state.timer.running?"توقف":"شروع")+'</span><span>مرحله بعد</span></div></div><div class="timer-settings"><label class="timer-subject"><span>نوع فعالیت</span><select id="timerActivity" '+(study?"":"disabled")+'><option value="study" '+(activity==="study"?"selected":"")+'>مطالعه آزاد</option><option value="task" '+(activity==="task"?"selected":"")+'>انجام تکلیف</option><option value="exam" '+(activity==="exam"?"selected":"")+'>آمادگی امتحان</option></select></label>'+timerTargetSelect()+'<label class="timer-subject"><span>درس</span><select id="timerSubject" '+(study?"":"disabled")+'>'+subjectOptions(state.timer.subject)+'</select></label></div><p class="timer-note">'+esc(study?note:"استراحت کوتاه بهت کمک می‌کنه برای دور بعد آماده بشی.")+'</p><div class="timer-footer"><span>زمان مطالعه به‌صورت خودکار ثبت می‌شود.</span><button data-page="stats">گزارش مطالعه</button></div></section>';
}
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
 let visibleGrades=state.grades.filter(g=>activeSubject(g.subject)),visibleSessions=state.sessions.filter(x=>activeSubject(x.subject)),visibleTasks=state.tasks.filter(t=>activeSubject(t.subject));let avg=visibleGrades.length?visibleGrades.reduce((a,g)=>a+(+g.score),0)/visibleGrades.length:null,mins=visibleSessions.reduce((a,x)=>a+(+x.minutes||0),0),rows=state.subjects.map(s=>{let gs=visibleGrades.filter(g=>g.subject===s),score=gs.length?gs.reduce((a,g)=>a+ +g.score,0)/gs.length:null,study=visibleSessions.filter(x=>x.subject===s).reduce((a,x)=>a+(+x.minutes||0),0);return {s,score,study}}).filter(x=>x.score!==null||x.study);
 return `${heading("آمار و کارنامه","پیشرفتت رو ببین و برای قدم بعدی انگیزه بگیر.",'<button class="primary-button small-button" data-action="add-grade">＋ ثبت نمره</button>')}<div class="grade-summary"><div><small>میانگین نمرات ثبت‌شده</small><strong>${avg===null?"—":fa(avg.toFixed(2))}</strong><em>${avg===null?"هنوز نمره‌ای ثبت نشده":avg>=18?"عالیه، همین‌طور ادامه بده":avg>=15?"روندت خوبه، ادامه بده":"با برنامه‌ریزی می‌تونی بهتر بشی"}</em></div><div class="grade-badge">★</div></div><div class="stats-grid"><article class="card stat-card"><span class="stat-icon">◷</span><div><strong>${fa((mins/60).toFixed(1))}</strong><small>ساعت مطالعه</small></div></article><article class="card stat-card"><span class="stat-icon">✓</span><div><strong>${fa(visibleTasks.filter(t=>t.done).length)}</strong><small>تکلیف انجام‌شده</small></div></article></div><section class="card panel" style="margin-top:16px"><div class="section-title" style="margin-top:0"><div><h2>عملکرد درس‌ها</h2><p>میانگین نمره و زمان مطالعه هر درس</p></div></div>${rows.length?`<div class="grade-list">${rows.map(x=>`<div class="grade-row"><strong>${esc(x.s)}</strong><div class="grade-track"><span style="width:${x.score===null?Math.min(100,x.study/120*100):Math.min(100,x.score/20*100)}%"></span></div><small>${x.score===null?fa(x.study)+"د":fa(x.score.toFixed(1))}</small></div>`).join("")}</div>`:empty("هنوز داده‌ای برای تحلیل نداریم","بعد از ثبت نمره یا زمان مطالعه، گزارش اینجا نمایش داده می‌شه.","▥")}</section><section class="card panel" style="margin-top:15px"><div class="section-title" style="margin-top:0"><div><h2>نمرات دروس</h2><p>نمره‌های ثبت‌شده خودت</p></div><button class="text-button" data-action="add-grade">＋ افزودن نمره</button></div>${visibleGrades.length?visibleGrades.slice().sort((a,b)=>b.createdAt-a.createdAt).map(g=>`<div class="task-row"><div class="stat-icon">✎</div><div class="task-main"><strong>${esc(g.subject)}</strong><small>${esc(g.title||"نمره ثبت‌شده")} · ${fmt(g.date,{day:"numeric",month:"short"})}</small></div><strong>${fa(g.score)}</strong><button class="mini-icon-button delete" data-delete-grade="${g.id}">×</button></div>`).join(""):empty("نمره‌ای ثبت نشده","نمره‌های امتحان‌هات رو وارد کن تا میانگینت محاسبه بشه.","★")}</section>`;
}
function renderMore(){return `${heading("بخش‌های بیشتر","همه ابزارهای مورد نیازت در یک جا.")}<div class="more-grid"><button class="more-tile" data-page="books"><span class="tile-icon">▤</span><span><strong>کتابخانه درسی</strong><small>کتاب‌های پایه و رشته خودت</small></span></button><button class="more-tile" data-page="exams"><span class="tile-icon">♜</span><span><strong>امتحانات</strong><small>تاریخ و مهلت آزمون‌ها</small></span></button><button class="more-tile" data-page="calendar"><span class="tile-icon">▣</span><span><strong>تقویم</strong><small>نمای روزانه و ماهانه</small></span></button><button class="more-tile" data-page="stats"><span class="tile-icon">▥</span><span><strong>نمرات و کارنامه</strong><small>معدل و عملکرد دروس</small></span></button><button class="more-tile" data-page="profile"><span class="tile-icon">◉</span><span><strong>پروفایل دانش‌آموز</strong><small>مشخصات و تنظیمات</small></span></button></div><section class="card panel" style="margin-top:16px"><div class="section-title" style="margin-top:0"><div><h2>یادآوری‌ها</h2><p>اعلان‌های تکالیف و زمان مطالعه</p></div></div><div class="settings-row"><div><strong>اعلان تکالیف امروز</strong><small>یادآوری کارهایی که مهلتشان امروز است</small></div><input class="switch" type="checkbox" data-pref="notifyTasks" ${state.preferences.notifyTasks?"checked":""}></div><div class="settings-row"><div><strong>اعلان‌های تایمر مطالعه</strong><small>پایان زمان مطالعه و استراحت</small></div><input class="switch" type="checkbox" data-pref="notifyStudy" ${state.preferences.notifyStudy?"checked":""}></div><div class="settings-row"><div><strong>زمان یادآوری تکالیف</strong><small>یادآوری تکالیف امروز و فردا</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۰۸:۰۰" data-pref-time="taskReminderTime" value="${fa(state.preferences.taskReminderTime||"08:00")}"></div><div class="settings-row"><div><strong>زمان پیشنهادی مطالعه</strong><small>یادآوری روزانه برای شروع مطالعه</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۱۶:۰۰" data-pref-time="studyReminderTime" value="${fa(state.preferences.studyReminderTime||"16:00")}"></div><button class="secondary-button small-button" style="margin-top:14px" data-action="enable-notifications">فعال‌سازی اعلان‌های گوشی</button></section>`}
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
function renderBooks(){
 const books=studentBooks(),student=state.student;
 const cards=books.length?books.map(b=>{
  const direct=!!b.pdfUrl,downloadUrl=officialBookUrl(b.pdfUrl||b.url),bookPageUrl=officialBookUrl(b.url);
  return '<article class="card panel book-card"><span class="pill">کد کتاب: '+esc(b.code||"ثبت نشده")+'</span><strong>'+esc(b.title)+'</strong><small class="book-meta">پایه '+esc(b.grade)+' · چاپ '+esc(CURRICULUM.academicYear)+'</small><a class="primary-button small-button book-download" href="'+esc(downloadUrl)+'" '+'target="_blank" rel="noopener noreferrer"'+'>' +(direct?'↓ دانلود PDF کتاب':'دریافت PDF از پایگاه رسمی')+'</a>'+(direct?'':'<small class="book-meta">برای دریافت فایل، صفحه رسمی کتاب باز می‌شود.</small>')+'<a class="secondary-button small-button" href="'+esc(bookPageUrl)+'" target="_blank" rel="noopener noreferrer">مشاهده مشخصات کتاب ↗</a></article>';
 }).join(""):empty("کتابی برای این انتخاب پیدا نشد","برای این پایه و رشته در فهرست چاپ سال جاری کتاب ثبت نشده است. مشخصات تحصیلی را بررسی کن یا فهرست رسمی را ببین.","▤");
 const trackLine=student.educationLevel==="secondary"?(student.track+" · "+(student.fieldGroup?student.fieldGroup+" · ":"")+student.major):student.grade;
 return heading("کتابخانه درسی","کتاب‌های رسمی متناسب با پایه و رشته خودت.")+'<section class="card panel" style="margin-bottom:15px"><strong>'+esc(trackLine)+'</strong><p class="book-meta">سال تحصیلی '+esc(CURRICULUM.academicYear)+' · منبع: پایگاه رسمی کتاب‌های درسی</p></section><div class="section-title"><div><h2>کتاب‌های رسمی در chap.oerp.ir</h2><p>'+fa(books.length)+' کتاب رسمی برای این پایه و رشته</p></div></div><div class="dashboard-grid">'+cards+'</div>';
}
function renderProfile(){
 let s=state.student,level=s.educationLevel||inferEducationLevel(s.grade||""),isSecondary=level==="secondary";
 let levelLabel=level==="elementary"?"ابتدایی":level==="middle"?"متوسطه اول":"متوسطه دوم";
 let trackLine=isSecondary?[s.track,s.fieldGroup,s.major].filter(Boolean).join(" · "):levelLabel;
 let academicFields=isSecondary?'<div class="data-box"><small>شاخه</small><strong>'+esc(s.track||"—")+'</strong></div>'+(s.fieldGroup?'<div class="data-box"><small>زمینه</small><strong>'+esc(s.fieldGroup)+'</strong></div>':'')+'<div class="data-box"><small>رشته</small><strong>'+esc(s.major||"—")+'</strong></div>':"";
 return `${heading("پروفایل دانش‌آموز","مشخصاتت رو ببین و تنظیمات برنامه رو مدیریت کن.",'<button class="secondary-button small-button" data-action="edit-profile">ویرایش مشخصات</button>')}<section class="profile-hero"><div class="profile-avatar">${esc(initials())}</div><div><h2>${esc(s.firstName+" "+s.lastName)}</h2><p>${esc(s.grade)}${s.age?" · "+fa(s.age)+" ساله":""}</p><span class="pill" style="margin-top:9px">${esc(trackLine)}</span></div></section><div class="profile-data"><div class="data-box"><small>نام</small><strong>${esc(s.firstName)}</strong></div><div class="data-box"><small>نام خانوادگی</small><strong>${esc(s.lastName)}</strong></div><div class="data-box"><small>پایه تحصیلی</small><strong>${esc(s.grade)}</strong></div><div class="data-box"><small>سن</small><strong>${s.age?fa(s.age)+" سال":"ثبت نشده"}</strong></div>${academicFields}</div><section class="card panel" style="margin-top:15px"><div class="section-title" style="margin-top:0"><div><h2>تنظیمات</h2><p>شخصی‌سازی تجربه استیونر</p></div></div><div class="settings-row"><div><strong>یادآوری تکالیف</strong><small>اعلان مهلت تکالیف روزانه</small></div><input class="switch" type="checkbox" data-pref="notifyTasks" ${state.preferences.notifyTasks?"checked":""}></div><div class="settings-row"><div><strong>یادآوری مطالعه</strong><small>اعلان پایان چرخه‌های پومودورو</small></div><input class="switch" type="checkbox" data-pref="notifyStudy" ${state.preferences.notifyStudy?"checked":""}></div><div class="settings-row"><div><strong>یادآوری استراحت</strong><small>اعلان شروع و پایان استراحت</small></div><input class="switch" type="checkbox" data-pref="notifyBreak" ${state.preferences.notifyBreak?"checked":""}></div><div class="settings-row"><div><strong>زمان یادآوری تکالیف</strong><small>یادآوری تکالیف امروز و فردا</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۰۸:۰۰" data-pref-time="taskReminderTime" value="${fa(state.preferences.taskReminderTime||"08:00")}"></div><div class="settings-row"><div><strong>زمان پیشنهادی مطالعه</strong><small>یادآوری روزانه برای شروع مطالعه</small></div><input class="inline-input" style="width:112px;text-align:center" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۱۶:۰۰" data-pref-time="studyReminderTime" value="${fa(state.preferences.studyReminderTime||"16:00")}"></div><button class="secondary-button small-button" style="margin-top:15px" data-action="enable-notifications">فعال‌سازی اعلان‌های گوشی</button></section><p style="text-align:center;color:#a1ada5;font-size:10px;margin-top:22px">STUNER · نسخه آزمایشی ۰.۲</p>`;
}
function render(){
 let app=$("#app"),on=$("#onboarding");
 if(!profileIsReady(state.student)||editingStudent){app.style.display="none";on.hidden=false;populateStudentForm();return}
 app.style.display="";on.hidden=true;$("#topAvatar").textContent=initials();
 let views={home:renderHome,plan:renderPlan,timer:renderTimer,tasks:renderTasks,exams:renderExams,calendar:renderCalendar,stats:renderStats,more:renderMore,profile:renderProfile,books:renderBooks};
 $("#mainContent").innerHTML=(views[page]||renderHome)();
 document.querySelectorAll(".sidebar [data-page], .bottom-nav [data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 window.STUNER_ICONS?.refresh?.();
 if(state.timer.running){tickerStart();paintTimer()}else if(ticker){clearInterval(ticker);ticker=null}
}
function openModal(title,body){$("#modalRoot").innerHTML=`<div class="modal-backdrop" data-modal-backdrop><section class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="close-button" data-close-modal>×</button></div>${body}</section></div>`;let f=$("input,select,textarea",$("#modalRoot"));if(f)setTimeout(()=>f.focus(),50)}
function closeModal(){$("#modalRoot").innerHTML=""}

function taskModal(){openModal("افزودن تکلیف جدید",`<form id="taskForm" class="modal-form"><label class="field"><span>عنوان تکلیف</span><input name="title" placeholder="مثلاً حل تمرین‌های ریاضی" required maxlength="90"></label><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label>${dateField("due","مهلت تحویل")}<label class="field"><span>توضیحات (اختیاری)</span><textarea name="note" placeholder="جزئیات تکلیف..."></textarea></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت تکلیف</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function examModal(){openModal("افزودن امتحان",`<form id="examForm" class="modal-form"><label class="field"><span>عنوان امتحان</span><input name="title" placeholder="مثلاً آزمون فصل دوم" required maxlength="90"></label><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label>${dateField("date","تاریخ امتحان",isoAdd(3))}<label class="field"><span>توضیحات (اختیاری)</span><textarea name="note" placeholder="محدوده امتحان یا نکته مهم..."></textarea></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت امتحان</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function planModal(){openModal("افزودن جلسه مطالعه",`<form id="planForm" class="modal-form"><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label><label class="field"><span>روز هفته</span><select name="day">${days.map((d,i)=>`<option value="${i}" ${i===planDay?"selected":""}>${d}</option>`).join("")}</select></label><div class="field-row"><label class="field"><span>ساعت شروع</span><input name="time" type="text" inputmode="numeric" dir="ltr" maxlength="5" placeholder="۱۶:۰۰" value="۱۶:۰۰" required></label><label class="field"><span>مدت (دقیقه)</span><input name="duration" type="number" min="5" max="300" step="5" value="45" required></label></div><label class="field"><span>توضیح (اختیاری)</span><input name="note" placeholder="مثلاً مرور فصل سوم"></label><div class="modal-actions"><button class="primary-button" type="submit">ثبت جلسه</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function gradeModal(){openModal("ثبت نمره جدید",`<form id="gradeForm" class="modal-form"><label class="field"><span>درس</span><select name="subject">${subjectOptions(state.timer.subject)}</select></label><label class="field"><span>عنوان آزمون یا فعالیت</span><input name="title" placeholder="مثلاً امتحان میان‌ترم"></label><div class="field-row"><label class="field"><span>نمره از ۲۰</span><input name="score" type="number" min="0" max="20" step=".25" placeholder="مثلاً ۱۸.۵" required></label>${dateField("date","تاریخ")}</div><div class="modal-actions"><button class="primary-button" type="submit">ثبت نمره</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function editProfileModal(){let s=state.student;openModal("ویرایش مشخصات",`<form id="profileForm" class="modal-form"><div class="field-row"><label class="field"><span>نام</span><input name="firstName" value="${esc(s.firstName)}" required></label><label class="field"><span>نام خانوادگی</span><input name="lastName" value="${esc(s.lastName)}" required></label></div><label class="field"><span>پایه تحصیلی</span><select name="grade">${["اول ابتدایی","دوم ابتدایی","سوم ابتدایی","چهارم ابتدایی","پنجم ابتدایی","ششم ابتدایی","هفتم","هشتم","نهم","دهم","یازدهم","دوازدهم","دانشجو"].map(g=>`<option ${g===s.grade?"selected":""}>${g}</option>`).join("")}</select></label><label class="field"><span>سن</span><input name="age" type="number" min="6" max="30" value="${s.age}" required></label><div class="modal-actions"><button class="primary-button" type="submit">ذخیره تغییرات</button><button class="secondary-button" type="button" data-close-modal>انصراف</button></div></form>`)}
function go(p){if(p==="exams"){taskView="exams";page="tasks"}else{page=p;if(p==="tasks")taskView="tasks"}render();window.scrollTo({top:0,behavior:"smooth"})}
function remove(key,id){state[key]=state[key].filter(x=>x.id!==id);save();render();toast("مورد انتخاب‌شده حذف شد.")}
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
function timerComplete(){
 if(ticker)clearInterval(ticker);ticker=null;deadline=null;
 let study=state.timer.mode==="study";
 if(study){
  let activity=state.timer.activity||"study",target=timerTarget();
  state.sessions.push({id:uid(),subject:state.timer.subject,minutes:25,date:isoToday(),createdAt:Date.now(),activity,activityId:state.timer.activityId||"",activityTitle:target?.title||(activity==="exam"?"آمادگی امتحان":activity==="task"?"انجام تکلیف":"مطالعه آزاد")});
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
$("#onboardingForm").addEventListener("submit",e=>{e.preventDefault();let d=new FormData(e.currentTarget),f=String(d.get("firstName")||"").trim(),l=String(d.get("lastName")||"").trim(),a=Number(d.get("age")),level=d.get("educationLevel"),grade=d.get("grade"),track=d.get("track")||"",fieldGroup=d.get("fieldGroup")||"",major=d.get("major")||"";if(!f||!l||a<6||a>30||!level||!grade||(level==="secondary"&&(!track||!major||(track!=="نظری"&&!fieldGroup)))){$("#onboardingError").textContent="لطفاً دوره، پایه و رشته تحصیلی را کامل انتخاب کن.";return}state.student={...(state.student||{}),firstName:f,lastName:l,age:a,educationLevel:level,grade,track:level==="secondary"?track:"",fieldGroup:level==="secondary"&&track!=="نظری"?fieldGroup:"",major:level==="secondary"?major:""};editingStudent=false;syncStudentSubjects();state.timer.subject=state.subjects[0]||"";save();page="home";render();toast(`اطلاعات تحصیلی ذخیره شد، ${f}!`)});
document.addEventListener("click",e=>{
 let p=e.target.closest("[data-page]");if(p){e.preventDefault();go(p.dataset.page);return}
 let a=e.target.closest("[data-action]")?.dataset.action;if(a){if(a==="timer-toggle"){state.timer.running?timerPause():timerStart();return}({"add-task":taskModal,"add-exam":examModal,"add-plan":planModal,"add-grade":gradeModal,"edit-profile":()=>{editingStudent=true;render()},"enable-notifications":enableNotifications,"timer-reset":timerReset,"timer-skip":timerSkip})[a]?.();return}
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
 if(e.target.closest("#notificationButton")){go("more");return}if(e.target.closest("#topAvatar")){go("profile");return}
});
document.addEventListener("change",e=>{
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
document.addEventListener("submit",e=>{
 let f=e.target;if(f.id==="taskForm"){e.preventDefault();let d=new FormData(f);state.tasks.push({id:uid(),title:String(d.get("title")).trim(),subject:d.get("subject"),due:d.get("due"),note:String(d.get("note")||"").trim(),done:false,createdAt:Date.now()});save();closeModal();render();toast("تکلیف جدید ثبت شد.")}
 if(f.id==="examForm"){e.preventDefault();let d=new FormData(f);state.exams.push({id:uid(),title:String(d.get("title")).trim(),subject:d.get("subject"),date:d.get("date"),note:String(d.get("note")||"").trim(),createdAt:Date.now()});save();closeModal();render();toast("امتحان به تقویمت اضافه شد.")}
 if(f.id==="planForm"){e.preventDefault();let d=new FormData(f),time=normalTime(d.get("time"),"");if(!time){toast("ساعت را به شکل ۱۶:۰۰ وارد کن.");return}state.plans.push({id:uid(),subject:d.get("subject"),day:+d.get("day"),time,duration:+d.get("duration"),note:String(d.get("note")||"").trim()});planDay=+d.get("day");save();closeModal();go("plan");toast("جلسه مطالعه برنامه‌ریزی شد.")}
 if(f.id==="gradeForm"){e.preventDefault();let d=new FormData(f),score=+d.get("score");if(score<0||score>20){toast("نمره باید بین صفر تا ۲۰ باشه.");return}state.grades.push({id:uid(),subject:d.get("subject"),title:String(d.get("title")||"").trim(),score,date:d.get("date"),createdAt:Date.now()});save();closeModal();go("stats");toast("نمره با موفقیت ثبت شد.")}
 if(f.id==="profileForm"){e.preventDefault();let d=new FormData(f);state.student={firstName:String(d.get("firstName")).trim(),lastName:String(d.get("lastName")).trim(),grade:d.get("grade"),age:+d.get("age")};save();closeModal();render();toast("مشخصاتت به‌روزرسانی شد.")}
});
if("serviceWorker"in navigator&&location.protocol!=="file:")addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
document.addEventListener("stuner-school-work-updated",()=>render());
if(profileIsReady(state.student))syncStudentSubjects();render();reminderCheck();setInterval(reminderCheck,60000);
})();