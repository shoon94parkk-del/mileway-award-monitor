const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const CHANGES_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/changes.json';
let snapshot=null,health=null,changesHistory=null,applyingUrl=false,lastSource=null,installPrompt=null;
const snapshotVersion=s=>s?.bootstrap?.report?.publication_id||s?.bootstrap?.report?.source_updated_at||null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(message){const t=$('#toast');if(!t)return;t.textContent=message;t.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.hidden=true,4000);}
function triggerFilters(){($('#sort')||$('#month'))?.dispatchEvent(new Event('change',{bubbles:true}));}
function selectedRegion(){return $('#regions button.selected')?.dataset.region||'';}

function addCloudControls(){
 const top=$('.filter-top');if(!top||$('#cloud-alert-create'))return;const save=$('#save-search'),actions=document.createElement('div');actions.className='cloud-filter-actions';if(save){save.parentNode.insertBefore(actions,save);actions.appendChild(save);}const alert=document.createElement('button');alert.id='cloud-alert-create';alert.className='text-button';alert.type='button';alert.textContent='🔔 좌석 알림';actions.appendChild(alert);
 const nav=$('.sidebar nav');if(nav&&!$('#cloud-alert-nav')){const navAlert=document.createElement('button');navAlert.id='cloud-alert-nav';navAlert.type='button';navAlert.className='nav cloud-alert-nav';navAlert.innerHTML='<span>🔔</span>알림';nav.appendChild(navAlert);}
 const quick=document.createElement('div');quick.className='quick-filters';quick.setAttribute('aria-label','빠른 검색');quick.innerHTML='<button type="button" data-quick="3m">앞으로 3개월</button><button type="button" data-quick="6m">앞으로 6개월</button><button type="button" data-quick="weekend">주말만</button><button type="button" data-quick="flex3">선택일 ±3일</button><button type="button" data-quick="flex7">선택일 ±7일</button>';top.insertAdjacentElement('afterend',quick);
 const filter=$('.filter-card');if(filter){const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-filter-toggle';toggle.setAttribute('aria-expanded','false');toggle.textContent='검색 조건 열기';filter.parentNode.insertBefore(toggle,filter);filter.classList.add('cloud-collapsed');}
}
function addStatusRow(){const banner=$('.source-banner');if(!banner||$('#cloud-status-row'))return;const row=document.createElement('div');row.id='cloud-status-row';row.className='cloud-status-row';row.innerHTML='<span class="cloud-status-chip">수집 <strong id="cloud-health">확인 중</strong></span><span class="cloud-status-chip">마지막 성공 <strong id="cloud-last-success">확인 중</strong></span><span class="cloud-status-chip">원자료 감시 <strong id="cloud-watch-cadence">23시 집중 감시</strong></span>';banner.appendChild(row);}
async function fetchJson(url){const r=await fetch(url+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.json();}
function updateStatusUi(){
 const report=snapshot?.bootstrap?.report||{},finished=report.finished_at?new Date(report.finished_at):null;$('#cloud-last-success').textContent=finished?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(finished):'미확인';
 const healthMismatch=!!(health?.source_updated_at&&report.source_updated_at&&health.source_updated_at!==report.source_updated_at);$('#cloud-health').textContent=healthMismatch?'⚠ 상태 동기화 중':health?.status==='degraded'?`⚠ ${health.last_error_step||'오류'}`:health?.status==='healthy'?'🟢 정상':'상태 수집 전';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),hour=Number(parts.find(p=>p.type==='hour')?.value||0),minute=Number(parts.find(p=>p.type==='minute')?.value||0),primary=hour===22&&minute>=57||hour===23&&minute<=20;$('#cloud-watch-cadence').textContent=primary?'30초 집중 확인':'23시 집중 감시';
}
async function loadStatus(){try{[snapshot,health,changesHistory]=await Promise.all([fetchJson(SNAPSHOT_URL),fetchJson(HEALTH_URL).catch(()=>null),fetchJson(CHANGES_URL).catch(()=>null)]);lastSource=snapshotVersion(snapshot);}catch{}updateStatusUi();renderRecentOpened();}

function quickFilter(kind){
 const today=fmtDate(new Date());if(kind==='3m'||kind==='6m'){const count=kind==='3m'?3:6,d=new Date(today+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+count);let end=d.toISOString().slice(0,10),max=snapshot?.bootstrap?.report?.end_date;if(max&&end>max)end=max;$('#month').value='';$('#start').value=today;$('#end').value=end;}
 if(kind==='weekend')$('#weekend').checked=!$('#weekend').checked;
 if(kind==='flex3'||kind==='flex7'){const days=kind==='flex3'?3:7,anchor=$('#start').value||$('#end').value||today,d=new Date(anchor+'T00:00:00Z'),s=new Date(d),e=new Date(d);s.setUTCDate(s.getUTCDate()-days);e.setUTCDate(e.getUTCDate()+days);$('#month').value='';$('#start').value=s.toISOString().slice(0,10);$('#end').value=e.toISOString().slice(0,10);}
 triggerFilters();
}
function urlState(){const p=new URLSearchParams(),values={region:selectedRegion(),destination:$('#destination')?.value||'',month:$('#month')?.value||'',start:$('#start')?.value||'',end:$('#end')?.value||'',weekend:$('#weekend')?.checked?'true':'',sort:$('#sort')?.value||''};for(const [k,v] of Object.entries(values))if(v&&!(k==='sort'&&v==='date'))p.set(k,v);const mode=$('#display-mode button.selected')?.dataset.mode;if(mode&&mode!=='list')p.set('mode',mode);return p;}
function syncUrl(){if(applyingUrl)return;const q=urlState().toString();history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash);}
async function applyUrl(){const p=new URLSearchParams(location.search);if(![...p.keys()].length)return;applyingUrl=true;const region=p.get('region')||'',regionBtn=$$(`#regions [data-region]`).find(b=>b.dataset.region===region);if(regionBtn)regionBtn.click();await sleep(0);for(const id of ['destination','month','start','end','sort']){const v=p.get(id);if(v&&$('#'+id)){const el=$('#'+id);if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===v))el.value=v;}}$('#weekend').checked=p.get('weekend')==='true';triggerFilters();const mode=p.get('mode');if(mode)$('#display-mode [data-mode="'+CSS.escape(mode)+'"]')?.click();applyingUrl=false;}

