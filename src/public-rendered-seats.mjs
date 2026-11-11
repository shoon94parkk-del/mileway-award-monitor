// Public airline UI reader. No direct API calls or response-body parsing.
// Collect only what the rendered public calendar proves; absent calendar != zero seats.
const PRESTIGE='프레스티지석 보너스';
const FIRST='일등석 보너스/좌석승급';
const UNQUERYABLE='검색하신 여정은 조회가 불가합니다.';

export function readRenderedSeatCalendar(){
  const visible=el=>!!(el&&el.getClientRects().length&&!el.closest('[aria-hidden="true"]'));
  const modern=document.querySelector('kds-fromto_1');
  const origin=modern?.getAttribute('is-from-code')||null;
  const destination=modern?.getAttribute('is-to-code')||null;
  const legacyPopup=document.querySelector('#travelCalendarPopup');
  if(legacyPopup&&visible(legacyPopup)){
    const heading=document.querySelector('#modals-travelCalendar-title')?.textContent?.trim()||'';
    const month=document.querySelector('#travelCalendarListBtn')?.textContent?.trim()||'';
    const days=[...legacyPopup.querySelectorAll('[id^="day_"]')].map(el=>({
      day:Number(el.id.replace('day_','')),
      text:el.textContent?.trim()||'',
      disabled:el.getAttribute('aria-disabled')==='true'||el.classList.contains('-disabled'),
      labels:[...el.querySelectorAll('li')].map(li=>li.textContent?.trim()||'')
    }));
    return {kind:'LEGACY',origin,destination,heading,month,days,
      legend:legacyPopup.textContent?.includes(PRESTIGE)||legacyPopup.textContent?.includes(FIRST)||false};
  }
  // The redesigned site uses nested Web Components (shadow roots). Traverse
  // public DOM only; never inspect network responses, private state or tokens.
  const collected=[];
  const visit=root=>{
    for(const el of root.querySelectorAll('*')){
      if(el.shadowRoot)visit(el.shadowRoot);
      if(!visible(el))continue;
      if(!el.matches('[role="gridcell"],[data-date],[data-day],[id^="day_"],[aria-label*="보너스"],[class*="calendar"] [aria-label]'))continue;
      // Ignore generic calendar headers, buttons and page-level legends.
      const label=el.getAttribute('aria-label')||'';
      const attrs=[el.getAttribute('data-date'),el.getAttribute('data-day'),el.id].filter(Boolean);
      const text=el.textContent?.trim()||'';
      collected.push({label,text:text.slice(0,350),attrs,disabled:el.getAttribute('aria-disabled')==='true'||
        el.hasAttribute('disabled')||el.classList.contains('-disabled'),html:el.localName});
    }
  };
  visit(document);
  const body=document.body?.innerText||'';
  const month=modern?.parentElement?.querySelector('kds-dateinput_1')?.textContent?.trim()||
      document.querySelector('kds-dateinput_1')?.textContent?.trim()||'';
  return {kind:'MODERN',origin,destination,month,days:collected,
    legend:body.includes(PRESTIGE)||body.includes(FIRST),
    unavailableMessage:body.includes(UNQUERYABLE),
    resultHint:body.slice(0,700)};
}

const matchDay=(item,year,month)=>{
  const mm=String(month).padStart(2,'0');
  const combined=[...(item.attrs||[]),item.label||'',item.text||''].join(' ');
  const full=combined.match(new RegExp('(?:^|[^0-9])'+year+'[-./년 ]\\s*0?'+month+'[-./월 ]\\s*([0-3]?\\d)(?:일|[^0-9]|$)'));
  if(full)return Number(full[1]);
  const iso=combined.match(new RegExp('(?:^|[^0-9])'+year+mm+'([0-3]\\d)(?:[^0-9]|$)'));
  if(iso)return Number(iso[1]);
  const short=combined.match(/\bday_(\d{1,2})\b/);
  if(short)return Number(short[1]);
  // A standalone day number is valid only for explicitly marked grid cells.
  if(item.html==='button'||item.html==='div'){
    const v=(item.label||item.text||'').trim();
    if(/^\d{1,2}$/.test(v)&&item.attrs?.some(a=>/day_|20\d{2}/.test(a)))return Number(v);
  }
  return null;
};
const keyFromDate=month=>month.replace('-','')+'01';

