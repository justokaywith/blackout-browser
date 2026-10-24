const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const address = $('#address');
const welcome = $('#welcome');
const status = $('#status');
const settingsPanel = $('#settings-panel');
const menu = $('#app-menu');
const themes = new Set(['eclipse','ember','aurora']);
const surfaces = new Set(['dark','light']);
const motions = new Set(['full','reduced']);
let profileMode = 'standard';
let favoritesWritable = false;
let activeUrl = '';

function loadAppearance(){try{return JSON.parse(localStorage.getItem('blackout-appearance'))||{}}catch{return {}}}
function applyAppearance(next={}){const current=loadAppearance();const appearance={theme:themes.has(next.theme)?next.theme:(themes.has(current.theme)?current.theme:'eclipse'),surface:surfaces.has(next.surface)?next.surface:(surfaces.has(current.surface)?current.surface:'dark'),motion:motions.has(next.motion)?next.motion:(motions.has(current.motion)?current.motion:'full')};document.documentElement.dataset.theme=appearance.theme;document.documentElement.dataset.surface=appearance.surface;document.documentElement.dataset.motion=appearance.motion;
// Theme-to-music-player color sync
const themeColors = {
  eclipse: { accent: '#9a7aff', glow: 'rgba(154, 122, 255, 0.35)' },
  aurora: { accent: '#77e4c4', glow: 'rgba(119, 228, 196, 0.35)' },
  ember: { accent: '#ff684d', glow: 'rgba(255, 104, 77, 0.35)' },
  midnight: { accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)' },
  noir: { accent: '#9a7aff', glow: 'rgba(154, 122, 255, 0.25)' }
};
const tc = themeColors[appearance.theme] || themeColors.eclipse;
document.documentElement.style.setProperty('--mood-accent', tc.accent);
document.documentElement.style.setProperty('--mood-glow', tc.glow);
window.blackout?.setUiAppearance?.({theme:appearance.theme}).catch(()=>{});
document.dispatchEvent(new CustomEvent('blackout-theme-change',{detail:{theme:appearance.theme}}));
$('#settings-theme').value=appearance.theme;$('#surface-mode').value=appearance.surface;$('#motion-mode').value=appearance.motion;try{localStorage.setItem('blackout-appearance',JSON.stringify(appearance))}catch{}}
applyAppearance();
$('#settings-theme').addEventListener('change',e=>applyAppearance({theme:e.target.value}));
$('#surface-mode').addEventListener('change',e=>applyAppearance({surface:e.target.value}));
$('#motion-mode').addEventListener('change',e=>applyAppearance({motion:e.target.value}));
const startup=$('#startup-sequence');
const startupBar=$('#startup-progress-bar');
const startupLabel=$('#startup-progress-label');
const startupVal=$('#startup-progress-val');
function setStartupProgress(percent,label){
  if(startupBar)startupBar.style.width=`${percent}%`;
  if(startupVal)startupVal.textContent=`${percent}%`;
  if(startupLabel&&label)startupLabel.textContent=label;
}
let startupEnded=false;
function endStartup(){
  if(startupEnded||!startup)return;
  startupEnded=true;
  setStartupProgress(100,'READY');
  setTimeout(()=>{startup.classList.add('done')},350);
}
setStartupProgress(24,'INITIALIZING SYSTEM...');
setTimeout(()=>setStartupProgress(58,'LOADING FAVORITES...'),380);
setTimeout(()=>setStartupProgress(85,'SYNCHRONIZING ENGINE...'),850);
setTimeout(()=>endStartup(),1650);

function toggleMenu(force){
  if (force === false) {
    menu.hidden = true;
    $('#menu-button')?.setAttribute('aria-expanded', 'false');
    return;
  }
  if (window.blackout?.showAppMenu) {
    window.blackout.showAppMenu();
    return;
  }
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  $('#menu-button')?.setAttribute('aria-expanded', String(open));
}
$('#menu-button').addEventListener('click',e=>{e.stopPropagation();toggleMenu()});
document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!$('#menu-button').contains(e.target))toggleMenu(false)});

let bookmarksBarVisible = true;
function setBookmarksBarVisibility(visible) {
  bookmarksBarVisible = Boolean(visible);
  document.documentElement.classList.toggle('has-bookmarks-bar', bookmarksBarVisible);
  try { localStorage.setItem('blackout-show-bookmarks-bar', String(bookmarksBarVisible)); } catch {}
  const menuBtn = $('#menu-toggle-bookmarks span');
  if (menuBtn) menuBtn.textContent = bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar';
  const settingsCheck = $('#settings-toggle-bookmarks-bar');
  if (settingsCheck) settingsCheck.checked = bookmarksBarVisible;
  if (window.blackout?.setBookmarksBar) {
    window.blackout.setBookmarksBar(bookmarksBarVisible).catch(() => {});
  }
}
function toggleBookmarksBar(force) {
  const next = force !== undefined ? force : !bookmarksBarVisible;
  setBookmarksBarVisibility(next);
}
try {
  const savedBarPref = localStorage.getItem('blackout-show-bookmarks-bar');
  if (savedBarPref !== null) {
    setBookmarksBarVisibility(savedBarPref !== 'false');
  } else {
    setBookmarksBarVisibility(true);
  }
} catch {
  setBookmarksBarVisibility(true);
}
const menuToggleBookmarks = $('#menu-toggle-bookmarks');
if (menuToggleBookmarks) {
  menuToggleBookmarks.addEventListener('click', () => {
    toggleBookmarksBar();
    toggleMenu(false);
  });
}
const settingsToggleBookmarks = $('#settings-toggle-bookmarks-bar');
if (settingsToggleBookmarks) {
  settingsToggleBookmarks.addEventListener('change', (e) => {
    setBookmarksBarVisibility(e.target.checked);
  });
}
const settingsAddBookmark = $('#settings-add-bookmark');
if (settingsAddBookmark) {
  settingsAddBookmark.addEventListener('click', () => openFavoriteDialog());
}
const bookmarksBarEl = $('#bookmarks-bar');
if (bookmarksBarEl) {
  bookmarksBarEl.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.bookmark-item')) return;
    e.preventDefault();
    if (window.blackout?.bookmarkContextMenu) {
      window.blackout.bookmarkContextMenu(null);
    }
  });
}

let settingsTabOpen = false;
let settingsActive = false;

function switchSettingsSection(key) {
  $('#settings-title').textContent = key === 'music-library' ? 'Your music, collected.' : 'Make Blackout yours.';
  $$('[data-settings-target]').forEach(x => x.classList.toggle('active', x.dataset.settingsTarget === key));
  $$('[data-settings-section]').forEach(x => x.hidden = x.dataset.settingsSection !== key);
  if (key === 'history') {
    address.value = 'blackout://history';
    refreshHistory();
  } else if (key === 'music-library') {
    address.value = 'blackout://music';
    refreshSettingsMusicLibrary();
  } else if (key === 'downloads') {
    address.value = 'blackout://downloads';
    restoreDownloads();
  } else if (key === 'favorites') {
    address.value = 'blackout://bookmarks';
  } else {
    address.value = 'blackout://settings';
  }
}

function openSettingsTab(targetSection = 'you') {
  settingsTabOpen = true;
  settingsActive = true;
  document.body.classList.add('settings-active');
  settingsPanel.hidden = false;
  welcome.hidden = true;
  welcome.inert = true;
  menu.hidden = true;
  if (window.blackout) window.blackout.settings(true);
  switchSettingsSection(targetSection);
  $('#settings-title').focus();
  if (window.lastTabState) renderTabs(window.lastTabState);
}

function openHistoryTab() {
  openSettingsTab('history');
}

function closeSettingsTab() {
  settingsTabOpen = false;
  settingsActive = false;
  document.body.classList.remove('settings-active');
  settingsPanel.hidden = true;
  welcome.inert = false;
  menu.hidden = true;
  if (window.blackout) window.blackout.settings(false);
  address.value = activeUrl || '';
  welcome.hidden = Boolean(activeUrl);
  updateStarIcon();
  if (window.lastTabState) renderTabs(window.lastTabState);
}

function showSettings(open) {
  if (open) {
    openSettingsTab();
  } else {
    closeSettingsTab();
  }
}
$('#settings-button').addEventListener('click',()=>openSettingsTab());
$('#menu-settings').addEventListener('click',()=>showSettings(true));
$('#settings-close').addEventListener('click',()=>showSettings(false));
$$('[data-settings-target]').forEach(button=>button.addEventListener('click',()=>switchSettingsSection(button.dataset.settingsTarget)));
$('#settings-search').addEventListener('input',e=>{const term=e.target.value.trim().toLowerCase();$$('[data-settings-target]').forEach(x=>x.hidden=term&&!x.textContent.toLowerCase().includes(term))});

function loadSearchEngine(){try{return localStorage.getItem('blackout-search-engine')||'duckduckgo'}catch{return 'duckduckgo'}}
function applySearchEngine(engine){
  const el=$('#settings-search-engine');
  if(el)el.value=engine;
  try{localStorage.setItem('blackout-search-engine',engine)}catch{}
}
applySearchEngine(loadSearchEngine());
const searchEngineSelect=$('#settings-search-engine');
if(searchEngineSelect){searchEngineSelect.addEventListener('change',e=>applySearchEngine(e.target.value));}

async function navigate(value){
  const target=String(value||'').trim();
  if(!target)return;
  const lower=target.toLowerCase();
  if(lower==='blackout://settings'||lower==='blackout:settings'){
    openSettingsTab('you');
    return;
  }
  if(lower==='blackout://history'||lower==='blackout:history'){
    openHistoryTab();
    return;
  }
  if(lower==='blackout://downloads'||lower==='blackout:downloads'){
    openSettingsTab('downloads');
    return;
  }
  if(lower==='blackout://bookmarks'||lower==='blackout:bookmarks'||lower==='blackout://favorites'){
    openSettingsTab('favorites');
    return;
  }
  if(!window.blackout)return;
  if (settingsActive) {
    closeSettingsTab();
  }
  status.textContent='Opening…';
  try{
    const engine=loadSearchEngine();
    await window.blackout.navigate(target, engine);
    welcome.hidden=true;
  }catch(error){
    status.textContent=error.message||'That address could not be opened.';
  }
}
$('#address-form').addEventListener('submit',e=>{e.preventDefault();navigate(address.value)});$('#search-form').addEventListener('submit',e=>{e.preventDefault();address.value=$('#welcome-search').value;navigate(address.value)});
$$('[data-action]').forEach(button=>button.addEventListener('click',()=>{
  if (settingsActive) {
    settingsActive = false;
    settingsPanel.hidden = true;
    welcome.inert = false;
    if (window.blackout) window.blackout.settings(false);
    address.value = activeUrl || '';
    welcome.hidden = Boolean(activeUrl);
  }
  if (button.dataset.action === 'new-tab') {
    address.value = '';
    activeUrl = '';
    welcome.hidden = false;
    setTimeout(() => {
      address.focus();
      address.select();
    }, 30);
  }
  window.blackout?.control(button.dataset.action);
}));
$('#menu-new-tab').addEventListener('click',()=>{
  if (settingsActive) {
    settingsActive = false;
    settingsPanel.hidden = true;
    welcome.inert = false;
    if (window.blackout) window.blackout.settings(false);
  }
  address.value = '';
  activeUrl = '';
  welcome.hidden = false;
  window.blackout?.control('new-tab');
  setTimeout(() => {
    address.focus();
    address.select();
  }, 30);
});
$('#menu-incognito').addEventListener('click',()=>window.blackout?.openIncognito());
$$('[data-window-action]').forEach(button=>button.addEventListener('click',()=>window.blackout?.windowAction(button.dataset.windowAction)));

const siteInfoIcon=$('#address-form span[aria-hidden]');
const siteInfoButton=siteInfoIcon?document.createElement('button'):null;
if(siteInfoButton){
  siteInfoButton.type='button';
  siteInfoButton.id='site-info-button';
  siteInfoButton.className='site-info-button';
  siteInfoButton.setAttribute('aria-label','Site information');
  siteInfoButton.setAttribute('aria-expanded','false');
  siteInfoButton.append(siteInfoIcon.cloneNode(true));
  siteInfoIcon.replaceWith(siteInfoButton);
}
const siteInfoPanel=$('#site-info-panel');
async function showSiteInfo(){
  if(!siteInfoButton)return;
  await window.blackout?.toggleSiteInfoPopup?.();
}
function hideSiteInfo(){siteInfoPanel.hidden=true;if(siteInfoButton)siteInfoButton.setAttribute('aria-expanded','false');}
if(siteInfoButton)siteInfoButton.addEventListener('click',showSiteInfo);
$('#site-info-close').addEventListener('click',hideSiteInfo);
document.addEventListener('pointerdown',event=>{if(!siteInfoPanel.hidden&&!siteInfoPanel.contains(event.target)&&!siteInfoButton?.contains(event.target))hideSiteInfo();});

function loadLocalFavorites() {
  try {
    if (!localStorage.getItem('blackout-v021-purged')) {
      localStorage.removeItem('blackout-local-favorites');
      localStorage.setItem('blackout-v021-purged', 'true');
      return [];
    }
    return JSON.parse(localStorage.getItem('blackout-local-favorites')) || [];
  } catch { return []; }
}
function saveLocalFavorites(items) {
  try {
    localStorage.setItem('blackout-local-favorites', JSON.stringify(items));
  } catch {}
}

async function refreshFavorites(){
  if(!window.blackout){
    renderFavorites(loadLocalFavorites(), true);
    return;
  }
  try{
    const result=await window.blackout.favorites('list');
    renderFavorites(result.items, result.writable);
  }catch{
    renderFavorites([],false);
  }
}

let currentFavorites = [];

function updateStarIcon(){
  const star = $('#favorite-current');
  if(!star) return;
  if(!activeUrl){
    star.textContent = '☆';
    star.style.color = '';
    star.title = 'Add to favorites';
    return;
  }
  const isFav = currentFavorites.some(f => {
    try {
      const u1 = new URL(f.url).href.replace(/\/$/, '');
      const u2 = new URL(activeUrl).href.replace(/\/$/, '');
      return u1 === u2;
    } catch {
      return f.url === activeUrl;
    }
  });
  if(isFav){
    star.textContent = '★';
    star.style.color = 'var(--accent)';
    star.title = 'In favorites';
  } else {
    star.textContent = '☆';
    star.style.color = '';
    star.title = 'Add current page to favorites';
  }
}

function favoriteIconUrl(value){
  try{
    const url=new URL(value);
    return `blackout://app/favicon?url=${encodeURIComponent(url.href)}`;
  }catch{return '';}
}

