(function(root){
 'use strict';
 const key=v=>String(v||'').trim().toLowerCase(),clone=v=>JSON.parse(JSON.stringify(v));
 function diff(before,after){const old=new Map(before.map(a=>[key(a.username),a])),next=new Map(after.map(a=>[key(a.username),a]));return {added:after.filter(a=>!old.has(key(a.username))),removed:before.filter(a=>!next.has(key(a.username))),changed:after.filter(a=>old.has(key(a.username))&&JSON.stringify(old.get(key(a.username)))!==JSON.stringify(a))};}
 function parse(text){const seen=new Set(),rows=[];for(const line of String(text).split(/\r?\n/)){const value=line.trim();if(!value)continue;const match=value.match(/^([^:|/]+)([:|/])?(.*)$/);const username=match[1].trim(),password=match[3].trim();if(!username||!password)throw new Error('Mỗi dòng cần tài_khoản:mật_khẩu.');if(seen.has(key(username)))continue;seen.add(key(username));rows.push({username,password});}return rows;}
 function importPlan(current,incoming,mode){const next=clone(current),byName=new Map(next.map(a=>[key(a.username),a])),added=[],updated=[],skipped=[];for(const row of incoming){const old=byName.get(key(row.username));if(old){if(mode==='update'&&old.password!==row.password){old.password=row.password;updated.push(old);}else skipped.push(row);}else{const item=clone(row);next.push(item);byName.set(key(item.username),item);added.push(item);}}return {next,added,updated,skipped};}
 function bulkPlan(current,ids,action,metadata,schedule,now=Date.now()){
  const selected=new Set(ids.map(String));if(!selected.size)throw new Error('Chưa chọn acc.');const next=clone(current),changed=[];
  for(const row of next){if(!selected.has(String(row.id)))continue;
   if(action==='schedule'){if(row.category==='chungsuc')throw new Error('Lịch BAN chỉ dùng cho kho Rank.');if(!metadata.date)throw new Error('Nhập ngày mở BAN.');schedule.resolve(metadata.date,metadata.hour||'00',now);Object.assign(row,schedule.fields(metadata.date,metadata.hour,now),{unlockDate:metadata.date,unbanCleared:false,unbanReviewPending:false});}
   else if(action==='move'){if(!['rank','chungsuc'].includes(metadata.to))throw new Error('Kho đích không hợp lệ.');if(row.unbanReviewPending||schedule.status(row,now)?.isJustUnbanned)throw new Error('Acc vừa mở BAN cần sao chép kiểm tra và chuyển riêng.');row.category=metadata.to;if(metadata.to==='chungsuc')Object.assign(row,schedule.fields('','',now),{unlockDate:'',unbanCleared:true});}
   else throw new Error('Thao tác không hợp lệ.');changed.push(row);
  }if(changed.length!==selected.size)throw new Error('Danh sách đã thay đổi. Hãy chọn lại.');return {next,changed};
 }
 function auditSame(a,b){if(!a||!b)return false;const fields=['id','timestamp','action','uid','count','field','before','after','from','to'];if(fields.some(k=>String(a[k]??'')!==String(b[k]??'')))return false;const targets=v=>Object.values(v||{}).map(t=>[String(t.id||''),String(t.username||''),String(t.category||'rank')]);return JSON.stringify(targets(a.targets))===JSON.stringify(targets(b.targets));}
 const api={key,diff,parse,importPlan,bulkPlan,auditSame};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.managementCore=api;
})(typeof window==='undefined'?globalThis:window);
