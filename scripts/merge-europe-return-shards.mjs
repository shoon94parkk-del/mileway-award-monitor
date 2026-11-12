import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RETURN_SHARDS,assertReturnShards} from './europe-return-shards.mjs';
import {getReturnOrigins,checkReturnReport} from '../src/europe-returns.mjs';
import {monthRange} from '../src/public-calendar.mjs';

export function mergeReturnShards(parts,expectedOrigins){
 const expected=new Set(assertReturnShards());
 const all=new Set(getReturnOrigins(expectedOrigins).map(o=>o.code));
 if(all.size!==expected.size||[...all].some(code=>!expected.has(code)))
   throw Error('Europe return shard assignments differ from the currently published route scope');
 const reports=RETURN_SHARDS.map(shard=>{
   const report=parts.get(shard.id);
   if(!report||report.attempt_complete!==true||report.failed?.length||report.failure)
     throw Error('Unfinished return runner '+shard.id);
   const codes=report.origins?.map(route=>route.code)||[];
   if(codes.length!==shard.codes.length||shard.codes.some(c=>!codes.includes(c)))
     throw Error('Return runner '+shard.id+' does not match route assignment');
   checkReturnReport(report);
   return report;
 });
 const first=reports[0],source=first.source_updated_at;
 for(const report of reports){
   if(report.source_updated_at!==source||report.start_date!==first.start_date||report.end_date!==first.end_date)
     throw Error('Return runners used different source dates or travel windows');
 }
 const combined={...first,
   origins:reports.flatMap(r=>r.origins),
   rows:reports.flatMap(r=>r.rows),
   coverage:reports.flatMap(r=>r.coverage),
   unqueryable:reports.flatMap(r=>r.unqueryable),
   failed:[],failure:undefined,
   started_at:reports.map(r=>r.started_at).sort()[0],
   finished_at:reports.map(r=>r.finished_at).sort().at(-1),
   attempt_complete:true,
   complete:reports.every(r=>r.complete)&&reports.every(r=>r.unqueryable.length===0),
   collection_engine:'UI_ACCESSIBLE_5_RUNNERS',
   acceleration:{ui_months:reports.reduce((n,r)=>n+(r.acceleration?.ui_months||0),0)}
 };
 checkReturnReport(combined);
 const expectedCount=all.size*monthRange(first.start_date,first.end_date).length;
 if(combined.coverage.length+combined.unqueryable.length!==expectedCount)
   throw Error('Return route/month coverage missing');
 return combined;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=path.resolve(process.argv[2]||'data/return-parts');
 const destination=path.resolve(process.argv[3]||'data/returns-europe.json');
 const snapshot=JSON.parse(fs.readFileSync('public-data/snapshot.json','utf8'));
 const reports=new Map(RETURN_SHARDS.map(shard=>[shard.id,
    JSON.parse(fs.readFileSync(path.join(input,'return-shard-'+shard.id,'returns-europe.json'),'utf8'))]));
 const merged=mergeReturnShards(reports,snapshot.bootstrap?.routes||[]);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,JSON.stringify(merged,null,2)+'\n');
 console.log('RETURN SHARDS MERGED',merged.origins.length,'origins',
  merged.coverage.length,'verified route-months',merged.unqueryable.length,
  'unqueryable route-months',merged.rows.length,'available award date/class markers');
}
