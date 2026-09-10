import {monthRange} from './public-calendar.mjs';
import {validateDiscovery,collectionGroup} from './route-discovery.mjs';

export function validatePublication(report){
  if(!['WORLDWIDE','REGION'].includes(report.scope)||report.discovery?.validated!==true)throw Error('Only validated worldwide or completed region scans may publish');
  validateDiscovery(report.discovery.regions,report.routes);
  if(!report.attempt_complete||report.failure||report.failed?.length||report.errors?.length||!report.source_updated_at||!report.finished_at||!Array.isArray(report.rows))throw Error('Incomplete or failed scan cannot publish');
  const months=monthRange(report.start_date,report.end_date);
  if(report.scope==='REGION'&&!['유럽','미주','오세아니아','아시아'].includes(report.collection_group))throw Error('Invalid collection group');
  const routes=new Set(report.routes.filter(r=>report.scope==='WORLDWIDE'||collectionGroup(r.region)===report.collection_group).map(r=>r.code));
  if(!routes.size)throw Error('No routes in completed region');
  if(report.target_routes?.length!==routes.size||new Set(report.target_routes).size!==routes.size||report.target_routes.some(c=>!routes.has(c)))throw Error('Partial route selection cannot publish');
  const covered=new Set(),normal=new Set();
  for(const [records,isNormal] of [[report.coverage,true],[report.unqueryable||[],false]]){
    if(!Array.isArray(records))throw Error('Missing coverage');
    for(const record of records){
      const key=record.destination+'|'+record.month;
      if(!routes.has(record.destination)||!months.includes(record.month)||covered.has(key)||(!isNormal&&record.status!=='UNQUERYABLE'))throw Error('Invalid or duplicate route/month coverage');
      covered.add(key);if(isNormal)normal.add(key);
    }
  }
  if(covered.size!==routes.size*months.length)throw Error('Missing route/month coverage');
  for(const row of report.rows){
    if(row.origin!=='ICN'||!normal.has(row.destination+'|'+row.date?.slice(0,7))||row.date<report.start_date||row.date>report.end_date||typeof row.available!=='boolean'||row.sourceUpdatedAt!==report.source_updated_at||!['O','A'].includes(row.fareClass)||row.cabin!==(row.fareClass==='O'?'PRESTIGE':'FIRST'))throw Error('Invalid public observation');
  }
  return true;
}

export function confidentlyAbsent(row,report){
  return row.date>=report.start_date&&row.date<=report.end_date&&report.coverage.some(c=>c.destination===row.destination&&c.month===row.date.slice(0,7));
}
