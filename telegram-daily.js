(function(global){
  'use strict';
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  function dayKey(ms){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const get=k=>parts.find(p=>p.type===k).value;return get('year')+'-'+get('month')+'-'+get('day');}
  function classify(list,now,parse,status){const result={today:[],six:[],tomorrow:[]},seen=new Set(),day=dayKey(now),tomorrow=dayKey(now+86400000);
    for(const row of list||[]){const name=String(row?.username||'').trim().toLowerCase();if(!name||seen.has(name)||!row.unlockDate)continue;seen.add(name);const target=parse(row.unlockDate);if(!target)continue;const diff=target-now,targetDay=dayKey(target);let kind;
      if(diff<=0&&targetDay===day&&status(row.unlockDate,row).isJustUnbanned)kind='today';
      else if(diff>0&&diff<=21600000)kind='six';
      else if(diff>21600000&&diff<=86400000&&targetDay===tomorrow)kind='tomorrow';
      if(kind)result[kind].push({username:String(row.username),password:String(row.password||''),rank:String(row.rank||'')});
    }return result;
  }
  function mergeEntries(previous,incoming){const map=new Map();for(const row of [...(previous||[]),...(incoming||[])])if(row?.username)map.set(String(row.username).trim().toLowerCase(),{username:String(row.username),password:String(row.password||''),rank:String(row.rank||'')});return [...map.values()].sort((a,b)=>a.username.localeCompare(b.username,'vi'));}
  function buildMessage(kind,entries,day){const date=day.slice(8,10)+'/'+day.slice(5,7);const tomorrow=dayKey(Date.parse(day+'T12:00:00+07:00')+86400000);const next=tomorrow.slice(8,10)+'/'+tomorrow.slice(5,7);
    const titles={today:`🎉 <b>THÔNG BÁO: CÓ ${entries.length} NICK VỪA MỞ BAN HÔM NAY (${date})!</b>`,six:`⚡ <b>ĐẾM NGƯỢC: ${entries.length} NICK SẮP MỞ BAN TRONG 6 TIẾNG · ${date}</b>`,tomorrow:`⏳ <b>NHẮC NHỞ: ${entries.length} NICK SẮP MỞ BAN VÀO NGÀY MAI (${next})!</b>`};
    if(!titles[kind])throw new Error('Loại bản tin không hợp lệ.');let text=titles[kind]+'\n\n',shown=0;
    for(const row of entries){const line=`${shown+1}. <code>${esc(row.username+(row.password?':'+row.password:''))}</code>${row.rank?' | Rank: <b>'+esc(row.rank)+'</b>':''}\n`;if(text.length+line.length>3500)break;text+=line;shown++;}
    if(shown<entries.length)text+=`\n… còn ${entries.length-shown} acc, xem đầy đủ trên web.\n`;
    return text+'\n<i>Bản tin được cập nhật trong ngày khi có thêm acc.</i>';
  }
  function createClient({base,fetcher,canWrite,now=()=>Date.now(),storage,owner='client'}){
    async function request(url,options={},timeout=12000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetcher(url,{...options,signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}}
    async function read(path){if(!canWrite())throw new Error('Phiên Admin đã kết thúc.');const res=await request(base+'/'+path+'.json',{headers:{'X-Firebase-ETag':'true'}});if(!res.ok)throw new Error('Không đọc được nhật ký bản tin.');const tag=res.headers.get('ETag');if(!tag)throw new Error('Thiếu phiên bản nhật ký, chưa gửi để tránh trùng.');return{tag,value:await res.json()||{}};}
    async function write(path,tag,value){if(!canWrite())throw new Error('Phiên Admin đã kết thúc.');const res=await request(base+'/'+path+'.json',{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},body:JSON.stringify(value)});if(res.status===412)return false;if(!res.ok)throw new Error('Không lưu được nhật ký bản tin.');return true;}
    function recovery(key){try{return JSON.parse(storage?.getItem('lq_tele_daily_'+key)||'null');}catch(_){return null;}}
    function remember(key,id){try{storage?.setItem('lq_tele_daily_'+key,JSON.stringify({messageId:id}));}catch(_){}}
    async function finalize(path,change){for(let i=0;i<4;i++){const snapshot=await read(path);if(snapshot.value.owner!==owner)throw new Error('Quyền cập nhật bản tin đã thay đổi.');if(await write(path,snapshot.tag,change(snapshot.value)))return;}throw new Error('Nhật ký đang thay đổi, chưa hoàn tất.');}
    async function upsert(config,day,kind,incoming){if(!incoming.length)return 'empty';const chat=String(config.chatId),bot=String(config.token).split(':')[0].replace(/[^a-zA-Z0-9_-]/g,'');const encoded=Array.from(chat).map(c=>c.codePointAt(0).toString(16)).join('_');const key=bot+'_'+encoded+'_'+day+'_'+kind,path='tele_daily_summaries/'+key;
      let locked;
      for(let attempt=0;attempt<4;attempt++){
        const snapshot=await read(path),current=snapshot.value;
        if(current.owner&&Number(current.leaseUntil)>now())return 'busy';
        const remembered=recovery(key),messageId=current.messageId||remembered?.messageId;
        if(!messageId&&['sending','uncertain'].includes(current.state))return 'uncertain';
        const entries=mergeEntries(current.entries,incoming),text=buildMessage(kind,entries,day);
        if(messageId&&current.lastText===text)return 'unchanged';
        locked={...current,day,kind,entries,owner,leaseUntil:now()+120000,state:messageId?'editing':'sending',...(messageId?{messageId}: {})};
        if(await write(path,snapshot.tag,locked))break;locked=null;
      }
      if(!locked)return 'busy';
      const text=buildMessage(kind,locked.entries,day),method=locked.messageId?'editMessageText':'sendMessage';
      let data;
      try{
        if(!canWrite())throw new Error('Phiên Admin đã kết thúc.');
        const response=await request('https://api.telegram.org/bot'+config.token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:config.chatId,...(locked.messageId?{message_id:locked.messageId}:{}),text,parse_mode:'HTML'})});
        try{data=await response.json();}catch(_){throw new Error('Không xác định được kết quả Telegram.');}
        const notModified=locked.messageId&&String(data.description||'').toLowerCase().includes('message is not modified');
        if(!data.ok&&!notModified){await finalize(path,current=>({...current,state:'idle',owner:null,leaseUntil:0,errorCode:Number(data.error_code)||0}));return 'failed';}
        const messageId=locked.messageId||data.result?.message_id;
        if(!messageId)throw new Error('Thiếu mã tin nhắn Telegram.');
        remember(key,messageId);
        await finalize(path,current=>({...current,messageId,lastText:text,state:'sent',owner:null,leaseUntil:0,updatedAt:now(),errorCode:null}));
        return locked.messageId?'edited':'sent';
      }catch(_){
        // An ambiguous send must not automatically create another channel post.
        try{await finalize(path,current=>({...current,state:locked.messageId?'idle':'uncertain',owner:null,leaseUntil:0}));}catch(_){}
        return 'uncertain';
      }
    }
    return {upsert};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={classify,dayKey,mergeEntries,buildMessage,createClient};
  if(typeof document==='undefined')return;
  const owner=global.crypto?.randomUUID?.()||Date.now()+'_'+Math.random().toString(36).slice(2);
  const client=createClient({base:FIREBASE_DB_URL,fetcher:(...args)=>fetch(...args),canWrite:()=>isAdmin,storage:localStorage,owner});let lastFingerprint='';
  global.telegramDaily={async scan(list,config){
    if(!isAdmin||document.hidden||navigator.onLine===false)return;
    const chatId=normalizeTelegramChatId(config.chatId);const grouped=classify(list,Date.now(),parseUnlockTargetTimestamp,checkBanStatus),day=dayKey(Date.now());
    const fingerprint=JSON.stringify([day,chatId,config.token,grouped]);if(fingerprint===lastFingerprint)return;
    let complete=true;
    for(const kind of ['today','six','tomorrow']){if(!grouped[kind].length)continue;const notice={id:'daily_'+day+'_'+kind,category:'rank',firstAccount:'Bản tin BAN '+({today:'hôm nay',six:'6 giờ tới',tomorrow:'ngày mai'}[kind]),timestamp:Date.now()};global.warehouseTransferTele?.trackState(notice,'sending');let result;try{result=await client.upsert({...config,chatId},day,kind,grouped[kind]);}catch(_){result='failed';}global.warehouseTransferTele?.trackState(notice,result==='uncertain'?'uncertain':['busy','failed'].includes(result)?'retry':'sent');if(['busy','failed','uncertain'].includes(result))complete=false;if(result==='uncertain')showToast('Chưa xác minh được bản tin Telegram. Hệ thống không gửi tin mới để tránh trùng.');}
    if(complete)lastFingerprint=fingerprint;
  }};
  setInterval(()=>{if(isAdmin&&!document.hidden&&navigator.onLine!==false)void autoCheckUnbannedAccounts();},60000);
})(typeof window==='undefined'?globalThis:window);
