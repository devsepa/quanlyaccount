(function () {
  'use strict';
  // Presentation only: delegate actions to existing controls and mirror their labels.
  const byId=id=>document.getElementById(id), shell=document.querySelector('.app-layout');
  if(!shell)return;
  const sidebar=document.createElement('aside');sidebar.className='dashboard-sidebar';sidebar.id='dashboard-sidebar';sidebar.setAttribute('aria-label','Điều hướng chính');
  sidebar.innerHTML=`<nav>
  <button type="button" data-nav="accounts" class="is-active" aria-current="page"><span>▤</span>Tài khoản</button>
  <button type="button" data-nav="analytics"><span>▥</span>Thống kê</button>
  <button type="button" data-nav="settings"><span>⚙</span>Cài đặt & công cụ</button></nav><div class="dashboard-sidebar-footer"></div>`;
  shell.prepend(sidebar);
  // Reuse the original buttons rather than creating another route to each tool.
  const settings=byId('btn-toggle-menu'),analytics=byId('btn-open-analytics');
  if(settings){settings.classList.add('dashboard-native-nav');settings.innerHTML='<span aria-hidden="true">⚙</span><span>Cài đặt</span><span id="menu-notify-dot" class="menu-notify-dot" style="display:none"></span>';sidebar.querySelector('[data-nav="settings"]').replaceWith(settings);}
  if(analytics){analytics.classList.add('dashboard-native-nav');analytics.innerHTML='<span id="analytics-icon" aria-hidden="true">▥</span><span>Thống kê</span>';sidebar.querySelector('[data-nav="analytics"]').replaceWith(analytics);}
  const dropdown=byId('option-menu-dropdown');if(dropdown)document.body.appendChild(dropdown);
  const syncBar=byId('sync-status-bar');if(syncBar)sidebar.querySelector('.dashboard-sidebar-footer').appendChild(syncBar);
  const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='dashboard-nav-backdrop';backdrop.setAttribute('aria-label','Đóng điều hướng');document.body.appendChild(backdrop);
  const menu=document.createElement('button');menu.type='button';menu.className='dashboard-nav-toggle';menu.textContent='☰';menu.setAttribute('aria-label','Mở điều hướng');menu.setAttribute('aria-controls','dashboard-sidebar');menu.setAttribute('aria-expanded','false');shell.querySelector('header').prepend(menu);
  const narrow=matchMedia('(max-width:1100px)');
  const brand=shell.querySelector('header .header-brand');
  const brandAnchor=document.createComment('Responsive brand position');
  if(brand)brand.before(brandAnchor);
  const context=document.createElement('div');context.className='dashboard-page-context';context.innerHTML='<span>QUẢN LÝ KHO</span><strong>Tài khoản game</strong>';shell.querySelector('header').prepend(context);
  function placeBrand(){if(!brand)return;if(narrow.matches)brandAnchor.after(brand);else sidebar.prepend(brand);}
  narrow.addEventListener('change',placeBrand);placeBrand();
  function closeNav(){if(document.body.classList.contains('dashboard-nav-open'))window.closeOptionMenu?.();const restore=narrow.matches&&sidebar.contains(document.activeElement);document.body.classList.remove('dashboard-nav-open');menu.setAttribute('aria-expanded','false');sidebar.inert=narrow.matches;if(restore)menu.focus({preventScroll:true});}
  narrow.addEventListener('change',closeNav);closeNav();
  menu.addEventListener('click',()=>{const open=document.body.classList.toggle('dashboard-nav-open');menu.setAttribute('aria-expanded',String(open));sidebar.inert=narrow.matches&&!open;if(open)sidebar.querySelector('nav button').focus();});
  analytics?.addEventListener('click',closeNav);
  dropdown?.addEventListener('click',event=>{if(event.target.closest('.option-menu-item'))closeNav();});
  backdrop.addEventListener('click',closeNav);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('dashboard-nav-open')){closeNav();menu.focus();}});
  document.addEventListener('keydown',event=>{if(event.key!=='Tab'||!document.body.classList.contains('dashboard-nav-open')||dropdown?.classList.contains('show'))return;const targets=[...sidebar.querySelectorAll('a[href],button')].filter(node=>!node.disabled);const first=targets[0],last=targets[targets.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  function go(id){const target=byId(id);target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return target;}
  sidebar.addEventListener('click',event=>{
    const control=event.target.closest('[data-nav]');if(!control)return;
    const action=control.dataset.nav;
    if(action!=='accounts')return;
    closeNav();go('account-workspace');
  });
  // One set of warehouse cards: their existing counts already provide the overview.
  const statuses=document.createElement('div');statuses.className='dashboard-list-status';statuses.setAttribute('aria-label','Trạng thái kho đang chọn');
  for(const id of ['stat-active','stat-ban']){const node=byId(id);if(node)statuses.appendChild(node);}
  byId('zone-player-divider').appendChild(statuses);
  // Mirror current warehouse counters without duplicating interactive IDs.
  const brandStatus=document.createElement('div');brandStatus.className='brand-warehouse-status';
  brand?.querySelector('.header-brand-info')?.appendChild(brandStatus);
  const footerStatus=document.createElement('div');footerStatus.className='footer-warehouse-status';
  document.querySelector('.footer-brand-text')?.appendChild(footerStatus);
  function updateBrandCounters(){
    brandStatus.replaceChildren();footerStatus.replaceChildren();
    for(const id of ['stat-count','stat-active','stat-ban']){
      const source=byId(id);if(!source)continue;
      const footerItem=document.createElement('span');footerItem.textContent=source.textContent;
      footerItem.className='warehouse-counter-'+id;footerStatus.appendChild(footerItem);
      if(id!=='stat-count'){
        const brandItem=document.createElement('span');brandItem.textContent=source.textContent;
        brandItem.className='warehouse-counter-'+id;brandStatus.appendChild(brandItem);
      }
    }
  }
  const countersObserver=new MutationObserver(updateBrandCounters);
  for(const id of ['stat-count','stat-active','stat-ban']){const source=byId(id);if(source)countersObserver.observe(source,{childList:true,subtree:true,characterData:true});}
  updateBrandCounters();
  const actions=document.createElement('div');actions.className='dashboard-add-actions';
  const add=document.createElement('button');add.type='button';add.className='dashboard-add-button';add.textContent='＋ Thêm tài khoản';actions.appendChild(add);byId('storage-switcher-bar').after(actions);const adminTools=byId('admin-account-tools');if(adminTools)actions.appendChild(adminTools);
  add.addEventListener('click',()=>{const form=byId('input-container');if(!form||form.style.display==='none')return;const content=byId('add-box-content')||form.querySelector('.add-box-content');if(content&&getComputedStyle(content).display==='none')byId('collapse-toggle')?.click();form.scrollIntoView({block:'center',behavior:'smooth'});form.querySelector('textarea')?.focus({preventScroll:true});});
  function refresh(){
    const tiles=[...document.querySelectorAll('#storage-switcher-bar .storage-tab-btn')];
    const visible=tiles.filter(tile=>!tile.hidden&&getComputedStyle(tile).display!=='none');
    tiles.forEach(tile=>tile.classList.toggle('mobile-wide-tile',visible.length%2===1&&tile===visible[visible.length-1]));
    const content=byId('collapse-content');
    add.hidden=typeof isAdmin==='undefined'||!isAdmin||!!(content&&!content.classList.contains('hidden'));
  }
  const observer=new MutationObserver(refresh);
  for(const id of ['input-container']){const node=byId(id);if(node)observer.observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden','style']});}
  const warehouseBar=byId('storage-switcher-bar');
  if(warehouseBar)new MutationObserver(refresh).observe(warehouseBar,{subtree:true,attributes:true,attributeFilter:['style','hidden']});
  refresh();
})();
