(function(){
  'use strict';
  const engine=window.banSchedule;if(!engine)return;
  for(const id of ['defaultUnlockHour','fq-unlock-hour']){const select=document.getElementById(id);if(select)select.innerHTML=engine.options();}
  let previousDue='',lastScan=0,needsRender=false;
  function tick(){
    if(document.hidden)return;
    const now=Date.now();
    document.querySelectorAll('[data-ban-deadline]').forEach(node=>{node.textContent=engine.countdown(Number(node.dataset.banDeadline),now);});
    const due=accounts.filter(a=>engine.status(a,now)?.isJustUnbanned||a.unbanReviewPending).map(a=>String(a.id)).sort().join('|');
    if(due!==previousDue){previousDue=due;needsRender=true;updateUnbanWarehouseUI();}
    if(needsRender&&!document.activeElement?.matches('input,select,textarea')){needsRender=false;renderList();}
    if(window.ACCOUNT_CONFIG?.serverScheduler||!isAdmin||now-lastScan<15000)return;lastScan=now;
    let changed=false;const known=new Set(getNotificationList().map(n=>n.id));
    accounts.forEach(account=>engine.reminders(account,now).forEach(reminder=>{
      if(!known.has(reminder.id)){
        pushAccountNotification({id:reminder.id,kind:'ban-reminder',reminderStage:reminder.stage,unlockAt:reminder.target,user:'Hệ thống',category:'rank',count:1,firstAccount:account.username,categoryName:'Nhắc mở BAN',time:new Date(now).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}),timestamp:now},false);
        known.add(reminder.id);
      }
      account[reminder.field]=reminder.target;changed=true;
    }));
    if(changed){saveData();triggerAutoSync();}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastScan=0;tick();}});
  document.addEventListener('focusout',()=>{if(!document.hidden)setTimeout(tick,0);});
  setInterval(tick,1000);tick();
})();
