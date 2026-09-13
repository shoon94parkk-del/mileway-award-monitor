import {prestigeSeatInfo} from './seat-metadata.js';

const SNAPSHOT_URL='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/snapshot.json';
const AWARD_URL='https://www.koreanair.com/booking/book-and-manage/award-seat-availability';
const mobileQuery=window.matchMedia('(max-width:850px)');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seatRowsPromise=null;

async function rowsById(){
 if(!seatRowsPromise)seatRowsPromise=fetch(SNAPSHOT_URL+'?seatinfo='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('좌석 자료를 불러오지 못했습니다.');return r.json();}).then(data=>new Map((data.rows||[]).map(row=>[String(row.id),row]))).catch(error=>{seatRowsPromise=null;throw error;});
 return seatRowsPromise;
}

function bookingUrl(row){
 if(!row?.destination)return AWARD_URL;
 const q=new URLSearchParams({bookingType:'A',tripType:'OW',departure:'ICN',arrival:String(row.destination),departureDate:String(row.date||''),adults:'1',cabinClass:row.cabin==='FIRST'?'F':'C'});
 return `https://www.koreanair.com/booking/search?${q}`;
}

function addSeatButton(actions,id){
 const seat=document.createElement('button');seat.type='button';seat.className='seat-info-button';seat.dataset.seatInfo=id;seat.textContent='좌석 정보';actions.append(seat);return seat;
}

function enhanceRows(){
 document.querySelectorAll('.flight-row').forEach(el=>{
  if(el.dataset.seatInfoEnhanced==='1')return;
  const detail=el.querySelector('[data-detail]');if(!detail)return;
  const id=detail.dataset.detail;
  const actions=document.createElement('div');actions.className='seat-actions';
  detail.before(actions);
  if(mobileQuery.matches)detail.remove();else actions.append(detail);
  addSeatButton(actions,id);
  const book=document.createElement('a');book.className='book-button reserve-button';book.dataset.book=id;book.href=AWARD_URL;book.target='_blank';book.rel='noreferrer';book.textContent='예약';actions.append(book);
  el.dataset.seatInfoEnhanced='1';el.dataset.seatRowId=id;
 });
 const head=document.querySelector('.list-head');if(head&&head.children[5])head.children[5].textContent='확인';
 hydrateRows();
}

