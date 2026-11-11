const $=query=>document.querySelector(query);
const SOURCE='https://raw.githubusercontent.com/shoon94parkk-del/mileway-award-monitor/main/public-data/returns.json';
let report=null,firstLoad=true;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const cityByCode=()=>new Map((report?.origins||[]).map(r=>[r.code,r.city||r.code]));
const cityName=(code,map)=>map.get(code)||code;
const official='https://www.koreanair.com/booking/book-and-manage/award-seat-availability';
async function getJson(url,timeoutMs=8000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}
 finally{clearTimeout(timer);}
}
async function load(){
 try{
  const latest=await getJson(SOURCE).catch(()=>getJson('./returns-data.json',5000));
  if(latest?.status==='pending')throw Error('귀국편 첫 수집 결과를 기다리고 있습니다.');
  if(latest?.direction!=='RETURN'||latest?.destination!=='ICN'||!Array.isArray(latest?.rows))throw Error('귀국편 데이터 형식을 확인할 수 없습니다.');
  report=latest;
  const previous=$('#origin').value,monthsValue=$('#month').value;
  const names=cityByCode();
  $('#origin').innerHTML='<option value="">모든 유럽 도시</option>'+report.origins.map(r=>'<option value="'+esc(r.code)+'">'+esc(cityName(r.code,names))+' ('+esc(r.code)+')</option>').join('');
  $('#origin').value=previous;
  const months=[...new Set([...(report.coverage||[]),...(report.unqueryable||[])].map(c=>c.month))].sort();
  $('#month').innerHTML='<option value="">모든 월</option>'+months.map(m=>'<option value="'+esc(m)+'">'+esc(m.replace('-','년 '))+'월</option>').join('');
  $('#month').value=monthsValue;
  $('#update-time').textContent='대한항공 자료: '+(report.source_updated_at||'미확인')+' · 수집 완료: '+(report.last_successful_scan_at?new Date(report.last_successful_scan_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미확인');
  render();
 }catch(error){
  if(!report){
   $('#update-time').textContent='귀국편 첫 수집 전 또는 자료 연결을 확인하고 있습니다.';
   $('#results').innerHTML='<div class="empty"><b>귀국편 수집 결과가 아직 없습니다.</b>첫 수집이 완료되면 이 화면에 유럽 → 인천 노선이 표시됩니다. 인천 출발편은 별도 화면에서 마지막 게시된 자료와 수집 상태를 확인할 수 있습니다.</div>';
   $('#coverage').textContent='데이터를 받지 못했습니다: '+error.message;
  }
 }finally{firstLoad=false;}
}
function render(){
 if(!report)return;
 const origin=$('#origin').value,month=$('#month').value,cabin=$('#cabin').value,sort=$('#sort').value,start=$('#start').value,end=$('#end').value,weekend=$('#weekend').checked,today=dateKst();
 const names=cityByCode();
 const active=(report.rows||[]).filter(r=>r.available===true&&r.verified!==false&&r.date>=today);
 const rows=active.filter(r=>(!origin||r.origin===origin)&&(!month||r.date.startsWith(month))&&(!cabin||r.cabin===cabin)&&(!start||r.date>=start)&&(!end||r.date<=end)&&(!weekend||[0,6].includes(new Date(r.date+'T00:00:00Z').getUTCDay())));
 rows.sort((a,b)=>sort==='latest'?b.date.localeCompare(a.date):sort==='origin'?cityName(a.origin,names).localeCompare(cityName(b.origin,names),'ko')||a.date.localeCompare(b.date):a.date.localeCompare(b.date)||String(a.departureTime||'').localeCompare(String(b.departureTime||'')));
 const totalOrigins=new Set(active.map(r=>r.origin)).size;
 const unknown=report.unqueryable?.length||0;
 const stale=report.rows?.filter(r=>r.verified===false).length||0;
 $('#summary').innerHTML=[
  ['비즈니스·일등석 가능 표시',active.length,'편명 × 날짜 × 좌석 등급'],
  ['좌석이 확인된 유럽 출발 도시',totalOrigins,(report.origins||[]).length+'개 도시 모니터링'],
  ['정상 조회 노선·월',(report.coverage||[]).length+'개',unknown?'조회 불가 '+unknown+'개 별도':'조회 불가 0개']
 ].map(([label,count,detail])=>'<article><span>'+esc(label)+'</span><strong>'+esc(count)+'</strong><small>'+esc(detail)+'</small></article>').join('');
 $('#count').textContent=rows.length.toLocaleString('ko-KR')+'건';
 const publishedAt=Date.parse(report.last_successful_scan_at||'');
 const old=Number.isFinite(publishedAt)&&Date.now()-publishedAt>48*3600000;
 $('#coverage').classList.toggle('warning',old||unknown>0);
 $('#coverage').textContent=(old?'최근 정상 수집 후 48시간 이상 지났습니다. 현재 좌석 상태는 미확인입니다. · ':'')+'정상 조회 '+(report.coverage||[]).length+'개 노선·월 · 조회 불가 '+unknown+'개 · 이전 결과 보존(현재 미확인) '+stale+'건. 조회 불가는 좌석 없음이 아닙니다.';
 $('#results').innerHTML=rows.length?rows.slice(0,500).map(r=>{
  const city=cityName(r.origin,names);
  const cabinName=r.cabin==='FIRST'?'일등석':'프레스티지';
  return '<article class="flight"><div><div class="city">'+esc(city)+' → 인천</div><div class="route">'+esc(r.origin)+' → ICN · 대한항공 공개 좌석 현황</div></div>'+
    '<div><div class="date">'+esc(r.date)+'</div><div class="sub">현지 출발 '+esc(r.departureTime||'시각 미제공')+'</div></div>'+
    '<div><span class="cabin '+(r.cabin==='FIRST'?'first':'')+'">'+cabinName+'</span><div class="sub">'+esc(r.flight||'날짜별 좌석 표시')+'</div></div>'+
    '<a href="'+official+'" target="_blank" rel="noopener noreferrer">예약 확인 ↗</a></article>';
 }).join('')+(rows.length>500?'<div class="empty">표시 성능을 위해 상위 500건만 보여줍니다. 기간과 도시를 좁혀 주세요.</div>':''):'<div class="empty"><b>선택한 조건에서 확인된 좌석이 없습니다.</b>좌석 없음으로 확정할 수는 없습니다. 다른 도시·날짜를 선택하거나 대한항공에서 다시 확인해 주세요.</div>';
}
for(const id of ['origin','month','cabin','sort','start','end','weekend'])$('#'+id).addEventListener('change',render);
$('#clear').addEventListener('click',()=>{for(const id of ['origin','month','start','end'])$('#'+id).value='';$('#cabin').value='PRESTIGE';$('#sort').value='date';$('#weekend').checked=false;render();});
$('#april').addEventListener('click',()=>{$('#month').value='2027-04';$('#start').value='2027-04-01';$('#end').value='2027-04-30';render();});
await load();
setInterval(load,10*60*1000);
