const VALUE_RE=/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})/;
const WRAPPED_RE=/대한민국\s*시간\s*[\(（]\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})\s*[\)）]/g;
const LOOSE_RE=/대한민국\s*시간[^0-9]{0,16}(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})/g;

const partsToValue=parts=>`${parts[1]}년 ${Number(parts[2])}월 ${Number(parts[3])}일 ${String(Number(parts[4])).padStart(2,'0')}:${parts[5]}`;
const partsToKey=parts=>Number(`${parts[1]}${String(Number(parts[2])).padStart(2,'0')}${String(Number(parts[3])).padStart(2,'0')}${String(Number(parts[4])).padStart(2,'0')}${parts[5]}`);

export function sourceTimestampKey(value){
  const match=String(value||'').match(VALUE_RE);
  return match?partsToKey(match):null;
}

export function parseSourceUpdatedAt(text){
  const normalized=String(text||'').replace(/\u00a0/g,' ');
  let latest=null,latestKey=-Infinity;
  for(const pattern of [WRAPPED_RE,LOOSE_RE]){
    pattern.lastIndex=0;
    for(const match of normalized.matchAll(pattern)){
      const key=partsToKey(match);
      if(key>latestKey){latestKey=key;latest=partsToValue(match);}
    }
  }
  return latest;
}

export function expectedDailySourceUpdatedAt(now=new Date()){
  const kst=new Date(now.getTime()+9*60*60*1000);
  kst.setUTCDate(kst.getUTCDate()-1);
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth()+1}월 ${kst.getUTCDate()}일 23:00`;
}

export function dailySourceIsStale(current,now=new Date()){
  const currentKey=sourceTimestampKey(current);
  const expectedKey=sourceTimestampKey(expectedDailySourceUpdatedAt(now));
  return currentKey===null||expectedKey===null||currentKey<expectedKey;
}