function reserveIdentity(el,reserve){
 const href=String(reserve?.dataset?.webFallback||reserve?.href||'');
 const destination=(href.match(/[?&]arrival=([^&#;]+)/)||[])[1];
 const date=(href.match(/[?&]departureDate=([^&#;]+)/)||[])[1];
 const flight=el.querySelector('.flight-time .subline')?.textContent?.trim()||'';
 const cabin=el.querySelector('.cabin')?.textContent?.includes('일등')?'FIRST':'PRESTIGE';
 try{return {destination:destination?decodeURIComponent(destination):'',date:date?decodeURIComponent(date):'',flight,cabin};}catch{return {destination,date,flight,cabin};}
}

function matchReserveRow(map,el,reserve){
 const id=reserveIdentity(el,reserve);
 if(!id.destination||!id.date||!id.flight)return null;
 for(const row of map.values())if(row.destination===id.destination&&row.date===id.date&&String(row.flight)===id.flight&&row.cabin===id.cabin)return row;
 return null;
}

function enhanceReserveOnlyRows(map){
 document.querySelectorAll('.flight-row:not([data-seat-info-enhanced="1"])').forEach(el=>{
  const reserve=el.querySelector('a.reserve-button');if(!reserve)return;
  const row=matchReserveRow(map,el,reserve);if(!row)return;
  const actions=document.createElement('div');actions.className='seat-actions mobile-seat-actions';
  reserve.before(actions);addSeatButton(actions,row.id);actions.append(reserve);
  el.dataset.seatInfoEnhanced='1';el.dataset.seatRowId=row.id;
 });
}

async function hydrateRows(){
 let map;try{map=await rowsById();}catch{return;}
 enhanceReserveOnlyRows(map);
 document.querySelectorAll('.flight-row[data-seat-info-enhanced="1"]').forEach(el=>{
  const detail=el.querySelector('[data-detail]'),book=el.querySelector('[data-book]');
  let row=map.get(String(el.dataset.seatRowId||detail?.dataset.detail||''));
  if(!row){const reserve=el.querySelector('a.reserve-button');row=reserve?matchReserveRow(map,el,reserve):null;}
  if(!row)return;
  if(book){book.href=bookingUrl(row);book.setAttribute('aria-label',`${row.city||row.destination} ${row.date} 대한항공 마일리지 예약`);}
  if(row.aircraft&&!el.querySelector('.aircraft-badge')){
   const badge=document.createElement('span');badge.className='aircraft-badge';badge.textContent=String(row.aircraft);badge.title='대한항공 공개 자료에서 수집한 예정 기종';
   el.querySelector('.cabin-cell')?.append(badge);
  }
 });
}

function seatFacts(meta){
 return `<div class="seat-facts"><div><span>좌석</span><strong>${esc(meta.seat_name)}</strong></div><div><span>침대 모드</span><strong>${esc(meta.bed)}</strong></div><div><span>통로 접근</span><strong>${esc(meta.direct_aisle)}</strong></div><div><span>배열</span><strong>${esc(meta.layout)}</strong></div></div>`;
}

function variantsHtml(meta){
 if(!meta.variants?.length)return '';
 return `<section class="seat-variants"><h3>같은 기종 안에서도 좌석이 달라요</h3>${meta.variants.map(v=>`<a href="${esc(v.official_url)}" target="_blank" rel="noreferrer"><b>${esc(v.name)} · ${esc(v.seat_name)}</b><span>${esc(v.bed)} · ${esc(v.layout)} · ${esc(v.direct_aisle)}</span><em>공식 정보 ↗</em></a>`).join('')}</section>`;
}

function renderSeatDialog(row){
 const d=document.querySelector('#dialog'),content=document.querySelector('#dialog-content');if(!d||!content)return;
 const prestige=row.cabin!=='FIRST';
 const meta=prestige?prestigeSeatInfo(row.aircraft):{aircraft:row.aircraft||'기종 미확인',seat_name:'일등석 좌석',bed:'기재별 상이',direct_aisle:'기재별 상이',layout:'기재별 상이',privacy:'기재별 상이',summary:'현재 Mileway의 좌석 품질 메타데이터는 프레스티지석을 우선 제공합니다. 일등석은 대한항공 공식 기종 페이지에서 확인해 주세요.',image_url:'',image_note:'',official_url:'https://www.koreanair.com/contents/plan-your-travel/in-flight-experience/fleet',confidence:'unknown'};
 const exact=meta.confidence==='exact',unknown=meta.confidence==='unknown';
 content.innerHTML=`<span class="eyebrow">SEAT GUIDE · ${esc(row.flight||'KOREAN AIR')}</span><div class="seat-dialog-title"><div><h2>${esc(row.city||row.destination)}행 ${prestige?'프레스티지':'일등석'} 좌석</h2><p>${esc(row.date)} · ${esc(row.flight)} ${esc(row.time||'')} · ${esc(meta.aircraft||row.aircraft||'기종 미확인')}</p></div><span class="seat-confidence ${exact?'exact':'check'}">${exact?'기종 기준 확인':unknown?'기종 미확인':'구성 확인 필요'}</span></div>
 ${meta.image_url?`<figure class="seat-photo"><img src="${esc(meta.image_url)}" alt="${esc(meta.image_note||meta.seat_name)}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc(meta.image_note||'대한항공 공식 좌석 이미지')}</figcaption><div class="seat-image-fallback" hidden>이미지를 불러오지 못했습니다. 아래 공식 좌석 정보에서 사진을 확인해 주세요.</div></figure>`:''}
 <div class="seat-product"><strong>${esc(meta.seat_name)}</strong><p>${esc(meta.summary)}</p></div>${seatFacts(meta)}${variantsHtml(meta)}
 <div class="seat-caution">예정 기종과 실제 투입 기재는 운항 사정으로 바뀔 수 있습니다. 특히 B777-300ER·A330-300은 같은 기종 안에서도 좌석 구성이 다르므로 예약 화면에서 최종 기재를 확인해 주세요.</div>
 <div class="dialog-actions seat-dialog-actions"><a class="secondary" href="${esc(meta.official_url)}" target="_blank" rel="noreferrer">대한항공 공식 좌석 사진 ↗</a><a class="primary book-button" href="${esc(bookingUrl(row))}" target="_blank" rel="noreferrer">예약하기 ↗</a></div>`;
 d.classList.add('seat-info-dialog');if(!d.open)d.showModal();
 const img=content.querySelector('.seat-photo img');if(img)img.addEventListener('error',()=>{img.hidden=true;const f=content.querySelector('.seat-image-fallback');if(f)f.hidden=false;},{once:true});
}

async function openSeatInfo(id){
 try{const row=(await rowsById()).get(String(id));if(!row)throw Error('항공편 정보를 찾지 못했습니다.');renderSeatDialog(row);}catch(error){const content=document.querySelector('#dialog-content'),d=document.querySelector('#dialog');if(content)content.innerHTML=`<h2 class="detail-heading">좌석 정보를 불러오지 못했어요</h2><p class="muted">${esc(error.message)}</p><div class="dialog-actions"><a class="primary" href="${AWARD_URL}" target="_blank" rel="noreferrer">대한항공에서 확인 ↗</a></div>`;if(d&&!d.open)d.showModal();}
}

document.addEventListener('click',event=>{const b=event.target.closest('[data-seat-info]');if(b){event.preventDefault();openSeatInfo(b.dataset.seatInfo);}});
new MutationObserver(enhanceRows).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceRows,{once:true});else enhanceRows();