function renderFavorites(items,writable){
  favoritesWritable=writable;
  currentFavorites = Array.isArray(items) ? items : [];
  updateStarIcon();
  const grid=$('#favorites-grid');
  if (grid) grid.replaceChildren();
  const bookmarksList = $('#bookmarks-list');
  if (bookmarksList) bookmarksList.replaceChildren();
  const bookmarksEmptyHint = $('#bookmarks-empty-hint');
  if (bookmarksEmptyHint) bookmarksEmptyHint.hidden = currentFavorites.length > 0;

  // Settings bookmarks list
  const settingsList = $('#settings-bookmarks-list');
  const settingsCount = $('#settings-bookmarks-count');
  const settingsEmpty = $('#settings-bookmarks-empty');
  if (settingsCount) settingsCount.textContent = String(currentFavorites.length);
  if (settingsEmpty) settingsEmpty.hidden = currentFavorites.length > 0;
  if (settingsList) settingsList.replaceChildren();

  if(!currentFavorites.length){
    if (grid) {
      const empty=document.createElement('p');
      empty.textContent=writable?'Add the places you return to most.':'No favorites saved yet.';
      grid.append(empty);
    }
    return;
  }
  for(const item of currentFavorites){
    // 1. Bookmarks Bar Item
    if (bookmarksList) {
      const bItem = document.createElement('button');
      bItem.className = 'bookmark-item';
      bItem.type = 'button';
      bItem.title = `${item.title}\n${item.url}`;

      const bIcon = document.createElement('img');
      bIcon.className = 'bookmark-icon';
      bIcon.alt = '';
      bIcon.src = favoriteIconUrl(item.url);
      bIcon.onerror = () => {
        bIcon.remove();
        const fb = document.createElement('span');
        fb.className = 'bookmark-fallback-icon';
        fb.textContent = (item.title || '★').charAt(0).toUpperCase();
        fb.style.color = item.color || 'var(--accent)';
        bItem.prepend(fb);
      };
      bItem.append(bIcon);

      const bTitle = document.createElement('span');
      bTitle.className = 'bookmark-title';
      bTitle.textContent = item.title;
      bItem.append(bTitle);

      bItem.addEventListener('click', () => {
        if (window.blackout) window.blackout.favorites('opened', { id: item.id }).catch(() => {});
        navigate(item.url);
      });

      bItem.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          window.blackout?.tab?.('new', item.url);
        }
      });

      bItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (window.blackout?.bookmarkContextMenu) {
          window.blackout.bookmarkContextMenu({ id: item.id, url: item.url, title: item.title });
        }
      });

      bookmarksList.append(bItem);
    }

    // 2. Settings Bookmarks Section Item
    if (settingsList) {
      const sItem = document.createElement('div');
      sItem.className = 'settings-bookmark-item';

      const sInfo = document.createElement('div');
      sInfo.className = 'settings-bookmark-info';

      const sIcon = document.createElement('img');
      sIcon.className = 'settings-bookmark-icon';
      sIcon.alt = '';
      sIcon.src = favoriteIconUrl(item.url);
      sIcon.onerror = () => {
        sIcon.remove();
        const fb = document.createElement('span');
        fb.className = 'favorite-badge';
        fb.style.width = '24px';
        fb.style.height = '24px';
        fb.style.fontSize = '12px';
        fb.textContent = (item.title || '★').charAt(0).toUpperCase();
        fb.style.color = item.color || 'var(--accent)';
        sInfo.prepend(fb);
      };
      sInfo.append(sIcon);

      const sMeta = document.createElement('div');
      sMeta.className = 'settings-bookmark-meta';
      const sTitle = document.createElement('b');
      sTitle.textContent = item.title;
      const sUrl = document.createElement('span');
      sUrl.textContent = item.url;
      sMeta.append(sTitle, sUrl);
      sInfo.append(sMeta);

      const sActions = document.createElement('div');
      sActions.className = 'settings-bookmark-actions';
      const sOpenBtn = document.createElement('button');
      sOpenBtn.type = 'button';
      sOpenBtn.textContent = 'Open';
      sOpenBtn.addEventListener('click', () => {
        if (settingsActive) showSettings(false);
        navigate(item.url);
      });
      const sDelBtn = document.createElement('button');
      sDelBtn.type = 'button';
      sDelBtn.className = 'settings-bookmark-delete';
      sDelBtn.textContent = 'Remove';
      sDelBtn.addEventListener('click', async () => {
        if (window.blackout) {
          const res = await window.blackout.favorites('remove', { id: item.id });
          renderFavorites(res.items, res.writable);
        } else {
          const updated = loadLocalFavorites().filter(x => x.id !== item.id);
          saveLocalFavorites(updated);
          renderFavorites(updated, true);
        }
      });
      sActions.append(sOpenBtn, sDelBtn);

      sItem.append(sInfo, sActions);
      settingsList.append(sItem);
    }

    // 3. New Tab Favorites Grid
    if (grid) {
      const card=document.createElement('article');
      card.className='favorite-card';


      const open=document.createElement('button');
      open.className='favorite-open';
      open.type='button';
      open.setAttribute('aria-label',`Open ${item.title}`);

      const iconBadge = document.createElement('div');
      iconBadge.className = 'favorite-badge';
      let hostName = item.url;
      try { hostName = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
      iconBadge.textContent = (item.title || hostName || '★').charAt(0).toUpperCase();
      iconBadge.style.color = item.color || 'var(--accent)';
      const iconImage=document.createElement('img');
      iconImage.className='favorite-icon';
      iconImage.alt='';
      iconImage.src=favoriteIconUrl(item.url);
      iconImage.onerror=()=>{iconImage.remove();iconBadge.classList.add('favorite-fallback');};
      iconImage.onload=()=>iconBadge.classList.add('has-favicon');
      if(iconImage.src)iconBadge.append(iconImage);

      const content = document.createElement('div');
      content.className = 'favorite-content';
      const title=document.createElement('b');
      title.textContent=item.title;
      const host=document.createElement('small');
      host.textContent = hostName;
      content.append(title,host);

      open.append(iconBadge,content);
      open.addEventListener('click',()=>{
        if(window.blackout) window.blackout.favorites('opened',{id:item.id}).catch(()=>{});
        navigate(item.url);
      });
      card.append(open);
      if(writable){
        const remove=document.createElement('button');
        remove.className='remove-favorite';
        remove.type='button';
        remove.textContent='×';
        remove.setAttribute('aria-label',`Remove ${item.title}`);
        remove.addEventListener('click',async e=>{
          e.stopPropagation();
          if(window.blackout){
            const result=await window.blackout.favorites('remove',{id:item.id});
            renderFavorites(result.items,result.writable);
          } else {
            const updated = loadLocalFavorites().filter(x => x.id !== item.id);
            saveLocalFavorites(updated);
            renderFavorites(updated, true);
          }
        });
        card.append(remove);
      }
      grid.append(card);
    }
  }
}

let editingFavoriteId = null;
function openFavoriteDialog(item){
  favoritesWritable = true;
  let targetUrl = activeUrl || '';
  let defaultTitle = '';
  editingFavoriteId = null;

  if (item && item.id) {
    editingFavoriteId = item.id;
    targetUrl = item.url;
    defaultTitle = item.title;
  } else if (activeUrl) {
    const existing = currentFavorites.find(f => {
      try {
        const u1 = new URL(f.url).href.replace(/\/$/, '');
        const u2 = new URL(activeUrl).href.replace(/\/$/, '');
        return u1 === u2;
      } catch { return f.url === activeUrl; }
    });
    if (existing) {
      editingFavoriteId = existing.id;
      defaultTitle = existing.title;
      targetUrl = existing.url;
    } else {
      try { defaultTitle = new URL(activeUrl).hostname.replace(/^www\./, ''); } catch { defaultTitle = activeUrl; }
    }
  }

  const heading = $('#favorite-dialog-heading');
  if (heading) heading.textContent = editingFavoriteId ? 'Edit bookmark' : 'Bookmark page';
  const saveBtn = $('#favorite-save');
  if (saveBtn) saveBtn.textContent = editingFavoriteId ? 'Save' : 'Save bookmark';
  const delBtn = $('#favorite-delete');
  if (delBtn) delBtn.hidden = !editingFavoriteId;

  $('#favorite-title').value = defaultTitle;
  $('#favorite-url').value = targetUrl;
  $('#favorite-error').textContent = '';
  if (window.blackout?.modal) window.blackout.modal(true);
  $('#favorite-dialog').showModal();
}

function closeFavoriteDialog(){
  const dlg = $('#favorite-dialog');
  if (dlg && dlg.open) dlg.close();
  editingFavoriteId = null;
  if (window.blackout?.modal) window.blackout.modal(false);
}

$('#add-favorite').addEventListener('click', () => openFavoriteDialog());
$('#favorite-current').addEventListener('click', () => openFavoriteDialog());
const favCancelBtn = $('#favorite-cancel');
if (favCancelBtn) favCancelBtn.addEventListener('click', closeFavoriteDialog);
const favCloseBtn = $('#favorite-close');
if (favCloseBtn) favCloseBtn.addEventListener('click', closeFavoriteDialog);

const favDelBtn = $('#favorite-delete');
if (favDelBtn) {
  favDelBtn.addEventListener('click', async () => {
    if (editingFavoriteId) {
      if (window.blackout) {
        const res = await window.blackout.favorites('remove', { id: editingFavoriteId });
        renderFavorites(res.items, res.writable);
      } else {
        const updated = loadLocalFavorites().filter(x => x.id !== editingFavoriteId);
        saveLocalFavorites(updated);
        renderFavorites(updated, true);
      }
      closeFavoriteDialog();
    }
  });
}

const favDlg = $('#favorite-dialog');
if (favDlg) {
  favDlg.addEventListener('click', (e) => {
    const rect = favDlg.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) closeFavoriteDialog();
  });
  favDlg.addEventListener('cancel', () => {
    if (window.blackout?.modal) window.blackout.modal(false);
  });
  favDlg.addEventListener('close', () => {
    if (window.blackout?.modal) window.blackout.modal(false);
  });
}

$('#favorite-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    let u = $('#favorite-url').value.trim();
    if (u && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) u = 'https://' + u;
    let defaultTitle = u;
    try { defaultTitle = new URL(u).hostname.replace(/^www\./, ''); } catch {}
    const title = $('#favorite-title').value.trim() || defaultTitle;
    if (window.blackout) {
      let result;
      if (editingFavoriteId) {
        result = await window.blackout.favorites('update', { id: editingFavoriteId, title, url: u });
      } else {
        result = await window.blackout.favorites('add', { title, url: u });
      }
      renderFavorites(result.items, result.writable);
    } else {
      const local = loadLocalFavorites();
      if (editingFavoriteId) {
        const idx = local.findIndex(x => x.id === editingFavoriteId);
        if (idx >= 0) local[idx] = { ...local[idx], title, url: u };
      } else {
        local.push({ id: 'fav-' + Date.now(), title, url: u });
      }
      saveLocalFavorites(local);
      renderFavorites(local, true);
    }
    closeFavoriteDialog();
  } catch (error) {
    $('#favorite-error').textContent = error.message || 'Could not save bookmark.';
  }
});

$('#clear-data-button').addEventListener('click',()=>{$('#clear-data-confirm').hidden=false});$('#clear-data-cancel').addEventListener('click',()=>{$('#clear-data-confirm').hidden=true});$('#clear-data-accept').addEventListener('click',async()=>{const feedback=$('#settings-status');feedback.textContent='Clearing site data…';try{await window.blackout.clearSiteData();feedback.textContent='Site data and cache cleared.';$('#clear-data-confirm').hidden=true}catch{feedback.textContent='Could not clear all site data.'}});

