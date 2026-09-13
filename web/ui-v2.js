import {cloudApi} from './cloud-api.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mobileQuery=window.matchMedia('(max-width:850px)');

function ensureCabinFilter(){
 const select=$('#cabin');
 const grid=$('.filter-grid');
 if(!select||!grid)return;
 if(select.dataset.uxCabinUpgraded!=='true'){
  select.dataset.uxCabinUpgraded='true';
  select.hidden=false;
  select.removeAttribute('aria-hidden');
  select.removeAttribute('tabindex');
  select.innerHTML='<option value="">프레스티지 + 일등석</option><option value="PRESTIGE">프레스티지</option><option value="FIRST">일등석</option>';
  const label=document.createElement('label');
  label.className='ux-cabin-filter';
  label.append(document.createTextNode('좌석 등급'));
  select.parentNode?.insertBefore(label,select);
  label.appendChild(select);
  grid.appendChild(label);
 }
 if(select.dataset.uxDefaultApplied!=='true'){
  select.dataset.uxDefaultApplied='true';
  if(!select.value){
   select.value='PRESTIGE';
   queueMicrotask(()=>select.dispatchEvent(new Event('change',{bubbles:true})));
  }
 }
}

function moveRecentOpenedBelowResults(){
 const panel=$('#recent-opened');
 const pagination=$('#pagination');
 if(panel&&pagination&&pagination.parentNode&&panel.previousElementSibling!==pagination){pagination.after(panel);}
}

function cabinFilterLabel(){
 const value=$('#cabin')?.value||'';
 return value==='PRESTIGE'?'프레스티지':value==='FIRST'?'일등석':'프레스티지 + 일등석';
}

function currentFilterParams(){
 return {
  region:$('#regions button.selected')?.dataset.region||'',
  destination:$('#destination')?.value||'',
  month:$('#month')?.value||'',
  cabin:$('#cabin')?.value||'',
  start:$('#start')?.value||'',
  end:$('#end')?.value||'',
  weekend:$('#weekend')?.checked?'true':'',
  sort:$('#sort')?.value||'date'
 };
}

