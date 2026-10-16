(function(global){
  'use strict';
  const visible=new Map(), LIMIT=2, DURATION=15000;
  let timer=null, events=[], lastAlert=0, sending=false;
  try{const saved=JSON.parse(sessionStorage.getItem('lq_privacy_activity')||'null');if(saved){events=Array.isArray(saved.events)?saved.events:[];lastAlert=Number(saved.lastAlert)||0;}}catch(_){}
  function persist(){try{sessionStorage.setItem('lq_privacy_activity',JSON.stringify({events,lastAlert}));}catch(_){}}
  function record(action,id){
    if(!['open','copy'].includes(action))return;
    const now=Date.now();
    events=events.filter(e=>Number(e.at)>now-60000&&Number(e.at)<=now);
    events.push({action,id:String(id),at:now});events=events.slice(-200);persist();
    const count=new Set(events.map(e=>e.id)).size;
    if(count<10||now-lastAlert<300000||sending)return;
    const config=getTeleConfig();if(!config?.token||!config?.chatId)return;
    lastAlert=now;persist();sending=true;
    const actor=escapeHtml(getUserName()||'Chưa đặt tên');
    const text=`⚠️ CẢNH BÁO THAO TÁC HÀNG LOẠT\nNgười thao tác: <b>${actor}</b>\nVai trò: ${isAdmin?'Admin':'Khách'}\n${count} tài khoản khác nhau trong 60 giây.\nMở mật khẩu: ${events.filter(e=>e.action==='open').length} lượt; sao chép: ${events.filter(e=>e.action==='copy').length} lượt.\nThời gian: ${new Date(now).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false})}\nĐây là cảnh báo tần suất thao tác, không phải phát hiện chụp/quay màn hình.`;
    Promise.resolve(sendTelegramMessage(config.token,config.chatId,text)).catch(()=>{}).finally(()=>{sending=false;});
  }
  function syncVisibility(){
    isGlobalPasswordMasked=true;singlePasswordVisible={};
    for(const id of visible.keys())if(!id.startsWith('filter:'))singlePasswordVisible[id]=true;
  }
  function schedule(){
    clearTimeout(timer);
    if(visible.size)timer=setTimeout(()=>{
      const now=Date.now();for(const [id,until] of visible)if(until<=now)visible.delete(id);
      syncVisibility();schedule();renderList();
    },Math.max(0,Math.min(...visible.values())-Date.now()));
  }
  function conceal(){const changed=visible.size||!isGlobalPasswordMasked||Object.keys(singlePasswordVisible).length;visible.clear();syncVisibility();schedule();if(changed)renderList();}
  function toggle(id){
    if(!isAdmin||isEmergencyLocked){showToast('Không có quyền xem mật khẩu hoặc hệ thống đang khóa.');return;}
    id=String(id);
    if(visible.has(id))visible.delete(id);
    else{while(visible.size>=LIMIT)visible.delete(visible.keys().next().value);visible.set(id,Date.now()+DURATION);record('open',id);}
    syncVisibility();schedule();renderList();
  }
  global.accountPrivacy={toggle,record,isVisible:id=>isAdmin&&!isEmergencyLocked&&(visible.get(String(id))||0)>Date.now(),conceal};
  global.toggleSinglePassword=toggle;
  global.toggleAllPasswordVisibility=()=>{conceal();showToast('Chỉ hiện tối đa 2 mật khẩu. Bấm biểu tượng mắt ở từng acc; tự che sau 15 giây.');};
  const label=document.getElementById('admin-pass-toggle-text');if(label)label.textContent='Che mật khẩu';
  document.addEventListener('visibilitychange',()=>{if(document.hidden)conceal();});
  global.addEventListener('pagehide',conceal);
  global.addEventListener('blur',conceal);
  syncVisibility();renderList();
})(window);
