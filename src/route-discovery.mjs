const IATA=/^([A-Z]{3})\b/;
const DOMESTIC=new Set('ICN GMP PUS CJU TAE CJJ KWJ USN RSU HIN KPO KUV WJU YNY MWX'.split(' '));
export const KOREAN_AIR_REGION_LABELS=['미주','동북아시아','동남아시아/서남아시아','유럽','대양주/괌','러시아/몽골/중앙아시아','중동/아프리카'];
export const MONITORED_REGION_LABELS=['미주','동남아시아/서남아시아','유럽','대양주/괌'];

export function collectionGroup(region){
  if(/유럽|Europe/i.test(region))return '유럽';
  if(/미주|America/i.test(region))return '미주';
  if(/대양주|오세아니아|Oceania/i.test(region))return '오세아니아';
  return '아시아';
}

// Keep the collector intentionally small: Northeast Asia is paused, Guam is excluded,
// Korean Air's combined Southeast/South Asia selector is screened only for Bali (DPS),
// and the Russia/Mongolia/Central Asia plus Middle East/Africa source groups are excluded.
export function monitoredRoute(route){
  const region=String(route?.region||'');
  const code=String(route?.code||'');
  if(code==='GUM')return false;
  if(/동북아시아|^일본$|중국\/동북아시아/.test(region))return false;
  if(/러시아|몽골|중앙아시아/.test(region))return false;
  if(/중동|아프리카/.test(region)&&!/유럽/.test(region))return false;
  if(/동남아시아|서남아시아/.test(region))return code==='DPS';
  return true;
}

export function monitoredRegion(region){
  const value=String(region||'');
  if(/동북아시아|^일본$|중국\/동북아시아/.test(value))return false;
  if(/러시아|몽골|중앙아시아/.test(value))return false;
  if(/중동|아프리카/.test(value)&&!/유럽/.test(value))return false;
  return /미주|America|유럽|Europe|대양주|오세아니아|Oceania|동남아시아|서남아시아/.test(value);
}

export function prioritizeRoutes(routes){
  const order=['유럽','미주','오세아니아','아시아'];
  return [...routes].filter(monitoredRoute).sort((a,b)=>order.indexOf(collectionGroup(a.region))-order.indexOf(collectionGroup(b.region)));
}

export function parseDestinationButton(text,region){
  const label=String(text||'').replace(/\s+/g,' ').trim();
  const code=label.match(IATA)?.[1];
  if(!code||DOMESTIC.has(code))return null;
  const city=label.replace(IATA,'').trim().replace(/^[-·|]\s*/,'')||code;
  const route={code,region,label,city};
  // Drop excluded destinations at discovery time so they never enter the collection queue or logs.
  return monitoredRoute(route)?route:null;
}

export function candidateRegionLabels(texts){
  const controls=new Set(['닫기','이전','모든 지역 보기','대한민국','선택','확인','취소','검색','출발지','도착지']);
  const parsed=[...new Set((texts||[]).map(t=>String(t||'').replace(/\s+/g,' ').trim()).filter(t=>t&&!controls.has(t)&&!IATA.test(t)))];
  const monitored=parsed.filter(monitoredRegion);
  // Discover only source groups that can contain a user-monitored route. This avoids repeatedly opening
  // Northeast Asia, Russia/Mongolia/Central Asia and Middle East/Africa on every regional collection.
  // If the responsive DOM hides region labels, fall back to the four current monitored source groups.
  return monitored.length>=3?monitored:[...MONITORED_REGION_LABELS];
}

export function validateDiscovery(regions,routes){
  if(!Array.isArray(regions)||regions.length<3||!Array.isArray(routes)||routes.length<20)throw Error('Suspiciously small monitored route discovery');
  const seen=new Set();
  for(const route of routes){
    if(!/^[A-Z]{3}$/.test(route.code)||DOMESTIC.has(route.code)||seen.has(route.code)||!regions.includes(route.region)||!monitoredRoute(route))throw Error('Invalid, domestic, duplicate or excluded discovered airport');
    seen.add(route.code);
  }
  if(regions.some(region=>!routes.some(r=>r.region===region)))throw Error('Discovered monitored region has no airports');
  return true;
}
