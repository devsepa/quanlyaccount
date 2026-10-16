const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..')+require('node:path').sep,html=fs.readFileSync(root+'index.html','utf8'),lib=require(root+'filter-queue.js');
const base={id:'a',username:'test',category:'rank',rank:'KC',uyTin:'100'};
test('two admins editing different fields preserve both changes',()=>{const result=lib.mergeMainAccounts([{...base,rank:'CT'}],[{...base,uyTin:'90'}],[base]);assert.equal(result[0].rank,'CT');assert.equal(result[0].uyTin,'90')});
test('conflicting destinations cannot silently overwrite each other',()=>assert.throws(()=>lib.mergeMainAccounts([{...base,rank:'CT'}],[{...base,rank:'BK'}],[base]),/thiết bị khác/));
test('stale local edit cannot resurrect an account another admin deleted',()=>assert.throws(()=>lib.mergeMainAccounts([],[{...base,rank:'BK'}],[base])));
test('stale deletion cannot delete another admins updated record',()=>assert.throws(()=>lib.mergeMainAccounts([{...base,rank:'CT'}],[],[base])));
test('same intended change on both devices is idempotent',()=>assert.equal(lib.mergeMainAccounts([{...base,rank:'CT'}],[{...base,rank:'CT'}],[base])[0].rank,'CT'));
test('new IDs cannot introduce duplicate usernames during concurrent adds',()=>assert.throws(()=>lib.mergeMainAccounts([base],[{...base,id:'b',username:'TEST'}],[])));
function setup({offline=false,fail=false,throwNetwork=false}={}){
 const store=new Map(),calls=[],events=[];
 const c={console:{error(){}},Date,Math,JSON,Set,Map,AbortController,isAdmin:true,navigator:{onLine:!offline},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},getUserName:()=> 'First Admin',showToast(){},renderAdminAudit(){},flushAdminAudit(){},accounts:[{...base}],localSyncRevision:1,pushInFlight:false,syncPending:true,autoSyncTimer:null,syncState:'pending',btnPushCloud:null,cloudModal:null,ADMIN_PIN_DEFAULT:'mock',FIREBASE_ENDPOINT:'https://mock',getNotificationList:()=>[],getTeleConfig:()=>({}),isEmergencyLocked:false,markSyncPending(v){c.syncPending=v},renderSyncStatus(){},updateCloudUI(){},showNotice(){},escapeHtml:v=>v,setTimeout:()=>1,clearTimeout(){},filterQueue:{async writeMainPayload(payload){calls.push(payload);if(c.onWrite)await c.onWrite();if(throwNetwork)throw new Error('offline');return{ok:!fail,json:async()=>({error:'denied'})}}}};c.window=c;vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('      let adminAuditState ='),html.indexOf('      function flushAdminAudit()')),c);
 vm.runInContext(html.slice(html.indexOf('      async function pushToCloud('),html.indexOf('      // TỰ ĐỘNG ĐỒNG BỘ NGẦM')),c);
 return {c,store,calls,read:expr=>vm.runInContext(expr,c)};
}
test('offline move remains pending with no successful audit entry',async()=>{const x=setup({offline:true});x.c.recordAdminAudit('move',base,{from:'unban',to:'rank'});await x.c.pushToCloud(true);assert.equal(x.calls.length,0);assert.equal(x.read('getAdminAuditState().entries.length'),0);assert.equal(JSON.parse(x.store.get('lq_account_audit_waiting')).length,1)});
test('Firebase rejection preserves pending audit rather than logging success',async()=>{const x=setup({fail:true});x.c.recordAdminAudit('move',base,{from:'unban',to:'rank'});await x.c.pushToCloud(true);assert.equal(x.read('getAdminAuditState().entries.length'),0);assert.equal(x.read('pendingAccountAudits.length'),1);assert.equal(x.c.syncPending,true)});
test('network exception never logs successful move',async()=>{const x=setup({throwNetwork:true});x.c.recordAdminAudit('move',base,{to:'rank'});await x.c.pushToCloud(true);assert.equal(x.read('getAdminAuditState().entries.length'),0);assert.equal(x.read('pendingAccountAudits.length'),1)});
test('confirmed Firebase write publishes audit once with original actor',async()=>{const x=setup();x.c.recordAdminAudit('move',base,{from:'unban',to:'rank'});x.c.getUserName=()=> 'Second Admin';await x.c.pushToCloud(true);assert.equal(x.read('getAdminAuditState().entries.length'),1);assert.equal(x.read('getAdminAuditState().entries[0].actor'),'First Admin');assert.equal(x.read('pendingAccountAudits.length'),0);await x.c.pushToCloud(true);assert.equal(x.read('getAdminAuditState().entries.length'),1)});
test('new move during an in-flight save waits for next confirmed revision',async()=>{const x=setup();x.c.recordAdminAudit('move',base,{to:'rank'});x.c.onWrite=async()=>{x.c.accounts[0].category='chungsuc';x.c.localSyncRevision++;x.c.recordAdminAudit('move',x.c.accounts[0],{to:'chungsuc'});};await x.c.pushToCloud(true);assert.equal(x.read('pendingAccountAudits.length'),1);assert.equal(x.read('getAdminAuditState().entries.length'),1);assert.equal(x.calls[0].accounts[0].category,'rank');assert.equal(x.c.syncPending,true)});
test('intermediate unsaved destination is not reported as a saved move',async()=>{const x=setup();x.c.recordAdminAudit('move',{...base,category:'chungsuc'},{to:'chungsuc'});x.c.recordAdminAudit('move',base,{to:'rank'});await x.c.pushToCloud(true);assert.equal(x.read('getAdminAuditState().entries.length'),1);assert.equal(x.read('getAdminAuditState().entries[0].to'),'rank')});
test('local JS and CSS all use one release identifier',()=>{const refs=[...html.matchAll(/(?:src|href)="((?:styles\/[^"?]+\.css|[^"/?]+\.js)(?:\?[^" ]*)?)"/g)].map(m=>m[1]);assert.ok(refs.length>=10);const versions=[...new Set(refs.map(r=>r.split('?v=')[1]))];assert.equal(versions.length,1);assert.ok(versions[0])});
test('all updated JavaScript and inline scripts compile',()=>{for(const file of ['filter-queue.js','admin-account-tools.js','telegram-transfers.js','telegram-daily.js','dashboard-ui.js'])new vm.Script(fs.readFileSync(root+file,'utf8'));for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);});

