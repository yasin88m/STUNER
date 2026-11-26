/* A single Jalali date picker shared by STUNER student and teacher screens. */
(function(){
"use strict";
const TZ="Asia/Tehran", days=["ش","ی","د","س","چ","پ","ج"];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa=v=>String(v).replace(/[0-9]/g,n=>"۰۱۲۳۴۵۶۷۸۹"[+n]);
function today(){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const get=k=>p.find(x=>x.type===k)?.value||"00";
 return get("year")+"-"+get("month")+"-"+get("day");
}
function dateObj(value){
 const [y,m,d]=String(value||today()).split("-").map(Number);
 return new Date(Date.UTC(y,m-1,d,12));
}
function isoFromDate(d){
 return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,"0"),String(d.getUTCDate()).padStart(2,"0")].join("-");
}
function addDays(amount){
 const d=dateObj(today());
 d.setUTCDate(d.getUTCDate()+Number(amount||0));
 return isoFromDate(d);
}
function formatted(value){
 try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:TZ}).format(dateObj(value))}
 catch{return value||"—"}
}
function persianParts(d){
 const ps=new Intl.DateTimeFormat("en-US-u-ca-persian",{year:"numeric",month:"numeric",day:"numeric",timeZone:TZ}).formatToParts(d);
 const get=k=>Number(ps.find(p=>p.type===k)?.value||0);
 return {y:get("year"),m:get("month"),d:get("day")};
}
function monthStartISO(s){
 let d=dateObj(s),p=persianParts(d);
 for(let i=0;i<31;i++){const x=new Date(d);x.setUTCDate(x.getUTCDate()-1);const q=persianParts(x);if(q.y!==p.y||q.m!==p.m)break;d=x}
 return isoFromDate(d);
}
function monthEndISO(s){
 let d=dateObj(s),p=persianParts(d);
 for(let i=0;i<31;i++){const x=new Date(d);x.setUTCDate(x.getUTCDate()+1);const q=persianParts(x);if(q.y!==p.y||q.m!==p.m)break;d=x}
 return isoFromDate(d);
}
function pickerMarkup(selected,anchor){
 const firstISO=monthStartISO(anchor),lastISO=monthEndISO(anchor),first=dateObj(firstISO),last=dateObj(lastISO);
 const label=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",year:"numeric",timeZone:TZ}).format(first),cells=[];
 for(let i=0;i<(first.getUTCDay()+1)%7;i++)cells.push("<span></span>");
 for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1)){
  const iso=isoFromDate(d),day=persianParts(d).d;
  cells.push('<button type="button" class="calendar-day '+(iso===today()?"today ":"")+(iso===selected?"selected":"")+'" data-picker-date="'+iso+'">'+fa(day)+'</button>');
 }
 while(cells.length%7)cells.push("<span></span>");
 return '<div class="jalali-picker-head"><button type="button" data-picker-move="-1" aria-label="ماه قبل">→</button><strong>'+label+'</strong><button type="button" data-picker-move="1" aria-label="ماه بعد">←</button></div><div class="calendar-grid jalali-picker-grid">'+days.map(x=>'<div class="calendar-weekday">'+x+'</div>').join("")+cells.join("")+'</div>';
}
function field(name,label,value=today(),options={}){
 const iso=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:today(),anchor=monthStartISO(iso);
 const shortcuts=options.shortcuts===false?"":'<div class="date-shortcuts"><button type="button" class="date-quick" data-date-quick="0">امروز</button><button type="button" class="date-quick" data-date-quick="1">فردا</button><button type="button" class="date-quick" data-date-quick="7">یک هفته بعد</button></div>';
 return '<div class="field jalali-date-field" data-jalali-field><span>'+esc(label)+'</span><input type="hidden" name="'+esc(name)+'" value="'+iso+'" required><strong class="jalali-date-display">'+formatted(iso)+'</strong>'+shortcuts+'<div class="jalali-picker" data-picker-anchor="'+anchor+'">'+pickerMarkup(iso,anchor)+'</div></div>';
}
function setDate(target,value){
 const input=target?.querySelector('input[type="hidden"]');
 if(!input||!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
 input.value=value;
 const display=target.querySelector(".jalali-date-display");if(display)display.textContent=formatted(value);
 const picker=target.querySelector(".jalali-picker"),anchor=monthStartISO(value);
 if(picker){picker.dataset.pickerAnchor=anchor;picker.innerHTML=pickerMarkup(value,anchor)}
 target.querySelectorAll("[data-date-quick]").forEach(b=>b.classList.toggle("active",addDays(Number(b.dataset.dateQuick))===value));
}
function move(target,delta){
 const picker=target?.querySelector(".jalali-picker");if(!picker)return;
 const d=dateObj(picker.dataset.pickerAnchor||today());
 d.setUTCDate(d.getUTCDate()+(delta>0?32:-1));
 const next=monthStartISO(isoFromDate(d));
 picker.dataset.pickerAnchor=next;
 picker.innerHTML=pickerMarkup(target.querySelector('input[type="hidden"]')?.value||today(),next);
}
function handleClick(e){
 const shortcut=e.target.closest("[data-date-quick]");
 if(shortcut){const target=shortcut.closest("[data-jalali-field]");if(target){setDate(target,addDays(Number(shortcut.dataset.dateQuick)));return true}}
 const direction=e.target.closest("[data-picker-move]");
 if(direction){const target=direction.closest("[data-jalali-field]");if(target){move(target,Number(direction.dataset.pickerMove));return true}}
 const day=e.target.closest("[data-picker-date]");
 if(day){const target=day.closest("[data-jalali-field]");if(target){setDate(target,day.dataset.pickerDate);return true}}
 return false;
}
window.STUNER_JALALI={today,field,setDate,move,handleClick,formatted,monthStartISO,monthEndISO,pickerMarkup};
})();