async function refreshSettingsMusicLibrary() {
  const container = $('#settings-music-list');
  const emptyHint = $('#settings-music-empty');
  const countBadge = $('#settings-music-count-badge');
  if (!container) return;

  try {
    const list = await window.blackout?.getMusicFavorites?.() || [];
    if (countBadge) countBadge.textContent = `${list.length} song${list.length === 1 ? '' : 's'}`;
    container.replaceChildren();

    if (!list.length) {
      if (emptyHint) emptyHint.hidden = false;
      return;
    }
    if (emptyHint) emptyHint.hidden = true;

    list.forEach(track => {
      const row = document.createElement('div');
      row.className = 'library-track';
      row.setAttribute('role', 'listitem');

      const left = document.createElement('div');
      left.className = 'library-track-main';

      const thumb = document.createElement('div');
      thumb.className = 'library-artwork';

      if (track.cover) {
        const img = document.createElement('img');
        img.src = track.cover;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.textContent = '♫';
      }

      const meta = document.createElement('div');
      meta.className = 'library-track-meta';

      const title = document.createElement('div');
      title.className = 'library-track-title';
      title.textContent = track.title || 'Untitled Track';

      const sub = document.createElement('div');
      sub.className = 'library-track-subtitle';
      sub.textContent = (track.artist || 'Web Artist') + (track.durationFormatted ? ` · ${track.durationFormatted}` : '');

      meta.appendChild(title);
      meta.appendChild(sub);
      left.appendChild(thumb);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'library-actions';

      if (track.isCached) {
        const badge = document.createElement('span');
      badge.className = 'library-offline';
        badge.textContent = 'Downloaded';
        right.appendChild(badge);
      } else {
        const cacheBtn = document.createElement('button');
      cacheBtn.className = 'library-download';
        cacheBtn.type = 'button';
        cacheBtn.textContent = 'Download';
        cacheBtn.title = 'Download to cache for instant offline playback';
        cacheBtn.addEventListener('click', async () => {
          cacheBtn.textContent = 'Downloading...';
          try {
            await window.blackout?.cacheMusicTrack?.(track);
            await refreshSettingsMusicLibrary();
          } catch {
            cacheBtn.textContent = 'Download';
          }
        });
        right.appendChild(cacheBtn);
      }

      const playBtn = document.createElement('button');
      playBtn.className = 'library-play';
      playBtn.type = 'button';
      playBtn.textContent = '▶';
      playBtn.setAttribute('aria-label', `Play ${track.title || 'song'}`);
      playBtn.title = `Play ${track.title || 'song'}`;
      playBtn.addEventListener('click', async () => {
        if (track.videoId) {
          window.blackout?.musicPlay?.({ videoId: track.videoId, track });
        } else if (track.hasLocalAudio && track.cachedUrl) {
          const audio = $('#universal-audio-player');
          if (audio) {
            try { await window.blackout?.musicStop?.(); } catch {}
            audio.src = track.cachedUrl;
            audio.currentTime = 0;
            audio.play().catch(() => {
              if (track.url) {
                audio.src = track.url;
                audio.play().catch(() => {});
              }
            });
          }
        } else if (track.url) {
          const audio = $('#universal-audio-player');
          if (audio) {
            try { await window.blackout?.musicStop?.(); } catch {}
            audio.src = track.url;
            audio.currentTime = 0;
            audio.play().catch(() => {});
          }
        }
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'library-remove';
      removeBtn.type = 'button';
      removeBtn.title = 'Remove from Favorites';
      removeBtn.setAttribute('aria-label', `Remove ${track.title || 'song'} from favorites`);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', async () => {
        await window.blackout?.toggleMusicFavorite?.(track);
        await refreshSettingsMusicLibrary();
      });

      right.appendChild(playBtn);
      right.appendChild(removeBtn);

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  } catch {}
}

async function refreshHistory(searchTerm = '') {
  const listEl = $('#history-list');
  const countEl = $('#history-count');
  const emptyEl = $('#history-empty-hint');
  if (!listEl || !window.blackout?.history) return;
  try {
    const items = await window.blackout.history('get', searchTerm);
    if (countEl) countEl.textContent = `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;
    listEl.innerHTML = '';
    if (!items || items.length === 0) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = searchTerm ? `No history matching "${searchTerm}"` : 'No browsing history yet.';
        listEl.appendChild(emptyEl);
      }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'history-item';

      const infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'history-item-info';
      infoBtn.title = `Open ${item.url}`;
      infoBtn.addEventListener('click', () => {
        closeSettingsTab();
        address.value = item.url;
        navigate(item.url);
      });

      const iconUrl = favoriteIconUrl(item.url);
      if (iconUrl) {
        const img = document.createElement('img');
        img.className = 'history-item-icon';
        img.src = iconUrl;
        img.alt = '';
        img.onerror = () => {
          const fallback = document.createElement('span');
          fallback.className = 'history-item-fallback-icon';
          fallback.textContent = (item.hostname || 'W')[0].toUpperCase();
          img.replaceWith(fallback);
        };
        infoBtn.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'history-item-fallback-icon';
        fallback.textContent = (item.hostname || 'W')[0].toUpperCase();
        infoBtn.appendChild(fallback);
      }

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';
      const b = document.createElement('b');
      b.className = 'history-item-title';
      b.textContent = item.title || item.hostname || 'Untitled';
      const s = document.createElement('span');
      s.textContent = item.url;
      meta.appendChild(b);
      meta.appendChild(s);
      infoBtn.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'history-item-right';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'history-item-time';
      const d = new Date(item.visitedAt);
      timeSpan.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timeSpan.title = d.toLocaleString();

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'history-item-delete';
      delBtn.setAttribute('aria-label', 'Delete from history');
      delBtn.title = 'Remove from history';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.blackout.history('delete', item.id);
        refreshHistory($('#history-search-input')?.value || '');
      });

      right.appendChild(timeSpan);
      right.appendChild(delBtn);

      card.appendChild(infoBtn);
      card.appendChild(right);
      listEl.appendChild(card);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

$('#history-clear-btn')?.addEventListener('click', async () => {
  if (confirm('Clear all browsing history?')) {
    await window.blackout.history('clear');
    refreshHistory();
  }
});
$('#history-search-input')?.addEventListener('input', (e) => {
  refreshHistory(e.target.value);
});
$('#menu-history')?.addEventListener('click', () => {
  menu.hidden = true;
  openHistoryTab();
});
$('#pip-button')?.addEventListener('click', () => {
  window.blackout?.togglePictureInPicture();
});
$('#menu-pip')?.addEventListener('click', () => {
  menu.hidden = true;
  window.blackout?.togglePictureInPicture();
});

let lastRevealedTabId = null;
let tabHeaderClick={id:null,time:0};
let lastTabDragAt=-Infinity;
let tabDragSession=null,pendingTabState=null;
function tabHeaderDoubleClick(id,event){
 const now=performance.now(),twice=event.detail>=2||(tabHeaderClick.id===id&&now-tabHeaderClick.time<400);
 tabHeaderClick=twice?{id:null,time:0}:{id,time:now};return twice;
}
function renderTabs(state){
  window.lastTabState = state;
  if(tabDragSession){pendingTabState=state;return;}
  const strip=$('#tab-strip');
  strip.replaceChildren();
  const tabs = (state && state.tabs && state.tabs.length) ? [...state.tabs] : [{ id: 'new-tab', url: '', title: 'New tab' }];
  const activeId = state?.activeId || 'new-tab';

  const groups=new Map((state.groups || []).map(group=>[group.id,group]));
  const renderedGroups=new Set();
  for(const tab of tabs){
    const group=groups.get(tab.groupId);
    if(group && !renderedGroups.has(group.id)) {
      renderedGroups.add(group.id);
      const chip=document.createElement('button');chip.className='tab-group-label';chip.type='button';
      chip.textContent=group.name+' · '+tabs.filter(t=>t.groupId===group.id).length;
      chip.setAttribute('aria-expanded',String(!group.collapsed));chip.title='Collapse or expand '+group.name;
      chip.addEventListener('click',()=>window.blackout?.tabGroup?.('collapse',{groupId:group.id}));
      chip.addEventListener('contextmenu',event=>{event.preventDefault();openTabsOverview()});strip.append(chip);
    }
    if(group?.collapsed && tab.id!==activeId)continue;
    const item=document.createElement('div');
    const isThisTabActive = (tab.id === activeId) && !settingsActive;
    item.className='tab-item'+(isThisTabActive?' active':'');
    item.dataset.tabId=tab.id;
    item.draggable=false;
    item.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('.tab-close'))return;
      tabDragSession={id:tab.id};
      const originX=event.clientX,originY=event.clientY;let moving=false,target=null,after=false;
      const clean=()=>{item.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);tabDragSession=null;try{if(item.hasPointerCapture(event.pointerId))item.releasePointerCapture(event.pointerId)}catch{}if(pendingTabState){pendingTabState=null;requestAnimationFrame(()=>renderTabs(window.lastTabState))}document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);strip.querySelectorAll('.tab-drop-target').forEach(n=>n.classList.remove('tab-drop-target','drop-after'));item.classList.remove('tab-moving')};
      const move=e=>{
        if(!moving&&Math.hypot(e.clientX-originX,e.clientY-originY)<6)return;
        if(!moving){try{item.setPointerCapture(event.pointerId)}catch{}}moving=true;tabHeaderClick={id:null,time:0};e.preventDefault();item.classList.add('tab-moving');
        const bounds=strip.getBoundingClientRect();if(e.clientX<bounds.left+30)strip.scrollLeft-=16;else if(e.clientX>bounds.right-30)strip.scrollLeft+=16;
        target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.tab-item[data-tab-id]');
        strip.querySelectorAll('.tab-drop-target').forEach(n=>n.classList.remove('tab-drop-target','drop-after'));
        if(target&&target!==item){after=e.clientX>target.getBoundingClientRect().left+target.offsetWidth/2;target.classList.add('tab-drop-target');target.classList.toggle('drop-after',after)}
      };
      const up=()=>{clean();if(moving){lastTabDragAt=performance.now();if(target&&target!==item)window.blackout?.moveTab?.(tab.id,target.dataset.tabId,after)}};
      const cancel=()=>{clean();if(moving)lastTabDragAt=performance.now()};
      item.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up,{once:true});document.addEventListener('pointercancel',cancel,{once:true});
    });
    item.addEventListener('contextmenu',event=>{event.preventDefault();openTabsOverview(tab.id)});
    const icon=document.createElement('img');
    icon.className='tab-icon';
    icon.alt='';
    icon.src = tab.url ? favoriteIconUrl(tab.url) : './blackout-mark.svg';
    icon.onerror = () => { icon.src = './blackout-mark.svg'; };
    icon.draggable=false;icon.addEventListener('dblclick',()=>window.blackout?.tab('close',tab.id));
    const select=document.createElement('button');
    select.className='tab-select';
    select.type='button';
    select.textContent = tab.title||'New tab';
    select.title=tab.url||'New tab';
    select.addEventListener('click',event=>{
      if(performance.now()-lastTabDragAt<300){event.preventDefault();return;}
      if(tabHeaderDoubleClick(tab.id,event)){window.blackout?.tab('close',tab.id);return}

      if (settingsActive) {
        settingsActive = false;
        settingsPanel.hidden = true;
        welcome.inert = false;
        if (window.blackout) window.blackout.settings(false);
      }
      activeUrl = tab.url || '';
      address.value = activeUrl;
      welcome.hidden = Boolean(activeUrl);
      updateStarIcon();
      if (window.lastTabState) {
        window.lastTabState.activeId = tab.id;
        renderTabs(window.lastTabState);
      }
      window.blackout?.tab('switch',tab.id);
    });
    const close=document.createElement('button');
    close.className='tab-close';
    close.type='button';
    close.textContent='×';
    close.setAttribute('aria-label','Close '+(tab.title||'tab'));
    close.addEventListener('click',()=>window.blackout?.tab('close',tab.id));
    item.append(icon,select,close);
    strip.append(item);
  }

  // When settings tab has been opened, keep it in the tab strip until closed with its '×'
  if (settingsTabOpen) {
    const settingsTabItem = document.createElement('div');
    settingsTabItem.className = 'tab-item' + (settingsActive ? ' active' : '');
    const settingsIcon = document.createElement('img');
    settingsIcon.className = 'tab-icon';
    settingsIcon.alt = '';
    settingsIcon.src = './blackout-mark.svg';
    const settingsSelect = document.createElement('button');
    settingsSelect.className = 'tab-select';
    settingsSelect.type = 'button';
    settingsSelect.textContent = 'Settings';
    settingsSelect.title = 'Blackout Settings';
    settingsSelect.addEventListener('click', (event) => {
      if(tabHeaderDoubleClick('settings',event)){closeSettingsTab();return}
      openSettingsTab();
    });
    const settingsClose = document.createElement('button');
    settingsClose.className = 'tab-close';
    settingsClose.type = 'button';
    settingsClose.textContent = '×';
    settingsClose.setAttribute('aria-label', 'Close Settings');
    settingsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSettingsTab();
    });
    settingsTabItem.append(settingsIcon, settingsSelect, settingsClose);
    strip.append(settingsTabItem);
  }
  if(lastRevealedTabId!==activeId) {
    lastRevealedTabId=activeId;
    requestAnimationFrame(()=>[...strip.children].find(item=>item.dataset.tabId===activeId)?.scrollIntoView({block:'nearest',inline:'nearest'}));
  }
  requestAnimationFrame(updateTabOverflow);
  if(document.querySelector('#tabs-overview')?.open)renderTabsOverview();
}

const protectionBtn = $('#protection-button');
const protectionMenu = $('#protection-menu');
const protectionDot = $('#protection-dot');
const protectionLabel = $('#protection-label');

const modeThemeMap = {
  light: 'aurora',
  balanced: 'eclipse',
  extra: 'ember'
};

function updateProtectionUI(mode) {
  if (protectionLabel) protectionLabel.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  if (protectionDot) {
    protectionDot.className = `dot-${mode}`;
  }
  $$('.protection-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function switchProtectionMode(mode) {
  const mappedTheme = modeThemeMap[mode] || 'eclipse';
  applyAppearance({ theme: mappedTheme });
  updateProtectionUI(mode);
  if (window.blackout?.setProtectionMode) {
    window.blackout.setProtectionMode(mode).catch(() => {});
  }
  try { localStorage.setItem('blackout-protection-mode', mode); } catch {}
}

if (protectionBtn && protectionMenu) {
  protectionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = true;
    $('#menu-button')?.setAttribute('aria-expanded', 'false');
    const extMenu = $('#extensions-menu');
    if (extMenu) extMenu.hidden = true;
    const sitePanel = $('#site-info-panel');
    if (sitePanel) sitePanel.hidden = true;

    if (window.blackout?.toggleProtectionMenu) {
      const rect = protectionBtn.getBoundingClientRect();
      window.blackout.toggleProtectionMenu({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
      return;
    }
    const open = protectionMenu.hidden;
    protectionMenu.hidden = !open;
    protectionBtn.setAttribute('aria-expanded', String(open));
  });

  $$('.protection-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchProtectionMode(mode);
      protectionMenu.hidden = true;
      protectionBtn.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (window.blackout?.closeMenuPopup) {
      window.blackout.closeMenuPopup();
    }
    if (!protectionMenu.hidden && !protectionMenu.contains(e.target) && e.target !== protectionBtn) {
      protectionMenu.hidden = true;
      protectionBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

try {
  const savedMode = localStorage.getItem('blackout-protection-mode') || 'balanced';
  updateProtectionUI(savedMode);
} catch {}

if (!window.blackout) {
  status.textContent = 'Design preview';
  refreshFavorites();
  renderTabs({ tabs: [], activeId: null });
} else {
  window.blackout.onState(state => {
    if (state.type === 'profile') {
      profileMode = state.mode;
      document.documentElement.dataset.profile = profileMode;
      $('#profile-label').textContent = profileMode === 'incognito' ? 'Incognito' : 'Standard';
      $('#profile-description').textContent = profileMode === 'incognito'
        ? 'Temporary site data clears when the last Incognito window closes. Your IP remains visible to sites and networks.'
        : 'Standard keeps site data between app restarts. Protection controls are still in development.';
      $('#settings-profile').textContent = $('#profile-description').textContent;
      refreshFavorites();
    } else if (state.type === 'music-volume') {
      const vol = Number(state.volume) || 0;
      const isZero = (vol === 0);
      const audioEl = $('#universal-audio-player');
      if (audioEl) {
        audioEl.volume = vol;
        audioEl.muted = isZero;
      }
      const slider = $('#music-volume-slider');
      if (slider) slider.value = String(vol);
      const toggle = $('#music-volume-toggle');
      if (toggle) toggle.textContent = isZero ? '🔇' : (vol < 0.5 ? '🔉' : '🔊');
    } else if (state.type === 'tabs') {
      renderTabs(state);
      updateStarIcon();
    } else if (state.type === 'focus-address') {
      setTimeout(() => {
        address.focus();
        address.select();
      }, 30);
    } else if (state.type === 'empty') {
      welcome.hidden = false;
      address.value = '';
      activeUrl = '';
      status.textContent = (profileMode === 'incognito' ? 'Incognito' : 'Ready');
      const secIcon = $('#address-form span[aria-hidden]');
      if (secIcon) {
        secIcon.textContent = '◇';
        secIcon.style.color = 'var(--mint)';
      }
      updateStarIcon();
      refreshFavorites();
      setTimeout(() => {
        address.focus();
        address.select();
      }, 30);
    } else if (state.type === 'tab') {
      activeUrl = state.tab.url || '';
      address.value = activeUrl;
      welcome.hidden = Boolean(activeUrl);
      status.textContent = state.tab.loading ? 'Opening…' : (profileMode === 'incognito' ? 'Incognito' : 'Ready');
      const backBtn = $('[data-action="back"]');
      const fwdBtn = $('[data-action="forward"]');
      if (backBtn) backBtn.disabled = !state.tab.canGoBack;
      if (fwdBtn) fwdBtn.disabled = !state.tab.canGoForward;
      const secIcon = $('#address-form span[aria-hidden]');
      if (secIcon) {
        if (activeUrl.startsWith('https://')) {
          secIcon.textContent = '🔒';
          secIcon.style.color = 'var(--mint)';
        } else if (activeUrl.startsWith('http://')) {
          secIcon.textContent = '⚠️';
          secIcon.style.color = 'var(--hot)';
        } else {
          secIcon.textContent = '◇';
          secIcon.style.color = 'var(--mint)';
        }
      }
      updateStarIcon();
    } else if (state.type === 'toggle-bookmarks-bar') {
      toggleBookmarksBar();
    } else if (state.type === 'open-settings') {
      showSettings(true);
    } else if (state.type === 'open-history') {
      openHistoryTab();
    } else if (state.type === 'open-downloads') {
      openSettingsTab('downloads');
    } else if (state.type === 'open-bookmark-dialog') {
      openFavoriteDialog();
    } else if (state.type === 'open-extensions-dialog') {
      const extDlg = $('#extensions-dialog');
      if (extDlg) {
        if (window.blackout?.modal) window.blackout.modal(true);
        extDlg.showModal();
      }
    } else if (state.type === 'remove-bookmark') {
      if (state.id) {
        window.blackout.favorites('remove', { id: state.id })
          .then(result => renderFavorites(result.items, result.writable))
          .catch(() => {});
      }
    } else if (state.type === 'protection-mode') {
      if (state.mode) {
        updateProtectionUI(state.mode);
        applyAppearance({ theme: modeThemeMap[state.mode] || 'eclipse' });
        try { localStorage.setItem('blackout-protection-mode', state.mode); } catch {}
      }
    } else if (state.type === 'open-extension-item') {
      if (state.id) openExtensionAction(state.id);
    } else if (state.type === 'toggle-pin-extension') {
      if (state.id) {
        const pinned = loadPinnedExtensions();
        const idx = pinned.indexOf(state.id);
        if (idx >= 0) pinned.splice(idx, 1);
        else pinned.push(state.id);
        savePinnedExtensions(pinned);
        refreshAllExtensions();
      }
    } else if (state.type === 'set-pinned-extensions') {
      if (Array.isArray(state.pinnedIds)) {
        savePinnedExtensions(state.pinnedIds);
        refreshAllExtensions();
      }
    } else if (state.type === 'refresh-extensions') {
      refreshAllExtensions();
    } else if (state.type === 'download-start' || state.type === 'download-started') {
      handleDownloadStart(state);
    } else if (state.type === 'download-progress') {
      handleDownloadProgress(state);
    } else if (state.type === 'download-completed') {
      handleDownloadCompleted(state);
    } else if (state.type === 'download-failed') {
      handleDownloadFailed(state);
    } else if (state.type === 'update') {
      showUpdateNotification(state.update);
    } else if (state.type === 'error') {
      status.textContent = state.message;
    }
  });
  refreshFavorites();
}

function notificationStack() {
  let stack=document.getElementById('notification-stack');
  if(!stack){stack=document.createElement('section');stack.id='notification-stack';stack.setAttribute('aria-label','Browser notifications');document.body.append(stack);}
  return stack;
}
let downloadToastTimer;
function showDownloadToast(message, isCompleted = false, filePath = '') {
  let toast = $('#download-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'download-toast';
    toast.className = 'download-toast';
    notificationStack().appendChild(toast);
    toast.setAttribute('role','status');
  }
  clearTimeout(downloadToastTimer);
  toast.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'download-toast-icon';
  icon.textContent = isCompleted ? '✓' : '↓';
  const text = document.createElement('span');
  text.className = 'download-toast-text';
  text.textContent = message;
  toast.append(icon, text);
  if (isCompleted && filePath) {
    const openBtn = document.createElement('button');
    openBtn.className = 'download-toast-action';
    openBtn.type = 'button';
    openBtn.textContent = 'Show in folder';
    openBtn.addEventListener('click', () => {
      window.blackout?.openDownload(filePath);
    });
    toast.appendChild(openBtn);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'download-toast-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label','Dismiss download notification');
  closeBtn.addEventListener('click', () => {
    toast.classList.remove('active');
  });
  toast.appendChild(closeBtn);
  toast.classList.add('active');
  if (isCompleted) {
    downloadToastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 9000);
  }
}

// ── Download Manager & Circular Progress Animation ─────────────────────────────
const downloadItems = new Map();
const recentDownloads = [];
async function restoreDownloads() {
  const items=await window.blackout?.getDownloads?.().catch(()=>[]) || [];
  for (const item of items) downloadItems.set(item.id,item);
  recentDownloads.splice(0,recentDownloads.length,...items.filter(d=>d.state==='completed').reverse().map(d=>({filename:d.filename,filePath:d.savePath,time:new Date(d.completedAt || d.startedAt || Date.now()).toLocaleString()})));
  renderSettingsDownloads();
}
restoreDownloads();
let unreadDownloadsCount = 0;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTimeRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return `${m}m ${remS}s left`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m left`;
}

function updateDownloadUI() {
  const btn = $('#downloads-button');
  const ringFill = $('#download-ring-fill');
  const badge = $('#downloads-badge');
  if (!btn || !ringFill) return;

  const activeDownloads = [...downloadItems.values()].filter(d => d.state === 'progressing');

  if (activeDownloads.length > 0) {
    btn.classList.add('downloading');
    btn.classList.remove('completed');

    let totalReceived = 0;
    let totalBytes = 0;
    let hasKnownTotal = true;

    for (const d of activeDownloads) {
      totalReceived += d.receivedBytes || 0;
      if (d.totalBytes > 0) {
        totalBytes += d.totalBytes;
      } else {
        hasKnownTotal = false;
      }
    }

    // Do NOT set ringFill.style.strokeDashoffset! The circular half ring orbits/spins via CSS!
    ringFill.style.strokeDashoffset = '';

    if (hasKnownTotal && totalBytes > 0) {
      btn.classList.remove('indeterminate');
      const pct = Math.min(100, Math.round((totalReceived / totalBytes) * 100));
      const remaining = Math.max(0, totalBytes - totalReceived);
      btn.title = `Downloading (${pct}% · ${formatBytes(totalReceived)} of ${formatBytes(totalBytes)} · ${formatBytes(remaining)} remaining)`;
    } else {
      btn.classList.add('indeterminate');
      btn.title = `Downloading (${formatBytes(totalReceived)} downloaded)`;
    }
  } else {
    btn.classList.remove('downloading', 'indeterminate');
    ringFill.style.strokeDashoffset = '';
    btn.title = 'Downloads';
  }

  if (badge) {
    if (unreadDownloadsCount > 0) {
      badge.textContent = unreadDownloadsCount > 9 ? '9+' : String(unreadDownloadsCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  renderDownloadsMenu();
  renderSettingsDownloads();
}

function handleDownloadStart(data) {
  const id = data.id || data.filename;
  const now = Date.now();
  const item = {
    id,
    filename: data.filename,
    totalBytes: data.totalBytes || 0,
    receivedBytes: data.receivedBytes || 0,
    state: 'progressing',
    startTime: now,
    lastTime: now,
    lastBytes: data.receivedBytes || 0,
    speed: 0
  };
  downloadItems.set(id, item);
  updateDownloadUI();
  showDownloadToast(`Downloading ${data.filename}…`, false);
}

function handleDownloadProgress(data) {
  const id = data.id || data.filename;
  let item = downloadItems.get(id);
  const now = Date.now();
  if (!item) {
    item = {
      id,
      filename: data.filename,
      totalBytes: data.totalBytes || 0,
      receivedBytes: 0,
      state: 'progressing',
      startTime: now,
      lastTime: now,
      lastBytes: 0,
      speed: 0
    };
    downloadItems.set(id, item);
  }
  const timeDelta = (now - (item.lastTime || now)) / 1000;
  if (timeDelta >= 0.35) {
    const bytesDelta = (data.receivedBytes || 0) - (item.lastBytes || 0);
    if (bytesDelta >= 0) {
      const instantSpeed = bytesDelta / timeDelta;
      item.speed = item.speed > 0 ? (item.speed * 0.65 + instantSpeed * 0.35) : instantSpeed;
    }
    item.lastBytes = data.receivedBytes || 0;
    item.lastTime = now;
  }
  item.receivedBytes = data.receivedBytes || 0;
  if (data.totalBytes) item.totalBytes = data.totalBytes;
  item.state = 'progressing';
  updateDownloadUI();
}

function handleDownloadCompleted(data) {
  const id = data.id || data.filename;
  let item = downloadItems.get(id);
  if (!item) {
    item = { id, filename: data.filename };
    downloadItems.set(id, item);
  }
  item.state = 'completed';
  item.savePath = data.savePath;
  item.receivedBytes = data.totalBytes || item.receivedBytes;
  item.totalBytes = data.totalBytes || item.totalBytes;
  item.completedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  unreadDownloadsCount++;

  const btn = $('#downloads-button');
  const ringFill = $('#download-ring-fill');
  if (btn && ringFill) {
    btn.classList.remove('downloading', 'indeterminate');
    btn.classList.add('completed');
    ringFill.style.strokeDashoffset = '';
    setTimeout(() => {
      btn.classList.remove('completed');
      updateDownloadUI();
    }, 3000);
  }

  updateDownloadUI();
  showDownloadToast(`Downloaded ${data.filename}`, true, data.savePath);
  addRecentDownload(data.filename, data.savePath);
}

function handleDownloadFailed(data) {
  const id = data.id || data.filename;
  let item = downloadItems.get(id);
  if (item) {
    item.state = 'failed';
  }
  updateDownloadUI();
  showDownloadToast(`Download failed: ${data.filename}`, false);
}

function renderDownloadsMenu() {
  const list = $('#downloads-menu-list');
  const emptyState = $('#downloads-empty-state');
  if (!list) return;

  const items = [...downloadItems.values()].reverse();
  if (!items.length) {
    list.replaceChildren();
    if (emptyState) {
      emptyState.hidden = false;
      list.appendChild(emptyState);
    }
    return;
  }

  list.replaceChildren();
  for (const dl of items.slice(0, 15)) {
    const el = document.createElement('div');
    el.className = 'dl-item';

    const row = document.createElement('div');
    row.className = 'dl-item-row';

    const main = document.createElement('div');
    main.className = 'dl-item-main';

    const icon = document.createElement('div');
    icon.className = `dl-file-icon ${dl.state}`;
    icon.textContent = dl.state === 'completed' ? '✓' : (dl.state === 'failed' ? '✕' : '↓');

    const meta = document.createElement('div');
    meta.className = 'dl-file-meta';

    const name = document.createElement('span');
    name.className = 'dl-filename';
    name.textContent = dl.filename;
    name.title = dl.filename;
    if (dl.state === 'completed' && dl.savePath) {
      name.addEventListener('click', () => {
        if (window.blackout?.openFile) {
          window.blackout.openFile(dl.savePath);
        } else {
          window.blackout?.openDownload(dl.savePath);
        }
      });
    }

    const statusText = document.createElement('span');
    statusText.className = 'dl-status-text';

    if (dl.state === 'progressing') {
      const hasSpeed = dl.speed > 0;
      const speedStr = hasSpeed ? `${formatBytes(dl.speed)}/s` : '';
      if (dl.totalBytes > 0) {
        const pct = Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100));
        const remainingBytes = Math.max(0, dl.totalBytes - dl.receivedBytes);
        const secLeft = dl.speed > 0 ? (remainingBytes / dl.speed) : 0;
        const timeLeftStr = formatTimeRemaining(secLeft);
        statusText.textContent = `${pct}% · ${formatBytes(dl.receivedBytes)} of ${formatBytes(dl.totalBytes)}${speedStr ? ' · ' + speedStr : ''}${timeLeftStr ? ' · ' + timeLeftStr : ''}`;
      } else {
        statusText.textContent = `${formatBytes(dl.receivedBytes)} downloaded${speedStr ? ' · ' + speedStr : ''}`;
      }
    } else if (dl.state === 'completed') {
      statusText.textContent = `Completed · ${formatBytes(dl.totalBytes || dl.receivedBytes)}${dl.completedTime ? ' · ' + dl.completedTime : ''}`;
    } else {
      statusText.textContent = 'Cancelled or failed';
    }

    meta.append(name, statusText);
    main.append(icon, meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'dl-actions';

    if (dl.state === 'progressing') {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'dl-action-btn dl-cancel-btn';
      cancelBtn.textContent = '✕ Cancel';
      cancelBtn.title = 'Cancel download';
      cancelBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling…';
        try {
          await window.blackout?.cancelDownload?.(dl.id);
        } catch {}
        dl.state = 'failed';
        updateDownloadUI();
      });
      actions.appendChild(cancelBtn);
      row.appendChild(actions);
    } else if (dl.state === 'completed' && dl.savePath) {
      const showBtn = document.createElement('button');
      showBtn.type = 'button';
      showBtn.className = 'dl-action-btn';
      showBtn.textContent = 'Folder';
      showBtn.title = 'Show in folder';
      showBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.blackout?.openDownload(dl.savePath);
      });
      actions.appendChild(showBtn);
      row.appendChild(actions);
    }

    el.appendChild(row);

    if (dl.state === 'progressing') {
      const barWrap = document.createElement('div');
      barWrap.className = 'dl-progress-bar-wrap';
      const barFill = document.createElement('div');
      barFill.className = 'dl-progress-bar-fill';
      if (dl.totalBytes > 0) {
        const pct = Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100));
        barFill.style.width = `${pct}%`;
      } else {
        barFill.classList.add('indeterminate');
      }
      barWrap.appendChild(barFill);
      el.appendChild(barWrap);
    }

    list.appendChild(el);
  }
}

