import {createHash} from 'node:crypto';

const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const CABINS=new Set(['PRESTIGE','FIRST']);
const RULE_ID=/^[A-Za-z0-9_-]{8,80}$/;
const REGION_IDS=new Set(['europe','americas','oceania','bali']);
const REGION_LABELS={europe:'유럽',americas:'미주',oceania:'오세아니아',bali:'발리'};
const OCEANIA_DESTINATIONS=new Set(['MEL','BNE','SYD','AKL']);
const arr=value=>Array.isArray(value)?value:[];
const uniq=value=>[...new Set(arr(value).map(v=>String(v).trim().toUpperCase()).filter(Boolean))].sort();
const hash=value=>createHash('sha256').update(String(value)).digest('hex').slice(0,24);

export function regionIdFor(region,destination=''){
 const code=String(destination||'').trim().toUpperCase();
 const value=String(region||'').trim();
 if(code==='DPS')return 'bali';
 if(OCEANIA_DESTINATIONS.has(code))return 'oceania';
 if(value==='유럽')return 'europe';
 if(value==='미주')return 'americas';
 if(value==='오세아니아'||value==='대양주/괌')return 'oceania';
 if(value==='발리')return 'bali';
 return '';
}

export function regionLabelFor(regionId,fallback=''){
 return REGION_LABELS[String(regionId||'').trim().toLowerCase()]||String(fallback||'');
}

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
 const legacyRegion=String(rule.region||'').trim();if(legacyRegion.length>60||/[\u0000-\u001f]/.test(legacyRegion))throw new Error(`${name}: region 형식이 올바르지 않습니다.`);
 const suppliedRegionId=String(rule.region_id||'').trim().toLowerCase();
 if(suppliedRegionId&&!REGION_IDS.has(suppliedRegionId))throw new Error(`${name}: region_id 형식이 올바르지 않습니다.`);
 const region_id=suppliedRegionId||regionIdFor(legacyRegion,destinations.length===1?destinations[0]:'');
 const region=region_id?regionLabelFor(region_id,legacyRegion):legacyRegion;
 const flights=uniq(rule.flights);if(flights.some(v=>!/^KE\d{1,4}$/.test(v)))throw new Error(`${name}: 항공편은 KE901 같은 형식이어야 합니다.`);
 return {name,region,region_id,destinations,cabins,start,end,weekend:rule.weekend===true,flights};
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
 if(rule.region_id){
  if(regionIdFor(row.region,row.destination)!==rule.region_id)return false;
 }else if(rule.region&&row.region!==rule.region)return false;
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

const coverageKey=row=>`${String(row?.destination||'').toUpperCase()}|${String(row?.date||'').slice(0,7)}`;
const compactActiveRow=row=>({key:alertSeatKey(row),destination:String(row.destination||'').toUpperCase(),date:String(row.date||''),flight:String(row.flight||'').toUpperCase(),cabin:String(row.cabin||'').toUpperCase()});
function coverageState(context={}){
 const coverage=arr(context.coverage),unqueryable=arr(context.unqueryable);
 const covered=new Set(coverage.map(item=>`${String(item?.destination||'').toUpperCase()}|${String(item?.month||'')}`).filter(value=>!value.endsWith('|')));
 const unknown=new Set(unqueryable.map(item=>`${String(item?.destination||'').toUpperCase()}|${String(item?.month||'')}`).filter(value=>!value.endsWith('|')));
 return {known:coverage.length>0||unqueryable.length>0,covered,unknown};
}
function priorRows(previous,ruleId,signature){
 const oldMeta=previous.rule_meta?.[ruleId];
 if(oldMeta?.signature!==signature)return [];
 return arr(previous.active_rows?.[ruleId]).filter(row=>row&&row.key&&row.destination&&row.date);
}

export function evaluateAlerts(rows,rules,previous={},context={}){
 const active={},active_rows={},rule_meta={},opened=[];
 const coverage=coverageState(context);
 let unknownPreserved=0;
 for(const rule of rules){
  const current=rows.filter(row=>matchesAlertRule(row,rule));
  const currentRows=current.map(compactActiveRow),currentKeys=new Set(currentRows.map(row=>row.key)),signature=ruleSignature(rule);
  const oldMeta=previous.rule_meta?.[rule.id];
  const legacyPrior=previous.active?.[rule.name]||[];
  const priorHashes=new Set(oldMeta?.signature===signature?(previous.active?.[rule.id]||[]):(!previous.rule_meta?legacyPrior:[]));
  const priorMetadata=priorRows(previous,rule.id,signature);
  const preserved=[];
  if(coverage.known){
   for(const oldRow of priorMetadata){
    if(currentKeys.has(oldRow.key))continue;
    const key=coverageKey(oldRow);
    if(!coverage.covered.has(key)||coverage.unknown.has(key)){preserved.push(oldRow);unknownPreserved++;}
   }
  }
  const mergedRows=[...currentRows,...preserved.filter(row=>!currentKeys.has(row.key))];
  active_rows[rule.id]=mergedRows;
  active[rule.id]=mergedRows.map(row=>row.key);
  rule_meta[rule.id]={signature};
  const fresh=current.filter(row=>!priorHashes.has(alertSeatKey(row)));
  if(fresh.length)opened.push({rule,rows:fresh});
 }
 return {version:4,rule_hash:ruleHash(rules),rule_meta,active,active_rows,opened,unknown_preserved:unknownPreserved};
}
