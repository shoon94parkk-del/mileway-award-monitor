import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OUTBOUND_SHARDS,GROUP_NAMES,validateShardPlan,groupCodes} from './outbound-shards.mjs';
import {collectionGroup,monitoredRoute,validateDiscovery} from '../src/route-discovery.mjs';
import {validatePublication} from '../src/publication-validation.mjs';
import {monthRange} from '../src/public-calendar.mjs';

export function mergeOutboundShards(entries){
  const allExpected=new Set(validateShardPlan());
  const reports=OUTBOUND_SHARDS.map(shard=>{
    const report=entries.get(shard.id);
    if(!report)throw Error('Missing successful worker '+shard.id);
    if(report.scope!=='SMOKE'||report.attempt_complete!==true||
       report.failed?.length||report.errors?.length||report.failure)
      throw Error('Worker '+shard.id+' did not finish all required routes');
    const target=new Set(report.target_routes||[]);
    if(target.size!==shard.codes.length||shard.codes.some(code=>!target.has(code)))
      throw Error('Worker '+shard.id+' covered unexpected route set');
    return report;
  });
  const first=reports[0];
  const routes=first.routes||[];
  validateDiscovery(first.discovery?.regions||[],routes);
  const discovered=new Set(routes.filter(monitoredRoute).map(r=>r.code));
  if(discovered.size!==allExpected.size||
      [...discovered].some(code=>!allExpected.has(code)))
    throw Error('Official route discovery differs from the fixed five-runner split. Refresh assignments before publishing.');
  for(const report of reports){
    validateDiscovery(report.discovery?.regions||[],report.routes||[]);
    if(report.source_updated_at!==first.source_updated_at||
        report.start_date!==first.start_date||report.end_date!==first.end_date)
      throw Error('Workers read incompatible source refresh or date range');
    const codes=new Set(report.routes.map(r=>r.code));
    if(codes.size!==new Set(routes.map(r=>r.code)).size||
        routes.some(r=>!codes.has(r.code)))
      throw Error('Worker route discovery mismatch');
  }
  const months=monthRange(first.start_date,first.end_date);
  const output=new Map();
  for(const group of GROUP_NAMES){
    const codes=groupCodes(routes,group);
    if(!codes.length)throw Error('Missing monitored region '+group);
    const targets=new Set(codes),records=[],unqueryable=[],rows=[];
    for(const report of reports){
      records.push(...report.coverage.filter(x=>targets.has(x.destination)));
      unqueryable.push(...(report.unqueryable||[]).filter(x=>targets.has(x.destination)));
      rows.push(...report.rows.filter(x=>targets.has(x.destination)));
    }
    const coverage=new Set([...records,...unqueryable].map(x=>x.destination+'|'+x.month));
    if(coverage.size!==codes.length*months.length)
      throw Error('Incomplete '+group+' coverage: '+coverage.size+'/'+(codes.length*months.length));
    const groupReport={
      ...first,source_updated_at:first.source_updated_at,scope:'REGION',collection_group:group,
      target_routes:codes,rows,coverage:records,unqueryable,
      failed:[],errors:[],failure:undefined,
      started_at:reports.map(r=>r.started_at).sort()[0],
      finished_at:reports.map(r=>r.finished_at).sort().at(-1),
      attempt_complete:true,complete:unqueryable.length===0,
      collection_engine:'UI_ACCESSIBLE_ONLY',
      acceleration:{
        ui_months:records.length+unqueryable.length,
        direct_months:0,direct_fallbacks:0,direct_verification_calls:0,
        direct_templates_verified:0,direct_verification_failures:0
      }
    };
    validatePublication(groupReport);
    output.set(group,groupReport);
  }
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=path.resolve(process.argv[2]||'data/outbound-shards');
  const output=path.resolve(process.argv[3]||'data/outbound-merged');
  fs.mkdirSync(output,{recursive:true});
  const reports=new Map(OUTBOUND_SHARDS.map(shard=>[shard.id,
    JSON.parse(fs.readFileSync(path.join(input,'outbound-shard-'+shard.id,'results.json'),'utf8'))]));
  const groups=mergeOutboundShards(reports);
  for(const [group,report] of groups){
    const file=path.join(output,GROUP_NAMES.indexOf(group)+'.json');
    fs.writeFileSync(file,JSON.stringify(report,null,2));
    console.log('MERGED',group,report.target_routes.length,'routes',
      report.coverage.length,'route-months',report.rows.length,'available markers');
  }
}