function initDownloadsDropdown() {
  const dlBtn = $('#downloads-button');
  const dlMenu = $('#downloads-menu');
  const clearBtn = $('#downloads-clear-all');
  const openFolderBtn = $('#menu-open-downloads-folder');
  if (!dlBtn || !dlMenu) return;

  dlBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.blackout?.toggleDownloadsMenu) {
      const rect = dlBtn.getBoundingClientRect();
      unreadDownloadsCount = 0;
      const badge = $('#downloads-badge');
      if (badge) badge.hidden = true;
      window.blackout.toggleDownloadsMenu({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
      return;
    }
    const willOpen = dlMenu.hidden;
    const protectionMenu = $('#protection-menu');
    if (protectionMenu) protectionMenu.hidden = true;
    const extMenu = $('#extensions-menu');
    if (extMenu) extMenu.hidden = true;
    const appMenu = $('#app-menu');
    if (appMenu) appMenu.hidden = true;

    dlMenu.hidden = !willOpen;
    dlBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      unreadDownloadsCount = 0;
      const badge = $('#downloads-badge');
      if (badge) badge.hidden = true;
      renderDownloadsMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dlMenu.hidden && !dlMenu.contains(e.target) && !dlBtn.contains(e.target)) {
      dlMenu.hidden = true;
      dlBtn.setAttribute('aria-expanded', 'false');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadItems.clear();
      updateDownloadUI();
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.blackout?.openDownloadsFolder?.();
      dlMenu.hidden = true;
      dlBtn.setAttribute('aria-expanded', 'false');
    });
  }
}

function addRecentDownload(filename, filePath) {
  recentDownloads.unshift({ filename, filePath, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  renderRecentDownloads();
}

function renderSettingsDownloads() {
  const activeSec = $('#settings-active-downloads-section');
  const activeList = $('#settings-active-downloads-list');
  const activeItems = [...downloadItems.values()].filter(d => d.state === 'progressing');

  if (activeSec && activeList) {
    if (activeItems.length > 0) {
      activeSec.hidden = false;
      activeList.replaceChildren();
      for (const dl of activeItems) {
        const item = document.createElement('div');
        item.className = 'recent-download-item setting-row';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.style.gap = '8px';
        item.style.border = '1px solid rgba(154, 122, 255, 0.25)';

        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.justifyContent = 'space-between';
        topRow.style.alignItems = 'center';

        const info = document.createElement('div');
        info.style.minWidth = '0';
        info.style.flex = '1';

        const name = document.createElement('b');
        name.style.display = 'block';
        name.textContent = dl.filename;

        const status = document.createElement('span');
        status.style.marginTop = '2px';
        status.style.display = 'block';

        const hasSpeed = dl.speed > 0;
        const speedStr = hasSpeed ? `${formatBytes(dl.speed)}/s` : '';
        if (dl.totalBytes > 0) {
          const pct = Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100));
          const remainingBytes = Math.max(0, dl.totalBytes - dl.receivedBytes);
          const secLeft = dl.speed > 0 ? (remainingBytes / dl.speed) : 0;
          const timeLeftStr = formatTimeRemaining(secLeft);
          status.textContent = `${pct}% · ${formatBytes(dl.receivedBytes)} of ${formatBytes(dl.totalBytes)}${speedStr ? ' · ' + speedStr : ''}${timeLeftStr ? ' · ' + timeLeftStr : ''}`;
        } else {
          status.textContent = `${formatBytes(dl.receivedBytes)} downloaded${speedStr ? ' · ' + speedStr : ''}`;
        }

        info.append(name, status);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'dl-action-btn dl-cancel-btn';
        cancelBtn.textContent = '✕ Cancel';
        cancelBtn.addEventListener('click', async () => {
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Cancelling…';
          try { await window.blackout?.cancelDownload?.(dl.id); } catch {}
          dl.state = 'failed';
          updateDownloadUI();
        });

        topRow.append(info, cancelBtn);

        const barWrap = document.createElement('div');
        barWrap.className = 'dl-progress-bar-wrap';
        const barFill = document.createElement('div');
        barFill.className = 'dl-progress-bar-fill';
        if (dl.totalBytes > 0) {
          const pct = Math.min(100, Math.round((dl.receivedBytes / dl.totalBytes) * 100));
          barFill.style.width = `${pct}%`;
        } else {
          barFill.classList.add('indeterminate');
        }
        barWrap.appendChild(barFill);

        item.append(topRow, barWrap);
        activeList.appendChild(item);
      }
    } else {
      activeSec.hidden = true;
      activeList.replaceChildren();
    }
  }

  renderRecentDownloads();
}

