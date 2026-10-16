(function(global){
  'use strict';
  const TTL=7*86400000, key=v=>String(v||'').trim().toLowerCase();
  function searchWarehouses(main,queue,query){
    const q=key(query);if(!q)return [];
    return [...Object.values(main||{}).filter(a=>a&&a.username).map(a=>({...a,warehouse:typeof accountWarehouse==='function'?accountWarehouse(a):a.category==='chungsuc'?'chungsuc':'rank'})),...Object.values(queue||{}).filter(a=>a&&a.username).map(a=>({...a,warehouse:'filter',group:queue?.__groups?.[a.groupId]?.number}))].filter(a=>key(a.username).includes(q));
  }
  function restorePlan(entry,main,queue,now){
    if(!entry||now>=Number(entry.expiresAt))throw new Error('Đã quá hạn khôi phục 7 ngày.');
    const names=new Set([...Object.values(main||{}),...Object.values(queue||{})].filter(a=>a&&a.username).map(a=>key(a.username)));
    const kept=[],skipped=[];
    for(const row of entry.rows||[]){if(names.has(key(row.username))){skipped.push(row);continue;}names.add(key(row.username));kept.push(entry.source==='filter'?{...row,status:'pending',owner:null,claimedBy:null,claimedAt:null,transferStartedAt:null}:row);}
    return {kept,skipped};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={searchWarehouses,restorePlan,TTL};
  if(typeof document==='undefined')return;
  const e=escapeHtml, base=FIREBASE_DB_URL;
  let busy=false,searchResults=[],trashEntries=[],searchMain={},searchQueue={},searchPage=0,trashPage=0;
  const bar=document.createElement('div');bar.id='admin-account-tools';bar.hidden=true;
  bar.innerHTML='<button type="button" class="btn btn-tool" id="aat-search">🔎 Tìm toàn bộ kho</button><button type="button" class="btn btn-tool" id="aat-trash">♻ Thùng rác 7 ngày</button>';
  document.getElementById('storage-switcher-bar').after(bar);
  const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.id='account-tools-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','aat-title');
  overlay.innerHTML='<div class="modal-card aat-card"><div class="aat-heading"><h3 id="aat-title"></h3><button type="button" class="btn btn-tool" id="aat-close" aria-label="Đóng">✕</button></div><div id="aat-search-form"><label for="aat-query">Tên tài khoản</label><div class="aat-query"><input id="aat-query" type="search" autocomplete="off" placeholder="Nhập tên tài khoản cần tìm"><button type="button" class="btn btn-tool" id="aat-submit">Tìm</button></div></div><p id="aat-message" role="status"></p><div id="aat-results"></div><div class="aat-pagination"><button type="button" id="aat-prev" class="btn btn-tool">← Trước</button><span id="aat-page"></span><button type="button" id="aat-next" class="btn btn-tool">Sau →</button></div></div>';
  document.body.appendChild(overlay);
  let mode='search';
  const node=id=>document.getElementById(id);
  function guard(){if(!isAdmin)throw new Error('Chỉ Admin được sử dụng.');if(navigator.onLine===false)throw new Error('Cần có mạng để thực hiện thao tác này.');}
  async function request(path,options={}){guard();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const res=await fetch(base+'/'+path+'.json',{...options,cache:'no-store',signal:controller.signal});if(!isAdmin)throw new Error('Phiên Admin đã kết thúc.');return res;}finally{clearTimeout(timer);}}
  async function read(path){const res=await request(path);if(!res.ok)throw new Error('Không tải được dữ liệu.');return res.json();}
  async function transaction(path,change){for(let i=0;i<4;i++){const res=await request(path,{headers:{'X-Firebase-ETag':'true'}});if(!res.ok)throw new Error('Không đọc được dữ liệu.');const tag=res.headers.get('ETag');if(!tag)throw new Error('Thiếu mã phiên bản, chưa thay đổi dữ liệu.');const value=change(await res.json());guard();const saved=await request(path,{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},body:JSON.stringify(value)});if(saved.status===412)continue;if(!saved.ok)throw new Error('Chưa lưu được thay đổi.');return value;}throw new Error('Dữ liệu vừa thay đổi. Hãy thử lại.');}
  async function archive(source,rows,groups={},title='Xóa tài khoản'){
    guard();const now=Date.now(),id='trash_'+(crypto.randomUUID?.()||now+'_'+Math.random().toString(36).slice(2));
    const entry=JSON.parse(JSON.stringify({id,source,rows,groups,title,deletedAt:now,expiresAt:now+TTL,deletedBy:getUserName()}));
    const res=await request('account_trash/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});if(!res.ok)throw new Error('Chưa lưu được bản khôi phục nên chưa xóa.');return entry;
  }
  async function deleteFilter(transport,change,title){
    guard();const before=await transport.read('filter_queue')||{},next=change(before)||{};
    const removed=Object.values(before).filter(r=>r&&r.username&&!next[r.id]);
    const groups={};for(const g of Object.values(before.__groups||{}))if(g?.id&&(!next.__groups?.[g.id]||removed.some(r=>r.groupId===g.id)))groups[g.id]=g;
    if(!removed.length&&!Object.keys(groups).length)return next;
    await archive('filter',removed,groups,title);
    return transport.transaction('filter_queue',current=>{
      const proposed=change(current)||{};
      const actual=Object.values(current||{}).filter(r=>r&&r.username&&!proposed[r.id]);
      if(actual.some(r=>!removed.some(a=>a.id===r.id&&JSON.stringify(a)===JSON.stringify(r))))throw new Error('Acc vừa thay đổi, chưa xóa. Hãy kiểm tra lại.');
      return proposed;
    });
  }
  function refreshRole(){bar.hidden=!isAdmin;if(!isAdmin){overlay.classList.remove('show');node('aat-results').innerHTML='';node('aat-query').value='';searchResults=[];trashEntries=[];searchMain={};searchQueue={};}}
  function close(){overlay.classList.remove('show');searchResults=[];trashEntries=[];searchMain={};searchQueue={};node('aat-results').innerHTML='';}
  function open(value){if(!isAdmin)return;mode=value;searchPage=0;trashPage=0;node('aat-title').textContent=value==='search'?'Tìm tài khoản xuyên ba kho':'Thùng rác · Khôi phục trong 7 ngày';node('aat-search-form').hidden=value!=='search';node('aat-message').textContent=value==='search'?'Tìm theo tên tài khoản. Kết quả không hiển thị mật khẩu.':'Đang tải…';node('aat-results').innerHTML='';overlay.classList.add('show');render();if(value==='trash')void run(loadTrash);else node('aat-query').focus();}
  async function run(action){if(busy)return;busy=true;node('aat-submit').disabled=true;try{guard();await action();}catch(err){if(isAdmin)node('aat-message').textContent=err.name==='AbortError'?'Kết nối quá chậm. Hãy thử lại.':err.message;}finally{busy=false;node('aat-submit').disabled=false;refreshRole();}}
  async function search(){await global.filterQueue.waitForSave();const [main,queue]=await Promise.all([read('app_data/accounts'),read('filter_queue')]);guard();searchMain=main||{};searchQueue=queue||{};searchResults=searchWarehouses(main,queue,node('aat-query').value);searchPage=0;node('aat-message').textContent=searchResults.length+' kết quả trong ba kho.';render();}
  async function loadTrash(){const data=await read('account_trash')||{},now=Date.now();trashEntries=Object.values(data).filter(a=>a&&a.id&&Number(a.expiresAt)>now).sort((a,b)=>b.deletedAt-a.deletedAt);trashPage=Math.min(trashPage,Math.max(0,Math.ceil(trashEntries.length/25)-1));node('aat-message').textContent=trashEntries.length+' mục có thể khôi phục. Chỉ những lần xóa từ khi bật tính năng này được ghi nhận.';render();
    // Expired records are physically cleaned when an admin opens the bin.
    for(const item of Object.values(data)){if(!isAdmin)break;if(item?.id&&Number(item.expiresAt)<=now)await request('account_trash/'+item.id,{method:'DELETE'});}
  }
  function render(){if(!isAdmin)return;const list=mode==='search'?searchResults:trashEntries,page=mode==='search'?searchPage:trashPage,shown=list.slice(page*25,(page+1)*25);
    node('aat-results').innerHTML=mode==='search'?shown.map((r,i)=>`<article class="aat-result"><strong>${e(r.username)}</strong><span>${r.warehouse==='filter'?'Kho cần lọc'+(r.group?' · Nhóm '+e(r.group):''):r.warehouse==='banned'?'Acc đang BAN':r.warehouse==='unban'?'Kho vừa mở BAN':r.warehouse==='rank'?'Kho Rank · '+e(r.rank||'Chưa rank'):'Kho Chung Sức'}</span><small>${r.warehouse==='filter'?(r.status==='pending'?'Chưa lọc':(r.status==='transferring'?'Đang chuyển':'Đang lọc')+' · '+e(r.claimedBy||'Admin')):'Thêm: '+e(formatCreatedTime(r))}</small><button type="button" class="btn btn-tool" data-open="${i}">Mở vị trí</button></article>`).join(''):shown.map((t,i)=>`<article class="aat-result"><strong>${e(t.title)} · ${(t.rows||[]).length} acc</strong><span>${t.source==='filter'?'Kho cần lọc':'Kho Rank / Chung Sức'} · Xóa bởi ${e(t.deletedBy||'Admin')}</span><small>${e(new Date(t.deletedAt).toLocaleString('vi-VN'))} · Hết hạn ${e(new Date(t.expiresAt).toLocaleString('vi-VN'))}</small><details><summary>Xem tài khoản</summary><div class="aat-names">${(t.rows||[]).map(r=>e(r.username)).join(', ')||'Nhóm rỗng'}</div></details><button type="button" class="btn btn-tool" data-restore="${i}">↶ Khôi phục</button></article>`).join('');
    node('aat-page').textContent=(page+1)+' / '+Math.max(1,Math.ceil(list.length/25));node('aat-prev').disabled=page===0;node('aat-next').disabled=(page+1)*25>=list.length;
    node('aat-results').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const r=shown[Number(b.dataset.open)];close();if(r.warehouse==='filter'){switchAccountStorage('filter');void global.filterQueue.openAccount(r.id);}else{void pullFromCloud(true).then(()=>global.revealAccountLocation(r.id));}});
    node('aat-results').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const item=shown[Number(b.dataset.restore)];showNotice({title:'Khôi phục mục đã xóa?',type:'confirm',message:`Khôi phục <b>${(item.rows||[]).length} acc</b> về kho ban đầu? Acc trùng ở bất kỳ kho nào sẽ được bỏ qua; acc kho lọc trở về Chưa lọc.`,onConfirm:()=>run(()=>restore(item.id))});});
  }
  async function restore(id){await global.filterQueue.waitForSave();const entry=await read('account_trash/'+id);const [main,queue]=await Promise.all([read('app_data/accounts'),read('filter_queue')]);let plan;
    if(entry?.source==='filter'){
      await transaction('filter_queue',current=>{plan=restorePlan(entry,main,current,Date.now());const next={...(current||{}),__groups:{...(current?.__groups||{})}};for(const row of plan.kept){if(next[row.id])throw new Error('Mã acc đã tồn tại, chưa ghi đè.');next[row.id]=row;}
        for(const g of Object.values(entry.groups||{})){if(!g?.id)continue;if(plan.kept.some(r=>r.groupId===g.id)||!(entry.rows||[]).length){if(!next.__groups[g.id])next.__groups[g.id]=g;next.__groups.__next=Math.max(Number(next.__groups.__next)||1,Number(g.number)+1);}}
        if(Object.values(next).filter(r=>r&&r.username).length>5000)throw new Error('Kho lọc vượt giới hạn 5.000 acc.');return next;});
    }else{
      await transaction('app_data',current=>{if(syncPending||pushInFlight)throw new Error('Có thay đổi chưa đồng bộ. Hãy thử lại.');const records=Object.values(current?.accounts||{}).filter(r=>r&&r.id&&r.username);plan=restorePlan(entry,records,queue,Date.now());const map=Object.fromEntries(records.map(r=>[r.id,r]));for(const row of plan.kept){if(map[row.id])throw new Error('Mã acc đã tồn tại, chưa ghi đè.');map[row.id]=row;}return {...(current||{}),accounts:map,updatedAt:Date.now()};});
    }
    // Keep skipped accounts available until expiry; never overwrite another restore's trash edits.
    await transaction('account_trash/'+id,current=>{if(!current)return null;const restored=new Set(plan.kept.map(r=>r.id));const remaining=(current.rows||[]).filter(r=>!restored.has(r.id));return remaining.length?{...current,rows:remaining}:null;});
    if(plan.kept.length)recordAdminAudit('restore',plan.kept.map(r=>({...r,category:entry.source==='filter'?'filter':r.category||'rank'})));
    await pullFromCloud(true);if(currentStorage==='filter')await global.filterQueue.refresh();await loadTrash();node('aat-message').textContent='Đã khôi phục '+plan.kept.length+' acc; bỏ qua '+plan.skipped.length+' acc trùng.';
  }
  node('aat-close').onclick=close;node('aat-search').onclick=()=>open('search');node('aat-trash').onclick=()=>open('trash');node('aat-submit').onclick=()=>run(search);node('aat-query').onkeydown=event=>{if(event.key==='Enter')void run(search);};node('aat-prev').onclick=()=>{if(mode==='search')searchPage--;else trashPage--;render();};node('aat-next').onclick=()=>{if(mode==='search')searchPage++;else trashPage++;render();};document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  global.adminAccountTools={archive,deleteFilter,refreshRole};refreshRole();
})(typeof window==='undefined'?globalThis:window);