function improveCalendar(){const cal=$('#calendar');if(!cal||cal.hidden)return;for(const day of $$('.calendar-day')){const b=day.querySelector('b');if(!b)continue;const text=b.textContent.trim();day.classList.remove('status-available','status-no-seat','status-unqueryable','status-unknown');if(day.classList.contains('has-flights'))day.classList.add('status-available');else if(text==='·'){b.textContent='없음';day.classList.add('status-no-seat');}else if(text.includes('조회 불가'))day.classList.add('status-unqueryable');else if(text.includes('미조회')||text.includes('미확인')){if(text!=='미확인')b.textContent='미확인';day.classList.add('status-unknown');}}const card=cal.querySelector('.calendar-card');if(card&&!card.querySelector('.cloud-calendar-legend'))card.insertAdjacentHTML('beforeend','<div class="cloud-calendar-legend"><span class="available"><i></i>가능</span><span><i></i>좌석 없음</span><span class="unqueryable"><i></i>조회 불가</span><span><i></i>미확인</span></div>');}
const seatIdentity=row=>[row?.destination,row?.date,row?.flight,row?.time,row?.cabin].map(v=>String(v||'')).join('|');
function renderRecentOpened(){
 const explorer=$('#explorer'),filter=$('.filter-card');if(!explorer||!filter)return;let panel=$('#recent-opened');if(!panel){panel=document.createElement('section');panel.id='recent-opened';panel.className='recent-opened';filter.parentNode.insertBefore(panel,filter);}
 const cutoff=Date.now()-7*864e5,today=fmtDate(new Date()),current=new Set((snapshot?.rows||[]).filter(r=>String(r.date||'')>=today).map(seatIdentity));
 const historyEvents=Array.isArray(changesHistory?.events)?changesHistory.events.filter(e=>e.kind==='OPENED'&&Date.parse(e.detected_at)>=cutoff):null,summary=snapshot?.bootstrap?.recent_opened,fallback=(snapshot?.bootstrap?.changes||[]).filter(e=>e.kind==='OPENED'&&Date.parse(e.detected_at)>=cutoff),eligible=(historyEvents||summary?.items||fallback).filter(e=>String(e.date||'')>=today&&current.has(seatIdentity(e))),events=eligible.slice(0,8),total=eligible.length;
 panel.innerHTML=events.length?`<div class="recent-opened-head"><div><span class="eyebrow">NEWLY OPENED</span><h2>최근 7일 새로 열려 지금 예약 가능한 좌석</h2><p class="recent-opened-note">현재 예약 가능한 ${total}건 중 최신 ${events.length}건 표시</p></div><span class="new-badge">${total}건</span></div><div class="recent-opened-list">${events.map(e=>`<button type="button" data-opened-destination="${esc(e.destination)}" data-opened-date="${esc(e.date)}"><strong>${esc(e.city||e.destination)} · ${esc(e.destination)}</strong><span>${esc(e.date)} · ${esc(e.flight)} · ${e.cabin==='FIRST'?'일등석':'프레스티지'}</span></button>`).join('')}</div>`:'';panel.hidden=!events.length;
}
async function checkForNewSnapshot(){try{const fresh=await fetchJson(SNAPSHOT_URL),source=snapshotVersion(fresh);if(lastSource&&source&&source!==lastSource){snapshot=fresh;lastSource=source;notify('새 지역 자료가 반영되어 화면을 갱신합니다.');setTimeout(()=>location.reload(),700);return;}snapshot=fresh;lastSource=source||lastSource;[health,changesHistory]=await Promise.all([fetchJson(HEALTH_URL).catch(()=>health),fetchJson(CHANGES_URL).catch(()=>changesHistory)]);updateStatusUi();renderRecentOpened();}catch{}}
function addInstall(){window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const top=$('.topbar');if(top&&!$('#install-app')){const b=document.createElement('button');b.id='install-app';b.className='outline-label install-button';b.type='button';b.textContent='앱 설치';top.appendChild(b);}});if('serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});}

function bind(){
 document.addEventListener('click',e=>{
  const q=e.target.closest('[data-quick]');if(q){quickFilter(q.dataset.quick);return;}if(e.target.closest('#install-app')&&installPrompt){installPrompt.prompt();installPrompt=null;e.target.remove();return;}
  const opened=e.target.closest('[data-opened-destination]');if(opened){const dest=opened.dataset.openedDestination,date=opened.dataset.openedDate;$('#destination').value=dest;$('#month').value='';$('#start').value=date;$('#end').value=date;triggerFilters();document.querySelector('.results-toolbar')?.scrollIntoView({behavior:'smooth'});return;}
  const toggle=e.target.closest('.mobile-filter-toggle');if(toggle){const card=$('.filter-card'),collapsed=card.classList.toggle('cloud-collapsed');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.textContent=collapsed?'검색 조건 열기':'검색 조건 닫기';return;}
  if(e.target.closest('#regions')||e.target.closest('#display-mode'))setTimeout(syncUrl,0);
 },true);
 document.addEventListener('change',e=>{if(['destination','month','start','end','weekend','sort'].includes(e.target.id))setTimeout(syncUrl,0);});
 const calendar=$('#calendar');
 const observer=new MutationObserver(()=>{observer.disconnect();improveCalendar();observer.observe(calendar,{childList:true,subtree:true});clearTimeout(observer.urlTimer);observer.urlTimer=setTimeout(syncUrl,80);});if(calendar)observer.observe(calendar,{childList:true,subtree:true});
}
async function init(){for(let i=0;i<80;i++){if($('#destination')?.options.length>1&&$('#source-time')?.textContent&&!$('#source-time').textContent.includes('불러오고'))break;await sleep(100);}addCloudControls();addStatusRow();bind();addInstall();await loadStatus();await applyUrl();improveCalendar();setInterval(checkForNewSnapshot,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForNewSnapshot();});}
init();
