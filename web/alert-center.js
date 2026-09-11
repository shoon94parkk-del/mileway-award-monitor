const HEALTH_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/health.json';
const RULES_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/telegram-rules.json';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REGION_CODE={'':'A','유럽':'E','미주':'U','오세아니아':'O','발리':'B','러시아·몽골':'R','중동':'M'};
let health=null,serverRules=[];

async function fetchJson(url,fallback){try{const r=await fetch(url+'?t='+Date.now(),{cache:'no-store'});return r.ok?await r.json():fallback;}catch{return fallback;}}
async function load(){health=await fetchJson(HEALTH_URL,null);const store=await fetchJson(RULES_URL,{rules:[]});serverRules=Array.isArray(store?.rules)?store.rules:[];}
const shortDate=v=>v?String(v).replaceAll('-','').slice(2):'X';
function botUsername(){return health?.alerts?.telegram_bot_username||'koreaairseat99_bot';}
function botLink(payload='mileway'){return `https://t.me/${encodeURIComponent(botUsername())}?start=${encodeURIComponent(payload)}`;}
function selectedRegion(){return $('#regions button.selected')?.dataset.region||'';}
function selectedDestinations(){const select=$('#alert-destinations');if(select)return [...select.selectedOptions].map(o=>o.value).filter(Boolean).slice(0,6);const d=$('#destination')?.value;return d?[d]:[];}
function alertPayload(){
 const dests=selectedDestinations(),region=dests.length?'':selectedRegion(),code=REGION_CODE[region]||'A';
 const d=dests.length?dests.join('_'):'X',start=shortDate($('#alert-start')?.value||$('#start')?.value||''),end=shortDate($('#alert-end')?.value||$('#end')?.value||''),weekend=($('#alert-weekend')?.checked||$('#weekend')?.checked)?'1':'0';
 return `a-${code}-${d}-${start}-${end}-${weekend}`;
}
function ruleSummary(r){const parts=[];if(r.region)parts.push(r.region);if(r.destinations?.length)parts.push(r.destinations.join(', '));if(r.start||r.end)parts.push(`${r.start||'오늘'} ~ ${r.end||'전체'}`);if(r.weekend)parts.push('주말만');parts.push('프레스티지+일등석');return parts.join(' · ');}
function activeRulesMarkup(){
 if(!serverRules.length)return '<div class="alert-center-empty"><b>활성 알림 없음</b><span>아래에서 조건을 고르고 Telegram 알림 등록을 누르세요.</span></div>';
 return `<div class="alert-center-rules">${serverRules.map(r=>`<div class="alert-center-rule"><div><b>${esc(r.name)}</b><span>${esc(ruleSummary(r))}</span></div><a href="${botLink('d-'+r.id)}" target="_blank" rel="noreferrer">삭제</a></div>`).join('')}</div>`;
}
function connectionMarkup(){const a=health?.alerts||{},connected=!!a.telegram_configured;return `<section class="alert-center-connect ${connected?'is-connected':''}"><div><i></i><p><b>${connected?'Telegram 연결됨':'Telegram 연결하기'}</b><span>${connected?'@'+esc(botUsername())+' · Start 한 번이면 끝':'버튼을 누르고 Telegram에서 Start만 누르면 됩니다.'}</span></p></div><a class="${connected?'secondary':'primary'}" href="${botLink('mileway')}" target="_blank" rel="noreferrer">${connected?'Telegram 열기':'연결하기'}</a></section>`;}
function updateRegisterLink(){const a=$('#telegram-alert-register');if(a)a.href=botLink(alertPayload());}
async function enhanceDialog(){
 const content=$('#dialog-content');if(!content||!content.querySelector('#alert-json')||content.dataset.alertCenter==='1')return;
 content.dataset.alertCenter='1';content.classList.add('alert-center-modern');await load();
 content.querySelector('.detail-note')?.classList.add('alert-center-hide');
 content.querySelector('.alert-rule-list')?.classList.add('alert-center-hide');
 content.querySelector('#alert-json')?.closest('label')?.classList.add('alert-center-hide');
 content.querySelector('.alert-help')?.classList.add('alert-center-hide');
 content.querySelector('[data-alert-add]')?.classList.add('alert-center-hide');
 const actionRows=[...content.querySelectorAll('.alert-actions')];if(actionRows.length)actionRows.at(-1)?.classList.add('alert-center-hide');
 const heading=content.querySelector('.detail-heading');if(heading)heading.textContent='좌석 알림';
 const panel=document.createElement('div');panel.className='alert-center-panel';panel.innerHTML=`${connectionMarkup()}<section class="alert-center-active"><div class="alert-center-title"><div><b>현재 활성 알림</b><span>Telegram으로 실제 전송되는 조건입니다.</span></div><strong>${serverRules.length}개</strong></div>${activeRulesMarkup()}</section>`;
 heading?.after(panel);
 const weekend=$('#alert-weekend')?.closest('label');const register=document.createElement('div');register.className='alert-center-register';register.innerHTML='<a id="telegram-alert-register" class="primary" target="_blank" rel="noreferrer">Telegram 알림 등록</a><span>Telegram이 열리면 <b>Start</b>를 누르세요. 등록 결과는 봇이 메시지로 알려드립니다.</span>';
 (weekend?.parentNode||content).insertBefore(register,weekend?.nextSibling||null);updateRegisterLink();
 for(const id of ['alert-destinations','alert-start','alert-end','alert-weekend'])$('#'+id)?.addEventListener('change',updateRegisterLink);
}
const observer=new MutationObserver(()=>queueMicrotask(enhanceDialog));observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#dialog')?.open){delete $('#dialog-content')?.dataset.alertCenter;enhanceDialog();}});
enhanceDialog();