export function parseRenderedSeatMonth(snapshot,{origin,destination,month,startDate,endDate,sourceUpdatedAt}){
  if(!snapshot||!['MODERN','LEGACY'].includes(snapshot.kind))throw Error('Unsupported public UI calendar');
  if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination)||!/^\d{4}-\d{2}$/.test(month))
    throw Error('Invalid public UI route or month');
  if(snapshot.kind==='MODERN'&&(snapshot.origin!==origin||snapshot.destination!==destination))
    throw Error('Rendered airport selection does not match requested route');
  if(snapshot.kind==='LEGACY'&&(!snapshot.heading?.includes(origin)||!snapshot.heading?.includes(destination)))
    throw Error('Rendered calendar route does not match requested route');
  const [year,number]=month.split('-').map(Number);
  if(snapshot.kind==='LEGACY'){
    if(!new RegExp(year+'년\\s*'+number+'월').test(snapshot.month||''))throw Error('Rendered legacy month mismatch');
  }else{
    if(!new RegExp(year+'년\\s*'+number+'월').test(snapshot.month||''))throw Error('Rendered modern month mismatch');
  }
  if(snapshot.unavailableMessage)return {status:'UNQUERYABLE',rows:[],days:0};
  const selected=[];
  const maxDay=new Date(Date.UTC(year,number,0)).getUTCDate();
  if(snapshot.kind==='LEGACY'){
    for(const item of snapshot.days||[]){
      if(Number.isInteger(item.day)&&item.day>=1&&item.day<=maxDay)
        selected.push({day:item.day,disabled:!!item.disabled,text:(item.labels||[]).join(' '),
          labels:item.labels||[]});
    }
  }else{
    for(const item of snapshot.days||[]){
      const day=matchDay(item,year,number);
      if(day&&day>=1&&day<=maxDay)selected.push({day,disabled:!!item.disabled,
        text:[item.label||'',item.text||''].join(' '),labels:[item.label||'',item.text||'']});
    }
  }
  const days=new Set(selected.map(r=>r.day));
  if(days.size<Math.min(20,maxDay))throw Error('Rendered public calendar has insufficient dated cells ('+days.size+')');
  // Do not report "no award seats" if the airline changed its label vocabulary.
  if(!snapshot.legend&&!selected.some(r=>r.text.includes(PRESTIGE)||r.text.includes(FIRST)))
    throw Error('Rendered public calendar has no verifiable award-class legend');
  const rows=[];
  const available=new Map();
  for(const item of selected){
    if(item.disabled)continue;
    for(const [fareClass,term] of [['O',PRESTIGE],['A',FIRST]]){
      if(item.text.includes(term))available.set(item.day+'|'+fareClass,true);
    }
  }
  for(const [key] of available){
    const [d,cls]=key.split('|'),date=month+'-'+String(d).padStart(2,'0');
    if(date<startDate||date>endDate)continue;
    rows.push({date,origin,destination,flight:null,departureTime:null,aircraft:null,
      cabin:cls==='O'?'PRESTIGE':'FIRST',fareClass:cls,available:true,
      availabilityType:cls==='O'?'AWARD':'AWARD_OR_UPGRADE',seats:null,
      sourcePath:'PUBLIC_UI_RENDERED',sourceUpdatedAt,checkedAt:new Date().toISOString(),
      source:'KOREAN_AIR_PUBLIC_DAILY',region:'유럽',direction:'RETURN'});
  }
  return {status:'COVERED',rows,days:days.size,engine:'UI_DOM'};
}