function telegramSetup(mode){const states=[],retries=new Map();let requests=0;const c={Date,Math,AbortSignal,isAdmin:true,normalizeTelegramChatId:v=>v,showToast(){},fetch:async()=>{requests++;if(mode==='timeout')throw new Error('lost');return{json:async()=>mode==='ok'?{ok:true}:{ok:false,error_code:429,parameters:{retry_after:40}}}},warehouseTransferTele:{trackState:(n,state)=>states.push({n,state}),registerRetry:(id,callback)=>callback?retries.set(id,callback):retries.delete(id)}};c.window=c;vm.createContext(c);vm.runInContext(html.slice(html.indexOf('      async function sendTelegramMessage('),html.indexOf('      window.handleTestTele')),c);return{c,states,retries,requests:()=>requests};}
test('legacy Telegram messages expose success without storing message credentials in history',async()=>{const x=telegramSetup('ok');assert.equal(await x.c.sendTelegramMessage('mock','channel','SECRET-PASSWORD'),true);assert.deepEqual(x.states.map(s=>s.state),['sending','sent']);assert.ok(!JSON.stringify(x.states).includes('SECRET-PASSWORD'));assert.equal(x.retries.size,0)});
test('known Telegram rejection exposes retry but honors retry_after and Admin role',async()=>{const x=telegramSetup('fail');assert.equal(await x.c.sendTelegramMessage('mock','channel','message'),false);assert.deepEqual(x.states.map(s=>s.state),['sending','retry']);assert.equal(x.retries.size,1);await [...x.retries.values()][0]();assert.equal(x.requests(),1);x.c.isAdmin=false;await [...x.retries.values()][0]();assert.equal(x.requests(),1)});
test('ambiguous Telegram network error is visible and cannot be blindly retried',async()=>{const x=telegramSetup('timeout');assert.equal(await x.c.sendTelegramMessage('mock','channel','message'),false);assert.deepEqual(x.states.map(s=>s.state),['sending','uncertain']);assert.equal(x.retries.size,0)});