function renderRecentDownloads() {
  const container = $('#recent-downloads-list');
  if (!container) return;
  const noHint = $('#no-downloads-hint');
  if (!recentDownloads.length) {
    if (noHint) noHint.hidden = false;
    return;
  }
  if (noHint) noHint.hidden = true;
  container.querySelectorAll('.recent-download-item').forEach(el => el.remove());
  for (const dl of recentDownloads.slice(0, 10)) {
    const item = document.createElement('div');
    item.className = 'recent-download-item setting-row';
    const info = document.createElement('div');
    const filename = document.createElement('b'); filename.textContent = dl.filename;
    const timestamp = document.createElement('span'); timestamp.textContent = dl.time;
    info.append(filename,timestamp);
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.textContent = 'Show in folder';
    actionBtn.addEventListener('click', () => {
      window.blackout?.openDownload(dl.filePath);
    });
    item.append(info, actionBtn);
    container.appendChild(item);
  }
}

const openDlFolderBtn = $('#open-downloads-folder-btn');
if (openDlFolderBtn) {
  openDlFolderBtn.addEventListener('click', () => {
    window.blackout?.openDownloadsFolder();
  });
}
if (window.blackout?.getDownloadsPath) {
  window.blackout.getDownloadsPath().then(p => {
    const pEl = $('#download-location-path');
    if (pEl && p) pEl.textContent = p;
  }).catch(() => {});
}

function showUpdateNotification(update) {
  if(!update?.version)return;
  let bar=document.getElementById('update-notification-banner');
  if(!bar){bar=document.createElement('div');bar.id='update-notification-banner';bar.className='update-notification-banner';notificationStack().prepend(bar);}
  bar.replaceChildren();bar.setAttribute('role','status');
  const content=document.createElement('div');content.className='update-banner-content';
  const copy=document.createElement('div');copy.className='update-copy';
  const title=document.createElement('strong');title.textContent='Blackout '+update.version+' is ready';
  const subtitle=document.createElement('p');subtitle.textContent='Download the latest improvements.';copy.append(title,subtitle);
  if(update.notes){const details=document.createElement('details'),summary=document.createElement('summary'),notes=document.createElement('p');summary.textContent='What’s new';notes.textContent=String(update.notes).slice(0,3000);details.append(summary,notes);copy.append(details);}
  const button=document.createElement('button');button.type='button';button.className='update-download-btn';button.id='banner-update-btn';button.textContent='Download update';
  button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Starting…';try{if(!window.blackout?.applyUpdate)throw Error('Update service unavailable.');await window.blackout.applyUpdate(update);bar.remove();}catch(error){button.disabled=false;button.textContent='Try again';subtitle.textContent=error.message || 'Could not start download.';}});
  const close=document.createElement('button');close.type='button';close.className='update-dismiss-btn';close.setAttribute('aria-label','Dismiss update');close.textContent='×';close.addEventListener('click',()=>bar.remove());
  content.append(copy,button,close);bar.append(content);
}
const proxyModeSelect = $('#proxy-mode');
const proxyFields = $('#proxy-settings-fields');
const wireguardFields = $('#wireguard-fields');
const wireguardInput = $('#wireguard-config-input');
const wireguardInfo = $('#wireguard-parsed-info');
const proxyHostInput = $('#proxy-host');
const proxyPortInput = $('#proxy-port');
const proxyBypassInput = $('#proxy-bypass');
const applyProxyBtn = $('#apply-proxy-button');
const proxyStatus = $('#proxy-status');

function updateProxyUI() {
  if (!proxyModeSelect) return;
  const val = proxyModeSelect.value;
  if (proxyFields) proxyFields.style.display = (val === 'http' || val === 'https' || val === 'socks5') ? 'block' : 'none';
  if (wireguardFields) wireguardFields.style.display = (val === 'wireguard') ? 'block' : 'none';
}

function loadProxyConfig() {
  try {
    return JSON.parse(localStorage.getItem('blackout-proxy-config')) || { mode: 'direct', host: '', port: '', bypass: '', wireguard: '' };
  } catch {
    return { mode: 'direct', host: '', port: '', bypass: '', wireguard: '' };
  }
}

function initProxy() {
  if (!proxyModeSelect) return;
  const cfg = loadProxyConfig();
  proxyModeSelect.value = cfg.mode || 'direct';
  if (proxyHostInput) proxyHostInput.value = cfg.host || '';
  if (proxyPortInput) proxyPortInput.value = cfg.port || '';
  if (proxyBypassInput) proxyBypassInput.value = cfg.bypass || '';
  if (wireguardInput) wireguardInput.value = cfg.wireguard || '';
  updateProxyUI();
  proxyModeSelect.addEventListener('change', updateProxyUI);

  if (wireguardInput) {
    wireguardInput.addEventListener('input', async () => {
      const text = wireguardInput.value.trim();
      if (!text || !window.blackout?.parseWireGuard) {
        if (wireguardInfo) wireguardInfo.textContent = '';
        return;
      }
      try {
        const parsed = await window.blackout.parseWireGuard(text);
        if (wireguardInfo) wireguardInfo.textContent = `Valid WireGuard: Endpoint ${parsed.endpoint || 'Pending'} · AllowedIPs: ${parsed.allowedIPs}`;
      } catch (err) {
        if (wireguardInfo) wireguardInfo.textContent = 'Parsing… ' + err.message;
      }
    });
  }

  if (applyProxyBtn) {
    applyProxyBtn.addEventListener('click', async () => {
      const mode = proxyModeSelect.value;
      const host = proxyHostInput?.value.trim() || '';
      const port = proxyPortInput?.value.trim() || '';
      const bypass = proxyBypassInput?.value.trim() || '<local>';
      const wgConfig = wireguardInput?.value.trim() || '';

      let proxyRules = '';
      let statusMsg = '';

      if (mode === 'tor') {
        proxyRules = 'socks5://127.0.0.1:9050';
        statusMsg = 'Tor circuit routing active (127.0.0.1:9050). .onion routing ready.';
      } else if (mode === 'wireguard') {
        try {
          const parsed = await window.blackout.parseWireGuard(wgConfig);
          proxyRules = `socks5://${parsed.endpoint || '127.0.0.1:51820'}`;
          statusMsg = `WireGuard tunnel configured: Endpoint ${parsed.endpoint || '127.0.0.1'}`;
        } catch (e) {
          if (proxyStatus) proxyStatus.textContent = 'WireGuard error: ' + e.message;
          return;
        }
      } else if (mode === 'http' || mode === 'https' || mode === 'socks5') {
        if (!host || !port) {
          if (proxyStatus) proxyStatus.textContent = 'Please enter both host and port.';
          return;
        }
        proxyRules = `${mode}://${host}:${port}`;
        statusMsg = `Routing active via ${mode.toUpperCase()} ${host}:${port}`;
      } else {
        proxyRules = '';
        statusMsg = 'Direct routing active (No proxy).';
      }

      const saveObj = { mode, host, port, bypass, wireguard: wgConfig };
      try { localStorage.setItem('blackout-proxy-config', JSON.stringify(saveObj)); } catch {}

      if (window.blackout?.setProxy) {
        try {
          await window.blackout.setProxy({ mode, host, port, bypass, proxyRules, proxyBypassRules: bypass });
          if (proxyStatus) proxyStatus.textContent = statusMsg;
        } catch (err) {
          if (proxyStatus) proxyStatus.textContent = 'Failed to apply: ' + (err.message || err);
        }
      } else {
        if (proxyStatus) proxyStatus.textContent = 'Settings saved.';
      }
    });
  }
}
initProxy();
initDownloadsDropdown();

const extBtn = $('#extensions-button');
const extMenu = $('#extensions-menu');
const extMenuList = $('#extensions-menu-list');
const menuManageExt = $('#menu-manage-extensions');
const menuLoadUnpacked = $('#menu-load-unpacked');
const pinnedExtContainer = $('#pinned-extensions');

const menuExtBtn = $('#menu-extensions');
const extDialog = $('#extensions-dialog');
const extClose = $('#extensions-close');
const loadUnpackedBtn = $('#load-unpacked-btn');
const extListContainer = $('#installed-extensions-list');

function loadPinnedExtensions() {
  try {
    return JSON.parse(localStorage.getItem('blackout-pinned-extensions')) || [];
  } catch {
    return [];
  }
}

function savePinnedExtensions(list) {
  try {
    localStorage.setItem('blackout-pinned-extensions', JSON.stringify(list));
  } catch {}
}

function isExtensionPinned(id) {
  return loadPinnedExtensions().includes(id);
}

function renderPinnedExtensions(list) {
  if (!pinnedExtContainer) return;
  pinnedExtContainer.replaceChildren();
  const pinnedIds = loadPinnedExtensions();
  const pinnedItems = list.filter(item => pinnedIds.includes(item.id));
  for (const item of pinnedItems) {
    const btn = document.createElement('button');
    btn.className = 'pinned-ext-btn';
    btn.type = 'button';
    btn.title = item.name;
    if (item.iconDataUrl) {
      const img = document.createElement('img');
      img.src = item.iconDataUrl;
      img.alt = item.name;
      btn.append(img);
    } else {
      const icon = document.createElement('span');
      icon.textContent = '🧩';
      btn.append(icon);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExtensionAction(item.id, btn);
    });
    pinnedExtContainer.append(btn);
  }
}

async function openExtensionAction(id, anchorEl) {
  if (extMenu) extMenu.hidden = true;
  if (extBtn) extBtn.setAttribute('aria-expanded', 'false');
  const rect = anchorEl
    ? anchorEl.getBoundingClientRect()
    : (extBtn ? extBtn.getBoundingClientRect() : { left: window.innerWidth - 300, width: 0 });
  const anchorX = Math.round(rect.left + rect.width / 2);
  if (window.blackout?.extensions?.openPopup) {
    const opened = await window.blackout.extensions.openPopup(id, { x: anchorX });
    if (!opened && window.blackout.extensions.openTab) {
      window.blackout.extensions.openTab(id);
    }
  }
}

function renderExtensionsMenu(list) {
  if (!extMenuList) return;
  extMenuList.replaceChildren();
  if (!list.length) {
    const empty = document.createElement('p');
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '12px';
    empty.style.padding = '12px 8px';
    empty.style.margin = '0';
    empty.textContent = 'No extensions installed yet.';
    extMenuList.append(empty);
    return;
  }

  for (const item of list) {
    const row = document.createElement('div');
    row.className = 'ext-menu-item';

    const mainBtn = document.createElement('button');
    mainBtn.className = 'ext-item-main';
    mainBtn.type = 'button';

    if (item.iconDataUrl) {
      const img = document.createElement('img');
      img.className = 'ext-icon';
      img.src = item.iconDataUrl;
      img.alt = item.name;
      mainBtn.append(img);
    } else {
      const mark = document.createElement('span');
      mark.style.fontSize = '18px';
      mark.textContent = '🧩';
      mainBtn.append(mark);
    }

    const info = document.createElement('div');
    info.className = 'ext-info';
    const b = document.createElement('b');
    b.textContent = item.name;
    const small = document.createElement('small');
    small.textContent = item.popup ? 'Click to open popup' : `v${item.version}`;
    info.append(b, small);
    mainBtn.append(info);

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExtensionAction(item.id, row);
    });

    const pinBtn = document.createElement('button');
    pinBtn.className = 'ext-pin-btn' + (isExtensionPinned(item.id) ? ' pinned' : '');
    pinBtn.type = 'button';
    pinBtn.title = isExtensionPinned(item.id) ? 'Unpin from navbar' : 'Pin to navbar';
    pinBtn.textContent = isExtensionPinned(item.id) ? '📌' : '📍';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let pinned = loadPinnedExtensions();
      if (pinned.includes(item.id)) pinned = pinned.filter(x => x !== item.id);
      else pinned.push(item.id);
      savePinnedExtensions(pinned);
      renderPinnedExtensions(list);
      renderExtensionsMenu(list);
    });

    row.append(mainBtn, pinBtn);
    extMenuList.append(row);
  }
}

async function refreshAllExtensions() {
  if (!window.blackout?.extensions?.list) return [];
  try {
    const list = await window.blackout.extensions.list();
    renderPinnedExtensions(list);
    renderExtensionsMenu(list);
    return list;
  } catch {
    return [];
  }
}
refreshAllExtensions();

