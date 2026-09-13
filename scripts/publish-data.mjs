import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validatePublication,confidentlyAbsent} from '../src/publication-validation.mjs';
import {mergeCompletedRegion} from '../src/regional-publication.mjs';
const input=process.argv[2]||'data/public/results.json';
const incoming=JSON.parse(fs.readFileSync(input,'utf8'));
validatePublication(incoming);
const oldReport=fs.existsSync('public-data/results.json.gz')?JSON.parse(gunzipSync(fs.readFileSync('public-data/results.json.gz')).toString('utf8')):null;
const report=incoming.scope==='REGION'?mergeCompletedRegion(oldReport,incoming):incoming;
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const safe=pick(report,['source','source_type','source_updated_at','start_date','end_date','started_at','finished_at','complete','attempt_complete','target_routes','scope','discovery','region_status','mixed_sources','worldwide_complete','publication_id']);
safe.routes=report.routes.map(r=>pick(r,['code','region','label','city','country']));
safe.coverage=report.coverage.map(r=>pick(r,['destination','month','days','flightClassRows','source_updated_at']));
safe.unqueryable=(report.unqueryable||[]).map(r=>pick(r,['destination','month','status','reason','checked_at']));
safe.rows=report.rows.map(r=>pick(r,['date','origin','destination','flight','departureTime','aircraft','cabin','fareClass','available','region','sourceUpdatedAt','checkedAt','availabilityType']));
fs.mkdirSync('public-data',{recursive:true});
const key=r=>createHash('sha256').update([r.destination,r.date,r.flight,r.cabin].join('|')).digest('hex').slice(0,24);
const previousSnapshot=(()=>{try{return JSON.parse(fs.readFileSync('public-data/snapshot.json','utf8'));}catch{return null;}})();
const previousRows=Array.isArray(previousSnapshot?.rows)?previousSnapshot.rows:[];
const previousCoverage=new Set((previousSnapshot?.bootstrap?.report?.coverage||[]).map(c=>`${c.destination}|${c.month}`));
const newAvailable=safe.rows.filter(r=>r.available===true),oldMap=new Map(previousRows.filter(r=>r.available!==false&&r.available!==0).map(r=>[key(r),r])),newMap=new Map(newAvailable.map(r=>[key(r),r]));
const historyPath='public-data/changes.json',oldHistory=(()=>{try{return JSON.parse(fs.readFileSync(historyPath,'utf8'));}catch{return {version:1,events:[]};}})();
let events=Array.isArray(oldHistory.events)?oldHistory.events:[];
if(previousSnapshot?.bootstrap?.report?.source_updated_at&&(previousSnapshot.bootstrap.report.source_updated_at!==safe.source_updated_at||incoming.scope==='REGION')){
 const detectedAt=new Date().toISOString();
 for(const [id,row] of newMap){const baseline=`${row.destination}|${row.date.slice(0,7)}`;if(!oldMap.has(id)&&previousCoverage.has(baseline))events.unshift({id,kind:'OPENED',destination:row.destination,date:row.date,flight:row.flight,time:row.departureTime||'',cabin:row.cabin,source_updated_at:safe.source_updated_at,detected_at:detectedAt});}
 for(const [id,row] of oldMap)if(!newMap.has(id)&&confidentlyAbsent(row,incoming))events.unshift({id,kind:'CLOSED',destination:row.destination,date:row.date,flight:row.flight,time:row.time||row.departureTime||'',cabin:row.cabin,source_updated_at:safe.source_updated_at,detected_at:detectedAt});
}
const now=Date.now(),historyCutoff=now-180*864e5,recentCutoff=now-7*864e5;
events=events.filter(e=>Date.parse(e.detected_at)>=historyCutoff);
const recent=events.filter(e=>Date.parse(e.detected_at)>=recentCutoff);
const older=events.filter(e=>Date.parse(e.detected_at)<recentCutoff).slice(0,Math.max(0,2000-recent.length));
events=[...recent,...older];
const baselineResetAt=oldHistory.baseline_reset_at||null;
fs.writeFileSync(historyPath,JSON.stringify({version:1,source_updated_at:safe.source_updated_at,...(baselineResetAt?{baseline_reset_at:baselineResetAt}:{}),events},null,2)+'\n');
fs.writeFileSync(path.join('public-data','results.json.gz'),gzipSync(JSON.stringify(safe)));
console.log(`Published ${safe.rows.length} observations; retained ${events.length} change events (${recent.length} within 7 days); ${safe.rows.filter(r=>r.aircraft).length} rows include aircraft metadata.`);
