const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const STATUS_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/status.json';
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const ALERT_API_URL='https://mileway-alert-api.onrender.com';
const ALERT_TOKEN_KEY='mileway.alert.manage-token.v1';
const $=s=>document.querySelector(s);

function compactSource(text=''){
 const m=String(text).match(/(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}:\d{2})/);
 return m?`${Number(m[1])}/${Number(m[2])} ${m[3]}`:String(text).replace(/\s*기준.*$/,'').trim()||'확인 중';
}
function sourceStamp(value){
 const m=String(value||'').match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})/);
 if(!m)return NaN;
 return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4])-9,Number(m[5]));
}
function freshestSource(...values){
 let best='',bestStamp=-Infinity;
 for(const value of values){const stamp=sourceStamp(value);if(stamp>bestStamp){best=String(value||'');bestStamp=stamp;}}
 return best||values.find(Boolean)||'';
}
function isoStamp(value){const ms=Date.parse(value||'');return Number.isFinite(ms)?ms:NaN;}
function expectedDailySourceStamp(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=type=>Number(parts.find(p=>p.type===type)?.value||0);
 const y=get('year'),m=get('month'),d=get('day'),h=get('hour');
 const todayAt23=Date.UTC(y,m-1,d,14,0);
 return h<23?todayAt23-864e5:todayAt23;
}
function sourceIsStale(value,now=new Date()){
 const observed=sourceStamp(value);
 return !Number.isFinite(observed)||observed<expectedDailySourceStamp(now);
}
function ensureRail(){
 if($('#ux-status-rail'))return $('#ux-status-rail');
 const top=$('.topbar');if(!top)return null;
 const rail=document.createElement('section');
 rail.id='ux-status-rail';rail.className='ux-status-rail';rail.setAttribute('aria-label','Mileway 상태 요약');
 rail.innerHTML=`
  <div class="ux-rail-item ux-health"><i></i><span>수집</span><b id="ux-health-value">확인 중</b></div>
  <div class="ux-rail-item"><span>원자료</span><b id="ux-source-value">확인 중</b></div>
  <div class="ux-rail-item"><span>현재 결과</span><b id="ux-result-value">—</b></div>
  <button class="ux-rail-item ux-rail-button" type="button" data-ux-alert><span>내 알림</span><b id="ux-alert-value">확인 중</b></button>
  <button class="ux-rail-more" type="button" data-ux-source>수집 범위 ↗</button>`;
 top.after(rail);return rail;
}
function syncVisibleValues(){
 ensureRail();
 const source=$('#source-time')?.textContent||'';$('#ux-source-value')&&( $('#ux-source-value').textContent=compactSource(source) );
 const count=$('#result-count')?.textContent?.trim();if(count&&$('#ux-result-value'))$('#ux-result-value').textContent=count;
}
async function fetchJson(url){try{const r=await fetch(url+'?t='+Date.now(),{cache:'no-store'});return r.ok?await r.json():null;}catch{return null;}}
async function deviceAlertStatus(){
 const token=localStorage.getItem(ALERT_TOKEN_KEY)||'';
 if(!token)return {label:'미연결',ok:false};
 try{
  const r=await fetch(ALERT_API_URL+'/me',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  if(!r.ok)return {label:'확인 필요',ok:false};
  const me=await r.json();
  if(!me.telegram_linked)return {label:'연결 필요',ok:false};
  return {label:`Telegram ON${Number(me.rule_count)>0?` · ${me.rule_count}개`:''}`,ok:true};
 }catch{return {label:'확인 필요',ok:false};}
}
async function syncHealth(){
 try{
  const [status,h,s,device]=await Promise.all([fetchJson(STATUS_URL),fetchJson(HEALTH_URL),fetchJson(SNAPSHOT_URL),deviceAlertStatus()]);
  const report=s?.bootstrap?.report||{};
  const source=freshestSource(report.source_updated_at,status?.observed_source_at,h?.source_updated_at);
  const sourceStatus=sourceIsStale(source)?'delayed':'current';
  const statusMatchesSnapshot=!report.publication_id||!status?.publication_id||status.publication_id===report.publication_id;
  const collector=statusMatchesSnapshot?(status?.collector_status||''):(report.attempt_complete?'succeeded':'partial');
  const successfulSnapshotAfterError=!!report.attempt_complete&&isoStamp(report.finished_at)>isoStamp(h?.last_error_at);
  const healthCollectionFailure=h?.status==='degraded'&&h?.last_error_step!=='notification'&&!successfulSnapshotAfterError;
  const health=$('.ux-health'),value=$('#ux-health-value'),alert=$('#ux-alert-value');
  if(source&&$('#ux-source-value'))$('#ux-source-value').textContent=compactSource(source);
  const operationalFailure=collector==='failed'||healthCollectionFailure;
  const delayed=sourceStatus==='delayed';
  const partial=collector==='partial';
  const ok=!operationalFailure&&!delayed&&!partial&&sourceStatus==='current';
  if(value)value.textContent=operationalFailure?'수집 실패':delayed?'원자료 지연':partial?'부분 반영':ok?'정상':'확인 중';
  health?.classList.toggle('is-ok',ok);
  health?.classList.toggle('is-warn',operationalFailure||delayed||partial);
  if(alert)alert.textContent=device.label;
 }catch{}
}
function bind(){
 if(document.documentElement.dataset.uxReferenceBound)return;
 document.documentElement.dataset.uxReferenceBound='1';
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-ux-source]'))$('#source-detail')?.click();
  if(e.target.closest('[data-ux-alert]'))($('#cloud-alert-nav')||$('#cloud-alert-create'))?.click();
 },true);
 const source=$('#source-time'),count=$('#result-count');
 if(source)new MutationObserver(syncVisibleValues).observe(source,{childList:true,subtree:true});
 if(count)new MutationObserver(syncVisibleValues).observe(count,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){syncVisibleValues();syncHealth();}});
}
ensureRail();bind();syncVisibleValues();syncHealth();
setTimeout(syncVisibleValues,500);setTimeout(syncHealth,1200);setInterval(syncHealth,30000);
