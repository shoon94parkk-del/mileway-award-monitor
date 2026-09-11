const API_URL='https://mileway-alert-api.onrender.com';
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const TOKEN_KEY='mileway.alert.manage-token.v1';
const LEGACY_RULES_KEY='mileway.cloud.alert-rules.v2';
const LOCAL_BACKUP_KEY='mileway.alert.direct-rules.v1';
const EXCLUDED_DESTINATIONS=new Set(['GUM','SVO','VVO','LED','UBN','IKT','DXB','TLV']);
const EXCLUDED_REGION_PATTERN=/(러시아|몽골|중앙아시아|중동|아프리카)/;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snapshot=null,health=null,serverRules=[],me={telegram_linked:false},opening=false;

function manageToken(){return localStorage.getItem(TOKEN_KEY)||'';}
function toast(message){const t=$('#toast');if(!t)return;t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,4200);}
async function fetchJson(url,fallback){try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});return r.ok?await r.json():fallback;}catch{return fallback;}}
async function ensureDevice(){
 if(manageToken())return manageToken();
 const r=await fetch(API_URL+'/device',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok||!data.token)throw new Error(data.error||'알림 기기를 준비하지 못했습니다.');localStorage.setItem(TOKEN_KEY,data.token);return data.token;
}
async function api(path,options={}){
 const token=await ensureDevice(),headers={'Content-Type':'application/json',...(options.headers||{}),Authorization:`Bearer ${token}`};
 const r=await fetch(API_URL+path,{...options,headers,cache:'no-store'});let data={};try{data=await r.json();}catch{}
 if(!r.ok)throw new Error(data.error||'알림 서버 요청에 실패했습니다.');return data;
}
function readLocalRules(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(Boolean):[];}catch{return [];}}
function saveLocalBackup(rules){localStorage.setItem(LOCAL_BACKUP_KEY,JSON.stringify((rules||[]).slice(0,50)));}
async function migrateLegacyRules(){
 const legacy=[...readLocalRules(LEGACY_RULES_KEY),...readLocalRules(LOCAL_BACKUP_KEY)];if(!legacy.length)return;
 const unique=new Map(legacy.map(r=>[r.id||JSON.stringify(r),r]));let migrated=0;
 for(const rule of unique.values()){try{await api('/rules',{method:'POST',body:JSON.stringify(rule)});migrated++;}catch{}}
 if(migrated){const r=await api('/rules').catch(()=>({rules:[]}));serverRules=Array.isArray(r?.rules)?r.rules:serverRules;saveLocalBackup(serverRules);localStorage.removeItem(LEGACY_RULES_KEY);toast(`기존 알림 ${migrated}개를 이 기기의 실제 알림으로 옮겼어요.`);}
}
async function capturePairingToken(){
 const raw=location.hash.startsWith('#')?location.hash.slice(1):'';if(!raw)return false;const params=new URLSearchParams(raw),legacyToken=params.get('alert-key'),pairCode=params.get('pair');
 if(legacyToken){localStorage.setItem(TOKEN_KEY,legacyToken);params.delete('alert-key');history.replaceState(null,'',location.pathname+location.search+(params.toString()?'#'+params.toString():''));return true;}
 if(!pairCode)return false;
 try{const r=await fetch(API_URL+'/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:pairCode}),cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok||!data.token)throw new Error(data.error||'기기 연결에 실패했습니다.');localStorage.setItem(TOKEN_KEY,data.token);params.delete('pair');history.replaceState(null,'',location.pathname+location.search+(params.toString()?'#'+params.toString():''));toast('✅ 기존 알림 관리 기기 연결을 가져왔어요.');return true;}catch(error){toast(error.message);return false;}
}
async function loadState(){
 await ensureDevice();const [s,h,m,r]=await Promise.all([snapshot?Promise.resolve(snapshot):fetchJson(SNAPSHOT_URL,null),fetchJson(HEALTH_URL,null),api('/me'),api('/rules')]);snapshot=s;health=h;me=m||{telegram_linked:false};serverRules=Array.isArray(r?.rules)?r.rules:[];saveLocalBackup(serverRules);
}
function selectedRegion(){return $('#regions button.selected')?.dataset.region||'';}
function filterDates(){const month=$('#month')?.value||'';let start=$('#start')?.value||'',end=$('#end')?.value||'';if(month&&!start&&!end){const [y,m]=month.split('-').map(Number);start=`${month}-01`;end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}return {start,end};}
const allowedRoute=r=>!EXCLUDED_DESTINATIONS.has(String(r?.code||''))&&!EXCLUDED_REGION_PATTERN.test(String(r?.region||''));
function routeOptions(){const routes=(snapshot?.bootstrap?.routes||[]).filter(allowedRoute),current=$('#destination')?.value||'';return routes.map(r=>`<option value="${esc(r.code)}" ${r.code===current?'selected':''}>${esc(r.city||r.code)} · ${esc(r.code)}</option>`).join('');}
function ruleSummary(r){const parts=[];if(r.region)parts.push(r.region);if(r.destinations?.length)parts.push(r.destinations.join(', '));if(r.start||r.end)parts.push(`${r.start||'오늘'} ~ ${r.end||'전체'}`);if(r.weekend)parts.push('주말만');parts.push('프레스티지+일등석');return parts.join(' · ');}
function activeRulesMarkup(){if(!serverRules.length)return '<div class="alert-center-empty"><b>활성 알림 없음</b><span>아래에서 조건을 선택하고 알림 등록을 누르세요.</span></div>';return `<div class="alert-center-rules">${serverRules.map(r=>`<div class="alert-center-rule"><div><b>${esc(r.name)}</b><span>${esc(ruleSummary(r))}</span></div><button type="button" data-direct-alert-delete="${esc(r.id)}">삭제</button></div>`).join('')}</div>`;}
function connectionMarkup(){
 const botConfigured=!!health?.alerts?.telegram_configured,linked=!!me?.telegram_linked,bot=me?.bot_username||health?.alerts?.telegram_bot_username||'koreaairseat99_bot';
 return `<section class="alert-center-connect ${linked?'is-connected':''}"><div><i></i><p><b>${linked?'Telegram 연결됨':botConfigured?'Telegram 연결 필요':'Telegram 준비 중'}</b><span>${linked?'@'+esc(bot)+' · 이 기기의 알림만 이 채팅으로 전송됩니다':botConfigured?'한 번만 연결하면 이후에는 자동으로 유지됩니다':'잠시 후 다시 시도해 주세요.'}</span></p></div>${botConfigured&&!linked?'<button id="direct-telegram-connect" type="button">Telegram 연결</button>':''}</section>`;
}
function render(){
 const content=$('#dialog-content');if(!content)return;const {start,end}=filterDates(),weekend=!!$('#weekend')?.checked,linked=!!me?.telegram_linked;
 content.className='alert-center-modern alert-center-direct';
 content.innerHTML=`<span class="eyebrow">SEAT ALERT</span><h2 class="detail-heading">좌석 알림</h2>${connectionMarkup()}<div class="alert-test-row"><button id="direct-alert-test" class="secondary" type="button" ${linked?'':'disabled'}>🔔 실제 알림 테스트</button><span>${linked?'Telegram으로 즉시 테스트 메시지를 보냅니다.':'Telegram을 한 번 연결하면 테스트할 수 있어요.'}</span></div><section class="alert-center-active"><div class="alert-center-title"><div><b>현재 활성 알림</b><span>이 기기에서 등록한 실제 Telegram 조건입니다.</span></div><strong>${serverRules.length}개</strong></div>${activeRulesMarkup()}</section><section class="alert-direct-form"><label>목적지 · 여러 개 선택 가능<select id="direct-alert-destinations" multiple size="7">${routeOptions()}</select></label><div class="alert-date-grid"><label>시작일<input id="direct-alert-start" type="date" value="${esc(start)}"></label><label>종료일<input id="direct-alert-end" type="date" value="${esc(end)}"></label></div><label class="check"><input id="direct-alert-weekend" type="checkbox" ${weekend?'checked':''}>주말 출발만</label><p class="small muted">목적지를 고르지 않으면 현재 선택한 지역 전체를 감시합니다. 좌석은 프레스티지 + 일등석을 함께 감시합니다.</p><button id="direct-alert-register" class="primary" type="button" ${linked?'':'disabled'}>${linked?'알림 등록':'Telegram 연결 후 등록'}</button><span class="alert-direct-help">등록 즉시 이 기기의 알림으로 활성화됩니다. JSON이나 GitHub 설정은 필요 없습니다.</span></section>`;
}
async function openAlertCenter(){
 const d=$('#dialog');if(d&&!d.open){const content=$('#dialog-content');if(content){content.className='alert-center-modern alert-center-direct';content.innerHTML='<span class="eyebrow">SEAT ALERT</span><h2 class="detail-heading">좌석 알림</h2><div class="alert-center-empty"><b>알림 설정 불러오는 중…</b><span>최신 연결 상태를 확인하고 있어요.</span></div>';}d.showModal();}
 if(opening)return;opening=true;try{await loadState();await migrateLegacyRules();render();}catch(error){toast(error.message);}finally{opening=false;}
}
function formRule(){const selected=[...($('#direct-alert-destinations')?.selectedOptions||[])].map(o=>o.value).filter(Boolean),region=selected.length?'':selectedRegion(),start=$('#direct-alert-start')?.value||'',end=$('#direct-alert-end')?.value||'',weekend=!!$('#direct-alert-weekend')?.checked,routes=(snapshot?.bootstrap?.routes||[]).filter(allowedRoute),map=new Map(routes.map(r=>[r.code,r.city||r.code])),label=selected.length===1?(map.get(selected[0])||selected[0]):selected.length?`${selected.length}개 목적지`:(region||'모든 목적지');return {name:`${label} 좌석 알림`,region,destinations:selected,cabins:[],start,end,weekend,flights:[]};}
async function register(){const button=$('#direct-alert-register');if(!button)return;button.disabled=true;button.textContent='등록 중…';try{const result=await api('/rules',{method:'POST',body:JSON.stringify(formRule())});serverRules=result.rules||serverRules;saveLocalBackup(serverRules);render();toast('✅ Telegram 좌석 알림이 바로 등록됐어요.');}catch(error){button.disabled=false;button.textContent='알림 등록';toast(error.message);}}
async function connectTelegram(){const button=$('#direct-telegram-connect');if(button){button.disabled=true;button.textContent='Telegram 여는 중…';}try{const result=await api('/telegram/link',{method:'POST',body:'{}'});if(!result?.url)throw new Error('Telegram 연결 링크를 만들지 못했습니다.');location.href=result.url;}catch(error){if(button){button.disabled=false;button.textContent='Telegram 연결';}toast(error.message);}}
async function testTelegram(){const button=$('#direct-alert-test');if(!button)return;button.disabled=true;button.textContent='전송 중…';try{const result=await api('/telegram-test',{method:'POST',body:'{}'});if(result?.sent){button.textContent='✓ 전송 완료';toast('✅ Telegram으로 테스트 메시지를 즉시 전송했어요.');}setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent='🔔 실제 알림 테스트';}},2500);}catch(error){button.disabled=false;button.textContent='🔔 실제 알림 테스트';toast(error.message);}}
async function removeRule(id){try{const result=await api('/rules/'+encodeURIComponent(id),{method:'DELETE'});serverRules=result.rules||[];saveLocalBackup(serverRules);render();toast('알림을 삭제했어요.');}catch(error){toast(error.message);}}
async function refreshIfOpen(){const d=$('#dialog');if(!d?.open)return;try{await loadState();render();}catch{}}

capturePairingToken();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refreshIfOpen,500);});
document.addEventListener('click',e=>{
 const trigger=e.target.closest('#cloud-alert-create,#cloud-alert-nav,[data-ux-alert]');if(trigger){e.preventDefault();e.stopImmediatePropagation();openAlertCenter();return;}
 if(e.target.closest('#direct-telegram-connect')){e.preventDefault();connectTelegram();return;}
 if(e.target.closest('#direct-alert-test')){e.preventDefault();testTelegram();return;}
 if(e.target.closest('#direct-alert-register')){e.preventDefault();register();return;}
 const del=e.target.closest('[data-direct-alert-delete]');if(del){e.preventDefault();removeRule(del.dataset.directAlertDelete);}
},true);