test('unban return accepts missing cloud flags and normalized default values',()=>{
 const raw={id:'old',username:'onepiece15',category:'rank',rank:'KC',uyTin:90,unlockDate:'16/10'};
 const before={...raw,uyTin:'90',unbanReviewPending:false,unbanCleared:false,unbanReviewedAt:0,unbanReviewedBy:'',lastUsedBy:'',useCount:0};
 const moved={...before,unlockDate:'',unbanCleared:true,unbanReviewedAt:1234,unbanReviewedBy:'Admin'};
 const merged=lib.mergeMainAccounts([raw],[moved],[before]);assert.equal(merged.length,1);assert.equal(merged[0].unlockDate,'');assert.equal(merged[0].unbanCleared,true);assert.equal(merged[0].unbanReviewedAt,1234);
});
test('numeric cloud trust and string UI trust do not create a false conflict',()=>{
 const raw={...base,uyTin:90};const before={...raw,uyTin:'90'};const merged=lib.mergeMainAccounts([raw],[{...before,uyTin:'95'}],[before]);assert.equal(merged[0].uyTin,'95');
});
test('same committed unban return can be merged again after a lost response',()=>{
 const before={...base,unlockDate:'16/10',unbanCleared:false,unbanReviewedAt:0};const moved={...before,unlockDate:'',unbanCleared:true,unbanReviewedAt:1234};assert.deepEqual(lib.mergeMainAccounts([moved],[moved],[before]),[moved]);
});
test('actual conflicting field still stops the save with an explicit conflict code',()=>{
 assert.throws(()=>lib.mergeMainAccounts([{...base,rank:'CT'}],[{...base,rank:'BK'}],[base]),error=>error.code==='ACCOUNT_CONFLICT');
});
test('normalized defaults do not overwrite unrelated remote changes during a move',()=>{
 const raw={...base,unlockDate:'16/10'};const before={...raw,unbanCleared:false,unbanReviewedAt:0,lastUsedBy:''};const merged=lib.mergeMainAccounts([{...raw,lastUsedBy:'Other'}],[{...before,unlockDate:'',unbanCleared:true,unbanReviewedAt:12}],[before]);assert.equal(merged[0].lastUsedBy,'Other');assert.equal(merged[0].unbanCleared,true);
});
test('background sync does not keep retrying an unchanged known conflict or open dialogs',async()=>{
 const x=setup();let notices=0;x.c.showNotice=()=>notices++;x.c.onWrite=async()=>{const error=new Error('conflict');error.code='ACCOUNT_CONFLICT';throw error;};await x.c.pushToCloud(true);for(let i=0;i<5;i++)await x.c.pushToCloud(true);assert.equal(x.calls.length,1);assert.equal(notices,0);assert.equal(x.c.syncPending,true);assert.equal(x.read('getAdminAuditState().entries.length'),0);
});
test('foreground conflict is labelled correctly and only shown once per unchanged revision',async()=>{
 const x=setup(),notices=[];x.c.showNotice=notice=>notices.push(notice);x.c.onWrite=async()=>{const error=new Error('conflict');error.code='ACCOUNT_CONFLICT';throw error;};await x.c.pushToCloud(false);await x.c.pushToCloud(false);assert.equal(notices.length,1);assert.equal(notices[0].title,'Xung đột dữ liệu');
});
test('new local changes can retry after a known conflict and successful save clears it',async()=>{
 const x=setup();x.c.onWrite=async()=>{const error=new Error('conflict');error.code='ACCOUNT_CONFLICT';throw error;};await x.c.pushToCloud(true);x.c.localSyncRevision++;x.c.onWrite=null;await x.c.pushToCloud(true);assert.equal(x.calls.length,2);assert.equal(x.c.syncPending,false);assert.equal(x.read('syncConflictRevision'),null);
});
test('main-save helper distinguishes background silent saves from foreground actions',async()=>{
 const source=fs.readFileSync(root+'filter-queue.js','utf8'),args=[],c={Date,pushInFlight:false,syncPending:true,pushToCloud:async silent=>{args.push(silent);c.syncPending=false;}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  async function waitForMainSave('),source.indexOf('  async function transferSelected(')),c);await c.waitForMainSave({silent:true});c.syncPending=true;await c.waitForMainSave();assert.deepEqual(args,[true,false]);
});
test('Telegram outbox always waits for main synchronization silently',async()=>{
 const storage=new Map(),args=[],c={console,Date,AbortController,isAdmin:true,FIREBASE_DB_URL:'https://mock',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{onLine:true},document:{hidden:false,getElementById:()=>null,addEventListener(){}},addEventListener(){},setInterval(){},setTimeout:()=>1,clearTimeout(){},getTeleConfig:()=>({token:'mock',chatId:'channel'}),filterQueue:{waitForSave:async options=>{args.push(options);throw new Error('pending');}},showToast(){},fetch(){throw new Error('must not send before saving');}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(root+'telegram-transfers.js','utf8'),c);c.warehouseTransferTele.enqueue({id:'move',kind:'transfer',category:'rank',timestamp:Date.now()});await c.warehouseTransferTele.flush();assert.equal(args.length,1);assert.equal(args[0].silent,true);assert.equal(JSON.parse(storage.get('lq_transfer_tele_queue')).length,1);
});

function deviceStatsContext() {
 const c={isValidUserName:n=>typeof n==='string' && n.trim().length>1,Map};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('      function groupDeviceRecords('),html.indexOf('      async function readDeviceRecords(')),c);
 const source=fs.readFileSync(root+'analytics-report.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function analyticsDeviceGroups('),source.indexOf('let analyticsDevicesLoading')),c);
 return c;
}
test('analytics counts linked browsers once per physical device group',()=>{
 const c=deviceStatsContext();const stats=c.analyticsDeviceGroups({a:{userName:'Duy',physicalDeviceId:'phone'},b:{userName:'Duy Chrome',physicalDeviceId:'phone'},c:{userName:'Duy',physicalDeviceId:'pc'},d:{userName:'Duy'}});
 assert.equal(stats.groups,3);assert.equal(stats.browsers,4);
});
test('device statistics match management eligibility and accept an empty registry',()=>{
 const c=deviceStatsContext();const stats=c.analyticsDeviceGroups({a:null,b:{userName:''},c:{userName:'khách'},d:{status:'blocked'},e:{isAdmin:true}});
 assert.equal(stats.groups,2);assert.equal(stats.browsers,2);assert.equal(c.analyticsDeviceGroups(null).groups,0);
});

