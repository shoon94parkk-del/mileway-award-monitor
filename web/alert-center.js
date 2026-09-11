const API_URL='https://mileway-alert-api.onrender.com';
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const TOKEN_KEY='mileway.alert.manage-token.v1';
const LEGACY_RULES_KEY='mileway.cloud.alert-rules.v2';
const LOCAL_BACKUP_KEY='mileway.alert.direct-rules.v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snapshot=null,health=null,serverRules=[],opening=false;

function manageToken(){return localStorage.getItem(TOKEN_KEY)||'';}
function toast(message){const t=$('#toast');if(!t)return;t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,4200);}
async function fetchJson(url,fallback){try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});return r.ok?await r.json():fallback;}catch{return fallback;}}
async function api(path,options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})},token=manageToken();if(token)headers.Authorization=`Bearer ${token}`;
 const r=await fetch(API_URL+path,{...options,headers,cache:'no-store'});let data={};try{data=await r.json();}catch{}
 if(!r.ok)throw new Error(r.status===401?'이 기기의 알림 관리 연결이 필요합니다.':data.error||'알림 서버 요청에 실패했습니다.');return data;
}
function readLocalRules(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(Boolean):[];}catch{return [];}}
function saveLocalBackup(rules){localStorage.setItem(LOCAL_BACKUP_KEY,JSON.stringify((rules||[]).slice(0,50)));}
async function migrateLegacyRules(){
 if(!manageToken())return;
 const legacy=[...readLocalRules(LEGACY_RULES_KEY),...readLocalRules(LOCAL_BACKUP_KEY)];if(!legacy.length)return;
 const unique=new Map(legacy.map(r=>[r.id||JSON.stringify(r),r]));let migrated=0;
 for(const rule of unique.values()){try{await api('/rules',{method:'POST',body:JSON.stringify(rule)});migrated++;}catch{}}
 if(migrated){const r=await api('/rules').catch(()=>({rules:[]}));serverRules=Array.isArray(r?.rules)?r.rules:serverRules;saveLocalBackup(serverRules);localStorage.removeItem(LEGACY_RULES_KEY);toast(`기존 알림 ${migrated}개도 실제 Telegram 알림으로 옮겼어요.`);}
}
async function capturePairingToken(){
 const raw=location.hash.startsWith('#')?location.hash.slice(1):'';if(!raw)return false;
 const params=new URLSearchParams(raw),legacyToken=params.get('alert-key'),pairCode=params.get('pair');
 if(legacyToken){localStorage.setItem(TOKEN_KEY,legacyToken);params.delete('alert-key');history.replaceState(null,'',location.pathname+location.search+(params.toString()?'#'+params.toString():''));setTimeout(async()=>{toast('이 기기에서 알림 관리가 연결됐어요.');await migrateLegacyRules();},200);return true;}
 if(!pairCode)return false;
 try{
  const r=await fetch(API_URL+'/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:pairCode}),cache:'no-store'});let data={};try{data=await r.json();}catch{}
  if(!r.ok||!data.token)throw new Error(data.error||'기기 연결에 실패했습니다.');
  localStorage.setItem(TOKEN_KEY,data.token);params.delete('pair');history.replaceState(null,'',location.pathname+location.search+(params.toString()?'#'+params.toString():''));
  toast('✅ 이 휴대폰이 Telegram 알림 관리 기기로 연결됐어요.');await migrateLegacyRules();return true;
 }catch(error){toast(error.message);return false;}
}
async function loadState(){
 const [s,h,r]=await Promise.all([snapshot?Promise.resolve(snapshot):fetchJson(SNAPSHOT_URL,null),fetchJson(HEALTH_URL,null),api('/rules').catch(()=>({rules:[]}))]);
 snapshot=s;health=h;serverRules=Array.isArray(r?.rules)?r.rules:[];saveLocalBackup(serverRules);
}
function selectedRegion(){return $('#regions button.selected')?.dataset.region||'';}
function filterDates(){const month=$('#month')?.value||'';let start=$('#start')?.value||'',end=$('#end')?.value||'';if(month&&!start&&!end){const [y,m]=month.split('-').map(Number);start=`${month}-01`;end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}return {start,end};}
function routeOptions(){const routes=snapshot?.bootstrap?.routes||[],current=$('#destination')?.value||'';return routes.map(r=>`<option value="${esc(r.code)}" ${r.code===current?'selected':''}>${esc(r.city||r.code)} · ${esc(r.code)}</option>`).join('');}
function ruleSummary(r){const parts=[];if(r.region)parts.push(r.region);if(r.destinations?.length)parts.push(r.destinations.join(', '));if(r.start||r.end)parts.push(`${r.start||'오늘'} ~ ${r.end||'전체'}`);if(r.weekend)parts.push('주말만');parts.push('프레스티지+일등석');return parts.join(' · ');}
function activeRulesMarkup(){if(!serverRules.length)return '<div class="alert-center-empty"><b>활성 알림 없음</b><span>아래에서 조건을 선택하고 알림 등록을 누르세요.</span></div>';return `<div class="alert-center-rules">${serverRules.map(r=>`<div class="alert-center-rule"><div><b>${esc(r.name)}</b><span>${esc(ruleSummary(r))}</span></div><button type="button" data-direct-alert-delete="${esc(r.id)}">삭제</button></div>`).join('')}</div>`;}
function connectionMarkup(){
 const connected=!!health?.alerts?.telegram_configured,bot=health?.alerts?.telegram_bot_username||'koreaairseat99_bot',managed=!!manageToken();
 return `<section class="alert-center-connect ${connected&&managed?'is-connected':''}"><div><i></i><p><b>${connected?'Telegram 연결됨':'Telegram 연결 필요'}</b><span>${connected?'@'+esc(bot)+(managed?' · 이 휴대폰에서 즉시 등록 가능':' · 이 휴대폰만 한 번 연결하면 됩니다'):'먼저 Telegram 봇 연결을 완료해 주세요.'}</span></p></div>${connected&&!managed?'<span class="alert-device-needed">기기 연결 필요</span>':''}</section>`;
}
function render(){
 const content=$('#dialog-content');if(!content)return;const {start,end}=filterDates(),weekend=!!$('#weekend')?.checked;
 const canTest=!!(manageToken()&&health?.alerts?.telegram_configured);
 content.className='alert-center-modern alert-center-direct';
 content.innerHTML=`<span class="eyebrow">SEAT ALERT</span><h2 class="detail-heading">좌석 알림</h2>${connectionMarkup()}<div class="alert-test-row"><button id="direct-alert-test" class="secondary" type="button" ${canTest?'':'disabled'}>🔔 실제 알림 테스트</button><span>${canTest?'Telegram으로 실제 테스트 메시지를 보냅니다. 최대 약 5분 정도 걸릴 수 있어요.':'Telegram과 이 기기 연결이 완료되면 테스트할 수 있어요.'}</span></div><section class="alert-center-active"><div class="alert-center-title"><div><b>현재 활성 알림</b><span>실제로 Telegram으로 전송되는 조건입니다.</span></div><strong>${serverRules.length}개</strong></div>${activeRulesMarkup()}</section><section class="alert-direct-form"><label>목적지 · 여러 개 선택 가능<select id="direct-alert-destinations" multiple size="7">${routeOptions()}</select></label><div class="alert-date-grid"><label>시작일<input id="direct-alert-start" type="date" value="${esc(start)}"></label><label>종료일<input id="direct-alert-end" type="date" value="${esc(end)}"></label></div><label class="check"><input id="direct-alert-weekend" type="checkbox" ${weekend?'checked':''}>주말 출발만</label><p class="small muted">목적지를 고르지 않으면 현재 선택한 지역 전체를 감시합니다. 좌석은 프레스티지 + 일등석을 함께 감시합니다.</p><button id="direct-alert-register" class="primary" type="button" ${manageToken()?'':'disabled'}>${manageToken()?'알림 등록':'이 기기 연결 필요'}</button><span class="alert-direct-help">등록 버튼을 누르면 즉시 활성화됩니다. JSON이나 GitHub 설정은 필요 없습니다.</span></section>`;
}
async function openAlertCenter(){if(opening)return;opening=true;try{await loadState();render();const d=$('#dialog');if(d&&!d.open)d.showModal();}finally{opening=false;}}
function formRule(){const selected=[...($('#direct-alert-destinations')?.selectedOptions||[])].map(o=>o.value).filter(Boolean),region=selected.length?'':selectedRegion();const start=$('#direct-alert-start')?.value||'',end=$('#direct-alert-end')?.value||'',weekend=!!$('#direct-alert-weekend')?.checked;const routes=snapshot?.bootstrap?.routes||[],map=new Map(routes.map(r=>[r.code,r.city||r.code]));const label=selected.length===1?(map.get(selected[0])||selected[0]):selected.length?`${selected.length}개 목적지`:(region||'모든 목적지');return {name:`${label} 좌석 알림`,region,destinations:selected,cabins:[],start,end,weekend,flights:[]};}
async function register(){const button=$('#direct-alert-register');if(!button)return;button.disabled=true;button.textContent='등록 중…';try{const result=await api('/rules',{method:'POST',body:JSON.stringify(formRule())});serverRules=result.rules||serverRules;saveLocalBackup(serverRules);render();toast('✅ Telegram 좌석 알림이 바로 등록됐어요.');}catch(error){button.disabled=false;button.textContent='알림 등록';toast(error.message);}}
async function testTelegram(){
 const button=$('#direct-alert-test');if(!button)return;button.disabled=true;button.textContent='테스트 요청 중…';
 try{await api('/telegram-test',{method:'POST',body:'{}'});button.textContent='✓ 테스트 요청 완료';toast('✅ 실제 Telegram 테스트를 요청했어요. 최대 약 5분 내 메시지가 옵니다.');setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent='🔔 실제 알림 테스트';}},2500);}
 catch(error){button.disabled=false;button.textContent='🔔 실제 알림 테스트';toast(error.message);}
}
async function removeRule(id){try{const result=await api('/rules/'+encodeURIComponent(id),{method:'DELETE'});serverRules=result.rules||[];saveLocalBackup(serverRules);render();toast('알림을 삭제했어요.');}catch(error){toast(error.message);}}

capturePairingToken();
document.addEventListener('click',e=>{
 const trigger=e.target.closest('#cloud-alert-create,#cloud-alert-nav,[data-ux-alert]');if(trigger){e.preventDefault();e.stopImmediatePropagation();openAlertCenter();return;}
 if(e.target.closest('#direct-alert-test')){e.preventDefault();testTelegram();return;}
 if(e.target.closest('#direct-alert-register')){e.preventDefault();register();return;}
 const del=e.target.closest('[data-direct-alert-delete]');if(del){e.preventDefault();removeRule(del.dataset.directAlertDelete);}
},true);