if (extBtn && extMenu) {
  extBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (protectionMenu) protectionMenu.hidden = true;
    toggleMenu(false);
    if (window.blackout?.toggleExtensionsMenu) {
      const rect = extBtn.getBoundingClientRect();
      const pinned = loadPinnedExtensions();
      window.blackout.toggleExtensionsMenu({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      }, pinned);
      return;
    }
    const open = extMenu.hidden;
    extMenu.hidden = !open;
    extBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      await refreshAllExtensions();
    }
  });

  document.addEventListener('click', (e) => {
    if (window.blackout?.closeMenuPopup) {
      window.blackout.closeMenuPopup();
    }
    if (!extMenu.hidden && !extMenu.contains(e.target) && e.target !== extBtn) {
      extMenu.hidden = true;
      extBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

if (menuManageExt) {
  menuManageExt.addEventListener('click', (e) => {
    e.stopPropagation();
    if (extMenu) extMenu.hidden = true;
    openExtensionsDialog();
  });
}

if (menuLoadUnpacked) {
  menuLoadUnpacked.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (window.blackout?.extensions?.loadUnpacked) {
      try {
        const loaded = await window.blackout.extensions.loadUnpacked();
        if (loaded) {
          await refreshAllExtensions();
          refreshExtensionsList();
        }
      } catch (err) {
        alert('Could not load extension: ' + (err.message || err));
      }
    }
  });
}

async function refreshExtensionsList() {
  if (!extListContainer || !window.blackout?.extensions?.list) return;
  extListContainer.replaceChildren();
  try {
    const list = await window.blackout.extensions.list();
    if (!list.length) {
      const p = document.createElement('p');
      p.style.color = 'var(--muted)';
      p.style.fontSize = '12px';
      p.textContent = 'No custom Chrome extensions loaded yet.';
      extListContainer.append(p);
      return;
    }
    for (const item of list) {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.padding = '10px 14px';
      card.style.background = '#12131d';
      card.style.border = '1px solid #30313f';
      card.style.borderRadius = '8px';

      const meta = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = item.name;
      b.style.display = 'block';
      b.style.fontSize = '12px';
      b.style.color = '#fff';

      const ver = document.createElement('small');
      ver.textContent = `v${item.version} · ${item.id.slice(0, 8)}…`;
      ver.style.color = 'var(--muted)';
      ver.style.fontSize = '11px';
      meta.append(b, ver);

      const rm = document.createElement('button');
      rm.textContent = 'Remove';
      rm.style.background = '#ff4d4d22';
      rm.style.color = '#ff684d';
      rm.style.border = '1px solid #ff4d4d44';
      rm.style.borderRadius = '5px';
      rm.style.padding = '4px 10px';
      rm.style.fontSize = '11px';
      rm.style.cursor = 'pointer';
      rm.addEventListener('click', async () => {
        await window.blackout.extensions.remove(item.id);
        refreshExtensionsList();
        refreshAllExtensions();
      });

      card.append(meta, rm);
      extListContainer.append(card);
    }
  } catch (err) {
    console.error('Failed to list extensions:', err);
  }
}

function openExtensionsDialog() {
  if (extDialog) {
    if (window.blackout?.modal) window.blackout.modal(true);
    refreshExtensionsList();
    extDialog.showModal();
    toggleMenu(false);
  }
}

function closeExtensionsDialog() {
  if (extDialog && extDialog.open) extDialog.close();
  if (window.blackout?.modal) window.blackout.modal(false);
}

if (menuExtBtn) menuExtBtn.addEventListener('click', openExtensionsDialog);
if (extClose) extClose.addEventListener('click', closeExtensionsDialog);

if (extDialog) {
  extDialog.addEventListener('click', (e) => {
    const rect = extDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) closeExtensionsDialog();
  });
  extDialog.addEventListener('cancel', () => {
    if (window.blackout?.modal) window.blackout.modal(false);
  });
  extDialog.addEventListener('close', () => {
    if (window.blackout?.modal) window.blackout.modal(false);
  });
}

if (loadUnpackedBtn) {
  loadUnpackedBtn.addEventListener('click', async () => {
    if (window.blackout?.extensions?.loadUnpacked) {
      try {
        const loaded = await window.blackout.extensions.loadUnpacked();
        if (loaded) {
          refreshExtensionsList();
          refreshAllExtensions();
        }
      } catch (err) {
        alert('Could not load extension: ' + (err.message || err));
      }
    }
  });
}

document.addEventListener('keydown', e => {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && !e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    openHistoryTab();
    return;
  }
  if (isMod && !e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    if (settingsActive) {
      settingsActive = false;
      settingsPanel.hidden = true;
      welcome.inert = false;
      if (window.blackout) window.blackout.settings(false);
    }
    address.value = '';
    activeUrl = '';
    welcome.hidden = false;
    window.blackout?.control('new-tab');
    setTimeout(() => {
      address.focus();
      address.select();
    }, 20);
    return;
  }
  if (isMod && !e.shiftKey && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (settingsActive) {
      closeSettingsTab();
      return;
    }
    const currentActiveId = window.lastTabState?.activeId;
    if (currentActiveId && currentActiveId !== 'new-tab') {
      window.blackout?.tab('close', currentActiveId);
    } else {
      address.value = '';
      activeUrl = '';
      welcome.hidden = false;
      window.blackout?.control('new-tab');
      setTimeout(() => {
        address.focus();
        address.select();
      }, 20);
    }
    return;
  }
  if (e.key === 'Escape') {
        if (!siteInfoPanel.hidden) hideSiteInfo();
        else if (!extMenu?.hidden) extMenu.hidden = true;
    else if (extDialog?.open) closeExtensionsDialog();
    else if (favDlg?.open) closeFavoriteDialog();
    else if (!settingsPanel.hidden) showSettings(false);
    else if (!protectionMenu?.hidden) protectionMenu.hidden = true;
    else toggleMenu(false);
  }
});

