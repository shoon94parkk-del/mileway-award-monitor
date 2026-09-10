import {createHash} from 'node:crypto';

const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const REGIONS=new Set(['미주','유럽']);
const CABINS=new Set(['PRESTIGE','FIRST']);
const arr=value=>Array.isArray(value)?value:[];
const uniq=value=>[...new Set(arr(value).map(v=>String(v).trim().toUpperCase()).filter(Boolean))];

export function normalizeAlertRules(input){
 const raw=typeof input==='string'?JSON.parse(input):input;
 if(!Array.isArray(raw))throw new Error('ALERT_RULES_JSON은 JSON 배열이어야 합니다.');
 return raw.slice(0,50).map((rule,index)=>{
  if(!rule||typeof rule!=='object')throw new Error(`알림 규칙 ${index+1} 형식이 올바르지 않습니다.`);
  const name=String(rule.name||`알림 ${index+1}`).trim().slice(0,80);
  const destinations=uniq(rule.destinations);if(destinations.some(v=>!/^[A-Z]{3}$/.test(v)))throw new Error(`${name}: 목적지는 3자리 공항코드여야 합니다.`);
  const cabins=uniq(rule.cabins);if(cabins.some(v=>!CABINS.has(v)))throw new Error(`${name}: 좌석 등급은 PRESTIGE/FIRST만 가능합니다.`);
  const start=String(rule.start||'').trim(),end=String(rule.end||'').trim();
  if(start&&!ISO_DATE.test(start))throw new Error(`${name}: start는 YYYY-MM-DD 형식이어야 합니다.`);
  if(end&&!ISO_DATE.test(end))throw new Error(`${name}: end는 YYYY-MM-DD 형식이어야 합니다.`);
  if(start&&end&&start>end)throw new Error(`${name}: 시작일이 종료일보다 늦습니다.`);
  const region=String(rule.region||'').trim();if(region&&!REGIONS.has(region))throw new Error(`${name}: region은 미주 또는 유럽만 가능합니다.`);
  const flights=uniq(rule.flights);if(flights.some(v=>!/^KE\d{1,4}$/.test(v)))throw new Error(`${name}: 항공편은 KE901 같은 형식이어야 합니다.`);
  return {name,region,destinations,cabins,start,end,weekend:rule.weekend===true,flights};
 });
}

export function matchesAlertRule(row,rule){
 if(!row||!rule)return false;
 if(row.available===false||row.available===0)return false;
 if(rule.region&&row.region!==rule.region)return false;
 if(rule.destinations.length&&!rule.destinations.includes(String(row.destination).toUpperCase()))return false;
 if(rule.cabins.length&&!rule.cabins.includes(String(row.cabin).toUpperCase()))return false;
 if(rule.flights.length&&!rule.flights.includes(String(row.flight).toUpperCase()))return false;
 if(rule.start&&row.date<rule.start)return false;
 if(rule.end&&row.date>rule.end)return false;
 if(rule.weekend&&![0,6].includes(new Date(row.date+'T00:00:00Z').getUTCDay()))return false;
 return true;
}

export function alertSeatKey(row){
 return createHash('sha256').update([row.destination,row.date,row.flight,row.time||'',row.cabin,row.fare_class||''].join('|')).digest('hex').slice(0,24);
}

export function ruleHash(rules){
 return createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0,24);
}

export function evaluateAlerts(rows,rules,previous={}){
 const sameRules=previous.rule_hash===ruleHash(rules),active={},opened=[];
 for(const rule of rules){
  const current=rows.filter(row=>matchesAlertRule(row,rule));
  const hashes=current.map(alertSeatKey);active[rule.name]=hashes;
  const prior=new Set(sameRules?(previous.active?.[rule.name]||[]):[]);
  const fresh=current.filter(row=>!prior.has(alertSeatKey(row)));
  if(fresh.length)opened.push({rule,rows:fresh});
 }
 return {rule_hash:ruleHash(rules),active,opened};
}
