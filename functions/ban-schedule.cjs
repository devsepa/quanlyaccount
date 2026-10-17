(function(root){
  'use strict';
  const HOUR=3600000,OFFSET=7*HOUR;
  function hour(value){if(value===null||value===undefined||String(value).trim()==='')return '';const text=String(value).trim();if(!/^(?:[01]?\d|2[0-3])$/.test(text))throw new Error('Giờ mở BAN phải từ 00 đến 23.');return String(Number(text)).padStart(2,'0');}
  function parts(timestamp){const d=new Date(timestamp+OFFSET);return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours()};}
  function resolve(date,value,now=Date.now()){
    const hh=hour(value);if(hh==='')return null;
    const m=String(date||'').trim().match(/^(\d{1,2})[\/-](\d{1,2})$/);if(!m)throw new Error('Nhập ngày mở BAN trước khi chọn giờ.');
    const day=Number(m[1]),month=Number(m[2]),today=parts(now),year=today.year+(today.month>=10&&month<=3?1:0);
    const ts=Date.UTC(year,month-1,day,Number(hh))-OFFSET,check=parts(ts);
    if(check.year!==year||check.month!==month||check.day!==day)throw new Error('Ngày mở BAN không hợp lệ.');
    return ts;
  }
  function normalize(row={}){let hh='';try{hh=hour(row.unlockHour);}catch(_){}return{unlockHour:hh,unlockAt:Number(row.unlockAt)||0,banReminder6At:Number(row.banReminder6At)||0,banReminder1At:Number(row.banReminder1At)||0};}
  function target(row,now=Date.now()){
    if(!row?.unlockDate)return null;let hh;try{hh=hour(row.unlockHour);}catch(_){return null;}if(hh==='')return null;
    const stored=Number(row.unlockAt);if(stored>0&&Number.isFinite(stored)){const p=parts(stored),m=String(row.unlockDate).match(/^(\d{1,2})[\/-](\d{1,2})$/);if(m&&p.day===Number(m[1])&&p.month===Number(m[2])&&p.hour===Number(hh))return stored;}
    try{return resolve(row.unlockDate,hh,now);}catch(_){return null;}
  }
  function fields(date,value,now=Date.now()){const hh=hour(value);if(!date&&hh!=='')throw new Error('Nhập ngày mở BAN trước khi chọn giờ.');const ts=date?resolve(date,hh||'00',now):0;return{unlockHour:date?hh:'',unlockAt:date&&hh!==''?ts:0,banReminder6At:0,banReminder1At:0};}
  function countdown(ts,now=Date.now()){if(!ts)return 'Chưa rõ giờ';const ms=ts-now;if(ms<=0)return 'Đã đến giờ mở BAN';const sec=Math.ceil(ms/1000),d=Math.floor(sec/86400),h=Math.floor(sec/3600)%24,m=Math.floor(sec/60)%60,s=sec%60,pad=n=>String(n).padStart(2,'0');return 'Còn '+(d?d+' ngày ':'')+pad(h)+':'+pad(m)+':'+pad(s);}
  function status(row,now=Date.now()){const ts=target(row,now);if(!ts)return null;const isBanned=now<ts,isJustUnbanned=!isBanned&&row.unbanCleared!==true;return{isBanned,isJustUnbanned,target:ts,desc:isBanned?'🚫 BAN · '+countdown(ts,now):isJustUnbanned?'🎉 VỪA MỞ BAN':'🟢 HOẠT ĐỘNG'};}
  function reminders(row,now=Date.now()){const ts=target(row,now);if(!ts||row.category==='chungsuc'||row.unbanReviewPending)return[];const diff=ts-now;if(diff<=0||diff>6*HOUR)return[];const stage=diff<=HOUR?1:6,field=stage===1?'banReminder1At':'banReminder6At';return Number(row[field])===ts?[]:[{stage,field,target:ts,id:'ban_reminder_'+String(row.id)+'_'+ts+'_'+stage}];}
  function options(selected=''){let hh='';try{hh=hour(selected);}catch(_){}return '<option value="">Chưa rõ giờ</option>'+Array.from({length:24},(_,i)=>{const n=String(i).padStart(2,'0');return '<option value="'+n+'"'+(hh===n?' selected':'')+'>'+n+':00</option>';}).join('');}
  function label(row){let hh='';try{hh=hour(row?.unlockHour);}catch(_){}return String(row?.unlockDate||'')+(hh!==''?' '+hh+':00 (VN)':'');}
  const api={HOUR,hour,parts,resolve,normalize,target,fields,countdown,status,reminders,options,label};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.banSchedule=api;
})(typeof window==='undefined'?globalThis:window);