function initElectronOrbits(){
  const electrons=$$('[data-electron]');
  if(!electrons.length)return;
  const cx=165,cy=110,rx=165,ry=55;
  let running=false;
  function tick(now){
    if(document.documentElement.dataset.motion==='reduced'){running=false;return;}
    running=true;
    for(const el of electrons){
      const period=parseFloat(el.dataset.period)||5;
      const startPhase=parseFloat(el.dataset.phase)||0;
      const angleDeg=parseFloat(el.dataset.angle)||0;
      const angleRad=(angleDeg*Math.PI)/180;
      const phase=(now*2*Math.PI)/(period*1000)+startPhase;
      const cosP=Math.cos(phase);
      const sinP=Math.sin(phase);
      const ex=rx*cosP,ey=ry*sinP;
      const rotX=ex*Math.cos(angleRad)-ey*Math.sin(angleRad);
      const rotY=ex*Math.sin(angleRad)+ey*Math.cos(angleRad);
      const px=cx+rotX-6,py=cy+rotY-6;
      const isBack=sinP<0;
      el.style.transform=`translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${isBack?0.8:1.15})`;
      el.style.zIndex=isBack?1:3;
      el.style.opacity=isBack?0.65:1;
    }
    requestAnimationFrame(tick);
  }
  if(document.documentElement.dataset.motion!=='reduced'){running=true;requestAnimationFrame(tick);}
  new MutationObserver(()=>{
    if(document.documentElement.dataset.motion!=='reduced'&&!running){running=true;requestAnimationFrame(tick);}
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
}
initElectronOrbits();

/* ==========================================================================
   UNIVERSAL MUSIC PLAYER ENGINE
   ========================================================================== */
function initUniversalMusicPlayer() {
  const musicBtn = $('#music-button');
  const musicPanel = $('#music-player-panel');
  const closeBtn = $('#music-panel-close');
  const audio = $('#universal-audio-player');
  const playBtn = $('#music-play');
  const playIcon = $('#music-play-icon');
  const stopBtn = $('#music-stop');
  const prevBtn = $('#music-prev');
  const nextBtn = $('#music-next');
  const timelineTrack = $('#music-timeline-track');
  const timelineFill = $('#music-timeline-fill');
  const timelineThumb = $('#music-timeline-thumb');
  const timeElapsed = $('#music-time-elapsed');
  const timeDuration = $('#music-time-duration');
  const trackName = $('#music-track-name');
  const trackArtist = $('#music-track-artist');
  const typeBadge = $('#music-type-badge');
  const musicCard = $('.music-card');
  const statusPill = $('#music-status-pill');
  const searchInput = $('#music-search-input');
  const searchBtn = $('#music-search-btn');
  const searchResults = $('#music-search-results');
  const volumeSlider = $('#music-volume-slider');
  const volumeToggle = $('#music-volume-toggle');

  if (!musicBtn || !musicPanel || !audio) return;

  const MOODS = {
    focus: {
      name: 'Focus Flow',
      accent: '#77e4c4',
      gradient: 'linear-gradient(90deg, #77e4c4 0%, #2dd4bf 50%, #38bdf8 100%)',
      glow: 'rgba(119, 228, 196, 0.45)',
      tag: 'Focus Wavelength',
      defaultTrack: { title: 'SomaFM Groove Salad', artist: 'Focus Ambient Broadcaster', url: 'https://ice1.somafm.com/groovesalad-128-mp3', live: true, type: 'LIVE STREAM' },
      tracks: [
        { title: 'SomaFM Groove Salad', artist: 'SomaFM Broadcaster', url: 'https://ice1.somafm.com/groovesalad-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Drone Zone', artist: 'Atmospheric Ambient Space', url: 'https://ice1.somafm.com/dronezone-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Deep Space Resonance', artist: 'Cosmic Soundscapes', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    lofi: {
      name: 'Lofi Chill',
      accent: '#9a7aff',
      gradient: 'linear-gradient(90deg, #9a7aff 0%, #c084fc 50%, #f472b6 100%)',
      glow: 'rgba(154, 122, 255, 0.45)',
      tag: 'Lofi Wavelength',
      defaultTrack: { title: 'SomaFM DEF CON Radio', artist: 'Music for Hacking & Chill', url: 'https://ice1.somafm.com/defcon-128-mp3', live: true, type: 'LIVE STREAM' },
      tracks: [
        { title: 'SomaFM DEF CON Radio', artist: 'Music for Hacking & Chill', url: 'https://ice1.somafm.com/defcon-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Chillout Lounge Radio', artist: '24/7 Lofi Coffee Study', url: 'https://streams.ilovemusic.de/iloveradio17.mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Midnight Coffee Beats', artist: 'Komorebi Study Session', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    cyberpunk: {
      name: 'Cyberpunk Energy',
      accent: '#ff684d',
      gradient: 'linear-gradient(90deg, #ff684d 0%, #f43f5e 50%, #ec4899 100%)',
      glow: 'rgba(255, 104, 77, 0.45)',
      tag: 'Cyberpunk Wavelength',
      defaultTrack: { title: 'SomaFM Beat Blender', artist: 'Electro Synthwave Pulse', url: 'https://ice1.somafm.com/beatblender-128-mp3', live: true, type: 'LIVE STREAM' },
      tracks: [
        { title: 'SomaFM Beat Blender', artist: 'Electro Synthwave Pulse', url: 'https://ice1.somafm.com/beatblender-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Secret Agent', artist: 'Spy Synth & Electro', url: 'https://ice1.somafm.com/secretagent-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Neon Metropolis 2099', artist: 'Overdrive Synthetics', url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3527e30ec.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    ambient: {
      name: 'Deep Ambient',
      accent: '#38bdf8',
      gradient: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)',
      glow: 'rgba(56, 189, 248, 0.45)',
      tag: 'Ambient Wavelength',
      defaultTrack: { title: 'SomaFM Deep Space One', artist: 'Deep Ambient Electronic Space', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', live: true, type: 'LIVE STREAM' },
      tracks: [
        { title: 'SomaFM Deep Space One', artist: 'Deep Ambient Electronic Space', url: 'https://ice1.somafm.com/deepspaceone-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Mission Control', artist: 'NASA Audio Mixed Ambient', url: 'https://ice1.somafm.com/missioncontrol-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Celestial Horizons', artist: 'Astral Echo Observatory', url: 'https://cdn.pixabay.com/download/audio/2021/11/01/audio_001d9f0494.mp3', live: false, type: 'FREE TRACK' }
      ]
    },
    acoustic: {
      name: 'Acoustic Warmth',
      accent: '#fbbf24',
      gradient: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)',
      glow: 'rgba(251, 191, 36, 0.45)',
      tag: 'Acoustic Wavelength',
      defaultTrack: { title: 'SomaFM Folk Forward', artist: 'Indie Folk & Acoustic', url: 'https://ice1.somafm.com/folkfwd-128-mp3', live: true, type: 'LIVE STREAM' },
      tracks: [
        { title: 'SomaFM Folk Forward', artist: 'Indie Folk & Acoustic', url: 'https://ice1.somafm.com/folkfwd-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'SomaFM Left Coast 70s', artist: 'Mellow Acoustic Rock', url: 'https://ice1.somafm.com/seventies-128-mp3', live: true, type: 'LIVE STREAM' },
        { title: 'Woodland Morning Walk', artist: 'Timber Fingerstyle Strings', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3', live: false, type: 'FREE TRACK' }
      ]
    }
  };

  let playlist = [...MOODS.focus.tracks];
  let currentIndex = 0;
  let isPlaying = false;
  let liveListeningSeconds = 0;
  let liveTimer = null;
  let isSeeking = false;
  let seekLockUntil = 0;

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const BROWSER_THEMES = {
    eclipse: { accent: '#9a7aff', glow: 'rgba(154, 122, 255, 0.45)', gradient: 'linear-gradient(90deg, #9a7aff, #c084fc, #f472b6)' },
    ember: { accent: '#ff684d', glow: 'rgba(255, 104, 77, 0.45)', gradient: 'linear-gradient(90deg, #ff684d, #f43f5e, #ec4899)' },
    aurora: { accent: '#77e4c4', glow: 'rgba(119, 228, 196, 0.45)', gradient: 'linear-gradient(90deg, #77e4c4, #2dd4bf, #38bdf8)' }
  };
  function applyBrowserMusicTheme(themeName) {
    const theme = BROWSER_THEMES[themeName] || BROWSER_THEMES.eclipse;
    musicPanel.style.setProperty('--mood-accent', theme.accent);
    musicPanel.style.setProperty('--mood-gradient', theme.gradient);
    musicPanel.style.setProperty('--mood-glow', theme.glow);
    musicPanel.style.setProperty('--mood-border', theme.accent);
    if (volumeSlider) volumeSlider.style.accentColor = theme.accent;
  }
  document.addEventListener('blackout-theme-change', event => applyBrowserMusicTheme(event.detail?.theme));

  function setTrackMetadata(track) {
    if (!track) return;
    if (trackName) trackName.textContent = track.title;
    if (trackArtist) trackArtist.textContent = track.artist + (track.album ? ` · ${track.album}` : '');
    if (typeBadge) typeBadge.textContent = track.live ? 'LIVE BROADCAST' : (track.type || 'SONG');
    if (statusPill) {
      statusPill.textContent = track.live ? '● LIVE' : (isPlaying ? 'PLAYING' : 'READY');
      statusPill.classList.toggle('live', Boolean(track.live));
    }
    const discCenter = $('#music-disc-center');
    if (discCenter) {
      if (track.cover) {
        discCenter.style.backgroundImage = `url("${track.cover}")`;
        discCenter.style.backgroundSize = 'cover';
        discCenter.style.backgroundPosition = 'center';
        discCenter.style.width = '30px';
        discCenter.style.height = '30px';
      } else {
        discCenter.style.backgroundImage = 'none';
        discCenter.style.width = '14px';
        discCenter.style.height = '14px';
      }
    }
  }

  let activePlayerType = 'audio';
  let ytCurrentTime = 0;
  let ytDuration = 0;
  let ytInterval = null;

  function updateTimeline() {
    const track = playlist[currentIndex];
    if (!track) return;

    if (track.live) {
      if (timeDuration) timeDuration.textContent = 'LIVE';
      if (timeElapsed) timeElapsed.textContent = formatTime(liveListeningSeconds);
      if (timelineFill && timelineThumb) {
        timelineFill.style.width = '100%';
        timelineThumb.style.left = '100%';
      }
    } else {
      let cur = 0;
      let dur = 0;
      if (activePlayerType === 'youtube') {
        cur = ytCurrentTime;
        dur = ytDuration || track.duration || 0;
      } else {
        cur = audio.currentTime || 0;
        dur = audio.duration || track.duration || 0;
      }

      if (timeElapsed) timeElapsed.textContent = formatTime(cur);
      if (timeDuration) timeDuration.textContent = dur > 0 ? formatTime(dur) : '--:--';
      const pct = dur > 0 ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
      if (timelineFill) timelineFill.style.width = `${pct}%`;
      if (timelineThumb) timelineThumb.style.left = `${pct}%`;
      if (timelineTrack) {
        timelineTrack.setAttribute('aria-valuenow', Math.round(pct));
      }
    }
  }

  function loadAndPlayCurrentTrack() {
    const track = playlist[currentIndex];
    if (!track) return;

    clearInterval(liveTimer);
    clearInterval(ytInterval);
    liveListeningSeconds = 0;
    ytCurrentTime = 0;
    ytDuration = track.duration || 0;

    setTrackMetadata(track);
    updateTimeline();

    if (track.videoId) {
      activePlayerType = 'youtube';
      audio.pause();
      try { audio.removeAttribute('src'); } catch {}

      setPlayingState(true);

      const targetVol = typeof audio.volume === 'number' ? audio.volume : 0.8;
      window.blackout?.musicPlay?.({ videoId: track.videoId, volume: targetVol });

      ytInterval = setInterval(async () => {
        if (!isPlaying || activePlayerType !== 'youtube') return;
        if (isSeeking) return;
        try {
          const status = await window.blackout?.musicStatus?.();
          if (status && status.active) {
            if (Date.now() < seekLockUntil) {
              if (Math.abs((status.currentTime || 0) - ytCurrentTime) <= 2) {
                seekLockUntil = 0;
              } else {
                return;
              }
            }
            ytCurrentTime = Math.floor(status.currentTime || 0);
            if (status.duration > 0) ytDuration = Math.round(status.duration);
            if (status.ended) {
              clearInterval(ytInterval);
              currentIndex = (currentIndex + 1) % playlist.length;
              loadAndPlayCurrentTrack();
            } else {
              updateTimeline();
            }
          }
        } catch {}
      }, 500);
    } else {
      activePlayerType = 'audio';
      window.blackout?.musicStop?.();

      if (audio.src !== track.url) {
        audio.src = track.url;
        audio.load();
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlayingState(true);
        }).catch(err => {
          console.warn('Universal player auto-play error or user pause:', err);
          setPlayingState(false);
        });
      }
    }
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    musicBtn.classList.toggle('playing', playing);
    if (musicCard) musicCard.classList.toggle('playing', playing);
    if (statusPill) {
      const track = playlist[currentIndex];
      statusPill.textContent = track?.live ? '● LIVE' : (playing ? 'PLAYING' : 'PAUSED');
      statusPill.classList.toggle('live', Boolean(track?.live));
    }

    if (playIcon) {
      if (playing) {
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        playBtn.title = 'Pause playback';
      } else {
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        playBtn.title = 'Play playback';
      }
    }

    clearInterval(liveTimer);
    if (playing && playlist[currentIndex]?.live) {
      liveTimer = setInterval(() => {
        liveListeningSeconds++;
        updateTimeline();
      }, 1000);
    }
  }

  // Audio element listeners
  audio.addEventListener('play', () => setPlayingState(true));
  audio.addEventListener('pause', () => setPlayingState(false));
  audio.addEventListener('timeupdate', updateTimeline);
  audio.addEventListener('loadedmetadata', updateTimeline);
  audio.addEventListener('ended', () => {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadAndPlayCurrentTrack();
  });
  audio.addEventListener('error', (e) => {
    console.warn('Audio stream error on', audio.src, e);
    if (statusPill) statusPill.textContent = 'STREAM OFFLINE';
    setPlayingState(false);
  });

  // Controls
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePlayerType === 'youtube') {
      if (isPlaying) {
        window.blackout?.musicPause?.();
        setPlayingState(false);
      } else {
        window.blackout?.musicResume?.();
        setPlayingState(true);
      }
    } else {
      if (!audio.src) {
        loadAndPlayCurrentTrack();
        return;
      }
      if (audio.paused) {
        audio.play().then(() => setPlayingState(true)).catch(() => {});
      } else {
        audio.pause();
        setPlayingState(false);
      }
    }
  });

  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePlayerType === 'youtube') {
      window.blackout?.musicStop?.();
      ytCurrentTime = 0;
    } else {
      audio.pause();
      try { audio.currentTime = 0; } catch {}
    }
    clearInterval(liveTimer);
    clearInterval(ytInterval);
    liveListeningSeconds = 0;
    setPlayingState(false);
    updateTimeline();
  });

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activePlayerType === 'youtube' ? ytCurrentTime > 3 : audio.currentTime > 3) {
      if (activePlayerType === 'youtube') {
        ytCurrentTime = 0;
        window.blackout?.musicSeek?.(0);
      } else {
        audio.currentTime = 0;
      }
      updateTimeline();
    } else {
      currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
      loadAndPlayCurrentTrack();
    }
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % playlist.length;
    loadAndPlayCurrentTrack();
  });

  // Timeline Scrubbing / Seeking
  function getSeekTarget(e) {
    const track = playlist[currentIndex];
    if (!track || track.live || !timelineTrack) return null;
    const rect = timelineTrack.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const seekPct = clickX / rect.width;
    const dur = activePlayerType === 'youtube' ? (ytDuration || track.duration || 0) : (audio.duration || track.duration || 0);
    if (dur <= 0) return null;
    const targetSec = Math.min(dur, Math.max(0, Math.round(seekPct * dur)));
    return { targetSec, dur, seekPct };
  }

  function previewSeek(e) {
    const target = getSeekTarget(e);
    if (!target) return;
    const { targetSec, dur } = target;
    if (timeElapsed) timeElapsed.textContent = formatTime(targetSec);
    const pct = Math.min(100, Math.max(0, (targetSec / dur) * 100));
    if (timelineFill) timelineFill.style.width = `${pct}%`;
    if (timelineThumb) timelineThumb.style.left = `${pct}%`;
  }

  function performSeek(e) {
    const target = getSeekTarget(e);
    if (!target) return;
    const { targetSec } = target;

    if (activePlayerType === 'youtube') {
      ytCurrentTime = targetSec;
      seekLockUntil = Date.now() + 2500;
      updateTimeline();
      setPlayingState(true);
      window.blackout?.musicSeek?.(targetSec);
    } else {
      if (audio.duration) {
        audio.currentTime = targetSec;
        updateTimeline();
        if (audio.paused) {
          audio.play().then(() => setPlayingState(true)).catch(() => {});
        }
      }
    }
  }

  if (timelineTrack) {
    timelineTrack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isSeeking = true;
      try { timelineTrack.setPointerCapture(e.pointerId); } catch {}
      previewSeek(e);
    });

    timelineTrack.addEventListener('pointermove', (e) => {
      if (isSeeking) {
        previewSeek(e);
      }
    });

    timelineTrack.addEventListener('pointerup', (e) => {
      if (isSeeking) {
        isSeeking = false;
        try { timelineTrack.releasePointerCapture(e.pointerId); } catch {}
        performSeek(e);
      }
    });

    timelineTrack.addEventListener('pointercancel', (e) => {
      if (isSeeking) {
        isSeeking = false;
        try { timelineTrack.releasePointerCapture(e.pointerId); } catch {}
        updateTimeline();
      }
    });

    timelineTrack.addEventListener('click', (e) => {
      e.stopPropagation();
      performSeek(e);
    });
  }

  // Volume
  if (volumeSlider) {
    try {
      const savedVol = localStorage.getItem('blackout-music-vol');
      if (savedVol !== null) {
        audio.volume = parseFloat(savedVol);
        volumeSlider.value = savedVol;
      } else {
        audio.volume = 0.8;
      }
    } catch { audio.volume = 0.8; }

    const updateVol = (val) => {
      const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
      audio.volume = num;
      audio.muted = (num === 0);
      window.blackout?.musicVolume?.(num);
      try { localStorage.setItem('blackout-music-vol', String(num)); } catch {}
      if (volumeToggle) volumeToggle.textContent = num === 0 ? '🔇' : (num < 0.5 ? '🔉' : '🔊');
    };

    volumeSlider.addEventListener('input', (e) => updateVol(e.target.value));
    volumeSlider.addEventListener('change', (e) => updateVol(e.target.value));
  }

  if (volumeToggle) {
    let prevVolume = 0.8;
    volumeToggle.addEventListener('click', () => {
      if (audio.volume > 0 && !audio.muted) {
        prevVolume = audio.volume;
        updateVol(0);
        if (volumeSlider) volumeSlider.value = '0';
      } else {
        const restoreVol = prevVolume > 0 ? prevVolume : 0.8;
        updateVol(restoreVol);
        if (volumeSlider) volumeSlider.value = String(restoreVol);
      }
    });
  }

  // Render search results dropdown with artwork, title, artist, and duration
  function renderSearchResults(results) {
    if (!searchResults) return;
    searchResults.replaceChildren();
    if (!results || !results.length) {
      searchResults.hidden = true;
      return;
    }

    results.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'music-search-result-item';

      const thumb = document.createElement('div');
      thumb.className = 'music-search-result-thumb';
      if (item.cover) {
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = item.title;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.borderRadius = '6px';
        img.style.objectFit = 'cover';
        thumb.appendChild(img);
      } else {
        thumb.textContent = '🎵';
      }

      const info = document.createElement('div');
      info.className = 'music-search-result-info';

      const title = document.createElement('span');
      title.className = 'music-search-result-title';
      title.textContent = item.title;

      const artist = document.createElement('span');
      artist.className = 'music-search-result-artist';
      artist.textContent = item.artist + (item.album ? ` · ${item.album}` : '');

      info.append(title, artist);

      const meta = document.createElement('div');
      meta.className = 'music-search-result-meta';

      if (item.duration && !item.live) {
        const dur = document.createElement('span');
        dur.className = 'music-search-result-duration';
        dur.textContent = formatTime(item.duration);
        meta.appendChild(dur);
      }

      const badge = document.createElement('span');
      badge.className = 'music-search-result-badge';
      badge.textContent = item.live ? 'LIVE' : (item.type || 'SONG');
      meta.appendChild(badge);

      btn.append(thumb, info, meta);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playlist = [item, ...playlist];
        currentIndex = 0;
        searchResults.hidden = true;
        loadAndPlayCurrentTrack();
      });

      searchResults.appendChild(btn);
    });
    searchResults.hidden = false;
  }

  // Search internet music across master catalogs & streaming networks
  async function performMusicSearch(query, autoPlayFirst = false) {
    if (!query || !query.trim()) return;
    const q = query.trim();

    // Direct stream or audio link
    if (/^https?:\/\//i.test(q)) {
      try {
        const urlObj = new URL(q);
        const filename = urlObj.pathname.split('/').pop() || 'Web Audio Stream';
        const cleanTitle = decodeURIComponent(filename.replace(/\.[a-z0-9]+$/i, '') || 'Live Web Stream');
        const customTrack = {
          title: cleanTitle,
          artist: urlObj.hostname,
          album: 'Web Stream',
          cover: '',
          url: q,
          duration: 0,
          live: !/\.(mp3|m4a|aac|ogg|wav|flac)($|\?)/i.test(q),
          type: 'WEB STREAM'
        };
        playlist = [customTrack, ...playlist];
        currentIndex = 0;
        if (searchResults) searchResults.hidden = true;
        loadAndPlayCurrentTrack();
        return;
      } catch {}
    }

    if (statusPill) statusPill.textContent = 'SEARCHING...';
    if (searchResults) {
      searchResults.hidden = false;
      searchResults.innerHTML = '<div class="music-search-loading"><span>⟳</span> Searching global music networks…</div>';
    }

    let results = [];

    // 1. Primary: Use main-process IPC (full access, zero CORS, Deezer + Audius + iTunes)
    if (window.blackout?.searchMusic) {
      try {
        results = await window.blackout.searchMusic(q);
      } catch (err) {
        console.warn('IPC music search err:', err);
      }
    }

    // 2. Renderer Fallback (Deezer / Audius fetch)
    if (!results || !results.length) {
      try {
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`);
        if (res.ok) {
          const json = await res.json();
          (json.data || []).forEach(t => {
            if (t.preview) {
              results.push({
                id: 'dz_' + t.id,
                title: t.title,
                artist: t.artist?.name || 'Unknown Artist',
                album: t.album?.title || '',
                cover: t.album?.cover_medium || '',
                url: t.preview,
                duration: t.duration || 30,
                live: false,
                source: 'DEEZER',
                type: 'SONG'
              });
            }
          });
        }
      } catch {}
    }

    if (!results || !results.length) {
      // 3. Fallback to catalog matches
      const allTracks = Object.values(MOODS).flatMap(m => m.tracks);
      const qLower = q.toLowerCase();
      allTracks.filter(t => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower)).forEach(t => {
        if (!results.some(r => r.title === t.title)) results.push(t);
      });
    }

    if (results && results.length > 0) {
      renderSearchResults(results);
      if (statusPill) statusPill.textContent = `${results.length} SONGS`;

      // If user hit Enter, immediately play #1 best match
      if (autoPlayFirst) {
        playlist = [results[0], ...playlist];
        currentIndex = 0;
        loadAndPlayCurrentTrack();
      }
    } else {
      if (searchResults) {
        searchResults.hidden = false;
        searchResults.innerHTML = `<div class="music-search-loading" style="color:#ff684d;">No matching songs found for "${q.slice(0, 24)}"</div>`;
      }
      if (statusPill) statusPill.textContent = 'NO RESULTS';
      setTimeout(() => setTrackMetadata(playlist[currentIndex]), 2500);
    }
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      performMusicSearch(searchInput.value, false);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performMusicSearch(searchInput.value, true);
      }
    });
  }

  // Toggle Panel
  function toggleMusicPanel(force) {
    if (window.blackout?.toggleMusicPopup) {
      const rect = musicBtn.getBoundingClientRect();
      window.blackout.toggleMusicPopup({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
      return;
    }
    const willOpen = typeof force === 'boolean' ? force : musicPanel.hidden;
    if (willOpen) {
      const downloadsMenu = $('#downloads-menu');
      if (downloadsMenu) downloadsMenu.hidden = true;
      const extMenu = $('#extensions-menu');
      if (extMenu) extMenu.hidden = true;
      const protectionMenu = $('#protection-menu');
      if (protectionMenu) protectionMenu.hidden = true;
      const appMenu = $('#app-menu');
      if (appMenu) appMenu.hidden = true;
    }
    musicPanel.hidden = !willOpen;
    musicBtn.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen && searchResults) searchResults.hidden = true;
  }

  musicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMusicPanel();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMusicPanel(false);
    });
  }

  document.addEventListener('click', (e) => {
    if (!musicPanel.hidden && !musicPanel.contains(e.target) && !musicBtn.contains(e.target)) {
      toggleMusicPanel(false);
    }
  });

  // Keyboard shortcut Alt+M to toggle Universal Music Player
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMusicPanel();
    }
  });

  // Initial setup
  applyBrowserMusicTheme(document.documentElement.dataset.theme);
  setTrackMetadata(playlist[0]);
  updateTimeline();
}

initUniversalMusicPlayer();

// ── Kinetic Liquid Topographic Contours & Quantum Atoms Engine ──────────────
function initTopographicAnimation() {
  const canvas = document.getElementById('topographic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const welcomeSec = document.getElementById('welcome');

  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = 1; // 1:1 pixel ratio for ambient background canvas eliminates heavy 2x/4x fillrate overhead
    width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
    height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Mood color tracking with smooth RGB interpolation
  const MOOD_COLORS = {
    focus: { r: 119, g: 228, b: 196 },     // #77e4c4 (Mint)
    lofi: { r: 154, g: 122, b: 255 },      // #9a7aff (Purple)
    cyberpunk: { r: 255, g: 104, b: 77 },   // #ff684d (Orange)
    ambient: { r: 56, g: 189, b: 248 },    // #38bdf8 (Cyan)
    acoustic: { r: 251, g: 191, b: 36 }    // #fbbf24 (Amber)
  };

  let targetColor = MOOD_COLORS.focus;
  try {
    const saved = localStorage.getItem('blackout-music-mood');
    if (saved && MOOD_COLORS[saved]) targetColor = MOOD_COLORS[saved];
  } catch {}

  let currentColor = { ...targetColor };

  window.setTopographicMood = function(moodKey) {
    if (MOOD_COLORS[moodKey]) {
      targetColor = MOOD_COLORS[moodKey];
    }
  };

  // High-Performance Full-Homepage Spreading Topography System
  const ringCount = 22; // 22 wide-spaced rings easily cover the full screen
  const nestedCraterCount = 3;

  let lastTime = performance.now();
  let time = 0;
  let lastFrameTime = 0;
  const targetFrameInterval = 28; // ~35 FPS throttle: silky smooth visual drift with near-zero CPU/GPU usage

  function render(now) {
    requestAnimationFrame(render);

    if (welcomeSec && welcomeSec.hidden) return;
    if (now - lastFrameTime < targetFrameInterval) return;
    lastFrameTime = now;

    const dt = Math.min(now - lastTime, 60);
    lastTime = now;
    time += dt;

    // Smooth RGB interpolation towards current mood
    const lerp = 0.05;
    currentColor.r += (targetColor.r - currentColor.r) * lerp;
    currentColor.g += (targetColor.g - currentColor.g) * lerp;
    currentColor.b += (targetColor.b - currentColor.b) * lerp;

    const r = Math.round(currentColor.r);
    const g = Math.round(currentColor.g);
    const b = Math.round(currentColor.b);

    ctx.clearRect(0, 0, width, height);

    const tSec = time * 0.0003;

    // Primary Summit Center (Right-center)
    const centerX = width * 0.62 + Math.sin(tSec * 0.7) * 14;
    const centerY = height * 0.52 + Math.cos(tSec * 0.5) * 10;

    // Center of hero text & URL card reading zone
    const textZoneX = width * 0.32;
    const textZoneY = height * 0.38;
    const invRadiusX2 = 1 / Math.pow(width * 0.36, 2);
    const invRadiusY2 = 1 / Math.pow(height * 0.38, 2);

    // 1. Draw Inner Crater / Core Peak loops
    for (let ci = 1; ci <= nestedCraterCount; ci++) {
      const crx = ci * 22;
      const cry = ci * 17;
      const cPoints = 36;
      const pts = [];

      for (let pi = 0; pi < cPoints; pi++) {
        const theta = (pi / cPoints) * Math.PI * 2;
        const wave = Math.sin(theta * 3 + tSec * 1.5 + ci) * 3;
        const x = centerX + (crx + wave) * Math.cos(theta);
        const y = centerY + (cry + wave * 0.8) * Math.sin(theta);
        pts.push({ x, y });
      }

      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.40 + ci * 0.15})`;
      ctx.lineWidth = ci === 1 ? 1.5 : 1.0;

      const plen = pts.length;
      ctx.moveTo((pts[plen - 1].x + pts[0].x) * 0.5, (pts[plen - 1].y + pts[0].y) * 0.5);
      for (let pi = 0; pi < plen; pi++) {
        const np = pts[(pi + 1) % plen];
        ctx.quadraticCurveTo(pts[pi].x, pts[pi].y, (pts[pi].x + np.x) * 0.5, (pts[pi].y + np.y) * 0.5);
      }
      ctx.closePath();
      ctx.stroke();

      // Core summit dot
      if (ci === 1) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Full-Screen Concentric Contours
    const maxDiagonal = Math.hypot(width, height) * 1.25;

    for (let ri = 1; ri <= ringCount; ri++) {
      const isIndex = (ri % 4 === 0);
      const baseR = 75 + ri * 55;

      if (baseR > maxDiagonal) break;

      const numPoints = Math.max(48, Math.min(84, Math.round(baseR * 0.08)));
      const points = [];
      let insideTextCount = 0;

      for (let pi = 0; pi < numPoints; pi++) {
        const theta = (pi / numPoints) * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        const harm1 = Math.sin(theta * 3 + tSec * 1.2 + ri * 0.22) * (baseR * 0.06 + 5);
        const harm2 = Math.cos(theta * 5 - tSec * 0.9 + ri * 0.12) * (baseR * 0.025 + 2);
        const harm3 = Math.sin(theta * 2 - 0.4) * (baseR * 0.075);

        const currentR = baseR + harm1 + harm2 + harm3;
        const x = centerX + currentR * cosT;
        const y = centerY + (currentR * 0.86) * sinT;

        const dx = x - textZoneX;
        const dy = y - textZoneY;
        if (dx * dx * invRadiusX2 + dy * dy * invRadiusY2 < 1.0) {
          insideTextCount++;
        }

        points.push({ x, y });
      }

      // Smooth dimming over hero text zone
      const overlapRatio = insideTextCount / numPoints;
      const dimFactor = Math.max(0.25, 1.0 - overlapRatio * 0.70);

      const baseAlpha = isIndex ? 0.70 : 0.24;
      const finalAlpha = baseAlpha * dimFactor;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha.toFixed(2)})`;
      ctx.lineWidth = isIndex ? 1.5 : 0.85;

      const pLen = points.length;
      const startX = (points[pLen - 1].x + points[0].x) * 0.5;
      const startY = (points[pLen - 1].y + points[0].y) * 0.5;
      ctx.moveTo(startX, startY);

      for (let pi = 0; pi < pLen; pi++) {
        const nextPt = points[(pi + 1) % pLen];
        const midX = (points[pi].x + nextPt.x) * 0.5;
        const midY = (points[pi].y + nextPt.y) * 0.5;
        ctx.quadraticCurveTo(points[pi].x, points[pi].y, midX, midY);
      }
      ctx.closePath();
      ctx.stroke();

      // Clean elevation number on index contours (outside text zone)
      if (isIndex && ri <= 16 && dimFactor > 0.6) {
        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.6 * dimFactor).toFixed(2)})`;
        const labelPt = points[Math.round(pLen * 0.38)];
        const ldx = labelPt.x - textZoneX;
        const ldy = labelPt.y - textZoneY;
        if (ldx * ldx * invRadiusX2 + ldy * ldy * invRadiusY2 > 1.1) {
          const elev = 1450 - ri * 40;
          ctx.fillText(`${elev}`, labelPt.x + 3, labelPt.y - 2);
        }
      }
    }
  }

  requestAnimationFrame(render);
}

