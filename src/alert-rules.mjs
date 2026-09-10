import {createHash} from 'node:crypto';

const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const CABINS=new Set(['PRESTIGE','FIRST']);
const RULE_ID=/^[A-Za-z0-9_-]{8,80}$/;
const arr=value=>Array.isArray(value)?value:[];
const uniq=value=>[...new Set(arr(value).map(v=>String(v).trim().toUpperCase()).filter(Boolean))].sort();
const hash=value=>createHash('sha256').update(String(value)).digest('hex').slice(0,24);

function normalizedShape(rule,index){
 if(!rule||typeof rule!=='object')throw new Error(`알림 규칙 ${index+1} 형식이 올바르지 않습니다.`);
 const name=String(rule.name||`알림 ${index+1}`).trim().slice(0,80);
 const destinations=uniq(rule.destinations);if(destinations.some(v=>!/^[A-Z]{3}$/.test(v)))throw new Error(`${name}: 목적지는 3자리 공항코드여야 합니다.`);
 const cabins=uniq(rule.cabins);if(cabins.some(v=>!CABINS.has(v)))throw new Error(`${name}: 좌석 등급은 PRESTIGE/FIRST만 가능합니다.`);
 const start=String(rule.start||'').trim(),end=String(rule.end||'').trim();
 const validDate=v=>ISO_DATE.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(start&&!validDate(start))throw new Error(`${name}: start는 유효한 YYYY-MM-DD 날짜여야 합니다.`);
 if(end&&!validDate(end))throw new Error(`${name}: end는 유효한 YYYY-MM-DD 날짜여야 합니다.`);
 if(start&&end&&start>end)throw new Error(`${name}: 시작일이 종료일보다 늦습니다.`);
 const region=String(rule.region||'').trim();if(region.length>60||/[\u0000-\u001f]/.test(region))throw new Error(`${name}: region 형식이 올바르지 않습니다.`);
 const flights=uniq(rule.flights);if(flights.some(v=>!/^KE\d{1,4}$/.test(v)))throw new Error(`${name}: 항공편은 KE901 같은 형식이어야 합니다.`);
 return {name,region,destinations,cabins,start,end,weekend:rule.weekend===true,flights};
}

export function ruleSignature(rule){
 const {name,...conditions}=rule;
 return hash(JSON.stringify(conditions));
}

export function normalizeAlertRules(input){
 const raw=typeof input==='string'?JSON.parse(input):input;
 if(!Array.isArray(raw))throw new Error('ALERT_RULES_JSON은 JSON 배열이어야 합니다.');
 const seen=new Set();
 return raw.slice(0,50).map((inputRule,index)=>{
  const shape=normalizedShape(inputRule,index);
  const supplied=String(inputRule?.id||'').trim();
  if(supplied&&!RULE_ID.test(supplied))throw new Error(`${shape.name}: id 형식이 올바르지 않습니다.`);
  const id=supplied||`rule_${hash(JSON.stringify({...shape,name:shape.name}))}`;
  if(seen.has(id))throw new Error(`${shape.name}: 알림 규칙 id가 중복되었습니다.`);
  seen.add(id);
  return {id,...shape};
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

// Keep notification identity stable when the airline adjusts time/fare-class metadata.
export function alertSeatKey(row){
 return hash([row.destination,row.date,row.flight,row.cabin].join('|'));
}

export function ruleHash(rules){
 return hash(JSON.stringify(rules.map(r=>({id:r.id,signature:ruleSignature(r)}))));
}

export function evaluateAlerts(rows,rules,previous={}){
 const active={},rule_meta={},opened=[];
 for(const rule of rules){
  const current=rows.filter(row=>matchesAlertRule(row,rule));
  const hashes=current.map(alertSeatKey),signature=ruleSignature(rule);
  active[rule.id]=hashes;rule_meta[rule.id]={signature};
  const oldMeta=previous.rule_meta?.[rule.id];
  const legacyPrior=previous.active?.[rule.name]||[];
  const prior=new Set(oldMeta?.signature===signature?(previous.active?.[rule.id]||[]):(!previous.rule_meta?legacyPrior:[]));
  const fresh=current.filter(row=>!prior.has(alertSeatKey(row)));
  if(fresh.length)opened.push({rule,rows:fresh});
 }
 return {version:2,rule_hash:ruleHash(rules),rule_meta,active,opened};
}