test('emergency restrictions apply only to guests, including role changes',()=>{
 const c={isAdmin:false,isEmergencyLocked:true};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('      function isGuestEmergencyLocked()'),html.indexOf('      function updateAdminUI()')),c);
 assert.equal(c.isGuestEmergencyLocked(),true);c.isAdmin=true;assert.equal(c.isGuestEmergencyLocked(),false);c.isAdmin=false;assert.equal(c.isGuestEmergencyLocked(),true);c.isEmergencyLocked=false;assert.equal(c.isGuestEmergencyLocked(),false);
});
test('admin password privacy remains available during guest emergency lock',()=>{
 const source=fs.readFileSync(root+'account-privacy.js','utf8');assert.ok(!source.includes('isEmergencyLocked'));assert.ok(source.includes('if(!isAdmin)'));assert.ok(html.includes('if (isGuestEmergencyLocked())'));
});

test('PIN opens after navigation closes and focuses within the same user gesture',()=>{
 const events=[],input={value:'old',focus(){events.push('focus')}},modal={classList:{add(value){events.push(value)}}};
 const c={window:{},CustomEvent:class{constructor(type){this.type=type}},document:{dispatchEvent(event){events.push(event.type)},getElementById(id){return id==='pin-modal'?modal:input}},setTimeout(){throw new Error('Delayed focus loses iOS user activation')}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('      window.openPinModal ='),html.indexOf('      window.closePinModal =')),c);
 c.window.openPinModal();assert.deepEqual(events,['dashboard:close-navigation','show','focus']);assert.equal(input.value,'');
});
