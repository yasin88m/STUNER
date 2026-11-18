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

function auto(){for(const k of Object.keys(fields)){const t=selected(k);st.cols[k]={};if(t)for(const f of fields[k])st.cols[k][f]=col(t.columns,f)||(f==="id"&&k==="majors"?col(t.columns,"majorId"):f==="id"&&k==="subjects"?col(t.columns,"subjectId"):k==="classes"&&f==="className"?t.columns.find(c=>norm(c)==="name")||"":"")}}
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
 if(!st.db)throw Error("فایل پایگاه داده آماده نیست.");
 const school=st.staging?draftSchool():st.ctx?.school;
 if(!school)throw Error("هنرستان انتخاب نشده است.");
 const errors=[],classes=[],byId=new Map(),byName=new Map(),byKey=new Map(),catalogMajors=new Map(),catalogSubjects=new Map(),majorSet=new Map();
 const validGrades={vocational:["دهم","یازدهم","دوازدهم"],secondary:["دهم","یازدهم","دوازدهم"],middle:["هفتم","هشتم","نهم"],elementary:["اول","دوم","سوم","چهارم","پنجم","ششم"]};
 const standardGrades={"1":"اول","2":"دوم","3":"سوم","4":"چهارم","5":"پنجم","6":"ششم","7":"هفتم","8":"هشتم","9":"نهم","10":"دهم","11":"یازدهم","12":"دوازدهم"};
 const canonicalGrade=v=>{
  const raw=norm(digits(v).replace(/^پایه\s*/,""));
  if(standardGrades[raw])return standardGrades[raw];
  return (validGrades[school.kind]||[]).find(x=>grade(x)===raw)||String(v||"").trim();
 };
 function fromName(name){
  const text=digits(name);
  const named=(validGrades[school.kind]||[]).find(g=>text.includes(g));
  if(named)return named;
  const match=text.match(/(?:^|[^\d])([1-9]|1[012])(?:[^\d]|$)/);
  return match?canonicalGrade(match[1]):"";
 }
 function rememberMajor(name){
  const value=String(name||"").trim();
  if(value.length>=2&&value.length<=90&&school.kind!=="middle"&&school.kind!=="elementary")majorSet.set(norm(value),value);
  return value;
 }
 const majorTable=selected("majors"),mm=st.cols.majors||{};
 if(majorTable)majorTable.rows.forEach((row,i)=>{
  const code=value(row,mm,"id"),name=value(row,mm,"majorName");
  if(!name){errors.push("فهرست رشته‌ها، ردیف "+(i+1)+": عنوان رشته مشخص نیست.");return}
  if(name.trim().length<2||name.length>90){errors.push("عنوان رشته در ردیف "+(i+1)+" معتبر نیست.");return}
  rememberMajor(name);
  if(code)catalogMajors.set(norm(code),name.trim());
  catalogMajors.set(norm(name),name.trim());
 });
 function majorName(raw,foreign){
  for(const key of [foreign,raw]){
   if(key&&catalogMajors.has(norm(key)))return rememberMajor(catalogMajors.get(norm(key)));
  }
  const v=String(raw||"").trim();
  if(v&&!/^\d+$/.test(digits(v)))return rememberMajor(v);
  if(foreign||v)errors.push("شناسه رشته «"+(foreign||v)+"» به عنوان رشته مرتبط نشد؛ ستون‌های فهرست رشته‌ها را بررسی کنید.");
  return "";
 }
 const subjectTable=selected("subjects"),sm=st.cols.subjects||{};
 if(subjectTable)subjectTable.rows.forEach((row,i)=>{
  const id=value(row,sm,"id"),name=value(row,sm,"subjectName");
  if(!name){errors.push("فهرست درس‌ها، ردیف "+(i+1)+": نام درس مشخص نیست.");return}
  if(id)catalogSubjects.set(norm(id),name);
  catalogSubjects.set(norm(name),name);
 });
 function subjectName(raw,foreign){
  for(const candidate of [foreign,raw])if(candidate&&catalogSubjects.has(norm(candidate)))return catalogSubjects.get(norm(candidate));
  const title=String(raw||"").trim();
  if(title&&!/^\d+$/.test(digits(title))&&title.length<=120)return title;
  if(foreign||title)errors.push("شناسه درس «"+(foreign||title)+"» به نام درس تبدیل نشد.");
  return "";
 }
 function add(raw){
  const name=String(raw.name||"").trim();
  const g=school.grades?.find(x=>grade(x)===grade(canonicalGrade(raw.grade)))||canonicalGrade(raw.grade);
  const m=school.majors?.find(x=>norm(x)===norm(raw.major))||String(raw.major||"").trim();
  if(!name||!g){errors.push("کلاس فاقد عنوان یا پایه است: "+(name||"—"));return null}
  if(!(validGrades[school.kind]||[]).includes(g)){errors.push("پایه «"+g+"» با نوع مدرسه سازگار نیست.");return null}
  if(school.grades?.length&&!school.grades.some(x=>grade(x)===grade(g))){errors.push("پایه "+g+" در مدرسه تعریف نشده است.");return null}
  const key=norm(name)+"|"+grade(g);
  let item=byKey.get(key);
  if(item&&m&&item.major&&norm(item.major)!==norm(m)){errors.push("رشته‌های متناقض برای کلاس "+name+"؛ "+item.major+" / "+m);return null}
  if(!item){
   item={name,grade:g,major:m,id:null};
   byKey.set(key,item);classes.push(item);
   if(!byName.has(norm(name)))byName.set(norm(name),[]);
   byName.get(norm(name)).push(item);
  }else if(m&&!item.major)item.major=m;
  if(item.major)rememberMajor(item.major);
  return item;
 }
 const cl=selected("classes"),cm=st.cols.classes||{};
 if(cl)cl.rows.forEach((r,i)=>{
  const className=value(r,cm,"className"),g=value(r,cm,"grade")||fromName(className);
  const major=majorName(value(r,cm,"major"),value(r,cm,"majorId"));
  const name=className||[g,major].filter(Boolean).join(" - ");
  const item=add({name,grade:g,major});
  const classCode=value(r,cm,"id");
  if(item&&classCode)byId.set(norm(classCode),item);
 });
 function findClass(code,name,gradeHint){
  if(code&&byId.has(norm(code)))return byId.get(norm(code));
  const options=byName.get(norm(name))||[];
  if(options.length===1)return options[0];
  if(gradeHint)return options.find(c=>grade(c.grade)===grade(gradeHint))||null;
  return null;
 }
 const known=new Set(st.ctx?.known||[]),seen=new Set();
 function roster(kind){
  const tab=selected(kind);if(!tab)return [];
  const map=st.cols[kind],out=[];
  tab.rows.forEach((r,i)=>{
   let f=value(r,map,"first"),l=value(r,map,"last");
   if((!f||!l)&&map.full){const names=value(r,map,"full").split(/\s+/).filter(Boolean);if(names.length>1){f=names[0];l=names.slice(1).join(" ")}}
   const rawId=digits(value(r,map,"national")).replace(/\s/g,""),username=/^\d{9}$/.test(rawId)?"0"+rawId:rawId;
   const mobile=phone(value(r,map,"mobile")),existing=kind==="teachers"&&known.has(username);
   const err=[];
   if(!f||l.length<2||f.length+l.length>118)err.push("نام و نام خانوادگی نامعتبر");
   if(!/^\d{10}$/.test(username))err.push("کد ملی ده‌رقمی نیست");
   if(!existing&&!/^0[1-9]\d{9}$/.test(mobile))err.push("شماره تماس معتبر نیست");
   if(seen.has(username))err.push("شناسه ملی تکراری در فایل");
   if(known.has(username)&&!existing)err.push("این حساب در مدرسه موجود است");
   let classroom=null;
   if(kind==="students"){
    const id=value(r,map,"classId"),name=value(r,map,"className"),g=value(r,map,"grade");
    const major=majorName(value(r,map,"major"),value(r,map,"majorId"));
    classroom=findClass(id,name,g);
    if(!classroom&&g)classroom=add({name:name||[canonicalGrade(g),major].filter(Boolean).join(" - "),grade:g,major});
    if(classroom&&major){
     if(!classroom.major){classroom.major=major;rememberMajor(major)}
     else if(norm(classroom.major)!==norm(major))err.push("رشته هنرجو با رشته کلاس یکسان نیست");
    }
    if(classroom&&g&&grade(g)!==grade(classroom.grade))err.push("پایه دانش‌آموز با کلاس تطابق ندارد");
    if(!classroom)err.push("کلاس دانش‌آموز شناسایی نشد");
   }
   if(err.length)errors.push((kind==="students"?"دانش‌آموز":"معلم")+" ردیف "+(i+1)+": "+err.join("، "));
   else out.push({first:f,last:l,username,password:mobile,existing,dbId:value(r,map,"id"),source:r,classroom,classrooms:[],subjects:[]});
   if(username)seen.add(username);
  });
  return out;
 }
 const students=roster("students"),teachers=roster("teachers");
 if(!cl&&!selected("students")&&!selected("teachers")&&!majorTable)throw Error("هیچ جدول رشته، کلاس یا عضو پیدا نشد.");
 const teachersById=new Map(),teachersByNational=new Map();
 for(const teacher of teachers){
  if(teacher.dbId)teachersById.set(norm(teacher.dbId),teacher);
  teachersByNational.set(norm(teacher.username),teacher);
 }
 function getTeacher(id,national){
  const n=digits(String(national||""));
  return teachersById.get(norm(id))||teachersByNational.get(norm(n))||teachersByNational.get(norm(id))||null;
 }
 function attachClass(teacher,id,name,source){
  const classroom=findClass(id,name);
  if(!classroom){errors.push("ارتباط تدریس: کلاس «"+(id||name)+"» برای "+teacher.first+" "+teacher.last+" در "+source+" پیدا نشد.");return null}
  if(!teacher.classrooms.includes(classroom))teacher.classrooms.push(classroom);
  return classroom;
 }
 function attachSubject(teacher,classroom,title,source){
  if(!title)return;
  if(!classroom){errors.push("دبیرِ درس «"+title+"» در "+source+" کلاس مشخصی ندارد؛ ثبت نشد.");return}
  if(!teacher.subjects.some(x=>x.classroom===classroom&&norm(x.subject)===norm(title)))teacher.subjects.push({classroom,subject:title});
 }
 const tmap=st.cols.teachers;
 for(const teacher of teachers)for(const k of ["classId","className","classIds","classNames"]){
  const valueList=value(teacher.source,tmap,k);
  if(!valueList)continue;
  valueList.split(/[|,،;؛\n]+/).map(x=>x.trim()).filter(Boolean).forEach(ref=>attachClass(teacher,k==="classId"||k==="classIds"?ref:"",k==="className"||k==="classNames"?ref:"","جدول معلمان"));
 }
 function linkedTable(tableName,source){
  const table=selected(tableName),map=st.cols[tableName];
  if(!table)return;
  table.rows.forEach((row,i)=>{
   const teacher=getTeacher(value(row,map,"teacherId"),value(row,map,"teacherNational"));
   if(!teacher){errors.push(source+" ردیف "+(i+1)+": شناسه معلم شناسایی نشد.");return}
   const cid=value(row,map,"classId"),cname=value(row,map,"className");
   let classroom=null;
   if(cid||cname)classroom=attachClass(teacher,cid,cname,source);
   const subject=subjectName(value(row,map,"subject"),value(row,map,"subjectId"));
   if(subject){
    if(!classroom&&teacher.classrooms.length===1)classroom=teacher.classrooms[0];
    attachSubject(teacher,classroom,subject,source);
   }
  });
 }
 linkedTable("links","رابط معلم/کلاس");
 // Some exports use one table for both class links and subject links.
 if(st.tables.teaching!==st.tables.links)linkedTable("teaching","انتساب دبیر/درس");
 for(const teacher of teachers){
  const name=value(teacher.source,tmap,"subject"),id=value(teacher.source,tmap,"subjectId");
  if(!name&&!id)continue;
  const titles=String(name||id).split(/[|,،;؛\n]+/).map(x=>x.trim()).filter(Boolean);
  for(const title of titles){
   const resolved=subjectName(name?title:"",name?"":title);
   if(!resolved)continue;
   // A subject declared for a teacher and explicit class list is usable for each listed class.
   if(!teacher.classrooms.length){errors.push("درس "+resolved+" برای "+teacher.first+" "+teacher.last+" کلاس معین ندارد.");continue}
   for(const classroom of teacher.classrooms)attachSubject(teacher,classroom,resolved,"جدول معلمان");
  }
 }
 // Include all program names, even if no student has yet enrolled in that major.
 for(const c of classes)if(c.major)rememberMajor(c.major);
 return {classes,students,teachers,majors:[...majorSet.values()],teacherLinks:teachers.reduce((sum,t)=>sum+t.classrooms.length,0),
  subjectLinks:teachers.reduce((sum,t)=>sum+t.subjects.length,0),errors};
}
function preview(){try{st.plan=parsePlan();st.msg="پیش‌نمایش آماده است. پیش از تأیید فهرست خطاها را بررسی کنید."}catch(e){st.plan=null;st.msg=e.message}draw()}
async function batch(list,role){
 for(let at=0;at<list.length;at+=20){
  const items=list.slice(at,at+20),rows=items.map(r=>({
   username:r.username,password:r.password,display_name:r.first+" "+r.last,
   grade:r.classroom?.grade||"",major:r.classroom?.major||"",
   class_id:role==="student"?r.classroom.id:null,
   ...(role==="teacher"?{class_ids:(r.classrooms||[]).map(c=>c.id)}:{})
  }));
  const response=await st.ctx.submitBatch({mode:"import_members",school_id:st.ctx.school.id,role,rows});
  if(!Array.isArray(response.results)||response.results.length!==rows.length)throw Error("پاسخ سرور ناقص است.");
  response.results.forEach((result,i)=>{
   const row=items[i];
   row.created=!!result.created;
   st.log.push((result.created?"حساب ثبت شد: ":"حساب ثبت نشد: ")+row.first+" "+row.last+(result.error?" — "+result.error:""));
   row.password="";
  });
  st.msg="تکمیل "+Math.min(at+20,list.length)+" از "+list.length+" حساب "+(role==="student"?"دانش‌آموز":"معلم");draw();
 }
}
async function saveTeachingLinks(teachers){
 const rows=teachers.filter(x=>x.existing||x.created).flatMap(teacher=>
  teacher.subjects.filter(x=>x.classroom?.id).map(x=>({
   username:teacher.username,class_id:x.classroom.id,subject:x.subject
  }))
 );
 for(let i=0;i<rows.length;i+=100){
  const result=await st.ctx.client.rpc("import_school_subject_links",{
   p_school:st.ctx.school.id,p_rows:rows.slice(i,i+100)
  });
  if(result.error)throw result.error;
  st.log.push("انتساب دبیر به درس: "+(result.data?.linked||0)+" ثبت شد"+
   (result.data?.skipped?"، "+result.data.skipped+" مورد یافت نشد":""));
 }
}
async function submit(){
 if(st.busy||!st.plan||!st.ctx)return false;
 st.busy=true;const plan=st.plan;st.msg="در حال ثبت کلاس‌ها و رشته‌ها…";draw();
 try{
  const existing=new Map(st.ctx.classes.map(c=>[norm(c.name)+"|"+grade(c.grade)+"|"+norm(c.major),c]));
  const existingByName=new Map();
  for(const c of st.ctx.classes){
   const key=norm(c.name)+"|"+grade(c.grade),list=existingByName.get(key)||[];
   list.push(c);existingByName.set(key,list);
  }
  const updates=[];
  for(const c of plan.classes){
   const key=norm(c.name)+"|"+grade(c.grade)+"|"+norm(c.major);
   let item=existing.get(key);
   if(!item){
    const sameName=existingByName.get(norm(c.name)+"|"+grade(c.grade))||[];
    if(sameName.length===1){
     const older=sameName[0];
     if(!older.major&&c.major){item=older;updates.push({id:older.id,major:c.major})}
     else if(norm(older.major)!==norm(c.major))
      throw Error("برای کلاس «"+c.name+"» دو رشته متفاوت ثبت شده است؛ لطفاً اصلاح کنید.");
    }
   }
   if(!item){
    const result=await st.ctx.client.from("school_classes").insert({
     school_id:st.ctx.school.id,name:c.name,grade:c.grade,major:c.major||null
    }).select("id,name,grade,major").single();
    if(result.error)throw result.error;
    item=result.data;existing.set(key,item);
    st.log.push("کلاس ثبت شد: "+c.name);
   }
   c.id=item.id;
  }
  const refreshed=await st.ctx.client.rpc("refresh_school_import_structure",{p_school:st.ctx.school.id});
  if(refreshed.error)throw refreshed.error;
  const metadata=await st.ctx.client.rpc("apply_imported_school_academics",{
   p_school:st.ctx.school.id,p_majors:plan.majors,p_class_updates:updates
  });
  if(metadata.error)throw metadata.error;
  st.log.push("فهرست رشته‌های مدرسه: "+(metadata.data?.majors||0)+" رشته");
  const newStudents=plan.students.filter(x=>!x.existing),newTeachers=plan.teachers.filter(x=>!x.existing);
  if(newStudents.length)await batch(newStudents,"student");
  if(newTeachers.length)await batch(newTeachers,"teacher");
  if(plan.subjectLinks)await saveTeachingLinks(plan.teachers);
  st.plan=null;
  const created=newStudents.filter(x=>x.created).length+newTeachers.filter(x=>x.created).length;
  st.msg="ثبت به پایان رسید. "+created+" حساب جدید ایجاد شد؛ اطلاعات رشته‌ها و دبیران درس‌ها پردازش شد.";
  await st.ctx.onComplete?.();
  return true;
 }catch(err){
  st.msg="فرایند ناتمام است: "+(err.message||"خطای نامشخص")+
   "؛ ممکن است بخشی از داده‌ها ثبت شده باشد. پیش از تکرار، گزارش و کاربران موجود را بررسی کنید.";
  return false;
 }finally{st.busy=false;draw()}
}
async function importCreatedSchool(ctx){
 if(!canCreate())throw Error("ابتدا فایل را بارگذاری و پیش‌نمایش را بررسی کنید.");
 st.ctx=ctx;st.staging=false;return await submit();
}
function invalidate(){st.plan=null;draw()}
document.addEventListener("change",e=>{if(e.target.id==="stunerDbFile"&&e.target.files?.[0])return void load(e.target.files[0]);if(e.target.dataset.dbTable){st.tables[e.target.dataset.dbTable]=e.target.value;const key=e.target.dataset.dbTable,tab=selected(key);st.cols[key]={};if(tab)for(const f of fields[key])st.cols[key][f]=col(tab.columns,f)||(f==="id"&&key==="majors"?col(tab.columns,"majorId"):f==="id"&&key==="subjects"?col(tab.columns,"subjectId"):key==="classes"&&f==="className"?tab.columns.find(c=>norm(c)==="name")||"":"");st.plan=null;draw();return}if(e.target.dataset.dbColumn){st.cols[e.target.dataset.dbColumn][e.target.dataset.dbField]=e.target.value;st.plan=null;draw()}});
document.addEventListener("click",e=>{if(e.target.closest("[data-db-preview]"))preview();if(e.target.closest("[data-db-submit]"))submit()});
window.STUNER_SCHOOL_DB_IMPORT={configure,render,startCreation,hasFile,canCreate,importCreatedSchool,invalidate,summary};
})();