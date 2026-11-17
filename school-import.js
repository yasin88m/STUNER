/* STUNER principal-only Excel onboarding. Files stay in browser; only validated records reach Edge Function. */
(function(){
"use strict";
const state={schoolId:"",role:"student",school:null,classes:[],known:[],rows:[],running:false,stop:false,note:"",fileName:"",submitBatch:null,onComplete:null};
const clean=s=>String(s??"").normalize("NFKC").replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[\u064b-\u065f\u0670\u200c\u200d\s_\-–—():.،,]/g,"").toLowerCase();
const num=s=>String(s??"").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).trim();
const esc=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const labels={first:["نام","نام دانش آموز","نام دانش‌آموز","نام معلم","اسم"],last:["نام خانوادگی","نام خانوادگي","فامیلی","نام خانوادگی دانش آموز"],national:["کد ملی","كد ملي","کدملی","شماره ملی"],phone:["شماره تماس","شماره موبایل","تلفن همراه","شماره همراه","موبایل","شماره تلفن","تلفن"],grade:["پایه تحصیلی","پایه","پایه آموزشی"],major:["رشته تحصیلی","رشته","گرایش","رشته آموزشی"]};
const phoneValue=v=>{
 let x=num(v).replace(/[\s()+\-]/g,"");
 if(x.startsWith("0098"))x="0"+x.slice(4);
 else if(x.startsWith("98")&&x.length===12)x="0"+x.slice(2);
 else if(x.length===10&&x.startsWith("9"))x="0"+x;
 return x;
};
function gradeValue(v){
 const x=clean(num(v).replace(/^پایه\s*/,"").replace(/\s*ابتدایی$/,""));
 const mapping={"1":"اول","2":"دوم","3":"سوم","4":"چهارم","5":"پنجم","6":"ششم","7":"هفتم","8":"هشتم","9":"نهم","10":"دهم","11":"یازدهم","12":"دوازدهم"};
 return clean(mapping[x]||x);
}
function findClass(grade,major){
 const matches=state.classes.filter(c=>gradeValue(c.grade)===gradeValue(grade)&&clean(c.major||"")===clean(major||""));
 if(matches.length===1)return {id:matches[0].id,name:matches[0].name};
 if(matches.length>1)return {error:"چند کلاس با همین پایه و رشته وجود دارد؛ تعیین کلاس به‌صورت خودکار ممکن نیست."};
 return {error:"کلاسی با این پایه و رشته در مدرسه پیدا نشد."};
}
const allColumns=["ردیف","نام","نام خانوادگی","کد ملی","شماره تماس","پایه تحصیلی","رشته تحصیلی"];
function render(role){
 if(state.role!==role){state.stop=true;state.role=role;state.rows=[];state.note="";state.fileName="";}
 const isStudent=role==="student";
 return '<details class="portal-card principal-disclosure school-import-card" '+(state.rows.length||state.note?'open':"")+'><summary><i data-lucide="file-text"></i> ورود گروهی '+(isStudent?"دانش‌آموزان":"معلمان")+' از اکسل <i data-lucide="chevron-down"></i></summary>'+
 '<p class="portal-note">فایل اکسل (.xlsx) یا CSV را انتخاب کنید. ستون‌ها: '+(isStudent?"ردیف، نام، نام خانوادگی، کد ملی، شماره تماس، پایه تحصیلی، رشته تحصیلی":"ردیف، نام، نام خانوادگی، کد ملی، شماره تماس (پایه و رشته اختیاری)")+'.</p>'+
 '<div class="school-import-top"><label class="school-import-file"><i data-lucide="file-text"></i><span>انتخاب فایل اکسل</span><input type="file" id="schoolImportFile" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"></label><button class="portal-secondary" data-import-template="'+role+'" type="button"><i data-lucide="arrow-right"></i> دریافت فایل نمونه</button></div>'+
 '<p class="school-import-hint">نام کاربری هر نفر کد ملی ۱۰ رقمی و رمز اولیه او شماره تماس درج‌شده در فایل است. صفر ابتدای اعداد حفظ می‌شود. رمز اولیه قابل حدس است؛ به کاربران تأکید کنید پس از ورود تغییرش دهند. '+(isStudent?"کلاس هر نفر فقط در صورت تطابق دقیق پایه و رشته تشخیص داده می‌شود.":"معلمان بدون هیچ انتساب کلاسی ثبت می‌شوند؛ مدیر بعداً کلاس‌هایشان را تعیین می‌کند.")+'</p>'+
 '<div id="schoolImportContent" aria-live="polite">'+view()+'</div></details>';
}
function configure(options){
 if(state.schoolId&&state.schoolId!==options.school.id){state.stop=true;state.rows=[];state.note="";state.fileName="";}
 state.schoolId=options.school.id;state.school=options.school;state.classes=options.classes;state.known=options.known||[];
 state.submitBatch=options.submitBatch;state.onComplete=options.onComplete;
}
function template(role){
 const headers=allColumns;
 const content="\ufeff"+headers.join(",")+"\r\n";
 const blob=new Blob([content],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=role==="teacher"?"stuner-teachers-template.csv":"stuner-students-template.csv";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),250);
}
function readCsv(text){
 const out=[],line=[],source=String(text).replace(/^\ufeff/,"");let field="",quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(c===","&&!quoted){line.push(field);field=""}
  else if((c==="\r"||c==="\n")&&!quoted){line.push(field);out.push(line.splice(0));field="";if(c==="\r"&&source[i+1]==="\n")i++}
  else field+=c;
 }
 if(field||line.length){line.push(field);out.push(line)}
 return out;
}
function headerMap(grid,role){
 for(let r=0;r<Math.min(8,grid.length);r++){
  const cells=grid[r].map(clean),columns={};
  for(const [key,alts] of Object.entries(labels)){
   const idx=cells.findIndex(c=>alts.some(a=>clean(a)===c));
   if(idx>=0)columns[key]=idx;
  }
  const required=role==="student"?["first","last","national","phone","grade"]:["first","last","national","phone"];
  if(required.every(k=>columns[k]!==undefined))return {row:r,columns};
 }
 throw Error("ستون‌های الزامی شناسایی نشدند. از «دریافت فایل نمونه» استفاده کنید و عنوان ستون‌ها را تغییر ندهید.");
}
function compile(grid,role){
 const {row:head,columns}=headerMap(grid,role),known=new Set(state.known),seen=new Set(),records=[];
 for(let i=head+1;i<grid.length;i++){
  const cells=grid[i];
  if(!Array.isArray(cells)||cells.every(v=>String(v??"").trim()===""))continue;
  const get=k=>columns[k]===undefined?"":String(cells[columns[k]]??"").trim();
  const first=get("first"),last=get("last"),rawCode=num(get("national")).replace(/\s/g,""),username=/^\d{9}$/.test(rawCode)?"0"+rawCode:rawCode;
  const password=phoneValue(get("phone")),grade=get("grade"),major=get("major"),errs=[];
  if(first.length<1||last.length<2||first.length+last.length>118)errs.push("نام و نام خانوادگی معتبر نیست.");
  if(!/^\d{10}$/.test(username))errs.push("کد ملی باید ۱۰ رقم باشد.");
  if(!/^0[1-9]\d{9}$/.test(password))errs.push("شماره تماس باید ۱۱ رقم و با صفر شروع شود.");
  if(seen.has(username))errs.push("کد ملی در همین فایل تکراری است.");else if(username)seen.add(username);
  if(known.has(username))errs.push("این نام کاربری در همین مدرسه ثبت شده است؛ حساب تکراری نسازید.");
  let classId=null,className="انتساب توسط مدیر";
  if(role==="student"){
   if(!grade)errs.push("پایه تحصیلی وارد نشده است.");
   const match=grade?findClass(grade,major):null;
   if(match?.error)errs.push(match.error);
   if(match?.id){classId=match.id;className=match.name;}
  }
  records.push({line:i+1,first,last,username,password:errs.length?"":password,grade,major,class_id:classId,className,error:errs.join(" "),status:errs.length?"invalid":"pending",serverError:""});
 }
 if(!records.length)throw Error("در فایل هیچ ردیف اطلاعاتی پیدا نشد.");
 if(records.length>2000)throw Error("فایل بیش از ۲۰۰۰ نفر دارد. فایل را به چند بخش تقسیم کنید.");
 return records;
}
function view(){
 const rows=state.rows,valid=rows.filter(r=>r.status==="pending"),ok=rows.filter(r=>r.status==="done").length,bad=rows.filter(r=>r.status==="invalid").length,fail=rows.filter(r=>r.status==="failed").length;
 if(!rows.length)return '<p class="school-import-empty">'+esc(state.note||"ابتدا یک فایل انتخاب کنید؛ پیش از ساخت حساب‌ها، اطلاعات و خطاها نمایش داده می‌شوند.")+'</p>';
 const summary='<div class="school-import-stats"><span>کل: <b>'+rows.length+'</b></span><span>آماده: <b>'+valid.length+'</b></span><span>ثبت‌شده: <b>'+ok+'</b></span><span>خطا: <b>'+(bad+fail)+'</b></span></div>';
 const sample=rows.slice(0,18).map(r=>'<tr><td>'+r.line+'</td><td>'+esc(r.first+" "+r.last)+'</td><td dir="ltr">'+esc(r.username)+'</td><td>'+esc(r.className)+'</td><td><span class="school-import-tag '+r.status+'">'+(r.status==="done"?"ثبت شد":r.status==="invalid"?"نامعتبر":r.status==="failed"?"ثبت نشد":"آماده")+'</span></td></tr>').join("");
 const errors=rows.filter(r=>r.error||r.serverError).slice(0,35).map(r=>'<li><b>ردیف '+r.line+':</b> '+esc(r.error||r.serverError)+'</li>').join("");
 return '<p class="school-import-filename">'+esc(state.fileName)+'</p>'+summary+
 '<div class="school-import-scroll"><table class="school-import-table"><thead><tr><th>ردیف</th><th>نام و نام خانوادگی</th><th>کد ملی</th><th>کلاس</th><th>وضعیت</th></tr></thead><tbody>'+sample+'</tbody></table></div>'+
 (rows.length>18?'<p class="portal-note">۱۸ ردیف نخست نشان داده می‌شود؛ بررسی و ثبت برای همه '+rows.length+' ردیف انجام می‌شود.</p>':"")+
 (errors?'<div class="school-import-errors"><strong>ردیف‌های نیازمند بررسی</strong><ul>'+errors+'</ul><button type="button" class="portal-secondary school-import-report" data-import-report>دریافت گزارش همه خطاها (CSV)</button></div>':"")+
 '<div class="school-import-actions">'+(valid.length?'<button type="button" class="portal-primary" data-import-start '+(state.running?'disabled':"")+'><i data-lucide="plus"></i> '+(state.running?"در حال ثبت…":"ثبت "+valid.length+" حساب معتبر")+'</button>':"")+
 (state.running?'<button type="button" class="portal-secondary" data-import-stop>توقف پس از گروه جاری</button>':"")+'</div>'+
 '<p class="school-import-result" role="status">'+esc(state.note||"فقط ردیف‌های معتبر ثبت می‌شوند. سایر ردیف‌ها نیاز به اصلاح فایل دارند.")+'</p>';
}
function redraw(){
 const target=document.getElementById("schoolImportContent");
 if(target){target.innerHTML=view();window.STUNER_ICONS?.refresh?.()}
}
async function parseFile(file){
 if(state.running)return;
 const targetRole=state.role,targetSchool=state.schoolId;
 state.rows=[];state.note="";state.fileName=file.name;redraw();
 try{
  if(file.size>5*1024*1024)throw Error("اندازه فایل نباید بیش از ۵ مگابایت باشد.");
  const suffix=file.name.toLowerCase(),isCsv=suffix.endsWith(".csv"),isXlsx=suffix.endsWith(".xlsx");
  if(!isCsv&&!isXlsx)throw Error("فرمت قابل قبول فقط xlsx یا CSV است؛ فایل xls را ابتدا با فرمت xlsx ذخیره کنید.");
  if(isXlsx&&typeof window.readXlsxFile!=="function")throw Error("کتابخانه خواندن اکسل بارگذاری نشده است؛ اتصال اینترنت را بررسی و صفحه را تازه‌سازی کنید.");
  state.note="در حال خواندن و اعتبارسنجی فایل…";redraw();
  const grid=isCsv?readCsv(await file.text()):await window.readXlsxFile(file);
  if(state.role!==targetRole||state.schoolId!==targetSchool)return;
  state.rows=compile(grid,targetRole);state.note="پیش‌نمایش آماده است. پیش از ثبت، کلاس‌ها و ردیف‌های خطادار را بررسی کنید.";
 }catch(e){state.note=e.message||"خواندن فایل اکسل ممکن نشد.";}
 redraw();
}
async function startImport(){
 if(state.running||!state.submitBatch)return;
 state.running=true;state.stop=false;
 const targetSchool=state.schoolId,targetRole=state.role,submitBatch=state.submitBatch,onComplete=state.onComplete,originalRows=state.rows;
 redraw();
 try{
  const pending=originalRows.filter(x=>x.status==="pending");
  for(let at=0;at<pending.length;at+=20){
   if(state.stop||state.schoolId!==targetSchool||state.role!==targetRole)break;
   const batch=pending.slice(at,at+20),payload=batch.map(r=>({username:r.username,password:r.password,display_name:r.first+" "+r.last,grade:r.grade,major:r.major,class_id:r.class_id}));
   const reply=await submitBatch({mode:"import_members",school_id:targetSchool,role:targetRole,rows:payload});
   if(!Array.isArray(reply.results)||reply.results.length!==batch.length)throw Error("پاسخ سرور برای یک گروه کامل نیست؛ وضعیت حساب‌ها را بررسی کنید.");
   reply.results.forEach((entry,i)=>{batch[i].status=entry.created===true?"done":"failed";batch[i].serverError=entry.created===true?"":String(entry.error||"این حساب ثبت نشد.");batch[i].password="";});
   if(state.schoolId!==targetSchool||state.role!==targetRole){state.stop=true;break}
   state.note="پیشرفت: "+originalRows.filter(r=>r.status==="done").length+" حساب ثبت شده از "+pending.length+" ردیف آماده.";
   redraw();
  }
  if(state.schoolId!==targetSchool||state.role!==targetRole)return;
  if(state.stop)state.note="فرایند متوقف شد. برای ادامه، دکمه ثبت حساب‌های باقی‌مانده را بزنید.";
  else state.note="پردازش کامل شد. "+state.rows.filter(r=>r.status==="done").length+" حساب ساخته شد؛ ردیف‌های خطادار در گزارش مشخص‌اند.";
  if(originalRows.some(r=>r.status==="done")&&onComplete)await onComplete();
 }catch(e){if(state.schoolId!==targetSchool||state.role!==targetRole)return;state.note="اشکال ارتباطی: "+(e.message||"درخواست انجام نشد.")+" — ممکن است برخی حساب‌ها ساخته شده باشند؛ پیش از تلاش دوباره فهرست کاربران را بررسی کنید.";}
 finally{state.running=false;redraw()}
}
function exportReport(){
 const items=state.rows.filter(r=>r.error||r.serverError);
 if(!items.length)return;
 const cell=x=>{
  let value=String(x??"");
  if(/^[=+\-@\t\r]/.test(value))value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
 };
 const result=[["ردیف اکسل","نام و نام خانوادگی","کد ملی","وضعیت","شرح خطا"],...items.map(r=>[r.line,r.first+" "+r.last,r.username,r.status,r.error||r.serverError])];
 const csv="\ufeff"+result.map(row=>row.map(cell).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="stuner-import-errors.csv";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),250);
}
document.addEventListener("click",e=>{
 if(e.target.closest("[data-import-report]")){e.preventDefault();exportReport();return}
 const download=e.target.closest("[data-import-template]");if(download){e.preventDefault();template(download.dataset.importTemplate);return}
 if(e.target.closest("[data-import-stop]")){state.stop=true;state.note="درخواست توقف ثبت شد.";redraw();return}
 if(e.target.closest("[data-import-start]")){startImport()}
});
document.addEventListener("change",e=>{
 if(e.target?.id==="schoolImportFile"&&e.target.files?.[0])parseFile(e.target.files[0]);
});
window.STUNER_SCHOOL_IMPORT={render,configure,helpers:{clean,gradeValue,phoneValue,readCsv,compile}};
})();