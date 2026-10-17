'use strict';
const {initializeApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database'),{getAuth}=require('firebase-admin/auth');
const {onSchedule}=require('firebase-functions/v2/scheduler'),{onRequest}=require('firebase-functions/v2/https'),{onValueWritten}=require('firebase-functions/v2/database'),{defineSecret}=require('firebase-functions/params');
const {hash,reminderPlan,auditChanges,applyGuestCopy,transferPlan}=require('./domain.cjs');
initializeApp();const db=getDatabase(),region='asia-southeast1',bot=defineSecret('BAN_TELEGRAM_BOT_TOKEN'),chat=defineSecret('BAN_TELEGRAM_CHAT_ID');
const escape=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// One durable outbox ID per account/deadline/stage. Ambiguous delivery is never resent automatically.
async function deliver(id){const ref=db.ref('app_data/serverReminderOutbox/'+id),claim=await ref.transaction(value=>{if(!value||value.state!=='pending')return;return {...value,state:'sending',startedAt:Date.now()};});if(!claim.committed)return;const event=claim.snapshot.val();
 try{const text=(event.kind==='ban-opened'?'🎉 Acc đến giờ mở BAN':'⏰ Nhắc trước '+event.reminderStage+' giờ')+'\n<b>'+escape(event.firstAccount)+'</b>\nMở BAN: '+escape(new Date(event.unlockAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}));
  const response=await fetch('https://api.telegram.org/bot'+bot.value()+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat.value(),text,parse_mode:'HTML'}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok){await ref.update({state:'failed',error:'Telegram từ chối gửi; cần kiểm tra cấu hình.',finishedAt:Date.now()});return;}await ref.update({state:'sent',messageId:result.result.message_id,finishedAt:Date.now()});
 }catch(_){await ref.update({state:'uncertain',error:'Chưa xác minh được kết quả; không tự gửi lại.',finishedAt:Date.now()});}
}
exports.banClock=onSchedule({schedule:'every 1 minutes',timeZone:'Asia/Ho_Chi_Minh',region,secrets:[bot,chat],maxInstances:1,timeoutSeconds:120},async()=>{
 if((await db.ref('server_settings/schedulerEnabled').get()).val()!==true)return;
 const now=Date.now();await db.ref('app_data').transaction(current=>{if(!current)return;const plan=reminderPlan(current,now);if(!plan.events.length)return;plan.next.serverReminderOutbox ||= {};for(const event of plan.events)plan.next.serverReminderOutbox[event.id] ||= {...event,state:'pending'};return plan.next;});
 const pending=(await db.ref('app_data/serverReminderOutbox').orderByChild('state').equalTo('pending').limitToFirst(40).get()).val()||{};for(const id of Object.keys(pending))await deliver(id);
 // Retain receipt IDs; flag interrupted sends rather than risking duplicate Telegram messages.
 const sending=(await db.ref('app_data/serverReminderOutbox').orderByChild('state').equalTo('sending').get()).val()||{};for(const[id,event]of Object.entries(sending))if(now-event.startedAt>300000)await db.ref('app_data/serverReminderOutbox/'+id).update({state:'uncertain',error:'Phiên gửi bị gián đoạn.'});
});
exports.dailyBackup=onSchedule({schedule:'15 3 * * *',timeZone:'Asia/Ho_Chi_Minh',region,maxInstances:1},async()=>{
 const data=(await db.ref().get()).val()||{};if(!data.app_data||!data.server_settings?.backupEnabled)return;const timestamp=Date.now(),id='auto_'+new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp)),record={id,timestamp,accountsCount:Object.values(data.app_data.accounts||{}).length,filterCount:Object.values(data.filter_queue||{}).filter(r=>r?.username).length,app_data:data.app_data,filter_queue:data.filter_queue||{}};
 const old=Object.entries(data.backup_index||{}).sort((a,b)=>b[1].timestamp-a[1].timestamp).slice(29),patch={['backups/'+id]:record,['backup_index/'+id]:{timestamp,accountsCount:record.accountsCount,filterCount:record.filterCount}};for(const[key]of old){patch['backups/'+key]=null;patch['backup_index/'+key]=null;}await db.ref().update(patch);
});
// Server-side audit survives a modified client. It deliberately omits password contents.
exports.auditAccounts=onValueWritten({ref:'/app_data',region,instance:'aopvman-default-rtdb'},async event=>{
 const before=event.data.before.val()||{},after=event.data.after.val()||{},entries=auditChanges(before.accounts,after.accounts);if(!entries.length)return;
 const patch={};entries.forEach((entry,index)=>{const id='server_'+hash(event.id).slice(0,24)+'_'+index;patch[id]={...entry,id,timestamp:Date.parse(event.time)||Date.now(),actor:after.lastWriterUid||'Hệ thống / phiên cũ',uid:after.lastWriterUid||'',source:'server'};});await db.ref('admin_audit').update(patch);
});
async function identity(req,admin){const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const user=await getAuth().verifyIdToken(token,true);if(admin&&(!user.admin||(await db.ref('admin_access/'+user.uid).get()).val()!==true))throw new Error('Cần tài khoản Admin đã được cấp quyền.');return user;}
function endpoint(admin,action){return onRequest({region,cors:true,maxInstances:5},async(req,res)=>{if(req.method!=='POST'){res.status(405).json({error:'Chỉ nhận POST.'});return;}try{const user=await identity(req,admin);res.json(await action(req.body||{},user));}catch(err){res.status(400).json({error:err.message==='Firebase ID token has expired.'?'Phiên đã hết hạn.':String(err.message||'Thao tác thất bại.')});}});}
exports.copyGuestAccount=endpoint(false,async(body,user)=>{
 if(!body.requestId||!/^[\w-]{8,80}$/.test(body.requestId))throw new Error('Thiếu mã thao tác.');
 if((await db.ref('devices/'+user.uid+'/status').get()).val()==='blocked')throw new Error('Thiết bị bị chặn.');
 const result=await db.ref('app_data').transaction(current=>{
  if(!current)throw new Error('Chưa có dữ liệu.');if(current.guestCopyReceipts?.[user.uid]?.[body.requestId])return;
  const now=Date.now();if(now-(Number(current.guestCopyLimits?.[user.uid])||0)<2000)throw new Error('Chờ một chút trước khi sao chép tiếp.');
  const next=applyGuestCopy(current,String(body.id),body.actor||'Khách',now);next.lastWriterUid=user.uid;next.guestCopyLimits ||= {};next.guestCopyLimits[user.uid]=now;next.guestCopyReceipts ||= {};const receipts={...(next.guestCopyReceipts[user.uid]||{}),[body.requestId]:{at:now}};next.guestCopyReceipts[user.uid]=Object.fromEntries(Object.entries(receipts).sort((a,b)=>b[1].at-a[1].at).slice(0,100));return next;
 });
 if(!result.committed&&!(await db.ref('app_data/guestCopyReceipts/'+user.uid+'/'+body.requestId).get()).exists())throw new Error('Chưa lưu được lượt dùng.');
 const copied=Object.values((await db.ref('app_data/accounts').get()).val()||{}).find(a=>a.id===body.id);return {ok:true,username:copied?.username,password:copied?.password};
});
exports.previewCloudBackup=endpoint(true,async body=>{const snapshot=(await db.ref('backups/'+String(body.id)).get()).val();if(!snapshot)throw new Error('Bản lưu không còn tồn tại.');const current=(await db.ref().get()).val(),before=Object.values(current.app_data?.accounts||{}),after=Object.values(snapshot.app_data?.accounts||{}),old=new Map(before.map(a=>[a.id,a])),next=new Map(after.map(a=>[a.id,a]));return {id:body.id,revision:hash([current.app_data,current.filter_queue||{}]),added:after.filter(a=>!old.has(a.id)).length,changed:after.filter(a=>old.has(a.id)&&hash(a)!==hash(old.get(a.id))).length,removed:before.filter(a=>!next.has(a.id)).length,total:after.length,filterCount:Object.values(snapshot.filter_queue||{}).filter(a=>a?.username).length};});
exports.restoreCloudBackup=endpoint(true,async(body,user)=>{const timestamp=Date.now(),recoveryId='before_restore_'+timestamp;
 const result=await db.ref().transaction(root=>{const saved=root?.backups?.[body.id];if(!saved)throw new Error('Bản sao lưu không tồn tại.');if(hash([root.app_data,root.filter_queue||{}])!==body.revision)throw new Error('Dữ liệu đã thay đổi; hãy xem trước lại.');root.backups[recoveryId]={id:recoveryId,timestamp,app_data:root.app_data,filter_queue:root.filter_queue||{}};root.backup_index ||= {};root.backup_index[recoveryId]={timestamp,accountsCount:Object.values(root.app_data?.accounts||{}).length,filterCount:Object.values(root.filter_queue||{}).filter(a=>a?.username).length};root.app_data={...saved.app_data,updatedAt:timestamp,lastWriterUid:user.uid};delete root.app_data.adminPin;delete root.app_data.teleConfig;root.filter_queue=saved.filter_queue||{};root.admin_audit ||= {};root.admin_audit['restore_'+timestamp]={id:'restore_'+timestamp,action:'restore',actor:user.email||user.uid,uid:user.uid,timestamp,count:Object.values(root.app_data.accounts||{}).length,previousCount:root.backup_index[recoveryId].accountsCount,targets:[],source:'server'};return root;});if(!result.committed)throw new Error('Chưa khôi phục.');return {ok:true,recoveryId};
});

exports.revokeAdminAccess=endpoint(true,async(body,user)=>{const uid=String(body.uid||'');if(!uid||uid===user.uid)throw new Error('Không tự thu hồi phiên đang dùng.');const target=await getAuth().getUser(uid);await db.ref('admin_access/'+uid).set(false);await getAuth().setCustomUserClaims(uid,{...target.customClaims,admin:false});await getAuth().revokeRefreshTokens(uid);await db.ref('devices/'+uid).update({isAdmin:false,adminRevoked:true});return {ok:true};});

exports.transferFilterAccount=endpoint(true,async(body,user)=>{let target;const now=Date.now();const result=await db.ref().transaction(root=>{const plan=transferPlan(root,String(body.id),body.destination||{},user.uid,body.duplicateMode,now);target=plan.target;return plan.next;});if(!result.committed)throw new Error('Chưa chuyển được acc.');return {ok:true,target};});
