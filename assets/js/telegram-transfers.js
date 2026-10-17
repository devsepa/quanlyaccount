(function(global){
  'use strict';
  const STORE='lq_transfer_tele_queue',esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  function formatNotice(n){const store=n.category==='chungsuc'?'Kho Chung Sức':'Kho Rank';return `📦 <b>TÀI KHOẢN ĐƯỢC CHUYỂN VÀO ${store.toUpperCase()}</b>\n\n👤 Người chuyển: <b>${esc(n.user||'Admin')}</b>\n📋 Số lượng: <b>${Number(n.count)||1} acc</b>\n${n.firstAccount?'Tài khoản: <code>'+esc(n.firstAccount)+'</code>\n':''}${n.from==='unban'?'Rank: <b>'+esc(n.rank||'Chưa nhập')+'</b> · Uy tín: <b>'+esc(n.uyTin||'Chưa nhập')+'</b>\n':''}🕒 ${esc(n.time||'')}\n\n<i>Xem và sử dụng tài khoản trên website.</i>`;}
  function safeNotice(n){return{id:String(n.id),kind:'transfer',category:n.category,from:n.from==='unban'?'unban':'',rank:String(n.rank||''),uyTin:String(n.uyTin||''),user:String(n.user||'Admin'),count:Math.max(1,Number(n.count)||1),firstAccount:String(n.firstAccount||''),time:String(n.time||''),timestamp:Number(n.timestamp)||Date.now()};}
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
  const HISTORY='lq_transfer_tele_history';
  let history=[];try{history=JSON.parse(localStorage.getItem(HISTORY)||'[]');if(!Array.isArray(history))history=[];}catch(_){}
  function track(notice,state,detail=''){
    history=[{...safeNotice(notice),state,detail,updatedAt:Date.now()},...history.filter(n=>n.id!==notice.id)].slice(0,100);
    try{localStorage.setItem(HISTORY,JSON.stringify(history));}catch(_){}renderDelivery();
  }
  const manualRetries=new Map();
  let deliveryDialog=null;
  function renderDelivery(){
    if(!deliveryDialog)return;
    if(!isAdmin){deliveryDialog.remove();deliveryDialog=null;return;}
    const labels={pending:'Chờ lưu / chờ gửi',sending:'Đang gửi',sent:'Đã gửi',retry:'Lỗi — sẽ thử lại',uncertain:'Chưa xác minh',expired:'Đã quá hạn gửi'};
    deliveryDialog.querySelector('[data-deliveries]').innerHTML=history.map(n=>`<article style="padding:12px 0;border-bottom:1px solid #475569"><strong>${esc(n.firstAccount||'Chuyển kho')}</strong><p>${esc(labels[n.state]||n.state)} · ${esc(new Date(n.updatedAt).toLocaleString('vi-VN'))}</p><p>${esc(n.detail||'')}</p>${n.state==='retry'&&(!n.id.startsWith('direct_')||manualRetries.has(n.id))?'<button type="button" data-retry="'+esc(n.id)+'">Thử lại khi đủ thời gian chờ</button>':''}</article>`).join('')||'<p>Chưa có thông báo trên thiết bị này.</p>';
  }
  function openDelivery(){
    if(!isAdmin)return;
    if(deliveryDialog)deliveryDialog.remove();
    deliveryDialog=document.createElement('dialog');
    deliveryDialog.style.cssText='width:min(520px,calc(100vw - 24px));max-height:80vh;overflow:auto;box-sizing:border-box;background:#101827;color:#e2e8f0;border:1px solid #64748b;border-radius:14px;padding:18px;overflow-wrap:anywhere';
    deliveryDialog.innerHTML='<h3>Trạng thái Telegram</h3><p>Lịch sử 100 thông báo gần nhất trên thiết bị này. Mục chưa xác minh cần kiểm tra trong Telegram; hệ thống không tự gửi lại để tránh trùng.</p><button type="button" data-close>Đóng</button><div data-deliveries aria-live="polite"></div>';
    deliveryDialog.addEventListener('click',event=>{if(event.target.closest('[data-close]'))deliveryDialog.close();const retry=event.target.closest('[data-retry]');if(retry){if(manualRetries.has(retry.dataset.retry))void manualRetries.get(retry.dataset.retry)();else if(retry.dataset.retry.startsWith('daily_'))void global.telegramDaily?.scan(accounts,getTeleConfig());else schedule();showToast('Đã yêu cầu thử lại. Hệ thống vẫn tuân thủ thời gian chờ Telegram.');}});
    document.body.appendChild(deliveryDialog);renderDelivery();deliveryDialog.showModal();
  }
  function updateDeliveryButton(){
    document.getElementById('telegram-delivery-status')?.remove();
    if(!isAdmin&&deliveryDialog){deliveryDialog.remove();deliveryDialog=null;}
  }
  let running=false,timer=null;
  const sender=createSender({base:FIREBASE_DB_URL,fetcher:(...args)=>fetch(...args),canWrite:()=>isAdmin,owner:global.crypto?.randomUUID?.()||String(Date.now())});
  function save(){updateDeliveryButton();try{localStorage.setItem(STORE,JSON.stringify(queue));}catch(_){}}
  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(()=>{void flush();},delay);}
  function enqueue(notice){if(!isAdmin||notice?.kind!=='transfer'||!['rank','chungsuc'].includes(notice.category))return;if(global.ACCOUNT_CONFIG?.serverScheduler&&notice.from==='unban'){track(notice,'pending','Đang chờ máy chủ gửi Telegram.');return;}const config=getTeleConfig();if(!config?.token||!config?.chatId)return;if(!queue.some(n=>n.id===notice.id)){queue.push(safeNotice(notice));track(notice,'pending');}queue=queue.slice(-200);save();schedule();}
  async function flush(){if(running||!isAdmin||document.hidden||navigator.onLine===false||!queue.length)return;const config=getTeleConfig();if(!config?.token||!config?.chatId)return;running=true;let delay=1000;
    try{
      // Local moves are announced only after main-list synchronization succeeds.
      await global.filterQueue.waitForSave({silent:true});
      const notice=queue[0];if(Date.now()-notice.timestamp>86400000){track(notice,'expired');queue.shift();save();return;}
      track(notice,'sending');
      const result=await sender.send({...config,chatId:normalizeTelegramChatId(config.chatId)},notice);
      if(result.status==='sent'){track(notice,'sent');queue=queue.filter(n=>n.id!==notice.id);save();}
      else if(result.status==='uncertain'){track(notice,'uncertain','Kiểm tra kênh Telegram trước khi xử lý tiếp.');queue=queue.filter(n=>n.id!==notice.id);save();showToast('Chuyển kho đã lưu. Chưa xác minh được Telegram; không tự gửi lặp.');}
      else {delay=result.delay||30000;track(notice,'retry','Thử lại sau '+Math.ceil(delay/1000)+' giây.');}
    }catch(_){delay=30000;if(queue[0])track(queue[0],'retry','Chưa lưu được danh sách hoặc mất kết nối.');}
    finally{running=false;if(queue.length)schedule(delay);}
  }
  global.warehouseTransferTele={enqueue,flush,openDelivery,trackState:track,registerRetry(id,callback){if(callback)manualRetries.set(id,callback);else manualRetries.delete(id);while(manualRetries.size>100)manualRetries.delete(manualRetries.keys().next().value);}};
  queue.forEach(n=>{if(!history.some(h=>h.id===n.id))track(n,'pending');});
  document.addEventListener('visibilitychange',updateDeliveryButton);updateDeliveryButton();
  global.addEventListener('online',()=>schedule());document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(()=>{if(isAdmin)void flush();},60000);schedule();
})(typeof window==='undefined'?globalThis:window);
