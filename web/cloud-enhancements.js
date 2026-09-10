const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const RULES_KEY='mileway.cloud.alert-rules.v1';
const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
let snapshot=null,applyingUrl=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmtDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function readRules(){try{return JSON.parse(localStorage.getItem(RULES_KEY)||'[]').filter(Boolean);}catch{return[];}}
function writeRules(rules){localStorage.setItem(RULES_KEY,JSON.stringify(rules.slice(0,50)));}
function notify(message){const t=$('#toast');if(!t)return;t.textContent=message;t.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.hidden=true,3500);}
function triggerFilters(){const el=$('#sort')||$('#cabin');el?.dispatchEvent(new Event('change',{bubbles:true}));}
function selectedRegion(){return $('#regions button.selected')?.dataset.region||'';}
function currentCondition(name=''){
 const month=$('#month')?.value||'';let start=$('#start')?.value||'',end=$('#end')?.value||'';
 if(month&&!start&&!end){const [y,m]=month.split('-').map(Number);start=`${month}-01`;end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
 const dest=$('#destination')?.value||'',cabin=$('#cabin')?.value||'',q=$('#query')?.value.trim()||'';
 const label=$('#destination option:checked')?.textContent?.split(' · ')[0]||selectedRegion()||'전체 목적지';
 const cabinLabel=cabin==='FIRST'?'일등석':cabin==='PRESTIGE'?'프레스티지':'비즈니스 이상';
 return {name:name||`${label} ${cabinLabel}`,region:selectedRegion(),destinations:dest?[dest]:[],cabins:cabin?[cabin]:[],start,end,weekend:!!$('#weekend')?.checked,flights:/^KE\d{1,4}$/i.test(q)?[q.toUpperCase()]:[]};
}
function ruleSummary(r){
 const parts=[];if(r.region)parts.push(r.region);if(r.destinations?.length)parts.push(r.destinations.join(','));if(r.cabins?.length)parts.push(r.cabins.map(c=>c==='FIRST'?'일등석':'프레스티지').join(','));if(r.start||r.end)parts.push(`${r.start||'시작'} ~ ${r.end||'종료'}`);if(r.weekend)parts.push('주말');if(r.flights?.length)parts.push(r.flights.join(','));return parts.join(' · ')||'전체 공개 범위';
}
function renderAlertManager(){
 const rules=readRules();
 const list=rules.length?rules.map((r,i)=>`<div class="alert-rule"><div><strong>${esc(r.name)}</strong><span>${esc(ruleSummary(r))}</span></div><button type="button" data-alert-remove="${i}" aria-label="${esc(r.name)} 삭제">×</button></div>`).join(''):'<p class="muted small">아직 저장한 알림 조건이 없습니다.</p>';
 const json=JSON.stringify(rules,null,2);
 $('#dialog-content').innerHTML=`<span class="eyebrow">SEAT ALERT</span><h2 class="detail-heading">원하는 좌석이 생기면 알려드릴게요</h2><p class="muted">현재 검색 조건을 알림 규칙으로 저장한 뒤 GitHub Actions Secret에 한 번 등록하면 됩니다.</p><label>알림 이름<input id="alert-name" maxlength="80" value="${esc(currentCondition().name)}"></label><div class="alert-actions"><button class="secondary" type="button" data-alert-add>현재 조건 추가</button></div><div class="alert-rule-list">${list}</div><label>ALERT_RULES_JSON<textarea id="alert-json" class="alert-json" readonly>${esc(json)}</textarea></label><div class="alert-help"><b>텔레그램 권장</b><br>GitHub Actions Secrets에 <code>ALERT_RULES_JSON</code>, <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_CHAT_ID</code>를 등록하세요.<br><br><b>이메일 선택</b><br>Resend를 쓰려면 <code>RESEND_API_KEY</code>, <code>ALERT_EMAIL_TO</code>, <code>ALERT_EMAIL_FROM</code>을 추가하면 됩니다. 토큰과 메일 주소는 웹사이트 코드에 저장되지 않습니다.</div><div class="alert-actions"><a class="secondary" href="https://github.com/shoon94parkk-del/mileway-award-monitor/settings/secrets/actions" target="_blank" rel="noreferrer">GitHub Secrets 열기 ↗</a><button class="primary" type="button" data-alert-copy>JSON 복사</button></div>`;
}
function openAlertManager(){renderAlertManager();const d=$('#dialog');if(d&&!d.open)d.showModal();}
async function copyAlertJson(){const text=$('#alert-json')?.value||'[]';try{await navigator.clipboard.writeText(text);notify('알림 규칙 JSON을 복사했어요.');}catch{$('#alert-json')?.select();document.execCommand?.('copy');notify('알림 규칙 JSON을 복사했어요.');}}

function addCloudControls(){
 const top=$('.filter-top');if(!top||$('#cloud-alert-create'))return;
 const save=$('#save-search');const actions=document.createElement('div');actions.className='cloud-filter-actions';
 if(save){save.parentNode.insertBefore(actions,save);actions.appendChild(save);}
 const alert=document.createElement('button');alert.id='cloud-alert-create';alert.className='text-button';alert.type='button';alert.textContent='🔔 좌석 알림';actions.appendChild(alert);
 const quick=document.createElement('div');quick.className='quick-filters';quick.setAttribute('aria-label','빠른 검색');quick.innerHTML='<button type="button" data-quick="3m">앞으로 3개월</button><button type="button" data-quick="6m">앞으로 6개월</button><button type="button" data-quick="weekend">주말만</button><button type="button" data-quick="prestige">프레스티지만</button><button type="button" data-quick="first">일등석만</button>';
 top.insertAdjacentElement('afterend',quick);
 const filter=$('.filter-card');if(filter){const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-filter-toggle';toggle.setAttribute('aria-expanded','false');toggle.textContent='검색 조건 열기';filter.parentNode.insertBefore(toggle,filter);filter.classList.add('cloud-collapsed');}
}
function addStatusRow(){
 const banner=$('.source-banner');if(!banner||$('#cloud-status-row'))return;
 const row=document.createElement('div');row.id='cloud-status-row';row.className='cloud-status-row';row.innerHTML='<span class="cloud-status-chip">마지막 성공 <strong id="cloud-last-success">확인 중</strong></span><span class="cloud-status-chip">원자료 감시 <strong id="cloud-watch-cadence">확인 중</strong></span><span class="cloud-status-chip">사이트 반영 <strong>최대 약 5분</strong></span>';banner.appendChild(row);
}
async function loadStatus(){
 try{const r=await fetch(SNAPSHOT_URL+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();snapshot=await r.json();const report=snapshot.bootstrap?.report||{};const finished=report.finished_at?new Date(report.finished_at):null;$('#cloud-last-success').textContent=finished?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(finished):'미확인';}catch{$('#cloud-last-success').textContent='미확인';}
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const hour=Number(parts.find(p=>p.type==='hour')?.value||0),minute=Number(parts.find(p=>p.type==='minute')?.value||0);const peak=hour===22&&minute>=30||hour===23||hour===0&&minute<=30;$('#cloud-watch-cadence').textContent=peak?'약 5분 이내':'약 1시간 이내';
}

function quickFilter(kind){
 const now=new Date(),today=fmtDate(now);if(kind==='3m'||kind==='6m'){const count=kind==='3m'?3:6,d=new Date(today+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+count);let end=d.toISOString().slice(0,10);const max=snapshot?.bootstrap?.report?.end_date;if(max&&end>max)end=max;$('#month').value='';$('#start').value=today;$('#end').value=end;}
 if(kind==='weekend')$('#weekend').checked=!$('#weekend').checked;
 if(kind==='prestige')$('#cabin').value='PRESTIGE';
 if(kind==='first')$('#cabin').value='FIRST';
 triggerFilters();
}
function urlState(){
 const p=new URLSearchParams(),values={region:selectedRegion(),destination:$('#destination')?.value||'',month:$('#month')?.value||'',cabin:$('#cabin')?.value||'',start:$('#start')?.value||'',end:$('#end')?.value||'',q:$('#query')?.value||'',weekend:$('#weekend')?.checked?'true':'',sort:$('#sort')?.value||''};
 for(const [k,v] of Object.entries(values))if(v&&!(k==='sort'&&v==='date'))p.set(k,v);const mode=$('#display-mode button.selected')?.dataset.mode;if(mode&&mode!=='list')p.set('mode',mode);return p;
}
function syncUrl(){if(applyingUrl)return;const q=urlState().toString();history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash);}
async function applyUrl(){
 const p=new URLSearchParams(location.search);if(![...p.keys()].length)return;applyingUrl=true;
 const region=p.get('region')||'';const regionBtn=$$(`#regions [data-region]`).find(b=>b.dataset.region===region);if(regionBtn)regionBtn.click();await sleep(0);
 for(const id of ['destination','month','cabin','start','end','sort']){const v=p.get(id);if(v&&$('#'+id)){const el=$('#'+id);if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===v))el.value=v;}}
 if(p.get('q')!==null)$('#query').value=p.get('q');$('#weekend').checked=p.get('weekend')==='true';triggerFilters();const mode=p.get('mode');if(mode)$('#display-mode [data-mode="'+CSS.escape(mode)+'"]')?.click();applyingUrl=false;
}

