let snapshot,loadedAt=0;
const SNAPSHOT_URL='./snapshot.json';
const SNAPSHOT_TTL_MS=15000;
const FAVORITES_KEY='mileway.cloud.favorites.v1';
const SEARCHES_KEY='mileway.cloud.searches.v1';
const EXCLUDED_DESTINATIONS=new Set(['GUM','SVO','VVO','LED','UBN','IKT','DXB','TLV']);
const EXCLUDED_REGION_PATTERN=/(러시아|몽골|중앙아시아|중동|아프리카)/;
const OCEANIA_DESTINATIONS=new Set(['MEL','BNE','SYD','AKL']);
const RUSSIA_MONGOLIA_DESTINATIONS=new Set(['SVO','VVO','LED','UBN','IKT']);
const MIDDLE_EAST_DESTINATIONS=new Set(['DXB','TLV']);
const storage=()=>typeof localStorage==='undefined'?null:localStorage;
function readJson(key,fallback){try{return JSON.parse(storage()?.getItem(key)||'')||fallback;}catch{return fallback;}}
function writeJson(key,value){storage()?.setItem(key,JSON.stringify(value));}
function favoriteSet(){return new Set(readJson(FAVORITES_KEY,[]));}
function readSearches(){return readJson(SEARCHES_KEY,[]).filter(s=>s&&Number.isFinite(Number(s.id))&&typeof s.name==='string'&&s.filters&&typeof s.filters==='object');}
function withSaved(row,favorites){return {...row,saved:favorites.has(row.id)};}
function groupRowsByDate(rows){
 const groups=new Map();
 for(const row of rows){
  const current=groups.get(row.date);
  if(current)current.push(row);else groups.set(row.date,[row]);
 }
 return groups;
}
function allowedRoute(route){return !EXCLUDED_DESTINATIONS.has(String(route?.code||route?.destination||''))&&!EXCLUDED_REGION_PATTERN.test(String(route?.region||''));}
export function normalizeRegion(region,destination){
 const code=String(destination||'');
 if(code==='DPS')return '발리';
 if(OCEANIA_DESTINATIONS.has(code)||(region==='대양주/괌'&&code!=='GUM'))return '오세아니아';
 if(RUSSIA_MONGOLIA_DESTINATIONS.has(code))return '러시아·몽골';
 if(MIDDLE_EAST_DESTINATIONS.has(code))return '중동';
 return region;
}
const normalizeRoute=route=>({...route,region:normalizeRegion(route?.region,route?.code)});
const normalizeRow=row=>({...row,region:normalizeRegion(row?.region,row?.destination)});
function sanitizeSnapshot(data){
 const source=data?.bootstrap||{},report=source.report||{};
 const rawRoutes=source.routes||[];
 const routes=rawRoutes.filter(allowedRoute).map(normalizeRoute);
 const visibleRouteCodes=new Set(routes.map(r=>r.code));
 const isVisibleDestination=item=>{
  const code=String(item?.destination||item?.code||item||'');
  if(EXCLUDED_DESTINATIONS.has(code))return false;
  if(item&&typeof item==='object'&&EXCLUDED_REGION_PATTERN.test(String(item.region||'')))return false;
  return rawRoutes.length?visibleRouteCodes.has(code):true;
 };
 const rows=(data?.rows||[]).filter(r=>isVisibleDestination(r)).map(normalizeRow);
 const filterDestinationArray=value=>(value||[]).filter(isVisibleDestination);
 const normalizeDestinationArray=value=>filterDestinationArray(value).map(item=>item&&typeof item==='object'?(item.code?normalizeRoute(item):item.destination?normalizeRow(item):item):item);
 const nextReport={...report,
  target_routes:(report.target_routes||[]).filter(isVisibleDestination),
  routes:normalizeDestinationArray(report.routes),coverage:filterDestinationArray(report.coverage),
  unqueryable:filterDestinationArray(report.unqueryable),failed:filterDestinationArray(report.failed)
 };
 if(report.region_status?.오세아니아){
  nextReport.region_status={...report.region_status,오세아니아:{...report.region_status.오세아니아,routes:routes.filter(r=>r.region==='오세아니아').length}};
 }
 const changes=normalizeDestinationArray(source.changes),recentItems=normalizeDestinationArray(source.recent_opened?.items);
 const bootstrap={...source,report:nextReport,routes,destinations:normalizeDestinationArray(source.destinations),changes,
  recent_opened:source.recent_opened?{...source.recent_opened,total:recentItems.length,items:recentItems}:source.recent_opened,
  stats:{...source.stats,available:rows.length,destinations:new Set(rows.map(r=>r.destination)).size,dates:new Set(rows.map(r=>r.date)).size,first:rows.filter(r=>r.cabin==='FIRST').length}
 };
 return {bootstrap,rows};
}
export function filterRows(rows,f={},favorites=new Set()){
 return rows.filter(r=>(!f.region||r.region===f.region)&&(!f.destination||r.destination===f.destination)&&(!f.cabin||r.cabin===f.cabin)&&(!f.month||r.date.startsWith(f.month))&&(!f.start||r.date>=f.start)&&(!f.end||r.date<=f.end)&&(!f.date||r.date===f.date)&&(f.weekend!=='true'||[0,6].includes(new Date(r.date+'T00:00:00Z').getUTCDay()))&&(!f.q||[r.city,r.destination,r.flight,r.country].some(v=>String(v).toLowerCase().includes(f.q.toLowerCase())))&&(f.saved!=='true'||favorites.has(r.id)));
}
async function loadSnapshot(){
 if(!snapshot||Date.now()-loadedAt>SNAPSHOT_TTL_MS){try{const r=await fetch(SNAPSHOT_URL+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('수집 자료를 불러오지 못했습니다.');snapshot=sanitizeSnapshot(await r.json());loadedAt=Date.now();}catch(e){if(!snapshot)throw e;loadedAt=Date.now();}}
 return snapshot;
}
export async function cloudApi(url,method='GET',data){
 await loadSnapshot();
 const u=new URL(url,'https://mileway.invalid'),f=Object.fromEntries(u.searchParams),favorites=favoriteSet();
 if(method==='POST'&&u.pathname==='/api/favorite'){
  const id=String(data?.id||'');if(!snapshot.rows.some(r=>r.id===id))throw Error('항공편을 찾지 못했습니다.');
  if(data?.saved)favorites.add(id);else favorites.delete(id);writeJson(FAVORITES_KEY,[...favorites]);return {ok:true,saved:!!data?.saved};
 }
 if(method==='POST'&&u.pathname==='/api/searches'){
  const name=String(data?.name||'').trim().slice(0,80);if(!name)throw Error('검색 이름이 필요합니다.');
  const searches=readSearches(),item={id:Date.now(),name,filters:data?.filters&&typeof data.filters==='object'?data.filters:{}};searches.unshift(item);writeJson(SEARCHES_KEY,searches.slice(0,30));return item;
 }
 if(method==='DELETE'&&u.pathname.startsWith('/api/searches/')){
  const id=Number(u.pathname.split('/').pop());writeJson(SEARCHES_KEY,readSearches().filter(s=>Number(s.id)!==id));return {ok:true};
 }
 if(method!=='GET')throw Error('공개 사이트는 조회 전용입니다.');
 if(u.pathname==='/api/bootstrap')return {...snapshot.bootstrap,favorites:favorites.size,searches:readSearches()};
 if(u.pathname.startsWith('/api/seats/')){const row=snapshot.rows.find(r=>r.id===u.pathname.split('/').pop());if(!row)throw Error('항공편을 찾지 못했습니다.');return withSaved(row,favorites);}
 const rows=filterRows(snapshot.rows,f,favorites);
 if(u.pathname==='/api/calendar')return [...groupRowsByDate(rows)].map(([date,rs])=>({date,count:rs.length,first:rs.filter(r=>r.cabin==='FIRST').length,destinations:new Set(rs.map(r=>r.destination)).size})).sort((a,b)=>a.date.localeCompare(b.date));
 if(u.pathname==='/api/seats'){
  rows.sort((a,b)=>f.sort==='latest'?b.date.localeCompare(a.date)||a.time.localeCompare(b.time):f.sort==='city'?a.city.localeCompare(b.city)||a.date.localeCompare(b.date):f.sort==='first'?(b.cabin==='FIRST')-(a.cabin==='FIRST')||a.date.localeCompare(b.date):a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const offset=Math.max(0,Number(f.offset)||0),limit=Math.max(1,Math.min(50000,Number(f.limit)||30));return {total:rows.length,rows:rows.slice(offset,offset+limit).map(r=>withSaved(r,favorites)),offset,limit};
 }
 throw Error('지원하지 않는 요청입니다.');
}