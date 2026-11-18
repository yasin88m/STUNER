/* STUNER Access / SQLite importer: parses locally; only approved account records reach Supabase. */
(function(){
"use strict";
const norm=x=>String(x??"").normalize("NFKC").replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[\s\u200c_\-–—.,،:()]/g,"").toLowerCase();
const digits=x=>String(x??"").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
const grade=x=>{let n=norm(digits(x).replace(/^پایه\s*/,""));return ({"1":"اول","2":"دوم","3":"سوم","4":"چهارم","5":"پنجم","6":"ششم","7":"هفتم","8":"هشتم","9":"نهم","10":"دهم","11":"یازدهم","12":"دوازدهم"})[n]||n};
const phone=x=>{let n=digits(x).replace(/[\s()+-]/g,"");if(n.startsWith("0098"))n="0"+n.slice(4);else if(n.startsWith("98")&&n.length===12)n="0"+n.slice(2);else if(n.length===10&&n[0]==="9")n="0"+n;return n};
const esc=x=>String(x??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[a]));
const names={
 majors:["majors","major","studyfields","study_fields","studybranches","fields","specialties","specializations","programs","reshteha","reshte","رشتهها","رشته‌های‌تحصیلی","رشتههایتحصیلی","رشته","گرایشها"],
 subjects:["subjects","lessons","courses","coursecatalog","subjectcatalog","schoolsubjects","dars","دروس","درسها","درس","واحدهای‌درسی"],
 teaching:["teaching","teaching_assignments","teacher_subjects","teacher_courses","course_teachers","class_subjects","class_lessons","class_courses","lesson_teachers","teacher_lessons","teacher_classes_subjects","تدریسدروس","دروسمعلمان","تدریس","دبیراندرودرسها","برنامهتدریس"],
 links:["class_teachers","teacher_classes","teacherclass","teacher_class","teacherassignments","teacher_assignments","انتسابمعلمان","کلاسهایمعلمان"],
 students:["students","student","studentinfo","tblstudents","pupil","دانشآموزان","دانشآموز","هنرجویان","هنرجو"],
 classes:["classes","class","classroom","schoolclasses","tblclasses","کلاسها","کلاس"],
 teachers:["teachers","teacher","staff","معلمان","دبیران","معلم"]
};
const aliases={
 teacherId:["teacherid","teacher_id","teachercode","staffid","idteacher","teacherkey","teachernumber","کدمعلم","شناسهمعلم","کددبیر","شناسهدبیر"],
 teacherNational:["teachernational","teachernationalcode","teachernationalid","کدملیمعلم","کدملیدبیر"],
 classIds:["classids","classes","teachingclasses","کدکلاسها","کلاسهایتدریس","کلاسها"],
 classNames:["classnames","classlist","نامکلاسها"],
 id:["id","recordid","code","شناسه","کد","classid","کدکلاس"],
 first:["firstname","fname","givenname","نام","نامدانشآموز","ناممعلم","نامدبیر"],
 last:["lastname","familyname","surname","lname","نامخانوادگی","فامیلی"],
 full:["fullname","displayname","studentname","teachername","نامونامخانوادگی","نامکامل"],
 national:["nationalcode","nationalid","codemelli","meli","کدملی","شمارهملی"],
 mobile:["mobile","cellphone","phone","contact","شمارهتماس","شمارههمراه","تلفن","موبایل"],
 grade:["grade","gradelevel","level","classgrade","پایه","پایهتحصیلی"],
 major:["majorname","fieldname","field","specialty","discipline","major","reshte","reshteh","رشتهتحصیلی","نامرشته","رشته","عنوانرشته"],
 majorId:["majorid","majorcode","fieldid","fieldcode","specialtyid","programid","reshteid","reshtecode","کدرشته","شناسهرشته"],
 majorName:["majorname","fieldname","major","field","specialty","reshte","reshteh","name","title","نامرشته","عنوانرشته","رشته"],
 branch:["branch","track","trackname","شاخه","شاخهتحصیلی"],
 classId:["classid","classcode","classroomid","classroomcode","کدکلاس","شناسهکلاس"],
 className:["classname","classroom","class","کلاس","نامکلاس","عنوانکلاس"],
 subject:["subjectname","lessonname","coursename","subject","lesson","course","dars","نامدرس","عنواندرس","درس","درسنام"],
 subjectId:["subjectid","subjectcode","lessonid","lessoncode","courseid","coursecode","darsid","darscode","کددرس","شناسهدرس"],
 subjectName:["subjectname","lessonname","coursename","subject","lesson","course","dars","name","title","نامدرس","عنواندرس","درس"]
};
const fields={
 classes:["id","className","grade","major","majorId"],
 students:["id","first","last","full","national","mobile","grade","major","majorId","classId","className"],
 teachers:["id","first","last","full","national","mobile","classId","className","classIds","classNames","subject","subjectId"],
 links:["teacherId","teacherNational","classId","className","subject","subjectId"],
 majors:["id","majorName","grade","branch"],
 subjects:["id","subjectName"],
 teaching:["teacherId","teacherNational","classId","className","subject","subjectId"]
};
const labels={
 teacherId:"شناسه معلم",teacherNational:"کد ملی معلم",classIds:"شناسه کلاس‌های تدریس",classNames:"نام کلاس‌های تدریس",
 id:"شناسه رکورد",className:"نام کلاس",first:"نام",last:"نام خانوادگی",full:"نام کامل",
 national:"کد ملی",mobile:"شماره تماس",grade:"پایه تحصیلی",major:"نام رشته",majorId:"شناسه رشته",
 majorName:"عنوان رشته",branch:"شاخه",classId:"شناسه کلاس مرتبط",
 subject:"نام درس",subjectId:"شناسه درس",subjectName:"عنوان درس"
};
const st={ctx:null,db:null,file:"",staging:false,tables:{classes:"",students:"",teachers:"",links:"",majors:"",subjects:"",teaching:""},cols:{classes:{},students:{},teachers:{},links:{},majors:{},subjects:{},teaching:{}},plan:null,msg:"",busy:false,log:[]};
const col=(available,key)=>available.find(c=>(aliases[key]||[]).some(a=>norm(a)===norm(c)))||"";
const selected=k=>st.db?.find(t=>t.name===st.tables[k]);
function configure(ctx){if(!st.staging)st.ctx=ctx}
function startCreation(){st.ctx=null;st.db=null;st.file="";st.plan=null;st.log=[];st.msg="";st.staging=true;st.tables={classes:"",students:"",teachers:"",links:"",majors:"",subjects:"",teaching:""};auto()}
function hasFile(){return !!st.db}
function summary(){return st.plan?{classes:st.plan.classes.length,students:st.plan.students.length,teachers:st.plan.teachers.length,teacherLinks:st.plan.teacherLinks,subjectLinks:st.plan.subjectLinks,majors:st.plan.majors.length,errors:st.plan.errors.length}:null}
function canCreate(){return !!st.db&&!!st.plan&&!st.busy&&st.plan.classes.length>0}
function draftSchool(){const form=document.getElementById("schoolForm");return {kind:form?.querySelector("[name=kind]")?.value||"vocational",grades:[],majors:[]}}

