(function (global) {
  "use strict";
  const keyOf = value => String(value || "").trim().toLowerCase();
  function parseFilterTxt(text) {
    const rows = [], errors = [], names = new Set();
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    if (lines.length > 5000) throw new Error("Mỗi file tối đa 5.000 dòng.");
    let duplicates = 0;
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const normalized = line.trim().replace(/^\d+\.\s*/, "");
      const match = normalized.match(/^([^:\s]+):(.+)$/);
      if (!match || !match[2].trim()) {
        errors.push(index + 1); return;
      }
      const username = match[1].trim(), password = match[2].trim();
      if (names.has(keyOf(username))) { duplicates++; return; }
      names.add(keyOf(username));
      rows.push({ sourceNumber: String(index + 1), sourceLine: index + 1, username, password });
    });
    return { rows, errors, duplicates };
  }
  const GROUP_SIZE = 100;
  function assignFilterGroups(value) {
    const result = {...(value||{})}, groups = {...(result.__groups||{})};
    let number = Number(groups.__next)||1;
    const unassigned = Object.values(result).filter(r=>r&&r.id&&r.username&&!r.groupId)
      .sort((a,b)=>Number(a.importedAt)-Number(b.importedAt)||Number(a.sourceLine||a.sourceNumber)-Number(b.sourceLine||b.sourceNumber)||String(a.id).localeCompare(String(b.id)));
    let current;
    unassigned.forEach((row,index)=>{
      if(!current||current.total>=GROUP_SIZE||current.batchId!==(row.batchId||'legacy_'+row.importedAt)){
        const id='group_'+row.id;
        current={id,number:number++,total:0,createdAt:row.importedAt||0,batchId:row.batchId||'legacy_'+row.importedAt,fileName:row.fileName||'',importedBy:row.importedBy||''};
        groups[id]=current;
      }
      current.total++;
      result[row.id]={...row,groupId:current.id};
    });
    Object.values(groups).filter(g=>g&&g.id&&!g.fileName).forEach(group=>{
      const source=Object.values(result).find(r=>r&&r.username&&r.groupId===group.id);
      if(source)groups[group.id]={...group,batchId:source.batchId||'legacy_'+source.importedAt,fileName:source.fileName||'',importedBy:source.importedBy||'',createdAt:source.importedAt||group.createdAt||0};
    });
    groups.__next=number;
    result.__groups=groups;
    return result;
  }
  function filterBatchTone(group) {
    const key=String(group.batchId||group.createdAt||group.fileName||'legacy');
    let hash=0;for(let i=0;i<key.length;i++)hash=(Math.imul(hash,31)+key.charCodeAt(i))>>>0;
    return ['cyan','violet','mint','amber','blue','rose'][hash%6];
  }
  function filterGroupList(value) {
    const groups=Object.values(value?.__groups||{}).filter(g=>g&&g.id);
    return groups.sort((a,b)=>a.number-b.number).map(g=>{
      const remaining=Object.values(value||{}).filter(r=>r&&r.username&&r.groupId===g.id);
      const source=remaining[0]||{};
      return {...g,batchId:g.batchId||source.batchId||'',fileName:g.fileName||source.fileName||'',importedBy:g.importedBy||source.importedBy||'',createdAt:g.createdAt||source.importedAt||0,remaining:remaining.length,working:remaining.filter(r=>r.status!=='pending').length};
    });
  }
  function removeFilterGroup(value,id,approvedWorkingIds=[]) {
    if(!value?.__groups?.[id])throw new Error('Nhóm đã bị xóa. Hãy tải lại.');
    const result={...value,__groups:{...value.__groups}};
    Object.values(value).filter(r=>r&&r.username&&r.groupId===id).forEach(row=>{
      if(row.status==='transferring')throw new Error('Có acc đang chuyển kho. Chờ chuyển xong rồi xóa nhóm.');
      if(row.status!=='pending'&&!approvedWorkingIds.includes(row.id))throw new Error('Có acc vừa được nhận lọc. Hãy kiểm tra và xác nhận xóa nhóm lại.');
      delete result[row.id];
    });
    delete result.__groups[id];
    return result;
  }
  function findFilterDuplicates(queue, ready) {
    const targets=new Map();
    Object.values(ready||{}).filter(a=>a&&a.username&&['rank','chungsuc'].includes(a.category||'rank')).forEach(a=>{
      const key=keyOf(a.username);if(!targets.has(key))targets.set(key,[]);targets.get(key).push(a);
    });
    return Object.values(queue||{}).filter(r=>r&&r.id&&r.username&&targets.has(keyOf(r.username))).map(row=>({row,targets:targets.get(keyOf(row.username))}));
  }
  function removeFilterDuplicates(queue, ready, approved) {
    const result={...(queue||{})}, removed=[], skipped=[];
    const allowed=new Map(approved.map(r=>[r.id,r]));
    findFilterDuplicates(queue,ready).forEach(({row})=>{
      const before=allowed.get(row.id);if(!before)return;
      if(row.status==='transferring'||row.username!==before.username||row.password!==before.password||row.status!==before.status||row.owner!==before.owner){skipped.push(row);return;}
      delete result[row.id];removed.push(row);
    });
    return {value:result,removed,skipped};
  }
  function locateFilterAccount(value,id,pageSize=50) {
    const row=value?.[id];if(!row?.username||!row.groupId)return null;
    const group=Object.values(value).filter(r=>r&&r.username&&r.groupId===row.groupId)
      .sort((a,b)=>Number(a.importedAt)-Number(b.importedAt)||Number(a.sourceLine||a.sourceNumber)-Number(b.sourceLine||b.sourceNumber)||String(a.id).localeCompare(String(b.id)));
    return {groupId:row.groupId,page:Math.floor(group.findIndex(r=>r.id===id)/pageSize)};
  }
  function mergeFilterImport(existing, incoming, readyAccounts) {
    const names = new Set([...Object.values(existing || {}), ...(readyAccounts || [])].filter(Boolean).map(a => keyOf(a.username)));
    const result = { ...(existing || {}) }; let added = 0, skipped = 0;
    incoming.forEach(row => {
      if (names.has(keyOf(row.username))) { skipped++; return; }
      result[row.id] = row; names.add(keyOf(row.username)); added++;
    });
    if (Object.values(result).filter(r=>r&&r.username).length > 5000) throw new Error("Kho cần lọc tối đa 5.000 acc. Hãy xử lý bớt trước khi nhập thêm.");
    return { value: assignFilterGroups(result), added, skipped };
  }
  function validateFilterDestination(category, metadata) {
    if (!["rank", "chungsuc"].includes(category)) throw new Error("Chọn kho Rank hoặc Chung Sức.");
    if (category === "chungsuc") return { rank: "", uyTin: "", unlockDate: "" };
    const rank = String(metadata.rank || "").trim().toUpperCase();
    const uyTin = String(metadata.uyTin || "").trim(), unlockDate = String(metadata.unlockDate || "").trim();
    if (rank.length > 15) throw new Error("Rank tối đa 15 ký tự.");
    if (uyTin && (!/^\d{1,3}$/.test(uyTin) || Number(uyTin) > 100)) throw new Error("Uy tín phải là số nguyên 0–100 hoặc để trống.");
    if (unlockDate) {
      const match = unlockDate.match(/^(\d{2})\/(\d{2})$/);
      if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[1]) < 1 || Number(match[1]) > [31,29,31,30,31,30,31,31,30,31,30,31][Number(match[2])-1]) throw new Error("Ngày mở BAN cần đúng dd/MM và là ngày có thật.");
    }
    return { rank, uyTin, unlockDate };
  }
  function filterClaim(row, owner, actor, now) {
    if (!row) throw new Error("Acc đã được chuyển hoặc xóa. Hãy tải lại.");
    if (row.status === "transferring") throw new Error("Acc đang được chuyển kho. Hãy tải lại sau.");
    if (row.owner && row.owner !== owner) throw new Error(`Acc đang được ${row.claimedBy || "quản trị khác"} lọc. Không nhận trùng.`);
    return { ...row, status: "working", owner, claimedBy: actor, claimedAt: row.claimedAt || now };
  }
  function buildFilterDestination(row, category, metadata, actor, now) {
    const fields = validateFilterDestination(category, metadata);
    const date=new Date(now),pad=value=>String(value).padStart(2,'0');
    return { id: "filtered_" + row.id, username: row.username, password: row.password, category, ...fields,
      date: new Date(now).toLocaleDateString("en-GB", { day:"2-digit",month:"2-digit" }),
      createdAt: `${pad(date.getHours())}:${pad(date.getMinutes())} - ${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}`, createdTimestamp: now, createdBy: actor,
      lastUsed:"", lastUsedBy:"", useCount:0, sourceBatch:row.batchId, sourceNumber:row.sourceNumber };
  }
  function filterTransferPatch(row, destination, now) {
    return { ["app_data/accounts/" + destination.id]: destination, "app_data/updatedAt": now, ["filter_queue/" + row.id]: null };
  }
  function mergeMainAccounts(remote, local, baseline) {
    const prior=new Map((baseline||[]).map(a=>[String(a.id),a]));
    const latest=new Map((remote||[]).filter(Boolean).map(a=>[String(a.id),a]));
    const localIds=new Set(local.map(a=>String(a.id)));
    prior.forEach((_,id)=>{if(!localIds.has(id))latest.delete(id);});
    local.forEach(a=>{const before=prior.get(String(a.id));if(!before||JSON.stringify(a)!==JSON.stringify(before))latest.set(String(a.id),a);});
    return [...latest.values()];
  }
  function createFilterTransport(base, fetcher, canWrite) {
    async function request(url, options = {}) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try { return await fetcher(url, { ...options, signal: controller.signal, cache: "no-store" }); }
      catch (err) { if(err.name === "AbortError") throw new Error("Kết nối quá chậm. Hãy tải lại để kiểm tra trạng thái trước khi thử lại."); throw err; }
      finally { clearTimeout(timer); }
    }
    async function read(path) {
      const response = await request(base + "/" + path + ".json");
      if (!response.ok) throw new Error("Không tải được dữ liệu. Kiểm tra kết nối hoặc quyền Firebase.");
      return response.json();
    }
    async function transaction(path, change) {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!canWrite()) throw new Error("Chỉ quản trị viên được thao tác.");
        const response = await request(base + "/" + path + ".json", { headers: { "X-Firebase-ETag":"true" } });
        if (!response.ok) throw new Error("Không đọc được dữ liệu để cập nhật.");
        const tag = response.headers.get("ETag");
        if (!tag) throw new Error("Máy chủ chưa cung cấp mã phiên bản, chưa cập nhật để tránh ghi đè.");
        const value = change(await response.json());
        if (!canWrite()) throw new Error("Phiên quản trị đã kết thúc.");
        const saved = await request(base + "/" + path + ".json", { method:value === null ? "DELETE":"PUT",
          headers:{"Content-Type":"application/json","if-match":tag}, ...(value === null ? {} : {body:JSON.stringify(value)}) });
        if (saved.status === 412) continue;
        if (!saved.ok) throw new Error("Chưa lưu được thay đổi. Dữ liệu nguồn được giữ lại.");
        return value;
      }
      throw new Error("Có người khác đang cập nhật acc này. Hãy tải lại và thử lại.");
    }
    async function transfer(row, destination) {
      if (!canWrite()) throw new Error("Phiên quản trị đã kết thúc.");
      const response = await request(base + "/.json", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(filterTransferPatch(row,destination,Date.now()))});
      if (!response.ok) throw new Error("Chưa chuyển được acc. Dòng nguồn vẫn được giữ lại.");
    }
    return {read,transaction,transfer};
  }
  const pure = {filterBatchTone,locateFilterAccount,findFilterDuplicates,removeFilterDuplicates,assignFilterGroups,filterGroupList,removeFilterGroup,parseFilterTxt,mergeFilterImport,validateFilterDestination,filterClaim,buildFilterDestination,filterTransferPatch,createFilterTransport,mergeMainAccounts};
  if (typeof module !== "undefined" && module.exports) module.exports = pure;
  if (typeof document === "undefined") return;
  const host = document.getElementById("filter-queue-panel"); if (!host) return;
  const transport = createFilterTransport(FIREBASE_DB_URL, (...args) => fetch(...args), () => isAdmin);
  let mainBaseline;
  try {mainBaseline=JSON.parse(localStorage.getItem('lq_filter_main_baseline')||'null');}catch(_){}
  if(!Array.isArray(mainBaseline))mainBaseline=syncPending?[]:JSON.parse(JSON.stringify(accounts));
  function observeAccounts(list) {mainBaseline=JSON.parse(JSON.stringify(list));try{localStorage.setItem('lq_filter_main_baseline',JSON.stringify(mainBaseline));}catch(_){}}
  async function writeMainPayload(payload, signal) {
    const local=JSON.parse(JSON.stringify(payload.accounts)),baseline=JSON.parse(JSON.stringify(mainBaseline));
    for(let attempt=0;attempt<4;attempt++) {
      const read=await fetch(FIREBASE_ENDPOINT,{headers:{'X-Firebase-ETag':'true'},cache:'no-store',signal});
      if(!read.ok)throw new Error('Không đọc được phiên bản dữ liệu trước khi lưu.');
      const tag=read.headers.get('ETag');if(!tag)throw new Error('Không nhận được phiên bản dữ liệu, chưa ghi đè.');
      const raw=await read.json()||{},remote=Array.isArray(raw)?raw:Object.values(raw.accounts||{});
      const merged=mergeMainAccounts(remote,local,baseline);
      const next={...(!Array.isArray(raw)?raw:{}),...payload,accounts:merged};
      const response=await fetch(FIREBASE_ENDPOINT,{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},body:JSON.stringify(next),signal});
      if(response.status===412)continue;
      if(response.ok){
        const submitted=new Map(local.map(a=>[String(a.id),a])),committed=new Map(merged.map(a=>[String(a.id),a]));
        const previous=JSON.stringify(accounts);
        const reconciled=accounts.flatMap(a=>{
          const before=submitted.get(String(a.id));
          if(before&&JSON.stringify(a)===JSON.stringify(before))return committed.has(String(a.id))?[committed.get(String(a.id))]:[];
          return [a];
        });
        const currentIds=new Set(reconciled.map(a=>String(a.id)));
        // A missing submitted ID may be a local deletion made during this save.
        const additions=merged.filter(a=>!submitted.has(String(a.id))&&!currentIds.has(String(a.id)));
        accounts=[...additions,...reconciled];observeAccounts(merged);
        if(JSON.stringify(accounts)!==previous){saveData();renderList();}
      }
      return response;
    }
    throw new Error('Danh sách đang thay đổi. Hãy thử đồng bộ lại.');
  }
  let rows = {}, active = false, connected = false, source = null, refreshing = false, busy = false, page = 0, error = "", query = "", mode = "all";
  const PAGE_SIZE=50;
  let selectedGroup=localStorage.getItem('lq_filter_group')||'';
  let lastAccountId='';
  try{lastAccountId=localStorage.getItem('lq_filter_last_account')||'';}catch(_){}
  let restorePending=!!lastAccountId, focusedAccountId='', scrollToAccount=false;
  function rememberAccount(id){lastAccountId=id;try{if(id)localStorage.setItem('lq_filter_last_account',id);else localStorage.removeItem('lq_filter_last_account');}catch(_){}}
  function resumeFiltering(manual=false){
    if(!isAdmin||!active)return;
    const location=locateFilterAccount(rows,lastAccountId,PAGE_SIZE);
    restorePending=false;
    if(!location){rememberAccount('');focusedAccountId='';if(manual)showToast('Acc vừa lọc đã rời kho hoặc bị xóa. Hãy chọn acc khác.');return;}
    selectedGroup=location.groupId;page=location.page;query='';mode='all';focusedAccountId=lastAccountId;scrollToAccount=true;
    try{localStorage.setItem('lq_filter_group',selectedGroup);}catch(_){}
    render();
  }
  function selectGroup(id){selectedGroup=id;try{localStorage.setItem('lq_filter_group',id);}catch(_){}page=0;render();}
  const e = escapeHtml;
  const owner = () => getOrCreateDeviceId();
  const eligible = () => { if(!isAdmin)throw new Error("Chỉ quản trị viên được thao tác."); if(navigator.onLine===false)throw new Error("Cần có mạng để thao tác trong kho cần lọc."); };
  function message(value) { error=value; render(); }
  function ordered() { return Object.values(rows).filter(r=>r&&r.id&&r.username).sort((a,b)=>Number(a.importedAt)-Number(b.importedAt)||Number(a.sourceLine||a.sourceNumber)-Number(b.sourceLine||b.sourceNumber)||String(a.id).localeCompare(String(b.id))); }
  function displayNumber(row) { return ordered().findIndex(item=>item.id===row.id)+1; }
  function render() {
    const tab = document.getElementById('storage-tab-filter');
    tab.hidden = !isAdmin;
    document.getElementById('storage-switcher-bar').classList.toggle('has-filter-access', !!isAdmin);
    if (!isAdmin) {
      stop(); rows = {}; host.innerHTML = ''; host.hidden = true;
      document.getElementById('storage-pill-filter').textContent = '';
      document.getElementById('filter-transfer-modal').classList.remove('show');
      global.filterQueue?.setActive(false);
      if (currentStorage === 'filter') switchAccountStorage('rank');
      return;
    }
    document.getElementById("storage-pill-filter").textContent=Object.values(rows).filter(r=>r&&r.username).length;
    document.getElementById("storage-pill-rank").textContent=accounts.filter(a=>(a.category||"rank")==="rank").length;
    document.getElementById("storage-pill-chungsuc").textContent=accounts.filter(a=>a.category==="chungsuc").length;
    if (!isAdmin) document.getElementById('filter-transfer-modal').classList.remove('show');
    if (!active) return;
    const visibleRows=ordered(),workingCount=visibleRows.filter(r=>r.status!=="pending").length;
    document.getElementById('stat-count').textContent=visibleRows.length+' acc [Cần lọc]';
    document.getElementById('stat-active').textContent=workingCount+' đang lọc';
    document.getElementById('stat-ban').textContent=(visibleRows.length-workingCount)+' chờ lọc';
    host.setAttribute('aria-busy',String(busy||refreshing));
    const groups=filterGroupList(rows);
    if(rows.__groups&&!groups.some(g=>g.id===selectedGroup))selectedGroup='';
    const all=ordered(), filtered=all.filter(r=>(!!selectedGroup&&r.groupId===selectedGroup)&&(!query||`${all.indexOf(r)+1} ${r.username} ${r.fileName}`.toLowerCase().includes(query))&&(mode!=="working"||r.status!=="pending")&&(mode!=="pending"||r.status==="pending"));
    page=Math.max(0,Math.min(page,Math.ceil(filtered.length/PAGE_SIZE)-1));
    const shown=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
    host.innerHTML=`<div class="fq-heading"><div><h3>📥 Kho acc cần lọc</h3><p>${all.length} acc · ${all.filter(r=>r.status!=="pending").length} đang lọc. Mỗi nhóm tối đa 100 acc, giữ nguyên nhóm khi chuyển hoặc xóa acc.</p></div><div class="fq-tools">${isAdmin?'<label class="btn btn-tool fq-import">＋ Nhập TXT<input id="fq-file" type="file" accept=".txt,text/plain" hidden></label>':''}${lastAccountId?'<button type="button" class="btn btn-tool fq-resume" id="fq-resume">▶ Tiếp tục lọc</button>':''}<button type="button" class="btn btn-tool" id="fq-scan" ${busy?'disabled':''}>🔎 Quét acc trùng</button><button type="button" class="btn btn-tool" id="fq-refresh">↻ Tải lại</button></div></div>
    <p class="fq-note">${isAdmin?'File dạng <b>stt.tk:mk</b> hoặc <b>tk:mk</b>, ví dụ <code>11.taikhoan:matkhau</code>. Web tự bỏ STT đầu dòng. Sao chép để nhận lọc; chuyển kho cần điền thông tin và xác nhận.':'Bạn đang xem danh sách. Chỉ quản trị viên được nhập file và thao tác.'}</p>
    <div class="fq-groups">${groups.map(g=>`<div class="fq-group fq-batch-${filterBatchTone(g)} ${selectedGroup===g.id?'is-selected':''}"><button type="button" data-group="${e(g.id)}" aria-pressed="${selectedGroup===g.id}"><strong class="fq-group-title">Nhóm ${String(g.number).padStart(2,'0')}${selectedGroup===g.id?'<span class="fq-group-selected">✓ Đang chọn</span>':''}</strong><span class="fq-group-source" title="${e(g.fileName||'Không còn thông tin file nguồn')}">📄 ${e(g.fileName||'File nguồn chưa xác định')}</span><small class="fq-group-import">Import · ${g.createdAt?e(new Date(Number(g.createdAt)).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false})):'Chưa rõ thời gian'}${g.importedBy?' · '+e(g.importedBy):''}</small><span>${g.remaining} còn lại / ${g.total} acc</span><small>${g.working} đang lọc · ${g.remaining-g.working} chờ lọc · ${Math.max(0,g.total-g.remaining)} đã rời kho</small><progress max="${g.total||1}" value="${Math.max(0,g.total-g.remaining)}" aria-label="Tiến độ nhóm ${g.number}"></progress></button><button type="button" class="fq-delete fq-group-delete" data-delete-group="${e(g.id)}" ${busy?'disabled':''} aria-label="Xóa nhóm ${g.number}">🗑 Xóa nhóm</button></div>`).join('')||'<p>Chưa có nhóm. Nhập TXT để bắt đầu.</p>'}</div>
    ${!selectedGroup&&groups.length?'<p class="fq-note">Chọn một nhóm phía trên để xem và tiếp tục lọc. Nhóm gần nhất được ghi nhớ trên trình duyệt này.</p>':''}
    <div class="fq-search"><input id="fq-search" type="search" placeholder="Tìm số dòng, tài khoản hoặc file…" aria-label="Tìm trong kho cần lọc"><select id="fq-mode" aria-label="Lọc trạng thái"><option value="all">Tất cả</option><option value="pending">Chưa lọc</option><option value="working">Đang lọc</option></select></div>
    <p class="fq-message" role="status">${e(error|| (refreshing?'Đang tải…':busy?'Đang lưu…':connected?'Đang cập nhật trực tiếp':'Bấm Tải lại nếu danh sách chưa cập nhật.'))}</p>
    <div class="fq-list">${shown.map((r,i)=>`<article class="fq-row ${r.status!=="pending"?'is-working':''} ${r.id===focusedAccountId?'is-resumed':''}" data-account-id="${e(r.id)}" data-index="${i}"><div class="fq-number" title="STT trong danh sách">#${all.indexOf(r)+1}</div><div class="fq-account"><code>${e(r.username+':'+r.password)}</code><small>${e(r.fileName)}${r.status!=="pending"?` · <b>${r.status==='transferring'?'Đang chuyển':'Đang lọc'}: ${e(r.claimedBy||'Quản trị')}</b>${isAdmin?` <button type="button" class="fq-release" data-do="release" ${busy?'disabled':''}>Bỏ nhận</button>`:''}`:''}</small></div>${isAdmin?`<div class="fq-actions"><button type="button" data-do="copy" ${busy?'disabled':''}>📋 Sao chép</button><button type="button" data-do="move" ${busy?'disabled':''}>⇄ Chuyển kho</button><button type="button" data-do="delete" class="fq-delete" ${busy?'disabled':''} aria-label="Xóa acc dòng ${all.indexOf(r)+1}">🗑 Xóa</button></div>`:''}</article>`).join('')||'<div class="fq-empty">'+(refreshing?'Đang tải danh sách…':(selectedGroup?'Nhóm này không còn acc phù hợp.':'Chọn nhóm để xem danh sách acc.'))+'</div>'}</div>
    <div class="fq-pagination"><button type="button" id="fq-prev" ${page===0?'disabled':''}>← Trước</button><span>Trang ${page+1}/${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))} · ${filtered.length} acc</span><button type="button" id="fq-next" ${(page+1)*PAGE_SIZE>=filtered.length?'disabled':''}>Sau →</button></div>`;
    host.querySelectorAll('[data-group]').forEach(button=>button.onclick=()=>selectGroup(button.dataset.group));
    host.querySelectorAll('[data-delete-group]').forEach(button=>button.onclick=()=>deleteGroup(button.dataset.deleteGroup));
    const search=host.querySelector('#fq-search');search.value=query;search.addEventListener('input',()=>{query=search.value.toLowerCase();page=0;const position=search.selectionStart;render();const next=host.querySelector('#fq-search');next.focus();try{next.setSelectionRange(position,position);}catch(_){}});
    const select=host.querySelector('#fq-mode');select.value=mode;select.onchange=()=>{mode=select.value;page=0;render();};
    host.querySelector('#fq-refresh').onclick=()=>refresh();
    host.querySelector('#fq-scan').onclick=()=>scanDuplicates();
    host.querySelector('#fq-resume')?.addEventListener('click',()=>resumeFiltering(true));
    host.querySelector('#fq-prev').onclick=()=>{page--;render();};host.querySelector('#fq-next').onclick=()=>{page++;render();};
    host.querySelector('#fq-file')?.addEventListener('change',event=>importFile(event.target.files[0]));
    if(scrollToAccount){scrollToAccount=false;
      (global.requestAnimationFrame||((fn)=>setTimeout(fn,0)))(()=>{
        if(!isAdmin||!active)return;
        const target=Array.from(host.querySelectorAll('[data-account-id]')).find(el=>el.dataset.accountId===focusedAccountId);
        target?.scrollIntoView?.({block:'center',behavior:'instant'});
      });
    }
    host.querySelectorAll('[data-do]').forEach(button=>button.onclick=()=>{const row=shown[Number(button.closest('[data-index]').dataset.index)];if(!row)return; if(button.dataset.do==='copy')copyRow(row);else if(button.dataset.do==='move')openTransfer(row);else if(button.dataset.do==='release')releaseRow(row);else deleteRow(row);});
  }
  async function refresh() {
    if(!isAdmin||refreshing)return;refreshing=true;render();
    try {const received=await transport.read('filter_queue');if(isAdmin&&Object.values(received||{}).some(r=>r&&r.username&&(!r.groupId||(!received.__groups?.[r.groupId]?.fileName&&r.fileName)))){const grouped=await transport.transaction('filter_queue',assignFilterGroups);rows=isAdmin?grouped:{};}else rows=isAdmin?(received||{}):{};error='';}catch(err){error=err.message;}finally{refreshing=false;if(isAdmin&&active&&restorePending&&!error)resumeFiltering();render();}
  }
  function stop() {source?.close();source=null;connected=false;}
  function listen() {
    if(!isAdmin||!active||document.hidden||navigator.onLine===false||source||typeof EventSource==='undefined')return;
    source=new EventSource(FIREBASE_DB_URL+'/filter_queue.json');
    source.onopen=()=>{connected=true;};source.onerror=()=>{connected=false;};
    const eventHandler=event=>{if(!isAdmin){stop();return;}try{const payload=JSON.parse(event.data);const path=String(payload.path||'/').split('/').filter(Boolean);if(!path.length){rows=event.type==='patch'?{...rows,...payload.data}:(payload.data||{});Object.keys(rows).forEach(k=>{if(rows[k]===null)delete rows[k];});}else{const id=path[0];if(['__proto__','constructor','prototype'].includes(id))return;if(path.length===1){if(payload.data===null)delete rows[id];else rows[id]=event.type==='patch'?{...rows[id],...payload.data}:payload.data;}else if(rows[id]&&!path.some(k=>['__proto__','constructor','prototype'].includes(k))){let ref=rows[id];for(let i=1;i<path.length-1;i++)ref=ref[path[i]]||(ref[path[i]]={});ref[path.at(-1)]=payload.data;}}render();}catch(_){}};
    source.addEventListener('put',eventHandler);source.addEventListener('patch',eventHandler);
  }
  async function run(action) {
    if(busy)return;try{eligible();busy=true;error='';render();await action();}catch(err){error=err.message;}finally{busy=false;render();}
  }
  function scanDuplicates() {return run(async()=>{
    await waitForMainSave();
    const [queue,ready]=await Promise.all([transport.read('filter_queue'),transport.read('app_data/accounts')]);
    if(!isAdmin)return;
    rows=queue||{};
    const matches=findFilterDuplicates(rows,ready), approved=matches.filter(m=>m.row.status!=='transferring').map(m=>m.row);
    if(!matches.length){showNotice({title:'Kết quả quét trùng',message:'Không có acc trùng với kho Rank hoặc Chung Sức.'});return;}
    const working=approved.filter(r=>r.status!=='pending').length, transferring=matches.length-approved.length;
    const details=matches.map(({row,targets})=>{
      const group=rows.__groups?.[row.groupId];
      const locations=[...new Set(targets.map(a=>a.category==='chungsuc'?'Chung Sức':'Rank'))].join(', ');
      return `<li><b>${e(row.username)}</b> · ${group?'Nhóm '+e(group.number):'Chưa chia nhóm'} · Có trong: ${locations}${targets.some(a=>a.password!==row.password)?' · <b>Khác mật khẩu</b>':''}${row.status==='transferring'?' · Đang chuyển, tạm bỏ qua':row.status!=='pending'?' · Đang lọc: '+e(row.claimedBy||'Admin'):''}</li>`;
    }).join('');
    const report=`Tìm thấy <b>${matches.length} acc trùng</b> theo tên tài khoản (không phân biệt hoa/thường).<br>${approved.length} acc có thể xóa khỏi kho cần lọc.${working?'<br><b>Cảnh báo: '+working+' acc đang được lọc.</b>':''}${transferring?'<br>'+transferring+' acc đang chuyển kho được tạm bỏ qua.':''}<ul style="max-height:280px;overflow:auto;text-align:left;overflow-wrap:anywhere;padding-left:20px">${details}</ul>Acc trong kho Rank/Chung Sức được giữ nguyên. Xóa không thể hoàn tác.`;
    showNotice({title:'Báo cáo acc trùng',type:approved.length?'danger':'info',message:report,...(approved.length?{onConfirm:()=>run(async()=>{
      await waitForMainSave();
      const latest=await transport.read('app_data/accounts');let outcome;
      const next=await transport.transaction('filter_queue',current=>{
        outcome=removeFilterDuplicates(current,latest,approved);return outcome.value;
      });
      rows=isAdmin?next:{};
      if(outcome.removed.length)recordAdminAudit('delete',outcome.removed.map(r=>({...r,category:'filter'})));
      const retained=approved.length-outcome.removed.length;
      showNotice({title:'Đã xử lý acc trùng',message:`Đã xóa <b>${outcome.removed.length} acc trùng</b> khỏi kho cần lọc.${retained?'<br>'+retained+' acc đã thay đổi hoặc không còn trùng nên không xóa.':''}<br>Kho Rank và Chung Sức được giữ nguyên.`});
    })}: {})});
  });}
  function deleteGroup(id) {
    if(!isAdmin||busy)return;
    const group=filterGroupList(rows).find(g=>g.id===id);if(!group)return;
    const working=ordered().filter(r=>r.groupId===id&&r.status!=='pending').map(r=>r.id);
    showNotice({title:'Xóa Nhóm '+String(group.number).padStart(2,'0')+'?',type:'danger',message:`Xóa nhóm và <b>${group.remaining} acc còn lại</b> trong kho cần lọc? ${group.working?`<br><b>Cảnh báo: ${group.working} acc đang được lọc.</b>`:''}<br>Acc đã chuyển sang Rank hoặc Chung Sức được giữ nguyên. Thao tác không thể hoàn tác.`,onConfirm:()=>run(async()=>{
      let removed=[];
      const next=await transport.transaction('filter_queue',current=>{
        removed=Object.values(current||{}).filter(r=>r&&r.username&&r.groupId===id);
        return removeFilterGroup(current,id,working);
      });
      rows=isAdmin?next:{};
      if(selectedGroup===id)selectGroup('');
      if(removed.length)recordAdminAudit('delete',removed.map(r=>({...r,category:'filter'})));
      showToast('Đã xóa nhóm và '+removed.length+' acc còn lại trong kho cần lọc.');
    })});
  }
  async function importFile(file) {
    if(!file)return;
    try {
      eligible();if(!/\.txt$/i.test(file.name))throw new Error("Chọn file .txt.");if(file.size>2*1024*1024)throw new Error("File tối đa 2 MB.");
      const parsed=parseFilterTxt(await file.text());
      if(parsed.errors.length)throw new Error(`Chưa nhập file. Kiểm tra định dạng stt.tk:mk hoặc tk:mk tại dòng ${parsed.errors.slice(0,15).join(', ')}${parsed.errors.length>15?'…':''}.`);
      if(!parsed.rows.length)throw new Error("File không có acc hợp lệ.");
      showNotice({title:'Nhập vào Kho acc cần lọc?',type:'confirm',message:`File <b>${e(file.name)}</b>: ${parsed.rows.length} acc hợp lệ; bỏ qua ${parsed.duplicates} acc trùng trong file. STT do web tự hiển thị theo danh sách. Acc đã có trong kho cần lọc/Rank/Chung Sức sẽ được bỏ qua.`,onConfirm:()=>run(async()=>{
        const now=Date.now(),batchId='batch_'+(global.crypto?.randomUUID?.()||now+'_'+Math.random().toString(36).slice(2));
        const incoming=parsed.rows.map((row,i)=>({...row,id:batchId+'_'+i,batchId,fileName:file.name.slice(0,120),importedAt:now,importedBy:getUserName(),status:'pending'}));
        await waitForMainSave();
        const raw=await transport.read('app_data/accounts'),ready=Object.values(raw||{});let merged;
        await transport.transaction('filter_queue',existing=>{merged=mergeFilterImport(existing,incoming,ready);return merged.value;});
        await refresh();showToast(`Đã nhập ${merged.added} acc; bỏ qua ${merged.skipped+parsed.duplicates} acc trùng.`);
        if(merged.added)recordAdminAudit('add',incoming.filter(a=>rows[a.id]).map(a=>({...a,category:'filter'})));
      })});
    }catch(err){message(err.message);}
  }
  async function copyText(text) {
    try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}}catch(_){}
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.appendChild(area);area.select();const done=document.execCommand('copy');area.remove();if(!done)throw new Error('Đã nhận lọc nhưng chưa sao chép được. Hãy bấm Sao chép lại hoặc chọn nội dung acc để sao chép.');
  }
  function copyRow(row) {return run(async()=>{
    if(isEmergencyLocked)throw new Error('Hệ thống đang khóa sao chép.');
    const claimed=await transport.transaction('filter_queue/'+row.id,current=>filterClaim(current,owner(),getUserName(),Date.now()));rows[row.id]=claimed;render();
    await copyText(claimed.username+':'+claimed.password);rememberAccount(row.id);focusedAccountId=row.id;restorePending=false;playSound('copy');showToast(`Đã sao chép dòng ${displayNumber(row)} — đang lọc.`);
  });}
  function deleteRow(row) {
    if(!isAdmin)return;
    showNotice({title:'Xóa khỏi kho cần lọc?',type:'danger',message:`Xóa dòng <b>${displayNumber(row)}</b> — <b>${e(row.username)}</b>? Danh sách sẽ được đánh lại STT sau khi xóa.`,onConfirm:()=>run(async()=>{
      await transport.transaction('filter_queue/'+row.id,current=>{if(!current)throw new Error('Acc đã rời kho.');if(current.status==='transferring')throw new Error('Acc đang chuyển kho.');if(current.owner&&current.owner!==owner())throw new Error('Acc đang được quản trị khác lọc.');return null;});
      delete rows[row.id];recordAdminAudit('delete',{...row,category:'filter'});showToast('Đã xóa dòng khỏi kho cần lọc.');
    })});
  }
  function releaseRow(row) {
    if(!isAdmin)return;
    showNotice({title:'Bỏ nhận lọc acc?',type:'confirm',message:`Dòng <b>${displayNumber(row)}</b> đang được <b>${e(row.claimedBy||'quản trị')}</b> xử lý. Chỉ bỏ nhận khi đã ngừng kiểm tra acc này. Tài khoản vẫn được giữ trong danh sách.`,onConfirm:()=>run(async()=>{
      const updated=await transport.transaction('filter_queue/'+row.id,current=>{
        if(!current)throw new Error('Acc đã rời kho.');
        if(current.owner!==row.owner)throw new Error('Người nhận lọc đã thay đổi. Hãy tải lại.');
        if(current.status==='transferring'&&Date.now()-Number(current.transferStartedAt||0)<120000)throw new Error('Acc đang chuyển, chưa thể bỏ nhận. Hãy đợi hoàn tất hoặc thử lại sau 2 phút.');
        return {...current,status:'pending',owner:null,claimedBy:null,claimedAt:null,transferStartedAt:null};
      });rows[row.id]=updated;showToast('Đã bỏ nhận lọc, dòng trở về Chưa lọc.');
    })});
  }
  function openTransfer(row) {
    if(!isAdmin||busy)return;
    const modal=document.getElementById('filter-transfer-modal');modal.dataset.rowId=row.id;
    document.getElementById('fq-transfer-account').textContent='#'+displayNumber(row)+' · '+row.username;
    ['fq-rank','fq-trust','fq-unlock'].forEach(id=>document.getElementById(id).value='');document.getElementById('fq-destination').value='rank';document.getElementById('fq-rank-fields').hidden=false;
    document.getElementById('fq-transfer-error').textContent='';modal.classList.add('show');
  }
  async function waitForMainSave() {
    const start=Date.now();
    while(pushInFlight){if(Date.now()-start>22000)throw new Error('Đang đồng bộ danh sách chính. Hãy thử chuyển lại sau.');await new Promise(r=>setTimeout(r,100));}
    if(syncPending)await pushToCloud(false);
    if(syncPending||pushInFlight)throw new Error('Danh sách chính còn thay đổi chưa đồng bộ. Hãy lưu thành công trước khi chuyển.');
  }
  async function transferSelected() {
    const modal=document.getElementById('filter-transfer-modal'),row=rows[modal.dataset.rowId];
    if(!row){document.getElementById('fq-transfer-error').textContent='Acc đã rời kho. Hãy tải lại.';return;}
    const category=document.getElementById('fq-destination').value;
    let metadata;try{eligible();metadata=validateFilterDestination(category,{rank:document.getElementById('fq-rank').value,uyTin:document.getElementById('fq-trust').value,unlockDate:document.getElementById('fq-unlock').value});}catch(err){document.getElementById('fq-transfer-error').textContent=err.message;return;}
    const button=document.getElementById('fq-confirm-transfer');if(busy)return;button.disabled=true;
    await run(async()=>{
      await waitForMainSave();
      const destination=buildFilterDestination(row,category,metadata,getUserName(),Date.now());
      const existing=await transport.read('app_data/accounts');
      if(Object.values(existing||{}).some(a=>a&&keyOf(a.username)===keyOf(row.username)))throw new Error('Tài khoản đã có trong kho đích hoặc kho còn lại. Chưa chuyển; dòng nguồn vẫn còn để kiểm tra.');
      const locked=await transport.transaction('filter_queue/'+row.id,current=>({...filterClaim(current,owner(),getUserName(),Date.now()),status:'transferring',transferStartedAt:Date.now()}));
      let saved=false;
      try {await transport.transfer(locked,destination);saved=true;}
      catch(err){
        // A timeout can occur after an atomic write succeeded. Verify before retrying.
        try{const remaining=await transport.read('filter_queue/'+row.id),target=await transport.read('app_data/accounts/'+destination.id);saved=!remaining&&!!target;}catch(_){}
        if(!saved){try{await transport.transaction('filter_queue/'+row.id,current=>{if(current?.owner===owner()&&current.status==='transferring')return {...current,status:'working'};throw new Error('Trạng thái đã thay đổi.');});}catch(_){}throw err;}
      }
      delete rows[row.id];accounts=[destination,...accounts.filter(a=>a.id!==destination.id)];
      try{saveData();}catch(_){error='Acc đã chuyển thành công trên cloud, nhưng bộ nhớ trình duyệt đầy. Hãy tải lại danh sách khi có mạng.';}
      renderList();
      recordAdminAudit('move',destination,{from:'filter',to:category});playSound('success');modal.classList.remove('show');
      showToast('Đã chuyển sang '+(category==='rank'?'kho Rank':'kho Chung Sức')+'. Dòng nguồn đã được xóa.');void pullFromCloud(true);
    });
    button.disabled=false;if(error)document.getElementById('fq-transfer-error').textContent=error;
  }
  global.filterQueue={observeAccounts,writeMainPayload,setActive(value){const changed=active!==!!value;active=!!value&&!!isAdmin;host.hidden=!active;document.body.classList.toggle('filter-mode',active);document.getElementById('storage-tab-filter').classList.toggle('active',active);document.getElementById('storage-tab-filter').setAttribute('aria-pressed',String(active));if(active){render();if(changed)void refresh();listen();}else stop();},render};
  document.getElementById('fq-destination').onchange=event=>{document.getElementById('fq-rank-fields').hidden=event.target.value!=='rank';document.getElementById('rank-popover').classList.remove('show');};
  document.getElementById('fq-confirm-transfer').onclick=transferSelected;
  document.getElementById('fq-cancel-transfer').onclick=()=>{if(!busy){document.getElementById('rank-popover').classList.remove('show');document.getElementById('filter-transfer-modal').classList.remove('show');}};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy){document.getElementById('rank-popover').classList.remove('show');document.getElementById('filter-transfer-modal').classList.remove('show');}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(active){listen();void refresh();}});
  window.addEventListener('offline',()=>{stop();render();});window.addEventListener('online',()=>{if(active){listen();void refresh();}});window.addEventListener('pagehide',stop);window.addEventListener('pageshow',()=>{if(active)listen();});
  setInterval(()=>{if(active&&!document.hidden&&navigator.onLine!==false&&!connected)void refresh();},30000);
  global.filterQueue.setActive(currentStorage==='filter');render();if(isAdmin&&currentStorage!=='filter')void refresh();
})(typeof window==='undefined'?globalThis:window);
