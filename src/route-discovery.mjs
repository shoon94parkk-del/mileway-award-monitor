const IATA=/^([A-Z]{3})\b/;

export function parseDestinationButton(text,region){
  const label=String(text||'').replace(/\s+/g,' ').trim();
  const code=label.match(IATA)?.[1];
  if(!code)return null;
  const city=label.replace(IATA,'').trim().replace(/^[-·|]\s*/,'')||code;
  return {code,region,label,city};
}

export function candidateRegionLabels(texts){
  return [...new Set((texts||[]).map(t=>String(t||'').replace(/\s+/g,' ').trim()).filter(t=>t&&t!=='닫기'&&t!=='모든 지역 보기'&&!IATA.test(t)&&t!=='대한민국'))];
}
