import {parsePublicApi,monthRange} from './public-calendar.mjs';

export const RETURN_DESTINATION='ICN';
export const RETURN_REGION='유럽';
const IATA=/^[A-Z]{3}$/;
const key=(origin,month)=>origin+'|'+month;

export function getReturnOrigins(routes){
  const seen=new Set();
  return (routes||[])
    .filter(r=>r.region==='유럽'&&IATA.test(r.code||'')&&r.code!=='ICN')
    .filter(r=>{if(seen.has(r.code))return false;seen.add(r.code);return true;})
    .map(r=>({code:r.code,city:r.city||r.code,region:'유럽',country:r.country||''}));
}

export function makeReturnMonth(data,{origin,month,start,end,sourceUpdatedAt}){
  const rows=parsePublicApi(data,{origin,destination:'ICN',month,startDate:start,endDate:end,sourceUpdatedAt});
  if(data.flightList.length===0)return {status:'UNQUERYABLE',rows:[],days:0};
  return {status:'COVERED',rows:rows.filter(row=>row.available).map(row=>({...row,region:'유럽',direction:'RETURN'})),
    days:new Set(data.flightList.map(day=>day.departureDate)).size};
}

export function checkReturnReport(report){
  if(report.direction!=='RETURN'||report.destination!=='ICN'||report.source_type!=='KOREAN_AIR_PUBLIC_DAILY'||!report.source_updated_at)throw Error('Invalid return source');
  if(!Array.isArray(report.origins)||!report.origins.length||!Array.isArray(report.rows)||!Array.isArray(report.coverage)||!Array.isArray(report.unqueryable))throw Error('Invalid return shape');
  if(report.failed?.length||!report.attempt_complete)throw Error('Cannot publish incomplete return scan');
  const months=monthRange(report.start_date,report.end_date),codes=getReturnOrigins(report.origins).map(r=>r.code);
  if(!codes.length||new Set(codes).size!==report.origins.length)throw Error('Return origins are invalid');
  const expected=new Set(codes.flatMap(origin=>months.map(month=>key(origin,month))));
  const covered=new Set(),complete=new Set();
  for(const [records,isCovered] of [[report.coverage,true],[report.unqueryable,false]]){
    for(const record of records){
      const k=key(record.origin,record.month);
      if(!expected.has(k)||covered.has(k)||(!isCovered&&record.status!=='UNQUERYABLE'))throw Error('Invalid return coverage');
      covered.add(k);if(isCovered)complete.add(k);
    }
  }
  if(covered.size!==expected.size)throw Error('Missing return route/month');
  for(const row of report.rows){
    if(row.destination!=='ICN'||!codes.includes(row.origin)||!complete.has(key(row.origin,row.date?.slice(0,7)))||row.available!==true||row.direction!=='RETURN'||row.sourceUpdatedAt!==report.source_updated_at||row.date<report.start_date||row.date>report.end_date||!['O','A'].includes(row.fareClass)||row.cabin!==(row.fareClass==='O'?'PRESTIGE':'FIRST'))throw Error('Invalid return seat');
  }
  return true;
}

export function mergeReturnReports(previous,next){
  checkReturnReport(next);
  const unknown=new Set(next.unqueryable.map(item=>key(item.origin,item.month)));
  const carried=(previous?.rows||[]).filter(row=>unknown.has(key(row.origin,row.date?.slice(0,7)))).map(row=>({...row,verified:false,carried_from_previous:true}));
  const active=next.rows.map(row=>({...row,verified:true,carried_from_previous:false}));
  const unique=new Map([...carried,...active].map(row=>[[row.origin,row.destination,row.date,row.flight,row.cabin].join('|'),row]));
  return {...next,rows:[...unique.values()],preserved_unknown_rows:carried.length,
    last_successful_scan_at:next.finished_at};
}
