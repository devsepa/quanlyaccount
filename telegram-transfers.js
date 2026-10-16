(function(global){
  'use strict';
  const STORE='lq_transfer_tele_queue',esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  function formatNotice(n){const store=n.category==='chungsuc'?'Kho Chung Sức':'Kho Rank';return `📦 <b>TÀI KHOẢN ĐƯỢC CHUYỂN VÀO ${store.toUpperCase()}</b>\n\n👤 Người chuyển: <b>${esc(n.user||'Admin')}</b>\n📋 Số lượng: <b>${Number(n.count)||1} acc</b>\n${n.firstAccount?'Tài khoản: <code>'+esc(n.firstAccount)+'</code>\n':''}🕒 ${esc(n.time||'')}\n\n<i>Xem và sử dụng tài khoản trên website.</i>`;}
  function safeNotice(n){return{id:String(n.id),kind:'transfer',category:n.category,user:String(n.user||'Admin'),count:Math.max(1,Number(n.count)||1),firstAccount:String(n.firstAccount||''),time:String(n.time||''),timestamp:Number(n.timestamp)||Date.now()};}
  function createSender({base,fetcher,canWrite,owner,now=()=>Date.now()}){
    async function request(url,options={}){if(!canWrite())throw new Error('Phiên Admin đã kết thúc.');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{return await fetcher(url,{...options,signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}}
    async function read(url){const r=await request(url,{headers:{'X-Firebase-ETag':'true'}});if(!r.ok)throw new Error('Chưa đọc được trạng thái thông báo.');const tag=r.headers.get('ETag');if(!tag)throw new Error('Thiếu mã phiên bản, chưa gửi để tránh trùng.');return{tag,value:await r.json()||{}};}
    async function write(url,tag,value){const r=await request(url,{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},body:JSON.stringify(value)});if(r.status===412)return false;if(!r.ok)throw new Error('Chưa lưu được trạng thái thông báo.');return true;}
    async function send(config,notice){
      const hex=v=>Array.from(String(v)).map(c=>c.codePointAt(0).toString(16)).join('_');
      const bot=String(config.token).split(':')[0].replace(/[^a-zA-Z0-9_-]/g,'');const id=bot+'_'+hex(config.chatId)+'_'+hex(notice.id);if(id.length>700)throw new Error('Mã thông báo quá dài.');
      const url=base+'/tele_transfer_receipts/'+id+'.json';let acquired=false;
      for(let i=0;i<4;i++){const s=await read(url);if(s.value.state==='sent')return{status:'sent'};if(['sending','uncertain'].includes(s.value.state))return{status:'uncertain'};if(Number(s.value.retryAt)>now())return{status:'retry',delay:Number(s.value.retryAt)-now()};if(await write(url,s.tag,{eventId:notice.id,state:'sending',owner,startedAt:now()})){acquired=true;break;}}
      if(!acquired)return{status:'retry',delay:5000};
      async function finish(fields){for(let i=0;i<4;i++){const s=await read(url);if(s.value.owner!==owner)throw new Error('Thông báo đang được xử lý ở thiết bị khác.');if(await write(url,s.tag,{...s.value,...fields}))return;}throw new Error('Chưa lưu được kết quả gửi.');}
      try{
        const response=await request('https://api.telegram.org/bot'+config.token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:config.chatId,text:formatNotice(notice),parse_mode:'HTML'})});
        let data;try{data=await response.json();}catch(_){throw new Error('Không xác định được kết quả Telegram.');}
        if(!data.ok){const delay=Math.max(30000,Number(data.parameters?.retry_after||0)*1000);await finish({state:'retry',retryAt:now()+delay,errorCode:Number(data.error_code)||0});return{status:'retry',delay};}
        await finish({state:'sent',messageId:data.result?.message_id||null,sentAt:now()});return{status:'sent'};
      }catch(_){try{await finish({state:'uncertain'});}catch(_){}return{status:'uncertain'};}
    }
    return {send};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={formatNotice,safeNotice,createSender};
  if(typeof document==='undefined')return;
  let queue=[];try{queue=JSON.parse(localStorage.getItem(STORE)||'[]');if(!Array.isArray(queue))queue=[];}catch(_){}
  let running=false,timer=null;
  const sender=createSender({base:FIREBASE_DB_URL,fetcher:(...args)=>fetch(...args),canWrite:()=>isAdmin,owner:global.crypto?.randomUUID?.()||String(Date.now())});
  function save(){try{localStorage.setItem(STORE,JSON.stringify(queue));}catch(_){}}
  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(()=>{void flush();},delay);}
  function enqueue(notice){if(!isAdmin||notice?.kind!=='transfer'||!['rank','chungsuc'].includes(notice.category))return;const config=getTeleConfig();if(!config?.token||!config?.chatId)return;if(!queue.some(n=>n.id===notice.id))queue.push(safeNotice(notice));queue=queue.slice(-200);save();schedule();}
  async function flush(){if(running||!isAdmin||document.hidden||navigator.onLine===false||!queue.length)return;const config=getTeleConfig();if(!config?.token||!config?.chatId)return;running=true;let delay=1000;
    try{
      // Local moves are announced only after main-list synchronization succeeds.
      await global.filterQueue.waitForSave();
      const notice=queue[0];if(Date.now()-notice.timestamp>86400000){queue.shift();save();return;}
      const result=await sender.send({...config,chatId:normalizeTelegramChatId(config.chatId)},notice);
      if(result.status==='sent'){queue=queue.filter(n=>n.id!==notice.id);save();}
      else if(result.status==='uncertain'){queue=queue.filter(n=>n.id!==notice.id);save();showToast('Chuyển kho đã lưu. Chưa xác minh được Telegram; không tự gửi lặp.');}
      else delay=result.delay||30000;
    }catch(_){delay=30000;}
    finally{running=false;if(queue.length)schedule(delay);}
  }
  global.warehouseTransferTele={enqueue,flush};
  global.addEventListener('online',()=>schedule());document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(()=>{if(isAdmin)void flush();},60000);schedule();
})(typeof window==='undefined'?globalThis:window);