function auto(){for(const k of Object.keys(fields)){const t=selected(k);st.cols[k]={};if(t)for(const f of fields[k])st.cols[k][f]=col(t.columns,f)||(k==="classes"&&f==="className"?t.columns.find(c=>norm(c)==="name")||"":"")}}
function opts(arr,val){return '<option value="">انتخاب نشده</option>'+arr.map(x=>'<option value="'+esc(x)+'"'+(x===val?" selected":"")+'>'+esc(x)+'</option>').join("")}
function map(k){const t=selected(k);return '<section class="stuner-db-mapping"><label><b>'+({classes:"کلاس‌ها",students:"دانش‌آموزان",teachers:"معلمان",links:"ارتباط معلمان و کلاس‌ها",majors:"فهرست رشته‌ها",subjects:"فهرست درس‌ها",teaching:"انتساب دبیران به درس‌ها"})[k]+'</b><select data-db-table="'+k+'">'+opts(st.db.map(x=>x.name),st.tables[k])+'</select></label>'+(t?'<div class="stuner-db-field-grid">'+fields[k].map(f=>'<label>'+labels[f]+'<select data-db-column="'+k+'" data-db-field="'+f+'">'+opts(t.columns,st.cols[k][f])+'</select></label>').join("")+'</div><small>تعداد رکورد: '+t.rows.length+'</small>':"")+'</section>'}
function render(){return '<section class="portal-card stuner-db-card"><h2>ورود پایگاه داده کامل مدرسه</h2><p>فایل واقعی پایگاه داده را وارد کنید؛ فرمت‌های Access (.accdb و .mdb) و SQLite (.db و .sqlite و .sqlite3) پشتیبانی می‌شوند. فایل اکسل لازم نیست.</p><label class="school-import-file">انتخاب فایل پایگاه داده<input id="stunerDbFile" type="file" accept=".accdb,.mdb,.db,.sqlite,.sqlite3"></label><p class="portal-note">فایل اصلی تنها در مرورگر خوانده می‌شود؛ ثبت داده پس از تأیید مدیر و بررسی جدول‌ها انجام می‌شود. فرمت‌های ناشناخته یا رمزگذاری‌شده ممکن است نیازمند پردازش جداگانه باشند.</p><div id="stunerDbRoot" aria-live="polite">'+view()+'</div></section>'}
function view(){let html='<p class="stuner-db-status">'+esc(st.msg||"فایل پایگاه داده مدرسه را انتخاب کنید (حداکثر ۳۵ مگابایت).")+'</p>';if(!st.db)return html;html+='<p><b>'+esc(st.file)+'</b> — '+st.db.length+' جدول شناسایی شد.</p><div class="stuner-db-tables">'+st.db.map(t=>'<span>'+esc(t.name)+' ('+t.rows.length+')</span>').join("")+'</div><h3>تطبیق جدول‌ها و ستون‌ها</h3>'+map("majors")+map("subjects")+map("classes")+map("students")+map("teachers")+map("links")+map("teaching")+'<button class="portal-secondary" type="button" data-db-preview '+(st.busy?"disabled":"")+'>پیش‌نمایش و اعتبارسنجی</button>';
 if(st.plan)html+='<div class="stuner-db-summary"><h3>پیش‌نمایش انتقال</h3><div class="school-import-stats"><span>کلاس‌ها <b>'+st.plan.classes.length+'</b></span><span>رشته‌ها <b>'+st.plan.majors.length+'</b></span><span>دانش‌آموزان <b>'+st.plan.students.length+'</b></span><span>معلمان <b>'+st.plan.teachers.length+'</b></span><span>انتساب کلاس <b>'+st.plan.teacherLinks+'</b></span><span>دبیر-درس <b>'+st.plan.subjectLinks+'</b></span><span>خطاها <b>'+st.plan.errors.length+'</b></span></div><p>اطلاعات رشته‌ها، کلاس‌ها و دبیران درس‌ها از جدول‌های مستقل و روابط بین جدول‌ها استخراج می‌شوند؛ موارد مبهم در خطاها مشخص می‌شوند.</p>'+(st.plan.errors.length?'<details><summary>مشاهده '+st.plan.errors.length+' خطا</summary><div class="stuner-db-errors">'+st.plan.errors.slice(0,60).map(e=>'<p>'+esc(e)+'</p>').join("")+'</div></details>':"")+(st.staging?'<p>اطلاعات آماده است؛ برای ادامه از دکمه ساخت مدرسه در انتهای فرم استفاده کنید.</p>':'<button type="button" class="portal-primary" data-db-submit '+(st.busy?"disabled":"")+'>تأیید نهایی و ثبت اطلاعات</button>')+'</div>';
 if(st.log.length)html+='<details open><summary>گزارش ثبت ('+st.log.length+')</summary><div class="stuner-db-errors">'+st.log.slice(-80).map(e=>'<p>'+esc(e)+'</p>').join("")+'</div></details>';return html}