initTopographicAnimation();


window.addEventListener('error', (event) => {
  if (window.blackout?.reportCrash) {
    window.blackout.reportCrash({
      title: 'Renderer Script Error',
      message: event.message || 'Script error',
      stack: `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}\n${event.error?.stack || ''}`
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (window.blackout?.reportCrash) {
    window.blackout.reportCrash({
      title: 'Renderer Unhandled Rejection',
      message: event.reason?.message || String(event.reason || 'Unhandled rejection'),
      stack: event.reason?.stack || String(event.reason || '')
    });
  }
});

// Browser-owned device permission controls. No website can dismiss this indicator.
const accessIndicator = document.querySelector('#device-access-indicator');
window.blackout?.onState?.(state => {
 if(state.type !== 'device-access')return;
 const items=state.items || [];
 accessIndicator.hidden=!items.length;
 const types=new Set(items.flatMap(i=>i.types));
 accessIndicator.textContent=[types.has('video')?'Camera':'',types.has('audio')?'Mic':''].filter(Boolean).join(' + ')+' permitted';
 accessIndicator.title=items.map(i=>{try{return new URL(i.origin).hostname}catch{return 'Website'}}).join(', ')+' · Open permissions to stop access';
});
accessIndicator?.addEventListener('click',()=>openSettingsTab('permissions'));
for (const type of ['audio','video']) {
 const select=document.querySelector('#permission-'+type);
 window.blackout?.devicePolicy?.().then(value=>{if(value)select.value=value[type]}).catch(()=>{});
 select?.addEventListener('change',async()=>{
   await window.blackout?.devicePolicy?.({[type]:select.value});
   if(select.value==='block')await window.blackout?.stopDevices?.();
 });
}
document.querySelector('#stop-device-access')?.addEventListener('click',()=>window.blackout?.stopDevices?.());

async function refreshNotificationPermissions(value){
 const result=await window.blackout?.notificationSettings?.(value);if(!result)return;
 document.querySelector('#notification-policy').value=result.policy;
 const list=document.querySelector('#notification-sites');list.replaceChildren();
 if(!result.sites.length){const p=document.createElement('p');p.textContent='No saved site notification choices. A site will ask before sending notifications.';list.append(p);}
 for(const site of result.sites){const row=document.createElement('div');row.className='setting-row';const name=document.createElement('span');name.textContent=site.origin;const select=document.createElement('select');select.setAttribute('aria-label',site.origin+' notifications');for(const[value,label]of [['ask','Ask again'],['allow','Allow'],['block','Block']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=site.value;select.onchange=()=>refreshNotificationPermissions({origin:site.origin,value:select.value});row.append(name,select);list.append(row);}
}
document.querySelector('#notification-policy')?.addEventListener('change',event=>refreshNotificationPermissions({policy:event.target.value}));
document.querySelector('#notification-windows')?.addEventListener('click',()=>window.blackout?.openNotificationSettings?.());
document.querySelector('[data-settings-target="permissions"]')?.addEventListener('click',()=>refreshNotificationPermissions());
refreshNotificationPermissions().catch(()=>{});
document.querySelector('#make-default-browser')?.addEventListener('click',async()=>{const status=document.querySelector('#default-browser-status');try{const result=await window.blackout?.makeDefaultBrowser?.();status.textContent=result?'In Windows Settings, choose Set default for Blackout Browser.':'This option is available in the Windows app.';}catch(error){status.textContent='Could not open Default apps: '+error.message;}});

function updateTabOverflow() {
  const strip=$('#tab-strip'),left=$('#tabs-scroll-left'),right=$('#tabs-scroll-right');
  if(!strip || !left || !right)return;
  const overflow=strip.scrollWidth>strip.clientWidth+2;
  left.hidden=right.hidden=!overflow;
  left.disabled=strip.scrollLeft<2;
  right.disabled=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2;
}
function scrollTabStrip(direction) {
  const strip=$('#tab-strip');
  strip.scrollBy({left:direction*Math.max(180,strip.clientWidth*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
let overviewTargetTab=null;
function openTabsOverview(tabId) {
  overviewTargetTab=tabId || window.lastTabState?.activeId;
  const dialog=$('#tabs-overview');
  renderTabsOverview();
  window.blackout?.modal?.(true);
  if(!dialog.open)dialog.showModal();
  $('#tabs-overview-search').focus();
}
function renderTabsOverview() {
  const state=window.lastTabState || {tabs:[]}, groups=state.groups || [];
  const query=$('#tabs-overview-search').value.toLowerCase().trim();
  const list=$('#tabs-overview-list');list.replaceChildren();
  const tabs=state.tabs.filter(tab=>(tab.title+' '+tab.url).toLowerCase().includes(query));
  for(const tab of tabs) {
    const row=document.createElement('div');row.className='tab-overview-row';
    const open=document.createElement('button');open.className='tab-overview-open';open.type='button';
    const title=document.createElement('b');title.textContent=tab.title || 'New tab';
    const host=document.createElement('small');try{host.textContent=new URL(tab.url).hostname}catch{host.textContent='New tab'};
    open.append(title,host);open.setAttribute('aria-current',String(tab.id===state.activeId));
    open.addEventListener('click',()=>{$('#tabs-overview').close();closeSettingsTab();window.blackout?.tab?.('switch',tab.id)});
    const select=document.createElement('select');select.setAttribute('aria-label','Group for '+(tab.title||'New tab'));
    const none=document.createElement('option');none.value='';none.textContent='No group';select.append(none);
    for(const group of groups){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;select.append(option)}
    select.value=tab.groupId || '';
    select.addEventListener('change',()=>window.blackout?.tabGroup?.('assign',{tabId:tab.id,groupId:select.value||null}));
    const close=document.createElement('button');close.className='tab-overview-close-tab';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close '+(tab.title||'tab'));
    close.addEventListener('click',()=>window.blackout?.tab?.('close',tab.id));
    row.append(open,select,close);list.append(row);
  }
  $('#tabs-overview-status').textContent=tabs.length+' of '+state.tabs.length+' tabs';
  const manager=$('#tab-groups-manager');manager.replaceChildren();
  for(const group of groups) {
    const form=document.createElement('form');form.className='tab-group-edit';
    const name=document.createElement('input');name.value=group.name;name.maxLength=40;name.required=true;name.setAttribute('aria-label','Rename group '+group.name);
    const save=document.createElement('button');save.type='submit';save.textContent='Rename';
    const remove=document.createElement('button');remove.type='button';remove.textContent='Ungroup';remove.setAttribute('aria-label','Ungroup '+group.name);
    remove.addEventListener('click',()=>window.blackout?.tabGroup?.('ungroup',{groupId:group.id}));
    form.addEventListener('submit',event=>{event.preventDefault();window.blackout?.tabGroup?.('rename',{groupId:group.id,name:name.value})});
    form.append(name,save,remove);manager.append(form);
  }
}
$('#tabs-overview-button')?.addEventListener('click',()=>openTabsOverview());
$('#tabs-scroll-left')?.addEventListener('click',()=>scrollTabStrip(-1));
$('#tabs-scroll-right')?.addEventListener('click',()=>scrollTabStrip(1));
$('#tab-strip')?.addEventListener('click',event=>{if(performance.now()-lastTabDragAt<250){event.preventDefault();event.stopImmediatePropagation()}},true);
$('#tab-strip')?.addEventListener('scroll',updateTabOverflow,{passive:true});
$('#tab-strip')?.addEventListener('wheel',event=>{
  const strip=$('#tab-strip');
  if(!event.ctrlKey && !event.deltaX && strip.scrollWidth>strip.clientWidth){event.preventDefault();strip.scrollLeft+=event.deltaY;}
},{passive:false});
new ResizeObserver(updateTabOverflow).observe($('#tab-strip'));
$('#tabs-overview-search')?.addEventListener('input',renderTabsOverview);
$('#tabs-overview-close')?.addEventListener('click',()=>$('#tabs-overview').close());
$('#tabs-overview')?.addEventListener('close',()=>window.blackout?.modal?.(false));
$('#tab-group-create')?.addEventListener('submit',async event=>{
  event.preventDefault();const input=$('#tab-group-name');
  const result=await window.blackout?.tabGroup?.('create',{tabId:overviewTargetTab || window.lastTabState?.activeId,name:input.value});
  if(result)input.value='';else $('#tabs-overview-status').textContent='Could not create group. Select an open tab and a group name.';
});

window.blackout?.runtimeInfo?.().then(info=>{const el=document.querySelector('#runtime-version');if(el&&info)el.textContent='Chromium '+info.chromium+' · Electron '+info.electron+' · '+info.platform;}).catch(()=>{});
