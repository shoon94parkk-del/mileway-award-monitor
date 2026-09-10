const IATA=/^([A-Z]{3})\b/;
const DOMESTIC=new Set('ICN GMP PUS CJU TAE CJJ KWJ USN RSU HIN KPO KUV WJU YNY MWX'.split(' '));
export const KOREAN_AIR_REGION_LABELS=['미주','동북아시아','동남아시아/서남아시아','유럽','대양주/괌','러시아/몽골/중앙아시아','중동/아프리카'];

export function collectionGroup(region){
  if(/유럽|Europe/i.test(region))return '유럽';
  if(/미주|America/i.test(region))return '미주';
  if(/대양주|오세아니아|Oceania/i.test(region))return '오세아니아';
  return '아시아';
}

// Keep the collector intentionally small: Northeast Asia is paused, and Korean Air's
// combined Southeast/South Asia selector is screened only for Bali (DPS).
export function monitoredRoute(route){
  const region=String(route?.region||'');
  const code=String(route?.code||'');
  if(/동북아시아|^일본$|중국\/동북아시아/.test(region))return false;
  if(/동남아시아/.test(region))return code==='DPS';
  return true;
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
  return {code,region,label,city};
}

export function candidateRegionLabels(texts){
  const controls=new Set(['닫기','이전','모든 지역 보기','대한민국','선택','확인','취소','검색','출발지','도착지']);
  const parsed=[...new Set((texts||[]).map(t=>String(t||'').replace(/\s+/g,' ').trim()).filter(t=>t&&!controls.has(t)&&!IATA.test(t)))];
  // Korean Air's current mobile/web accordion exposes region names on acc-button-mobile-web*,
  // while older collector code looked inside the collapsed panels and can therefore see no labels.
  // If that DOM locator yields too little information, fall back to the region labels observed on
  // the public selector instead of silently shrinking worldwide coverage.
  return parsed.length>=3?parsed:[...KOREAN_AIR_REGION_LABELS];
}

export function validateDiscovery(regions,routes){
  if(!Array.isArray(regions)||regions.length<3||!Array.isArray(routes)||routes.length<20)throw Error('Suspiciously small worldwide route discovery');
  const seen=new Set();
  for(const route of routes){
    if(!/^[A-Z]{3}$/.test(route.code)||DOMESTIC.has(route.code)||seen.has(route.code)||!regions.includes(route.region))throw Error('Invalid, domestic or duplicate discovered airport');
    seen.add(route.code);
  }
  if(regions.some(region=>!routes.some(r=>r.region===region)))throw Error('Discovered region has no airports');
  return true;
}