async function exportCurrentPublication(){
 const button=$('#export');
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 try{
  const filters=currentFilterParams();
  const query=new URLSearchParams(Object.entries({...filters,limit:'50000'}).filter(([,value])=>value!==''));
  const [boot,data]=await Promise.all([cloudApi('/api/bootstrap'),cloudApi('/api/seats?'+query.toString())]);
  const payload={
   schema_version:2,
   publication_id:boot?.report?.publication_id||boot?.report?.source_updated_at||null,
   source_updated_at:boot?.report?.source_updated_at||null,
   exported_at:new Date().toISOString(),
   filters,
   total:data.total,
   rows:data.rows
  };
  const blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const source=String(payload.source_updated_at||'unknown').replace(/[^0-9]+/g,'-').replace(/^-|-$/g,'');
  a.href=url;a.download=`mileway-${source||'snapshot'}-${filters.cabin||'all'}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }finally{
  if(button){button.disabled=false;button.removeAttribute('aria-busy');}
 }
}

function renderActiveFilters(){
 const card=$('.filter-card');
 if(!card)return;
 let bar=$('#active-filter-summary');
 if(!bar){bar=document.createElement('div');bar.id='active-filter-summary';bar.className='active-filter-summary';card.after(bar);}
 const region=$('#regions button.selected')?.textContent?.trim()||'전체';
 const destination=$('#destination option:checked')?.textContent?.trim()||'모든 목적지';
 const month=$('#month option:checked')?.textContent?.trim()||'전체 기간';
 const start=$('#start')?.value||'';
 const end=$('#end')?.value||'';
 const weekend=$('#weekend')?.checked;
 const range=start||end?`${start||'시작'} ~ ${end||'종료'}`:month;
 const chips=[`지역 ${region}`,destination,range,cabinFilterLabel(),...(weekend?['주말 출발']:[])];
 const signature=chips.join('|');
 if(bar.dataset.signature!==signature){bar.dataset.signature=signature;bar.innerHTML=`<strong>현재 검색조건</strong><div>${chips.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`;}
}

function emphasizeResults(){
 const toolbar=$('.results-toolbar');
 if(toolbar&&!toolbar.querySelector('.results-kicker'))toolbar.querySelector('div')?.insertAdjacentHTML('afterbegin','<span class="results-kicker">AVAILABLE AWARD SEATS</span>');
 const count=$('#result-count');
 if(count)count.classList.add('result-count-strong');
}

function renderMobileStatsSummary(){
 const stats=$('#stats');
 if(!stats)return;
 const cards=[...stats.querySelectorAll('.stat')];
 if(!cards.length)return;
 let summary=$('#mobile-stats-summary');
 if(summary&&summary.tagName==='DETAILS'){const replacement=document.createElement('div');replacement.id='mobile-stats-summary';replacement.className='mobile-stats-summary';summary.replaceWith(replacement);summary=replacement;}
 if(!summary){summary=document.createElement('div');summary.id='mobile-stats-summary';summary.className='mobile-stats-summary';stats.after(summary);}
 const value=i=>cards[i]?.querySelector('.stat-number')?.textContent?.replace(/\s+/g,'')?.trim()||'';
 const brief=[value(0),value(1),value(2)].filter(Boolean).join(' · ');
 const signature=brief;
 if(summary.dataset.signature!==signature){summary.dataset.signature=signature;summary.innerHTML=`<strong>수집 요약</strong><span>${esc(brief)}</span>`;}
}

function currentFilterSummary(){
 const region=$('#regions button.selected')?.textContent?.trim()||'전체';
 const destination=$('#destination option:checked')?.textContent?.trim()?.split(' · ')[0]||'모든 목적지';
 const month=$('#month option:checked')?.textContent?.trim()||'전체 기간';
 const start=$('#start')?.value||'',end=$('#end')?.value||'';
 const range=start||end?`${start||'시작'}~${end||'종료'}`:month;
 const weekend=$('#weekend')?.checked?' · 주말':'';
 return {region,destination,range,weekend,cabin:cabinFilterLabel()};
}

function setMobileFilterOpen(open){
 const card=$('.filter-card');
 if(!card)return;
 card.classList.toggle('cloud-collapsed',!open);
 const legacy=$('.mobile-filter-toggle');
 if(legacy){legacy.setAttribute('aria-expanded',String(open));legacy.textContent=open?'검색 조건 닫기':'검색 조건 열기';}
 syncMobileFilterState();
}

function ensureMobileFilterSheet(){
 const card=$('.filter-card');
 if(!card)return;
 let summary=$('#mobile-filter-summary-bar');
 if(!summary){
  summary=document.createElement('button');summary.id='mobile-filter-summary-bar';summary.className='mobile-filter-summary-bar';summary.type='button';summary.setAttribute('aria-controls','mobile-filter-sheet');summary.setAttribute('aria-expanded','false');
  const legacy=$('.mobile-filter-toggle');card.parentNode.insertBefore(summary,legacy||card);
 }
 card.id='mobile-filter-sheet';
 let head=card.querySelector('.mobile-filter-sheet-head');
 if(!head){head=document.createElement('div');head.className='mobile-filter-sheet-head';head.innerHTML='<strong>검색 조건</strong><button type="button" class="mobile-filter-sheet-close" aria-label="검색 조건 닫기">×</button>';card.prepend(head);}
 let foot=card.querySelector('.mobile-filter-sheet-foot');
 if(!foot){foot=document.createElement('div');foot.className='mobile-filter-sheet-foot';foot.innerHTML='<button type="button" class="mobile-filter-sheet-apply">결과 보기</button>';card.appendChild(foot);}
 let backdrop=$('#mobile-filter-backdrop');
 if(!backdrop){backdrop=document.createElement('button');backdrop.id='mobile-filter-backdrop';backdrop.className='mobile-filter-backdrop';backdrop.type='button';backdrop.setAttribute('aria-label','검색 조건 닫기');backdrop.hidden=true;document.body.appendChild(backdrop);}
 const f=currentFilterSummary();
 const signature=[f.region,f.destination,f.range,f.cabin,f.weekend].join('|');
 if(summary.dataset.signature!==signature){summary.dataset.signature=signature;summary.innerHTML=`<span class="mobile-filter-summary-text"><strong>${esc(f.region)}</strong> · ${esc(f.destination)} · ${esc(f.range)} · ${esc(f.cabin)}${esc(f.weekend)}</span><span class="mobile-filter-summary-action">필터</span>`;}
 const count=$('#result-count')?.textContent?.trim();
 const apply=card.querySelector('.mobile-filter-sheet-apply');
 const applyLabel=count?`${count} 결과 보기`:'결과 보기';
 if(apply&&apply.textContent!==applyLabel)apply.textContent=applyLabel;
 const selected=$('#regions button.selected');
 const selectedKey=selected?.dataset.region||'all';
 if(mobileQuery.matches&&selected&&summary.dataset.scrolledRegion!==selectedKey){summary.dataset.scrolledRegion=selectedKey;requestAnimationFrame(()=>selected.scrollIntoView({block:'nearest',inline:'center'}));}
 syncMobileFilterState();
}

function syncMobileFilterState(){
 const card=$('.filter-card'),summary=$('#mobile-filter-summary-bar'),backdrop=$('#mobile-filter-backdrop');
 if(!card)return;
 const open=mobileQuery.matches&&!card.classList.contains('cloud-collapsed');
 document.body.classList.toggle('mobile-filter-open',open);
 if(summary)summary.setAttribute('aria-expanded',String(open));
 if(backdrop)backdrop.hidden=!open;
}

function koreanAirAwardBookingUrl(row){
 const q=new URLSearchParams({
  bookingType:'A',
  tripType:'OW',
  departure:'ICN',
  arrival:String(row.destination||''),
  departureDate:String(row.date||''),
  adults:'1'
 });
 return `https://www.koreanair.com/booking/search?${q.toString()}`;
}

function simpleCityName(value){
 let text=String(value||'').trim();
 if(/발리/.test(text))return '발리';
 text=text.split('/')[0].replace(/공항$/,'').trim();
 return text||String(value||'');
}

async function prepareReserveButton(button){
 if(!button||button.dataset.reserveLoading)return;
 button.dataset.reserveLoading='true';
 button.textContent='예약';
 try{
  const row=await cloudApi('/api/seats/'+button.dataset.detail);
  if(!button.isConnected)return;
  const link=document.createElement('a');
  link.className='reserve-button';
  link.href=koreanAirAwardBookingUrl(row);
  link.textContent='예약';
  link.setAttribute('aria-label',`${row.city||row.destination} ${row.date} 대한항공 마일리지 예매`);
  link.setAttribute('rel','noreferrer');
  button.replaceWith(link);
 }catch{
  delete button.dataset.reserveLoading;
 }
}

function simplifyMobileRows(){
 if(!mobileQuery.matches)return;
 const list=$('.flight-list');
 if(!list)return;
 if(!list.querySelector('.mobile-award-list-head')){
  const head=document.createElement('div');
  head.className='mobile-award-list-head';
  head.innerHTML='<span>목적지</span><span>날짜</span><span>좌석/시간</span><span>예약</span>';
  list.prepend(head);
 }
 for(const row of list.querySelectorAll('.flight-row')){
  if(row.dataset.mobileSimple!=='true'){
   row.dataset.mobileSimple='true';
   const city=row.querySelector('.city');
   if(city)city.textContent=simpleCityName(city.textContent);
   const route=row.querySelector('.city-cell .subline');
   if(route)route.textContent=route.textContent.split('·')[0].trim();
  }
  const detail=row.querySelector('.detail-button[data-detail]');
  if(detail)prepareReserveButton(detail);
 }
}

function cleanDeveloperCopy(){
 const empty=$('#results .empty');
 if(empty&&empty.innerHTML.includes('로컬 서버 실행 상태를 확인해 주세요.'))empty.innerHTML=empty.innerHTML.replace(' · 로컬 서버 실행 상태를 확인해 주세요.',' · 잠시 후 다시 시도해 주세요.');
}

function bindMobileUi(){
 if(document.documentElement.dataset.mobileUiBound)return;
 document.documentElement.dataset.mobileUiBound='true';
 document.addEventListener('click',e=>{
  if(e.target.closest('#export')){e.preventDefault();e.stopImmediatePropagation();exportCurrentPublication().catch(()=>{});return;}
  if(e.target.closest('#reset')){setTimeout(()=>{const cabin=$('#cabin');if(cabin){cabin.value='PRESTIGE';cabin.dispatchEvent(new Event('change',{bubbles:true}));}},0);}
  if(e.target.closest('#mobile-filter-summary-bar')){setMobileFilterOpen(true);return;}
  if(e.target.closest('.mobile-filter-sheet-close,.mobile-filter-sheet-apply,#mobile-filter-backdrop')){setMobileFilterOpen(false);return;}
 },true);
 mobileQuery.addEventListener?.('change',()=>{if(!mobileQuery.matches)setMobileFilterOpen(false);sync();});
}

function sync(){ensureCabinFilter();moveRecentOpenedBelowResults();renderActiveFilters();emphasizeResults();renderMobileStatsSummary();ensureMobileFilterSheet();simplifyMobileRows();cleanDeveloperCopy();syncMobileFilterState();}
function scheduleSync(){if(scheduleSync.pending)return;scheduleSync.pending=requestAnimationFrame(()=>{scheduleSync.pending=0;sync();});}

bindMobileUi();
const observer=new MutationObserver(scheduleSync);
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',scheduleSync,true);
document.addEventListener('click',scheduleSync,true);
for(let i=0;i<8;i++)setTimeout(scheduleSync,i*250);