function improveCalendar(){
 const cal=$('#calendar');if(!cal||cal.hidden)return;for(const day of $$('.calendar-day')){const b=day.querySelector('b');if(!b)continue;const text=b.textContent.trim();day.classList.remove('status-available','status-no-seat','status-unqueryable','status-unknown');if(day.classList.contains('has-flights'))day.classList.add('status-available');else if(text==='·'){b.textContent='없음';day.classList.add('status-no-seat');}else if(text.includes('조회 불가'))day.classList.add('status-unqueryable');else if(text.includes('미조회')||text.includes('미확인')){b.textContent='미확인';day.classList.add('status-unknown');}}
 const card=cal.querySelector('.calendar-card');if(card&&!card.querySelector('.cloud-calendar-legend'))card.insertAdjacentHTML('beforeend','<div class="cloud-calendar-legend"><span class="available"><i></i>가능</span><span><i></i>좌석 없음</span><span class="unqueryable"><i></i>조회 불가</span><span><i></i>미확인</span></div>');
}

function bind(){
 document.addEventListener('click',e=>{const q=e.target.closest('[data-quick]');if(q){quickFilter(q.dataset.quick);return;}if(e.target.closest('#cloud-alert-create')){openAlertManager();return;}const toggle=e.target.closest('.mobile-filter-toggle');if(toggle){const card=$('.filter-card');const collapsed=card.classList.toggle('cloud-collapsed');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.textContent=collapsed?'검색 조건 열기':'검색 조건 닫기';return;}const remove=e.target.closest('[data-alert-remove]');if(remove){const rules=readRules();rules.splice(Number(remove.dataset.alertRemove),1);writeRules(rules);renderAlertManager();return;}if(e.target.closest('[data-alert-add]')){const name=$('#alert-name')?.value.trim();const rules=readRules();rules.push(currentCondition(name));writeRules(rules);renderAlertManager();notify('현재 조건을 알림 규칙에 추가했어요.');return;}if(e.target.closest('[data-alert-copy]')){copyAlertJson();return;}if(e.target.closest('#regions')||e.target.closest('#display-mode'))setTimeout(syncUrl,0);},true);
 document.addEventListener('change',e=>{if(['destination','month','cabin','start','end','weekend','sort'].includes(e.target.id))setTimeout(syncUrl,0);});
 $('#query')?.addEventListener('input',()=>{clearTimeout(syncUrl.timer);syncUrl.timer=setTimeout(syncUrl,260);});
 const observer=new MutationObserver(()=>{improveCalendar();clearTimeout(observer.urlTimer);observer.urlTimer=setTimeout(syncUrl,80);});if($('#calendar'))observer.observe($('#calendar'),{childList:true,subtree:true});
}

async function init(){
 for(let i=0;i<80;i++){if($('#destination')?.options.length>1&&$('#source-time')?.textContent&&!$('#source-time').textContent.includes('불러오고'))break;await sleep(100);}
 addCloudControls();addStatusRow();bind();await loadStatus();await applyUrl();improveCalendar();
}
init();