function draw(){let r=document.getElementById("stunerDbRoot");if(r){r.innerHTML=view();window.STUNER_ICONS?.refresh?.()}}
async function access(bytes){const [mdb,bf]=await Promise.all([import("https://esm.sh/mdb-reader@3.2.0?bundle&target=es2022"),import("https://esm.sh/buffer@6.0.3?bundle")]);const reader=new mdb.default(bf.Buffer.from(bytes)),list=reader.getTableNames().filter(n=>!/^msys/i.test(n));if(list.length>80)throw Error("پایگاه داده بیش از ۸۰ جدول دارد.");let count=0;return list.map(name=>{const t=reader.getTable(name);count+=t.rowCount;if(count>30000)throw Error("پایگاه داده بیش از ۳۰ هزار ردیف دارد و باید به صورت مرحله‌ای منتقل شود.");const cols=t.getColumns().filter(x=>!["binary","ole","complex"].includes(x.type)).map(x=>x.name);return {name,columns:cols,rows:t.getData({columns:cols}).map(r=>Object.fromEntries(cols.map(c=>[c,r[c]??""])))}})}
async function sqlite(bytes){if(!window.initSqlJs)await new Promise((ok,bad)=>{let t=document.createElement("script");t.src="https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.js";t.onload=ok;t.onerror=()=>bad(Error("موتور SQLite بارگذاری نشد."));document.head.appendChild(t)});const SQL=await window.initSqlJs({locateFile:()=> "https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm"}),db=new SQL.Database(bytes);const q=s=>'"'+s.replace(/"/g,'""')+'"';try{const result=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");const tables=result[0]?.values.map(row=>String(row[0]))||[];if(tables.length>80)throw Error("پایگاه داده بیش از ۸۰ جدول دارد.");let count=0;return tables.map(name=>{const info=db.exec("SELECT * FROM "+q(name)+" LIMIT 30001")[0],columns=info?.columns||db.exec("PRAGMA table_info("+q(name)+")")[0]?.values.map(v=>String(v[1]))||[],values=info?.values||[];count+=values.length;if(count>30000)throw Error("تعداد رکوردها بیش از ۳۰ هزار است.");return {name,columns,rows:values.map(v=>Object.fromEntries(columns.map((c,i)=>[c,v[i] instanceof Uint8Array?"":v[i]??""])))}})}finally{db.close()}}
async function load(file){if(st.busy)return;st.db=null;st.plan=null;st.log=[];st.file=file.name;st.msg="در حال خواندن جدول‌ها…";draw();try{if(file.size>35*1024*1024)throw Error("حجم پایگاه داده نباید بیش از ۳۵ مگابایت باشد.");const ext=file.name.toLowerCase().split(".").pop(),bytes=new Uint8Array(await file.arrayBuffer());if(["accdb","mdb"].includes(ext))st.db=await access(bytes);else if(["db","sqlite","sqlite3"].includes(ext))st.db=await sqlite(bytes);else throw Error("این فرمت پشتیبانی نمی‌شود.");if(!st.db.length)throw Error("هیچ جدول قابل خواندن وجود ندارد.");for(const k of Object.keys(names))st.tables[k]=st.db.find(t=>names[k].some(n=>norm(t.name)===norm(n)))?.name||st.db.find(t=>names[k].some(n=>norm(t.name).includes(norm(n))))?.name||"";auto();st.msg="جدول‌ها شناسایی شدند؛ ستون‌ها را بررسی و سپس پیش‌نمایش بگیرید."}catch(e){st.db=null;st.msg=e.message||"فایل پایگاه داده قابل خواندن نیست."}draw()}
const value=(r,m,k)=>m[k]?String(r[m[k]]??"").trim():"";
function parsePlan(){
 if(!st.db)throw Error("فایل پایگاه داده هنوز آماده نشده است.");
 const school=st.staging?draftSchool():st.ctx?.school;
 if(!school)throw Error("مدرسه مشخص نیست.");
 const classes=[],errors=[],byId=new Map(),byName=new Map(),byKey=new Map();
 const gradeLabels={"1":"اول","2":"دوم","3":"سوم","4":"چهارم","5":"پنجم","6":"ششم","7":"هفتم","8":"هشتم","9":"نهم","10":"دهم","11":"یازدهم","12":"دوازدهم"};
 const canonicalGrade=v=>gradeLabels[norm(digits(v).replace(/^پایه\s*/,""))]||String(v||"").trim();
 const validGrades={vocational:["دهم","یازدهم","دوازدهم"],secondary:["دهم","یازدهم","دوازدهم"],middle:["هفتم","هشتم","نهم"],elementary:["اول","دوم","سوم","چهارم","پنجم","ششم"]};
 function add(raw){
  const name=String(raw.name||"").trim(),normalizedGrade=canonicalGrade(raw.grade);
  const g=school.grades?.find(x=>grade(x)===grade(normalizedGrade))||normalizedGrade;
  const m=school.majors?.find(x=>norm(x)===norm(raw.major))||String(raw.major||"").trim();
  if(!name||!g){errors.push("کلاس فاقد عنوان یا پایه است.");return null}
  if(school.kind&&!(validGrades[school.kind]||[]).includes(g)){errors.push("پایه "+g+" با مقطع مدرسه سازگار نیست.");return null}
  if(school.grades?.length&&!school.grades.some(x=>grade(x)===grade(g))){errors.push("پایه "+g+" در مدرسه تعریف نشده است.");return null}
  if(m&&school.majors?.length&&!school.majors.some(x=>norm(x)===norm(m))){errors.push("رشته "+m+" در مدرسه تعریف نشده است.");return null}
  const key=norm(name)+"|"+grade(g)+"|"+norm(m);
  let item=byKey.get(key);
  if(!item){item={name,grade:g,major:m,id:null};byKey.set(key,item);classes.push(item)}
  byName.set(norm(item.name),item);
  return item;
 }
 const cls=selected("classes"),cm=st.cols.classes;
 if(cls)cls.rows.forEach((r,i)=>{
  const name=value(r,cm,"className"),g=value(r,cm,"grade"),m=value(r,cm,"major"),id=value(r,cm,"id");
  const item=add({name:name||[g,m].filter(Boolean).join(" - "),grade:g,major:m});
  if(item&&id)byId.set(norm(id),item);
 });
 const seen=new Set(),known=new Set(st.ctx?.known||[]);
 function roster(kind){
  const table=selected(kind);
  if(!table)return [];
  const map=st.cols[kind],out=[];
  table.rows.forEach((r,i)=>{
   let f=value(r,map,"first"),l=value(r,map,"last");
   if((!f||!l)&&map.full){const parts=value(r,map,"full").split(/\s+/).filter(Boolean);if(parts.length>1){f=parts[0];l=parts.slice(1).join(" ")}}
   const rawCode=digits(value(r,map,"national")).replace(/\s/g,"");
   const code=/^\d{9}$/.test(rawCode)?"0"+rawCode:rawCode;
   const password=phone(value(r,map,"mobile"));
   let classroom=null;
   if(kind==="students"){
    const ref=value(r,map,"classId"),cn=value(r,map,"className");
    classroom=byId.get(norm(ref))||byName.get(norm(cn))||null;
    if(!classroom){const g=value(r,map,"grade"),m=value(r,map,"major");if(g)classroom=add({name:cn||[g,m].filter(Boolean).join(" - "),grade:g,major:m})}
   }
   const rowErrors=[];
   if(!f||l.length<2||f.length+l.length>118)rowErrors.push("نام نامعتبر");
   if(!/^\d{10}$/.test(code))rowErrors.push("شناسه ملی ده‌رقمی نیست");
   if(!/^0[1-9]\d{9}$/.test(password))rowErrors.push("شماره تماس معتبر نیست");
   if(known.has(code))rowErrors.push("این حساب در مدرسه ثبت شده است");
   if(seen.has(code))rowErrors.push("کد ملی تکراری است");
   if(kind==="students"&&!classroom)rowErrors.push("کلاس دانش‌آموز شناسایی نشد");
   if(rowErrors.length)errors.push((kind==="students"?"دانش‌آموز":"معلم")+" ردیف "+(i+1)+": "+rowErrors.join("، "));
   else out.push({first:f,last:l,username:code,password,classroom,dbId:value(r,map,"id"),source:r,classrooms:[]});
   if(code)seen.add(code);
  });
  return out;
 }
 const students=roster("students"),teachers=roster("teachers");
 if(!selected("students")&&!selected("teachers")&&!cls)throw Error("حداقل یک جدول کلاس، دانش‌آموز یا معلم انتخاب کنید.");
 const byTeacherId=new Map(),byNational=new Map();
 for(const teacher of teachers){
  if(teacher.dbId)byTeacherId.set(norm(teacher.dbId),teacher);
  byNational.set(norm(teacher.username),teacher);
 }
 function attach(teacher,reference,source){
  const ref=String(reference||"").trim();
  if(!ref)return;
  const classroom=byId.get(norm(ref))||byName.get(norm(ref));
  if(!classroom){errors.push("کلاس تدریس "+ref+" برای "+teacher.first+" "+teacher.last+" در "+source+" شناسایی نشد.");return}
  if(!teacher.classrooms.includes(classroom))teacher.classrooms.push(classroom);
 }
 const teacherMap=st.cols.teachers;
 teachers.forEach(t=>{
  for(const key of ["classId","className","classIds","classNames"]){
   const raw=value(t.source,teacherMap,key);
   if(raw)raw.split(/[|,،;؛\n]+/).map(x=>x.trim()).filter(Boolean).forEach(ref=>attach(t,ref,"جدول معلمان"));
  }
 });
 const links=selected("links"),lm=st.cols.links;
 if(links)links.rows.forEach((r,i)=>{
  const id=value(r,lm,"teacherId"),national=digits(value(r,lm,"teacherNational"));
  const teacher=byTeacherId.get(norm(id))||byNational.get(norm(national))||byNational.get(norm(id));
  if(!teacher){errors.push("ارتباط معلم و کلاس، ردیف "+(i+1)+": معلم ناشناخته است.");return}
  const ref=value(r,lm,"classId")||value(r,lm,"className");
  if(!ref){errors.push("ارتباط معلم و کلاس، ردیف "+(i+1)+": کلاس مشخص نیست.");return}
  attach(teacher,ref,"جدول انتساب");
 });
 return {classes,students,teachers,teacherLinks:teachers.reduce((n,t)=>n+t.classrooms.length,0),errors};
}
function preview(){try{st.plan=parsePlan();st.msg="پیش‌نمایش آماده است. پیش از تأیید فهرست خطاها را بررسی کنید."}catch(e){st.plan=null;st.msg=e.message}draw()}
async function batch(list,role){for(let at=0;at<list.length;at+=20){let items=list.slice(at,at+20),rows=items.map(r=>({username:r.username,password:r.password,display_name:r.first+" "+r.last,grade:r.classroom?.grade||"",major:r.classroom?.major||"",class_id:role==="student"?r.classroom.id:null,...(role==="teacher"?{class_ids:(r.classrooms||[]).map(c=>c.id)}:{})}));let response=await st.ctx.submitBatch({mode:"import_members",school_id:st.ctx.school.id,role,rows});if(!Array.isArray(response.results)||response.results.length!==rows.length)throw Error("پاسخ سرور ناقص است. حساب‌ها را بررسی کنید.");response.results.forEach((x,i)=>{st.log.push((x.created?"ثبت شد: ":"ثبت نشد: ")+items[i].first+" "+items[i].last+(x.error?" — "+x.error:""));items[i].password=""});st.msg="تکمیل "+Math.min(at+20,list.length)+" از "+list.length+" حساب "+(role==="student"?"دانش‌آموز":"معلم");draw()}}
async function submit(){if(st.busy||!st.plan||!st.ctx)return false;st.busy=true;const plan=st.plan;st.msg="در حال ثبت کلاس‌ها…";draw();try{let existing=new Map(st.ctx.classes.map(c=>[norm(c.name)+"|"+grade(c.grade)+"|"+norm(c.major),c]));for(const c of plan.classes){let key=norm(c.name)+"|"+grade(c.grade)+"|"+norm(c.major),item=existing.get(key);if(!item){let res=await st.ctx.client.from("school_classes").insert({school_id:st.ctx.school.id,name:c.name,grade:c.grade,major:c.major||null}).select("id,name,grade,major").single();if(res.error)throw res.error;item=res.data;existing.set(key,item);st.log.push("کلاس ثبت شد: "+c.name)}c.id=item.id}
 const refreshed=await st.ctx.client.rpc("refresh_school_import_structure",{p_school:st.ctx.school.id});if(refreshed.error)throw refreshed.error;
 if(plan.students.length)await batch(plan.students,"student");if(plan.teachers.length)await batch(plan.teachers,"teacher");st.plan=null;st.msg="ثبت به پایان رسید. "+st.log.filter(x=>x.startsWith("ثبت شد:")).length+" حساب ایجاد شد.";await st.ctx.onComplete?.();return true}catch(e){st.msg="فرایند ناتمام است: "+(e.message||"خطای نامشخص")+"؛ احتمال ثبت بخشی از حساب‌ها وجود دارد. پیش از تکرار فهرست کاربران را بررسی کنید.";return false}finally{st.busy=false;draw()}}
async function importCreatedSchool(ctx){
 if(!canCreate())throw Error("ابتدا فایل را بارگذاری و پیش‌نمایش را بررسی کنید.");
 st.ctx=ctx;st.staging=false;return await submit();
}
function invalidate(){st.plan=null;draw()}
document.addEventListener("change",e=>{if(e.target.id==="stunerDbFile"&&e.target.files?.[0])return void load(e.target.files[0]);if(e.target.dataset.dbTable){st.tables[e.target.dataset.dbTable]=e.target.value;const key=e.target.dataset.dbTable,tab=selected(key);st.cols[key]={};if(tab)for(const f of fields[key])st.cols[key][f]=col(tab.columns,f)||(key==="classes"&&f==="className"?tab.columns.find(c=>norm(c)==="name")||"":"");st.plan=null;draw();return}if(e.target.dataset.dbColumn){st.cols[e.target.dataset.dbColumn][e.target.dataset.dbField]=e.target.value;st.plan=null;draw()}});
document.addEventListener("click",e=>{if(e.target.closest("[data-db-preview]"))preview();if(e.target.closest("[data-db-submit]"))submit()});
window.STUNER_SCHOOL_DB_IMPORT={configure,render,startCreation,hasFile,canCreate,importCreatedSchool,invalidate,summary};
})();