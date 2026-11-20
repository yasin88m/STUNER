/* STUNER personal data: authenticated, revision-checked Supabase persistence.
   localStorage is read only for one-time migration of old device data. */
(function(){
"use strict";
const collections=["tasks","exams","grades","plans","sessions"];
const copy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function combineLegacy(remote,old){
 const merged=copy(remote);
 for(const key of collections){
  const existing=new Set((merged[key]||[]).map(x=>String(x.id)));
  for(const item of old[key]||[]){
   if(!item||item.id==null||existing.has(String(item.id)))continue;
   (merged[key]||(merged[key]=[])).push(item);existing.add(String(item.id));
  }
 }
 if(!merged.student&&old.student)merged.student=old.student;
 return merged;
}
function reconcile(base,local,remote){
 const merged=copy(remote);
 for(const key of collections){
  const prev=new Map((base[key]||[]).filter(x=>x?.id!=null).map(x=>[String(x.id),x]));
  const next=new Map((local[key]||[]).filter(x=>x?.id!=null).map(x=>[String(x.id),x]));
  const result=new Map((remote[key]||[]).filter(x=>x?.id!=null).map(x=>[String(x.id),x]));
  for(const id of prev.keys())if(!next.has(id))result.delete(id);
  for(const [id,item] of next)if(!prev.has(id)||!same(item,prev.get(id)))result.set(id,item);
  merged[key]=[...result.values()];
 }
 for(const key of ["student","preferences","timer","konkuriaFocus"]){
  const before=base[key]||{},after=local[key]||{},target={...(remote[key]||{})};
  for(const field of new Set([...Object.keys(before),...Object.keys(after)])){
   if(same(before[field],after[field]))continue;
   if(Object.prototype.hasOwnProperty.call(after,field))target[field]=after[field];
   else delete target[field];
  }
  merged[key]=target;
 }
 if(!same(local.subjects,base.subjects))merged.subjects=local.subjects;
 return merged;
}
function create({client,schoolId,studentId,legacyKey,onStatus,onRemote}){
 let revision=0,baseline=null,ready=false,dirty=false,busy=false,latest=null,sequence=0,saveTimer=null,failed=false;
 const status=(value)=>onStatus?.(value);
 const target=()=>client.from("student_app_states");
 async function read(){
  const response=await target().select("payload,revision").eq("school_id",schoolId).eq("student_id",studentId).maybeSingle();
  if(response.error)throw response.error;
  return response.data;
 }
 async function update(payload,fromRevision){
  const response=await target().update({payload,revision:fromRevision+1,updated_at:new Date().toISOString()})
   .eq("school_id",schoolId).eq("student_id",studentId).eq("revision",fromRevision).select("revision").maybeSingle();
  if(response.error)throw response.error;
  return response.data;
 }
 async function load(defaultData){
  status("loading");
  let legacy=null;
  try{
   const str=localStorage.getItem(legacyKey);
   if(str){const parsed=JSON.parse(str);if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))legacy=parsed;}
  }catch{}
  let row=await read();
  if(!row){
   const response=await target().insert({school_id:schoolId,student_id:studentId,payload:legacy||defaultData})
    .select("payload,revision").single();
   if(response.error){
    if(response.error.code!=="23505")throw response.error;
    row=await read();
   }else row=response.data;
  }
  if(!row)throw Error("فضای ذخیره‌سازی این حساب ایجاد نشد.");
  let value=row.payload,version=Number(row.revision);
  if(legacy){
   const combined=combineLegacy(value,legacy);
   if(!same(value,combined)){
    const saved=await update(combined,version);
    if(!saved)throw Error("انتقال داده‌های قدیمی به علت تغییر هم‌زمان حساب متوقف شد. دوباره تلاش کنید.");
    value=combined;version=Number(saved.revision);
   }
   // Never delete the old copy unless the cloud write succeeded.
   try{localStorage.removeItem(legacyKey)}catch{}
  }
  baseline=copy(value);revision=version;ready=true;dirty=false;failed=false;latest=null;
  status("saved");
  return copy(value);
 }
 function schedule(value){
  if(!ready)return;
  latest=copy(value);dirty=true;sequence++;failed=false;
  status("saving");clearTimeout(saveTimer);
  saveTimer=setTimeout(flush,320);
 }
 async function flush(){
  if(!ready||busy||!dirty)return;
  clearTimeout(saveTimer);busy=true;failed=false;
  try{
   for(let retry=0;retry<5&&dirty;retry++){
    dirty=false;
    const value=copy(latest),stamp=sequence,oldRevision=revision;
    const saved=await update(value,oldRevision);
    if(saved){
     revision=Number(saved.revision);baseline=copy(value);
     if(stamp!==sequence)dirty=true;
    }else{
     const current=await read();
     if(!current)throw Error("اطلاعات حساب در دیتابیس پیدا نشد.");
     latest=reconcile(baseline,latest,current.payload);
     baseline=copy(current.payload);revision=Number(current.revision);
     sequence++;dirty=true;onRemote?.(copy(latest));
    }
   }
   if(dirty)throw Error("چند تغییر هم‌زمان شناسایی شد. دوباره برای ذخیره تلاش کنید.");
   status("saved");
  }catch(err){
   dirty=true;failed=true;status("failed",err.message);
  }finally{
   busy=false;
   if(dirty&&!failed){clearTimeout(saveTimer);saveTimer=setTimeout(flush,320);}
  }
 }
 async function refresh(){
  if(!ready||dirty||busy)return;
  const marker=sequence;
  try{
   const remote=await read();
   if(!remote||dirty||busy||marker!==sequence||Number(remote.revision)<=revision)return;
   baseline=copy(remote.payload);revision=Number(remote.revision);
   onRemote?.(copy(remote.payload));
   status("saved");
  }catch{status("offline")}
 }
 return {load,schedule,flush,refresh,isDirty:()=>dirty,isReady:()=>ready};
}
window.STUNER_STUDENT_CLOUD={create};
})();