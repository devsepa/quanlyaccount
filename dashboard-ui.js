(function () {
  'use strict';
  // Presentation only: delegate actions to existing controls and mirror their labels.
  const byId=id=>document.getElementById(id), shell=document.querySelector('.app-layout');
  if(!shell)return;
  const header=shell.querySelector('header');
  const headerMotion=document.createElement('div');headerMotion.className='header-combined-motion';headerMotion.setAttribute('aria-hidden','true');
  headerMotion.innerHTML='<span class="header-breath-light"></span><span class="header-silk-light"></span><span class="header-edge-light"></span>';
  header?.prepend(headerMotion);header?.classList.add('has-combined-motion');

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
  // Floating notifications must escape the animated header's stacking context.
  const notificationPanel=byId('noti-flyout-panel');
  if(notificationPanel)document.body.appendChild(notificationPanel);
  const motionToggle=document.createElement('button');motionToggle.type='button';motionToggle.id='btn-header-motion';motionToggle.className='option-menu-item';
  let headerMotionEnabled=true;
  try{headerMotionEnabled=localStorage.getItem('lq_header_motion')!=='off';}catch(_){}
  function updateHeaderMotion(){
    header?.classList.toggle('header-motion-off',!headerMotionEnabled);
    motionToggle.setAttribute('aria-pressed',String(headerMotionEnabled));
    motionToggle.textContent='✦ Hiệu ứng header: '+(headerMotionEnabled?'Bật':'Tắt');
  }
  motionToggle.addEventListener('click',()=>{headerMotionEnabled=!headerMotionEnabled;try{localStorage.setItem('lq_header_motion',headerMotionEnabled?'on':'off');}catch(_){}updateHeaderMotion();});
  (dropdown?.querySelector('.option-menu-list')||dropdown)?.appendChild(motionToggle);updateHeaderMotion();

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
  function closeNav(){if(document.body.classList.contains('dashboard-nav-open'))window.closeOptionMenu?.();const restore=narrow.matches&&sidebar.contains(document.activeElement);document.body.classList.remove('dashboard-nav-open');menu.setAttribute('aria-expanded','false');sidebar.inert=narrow.matches;if(restore)(matchMedia('(max-width:600px)').matches?settings:menu)?.focus({preventScroll:true});}
  narrow.addEventListener('change',closeNav);closeNav();
  document.addEventListener('dashboard:close-navigation',closeNav);
  menu.addEventListener('click',()=>{const open=document.body.classList.toggle('dashboard-nav-open');menu.setAttribute('aria-expanded',String(open));sidebar.inert=narrow.matches&&!open;if(open)sidebar.querySelector('button:not([hidden])')?.focus();});
  analytics?.addEventListener('click',closeNav);
  dropdown?.addEventListener('click',event=>{if(event.target.closest('.option-menu-item'))closeNav();});
  backdrop.addEventListener('click',closeNav);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('dashboard-nav-open')){closeNav();menu.focus();}});
  document.addEventListener('keydown',event=>{if(event.key!=='Tab'||!document.body.classList.contains('dashboard-nav-open')||dropdown?.classList.contains('show'))return;const targets=[...sidebar.querySelectorAll('a[href],button')].filter(node=>!node.disabled&&!node.hidden&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');const first=targets[0],last=targets[targets.length-1];if(!first)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  function go(id){const target=byId(id);target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return target;}
  const mainNav=sidebar.querySelector('nav');
  mainNav.addEventListener('click',event=>{
    const control=event.target.closest('[data-nav]');if(!control)return;
    const action=control.dataset.nav;
    if(action!=='accounts')return;
    closeNav();go('account-workspace');
  });
  // Lightweight SVG icons follow the same visual weight on phones and desktops.
  const icon=paths=>'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  const warehouseIcons={
    'storage-tab-rank':'<path d="M7 7h10a3 3 0 0 1 3 2l2 8a2 2 0 0 1-3.3 2L15 16H9l-3.7 3A2 2 0 0 1 2 17l2-8a3 3 0 0 1 3-2Z"/><path d="M6 11v4m-2-2h4m8-2h.01M18 14h.01"/>',
    'storage-tab-chungsuc':'<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    'storage-tab-filter':'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
    'storage-tab-unban':'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>'
  };
  for(const [id,paths] of Object.entries(warehouseIcons)){const target=byId(id)?.querySelector('.storage-tab-icon');if(target)target.innerHTML=icon(paths);}
  const accountIcon=mainNav.querySelector('[data-nav="accounts"]>span');if(accountIcon)accountIcon.innerHTML=icon('<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>');
  const analyticsIcon=byId('analytics-icon');if(analyticsIcon)analyticsIcon.innerHTML=icon('<path d="M5 20v-6m7 6V5m7 15V10"/>');
  const settingsIcon=settings?.querySelector('span:first-child');if(settingsIcon)settingsIcon.innerHTML=icon('<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>');
  // One set of warehouse cards: their existing counts already provide the overview.
  const statuses=document.createElement('div');statuses.className='dashboard-list-status';statuses.setAttribute('aria-label','Trạng thái kho đang chọn');
  for(const id of ['stat-active','stat-ban']){const node=byId(id);if(node)statuses.appendChild(node);}
  byId('zone-player-divider').appendChild(statuses);
  // Mirror current warehouse counters without duplicating interactive IDs.
  const brandStatus=document.createElement('div');brandStatus.className='brand-warehouse-status';
  brandStatus.hidden=true;
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
  const phoneHeader=matchMedia('(max-width:600px)');
  const brandInfo=brand?.querySelector('.header-brand-info');
  const brandSub=brand?.querySelector('.header-sub');
  const headerSummary=document.createElement('div');headerSummary.className='mobile-header-summary';
  shell.querySelector('header').appendChild(headerSummary);
  const bottomNav=document.createElement('div');bottomNav.className='mobile-bottom-nav';bottomNav.setAttribute('aria-label','Điều hướng nhanh');
  document.body.appendChild(bottomNav);
  const adminButton=byId('btn-toggle-admin');
  const adminAnchor=document.createComment('Desktop role control');adminButton?.before(adminAnchor);
  adminButton?.addEventListener('click',()=>{if(narrow.matches){window.closeOptionMenu?.();closeNav();}},true);
  const roleArea=document.createElement('div');roleArea.className='dashboard-drawer-role';
  roleArea.innerHTML='<span>Vai trò & quyền truy cập</span>';
  sidebar.insertBefore(roleArea,sidebar.querySelector('.dashboard-sidebar-footer'));
  function placeHeaderSummary(){
    if(!brandInfo||!brandSub)return;
    byId('zone-player-divider').appendChild(statuses);
    brandInfo.appendChild(brandSub);
    if(phoneHeader.matches){
      closeNav();
      bottomNav.appendChild(mainNav);
      if(adminButton)roleArea.appendChild(adminButton);
      const heading=dropdown?.querySelector('.option-menu-header');
      if(heading)heading.after(roleArea);else dropdown?.prepend(roleArea);
      if(syncBar)roleArea.after(syncBar);
    }else{
      const footer=sidebar.querySelector('.dashboard-sidebar-footer');
      sidebar.insertBefore(roleArea,footer);
      sidebar.insertBefore(mainNav,roleArea);
      if(syncBar)footer.appendChild(syncBar);
      if(adminButton)adminAnchor.after(adminButton);
    }
  }
  phoneHeader.addEventListener('change',placeHeaderSummary);placeHeaderSummary();
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
  const searchWrap=document.querySelector('.search-bar-wrap');
  const historyFilters=document.querySelector('.history-filters');
  const collapseButton=byId('btn-toggle-all-rank-groups');
  if(searchWrap&&historyFilters){
    historyFilters.id='dashboard-extra-filters';
    const searchActions=document.createElement('div');searchActions.className='dashboard-search-actions';
    const filterButton=document.createElement('button');filterButton.type='button';filterButton.className='dashboard-filter-toggle';
    filterButton.innerHTML='<span aria-hidden="true">☷</span><span>Bộ lọc</span>';
    filterButton.setAttribute('aria-label','Ẩn hoặc hiện bộ lọc BAN và lịch sử');filterButton.setAttribute('aria-controls',historyFilters.id);filterButton.setAttribute('aria-expanded','true');
    filterButton.addEventListener('click',()=>{const expanded=filterButton.getAttribute('aria-expanded')!=='true';filterButton.setAttribute('aria-expanded',String(expanded));historyFilters.hidden=!expanded;});
    searchActions.appendChild(filterButton);if(collapseButton){const previous=collapseButton.parentElement;searchActions.appendChild(collapseButton);if(previous&&!previous.children.length)previous.remove();}searchWrap.appendChild(searchActions);
  }
  // Fade a refreshed list once, without animating each row or delaying its handlers.
  const listArea=byId('display-area');let listFrame=0,listAnimation=null;
  if(listArea)new MutationObserver(()=>{
    if(listFrame)return;
    listFrame=requestAnimationFrame(()=>{
      listFrame=0;
      if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||listArea.contains(document.activeElement))return;
      listAnimation?.cancel();
      listAnimation=listArea.animate?.([{opacity:.65},{opacity:1}],{duration:160,easing:'ease-out'});
    });
  }).observe(listArea,{childList:true});
  refresh();
})();
