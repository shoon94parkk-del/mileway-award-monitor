import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const extractor=fileURLToPath(new URL('../src/public-extract.mjs',import.meta.url));
const uiEngines=new Set(['UI','UI_ACCESSIBLE']);

export function runPublicCanary({now=new Date(),output='data/public-canary',
 runCollector=(args,env)=>spawnSync(process.execPath,args,{stdio:'inherit',env})}={}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 output=path.resolve(output);
 const file=path.join(output,'results.json');
 fs.mkdirSync(output,{recursive:true});
 // A previous probe, including a successful one, cannot authorize this run.
 fs.rmSync(file,{force:true});
 const args=['--no-warnings',extractor,'--route','LHR','--start',today,'--end',today,
  '--output',output,'--interval-ms','3000','--max-retries','1'];
 const run=runCollector(args,{...process.env,MILEWAY_DIRECT_API:'0'});
 let report;try{report=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 const coverage=report?.coverage,unknown=report?.unqueryable;
 const entries=Array.isArray(coverage)&&Array.isArray(unknown)?[...coverage,...unknown]:[];
 const started=Date.parse(report?.started_at||''),finished=Date.parse(report?.finished_at||'');
 const allowed=run.status===0&&report?.source_type==='KOREAN_AIR_PUBLIC_DAILY'&&
  ['UI','UI_ACCESSIBLE_ONLY'].includes(report.collection_engine)&&
  report.start_date===today&&report.end_date===today&&
  report.target_routes?.length===1&&report.target_routes[0]==='LHR'&&
  report.attempt_complete===true&&entries.length===1&&
  entries[0].destination==='LHR'&&entries[0].month===today.slice(0,7)&&uiEngines.has(entries[0].engine)&&
  (coverage.length===1&&report.complete===true||unknown.length===1&&report.complete===false&&unknown[0].status==='UNQUERYABLE')&&
  Array.isArray(report.failed)&&report.failed.length===0&&Array.isArray(report.errors)&&report.errors.length===0&&
  !report.failure&&!report.failure_code&&report.acceleration?.ui_months===1&&
  report.acceleration.direct_months===0&&report.acceleration.direct_verification_calls===0&&
  started>=now.getTime()&&finished>=started;
 return {allowed:!!allowed,exitCode:allowed?0:(Number.isInteger(run.status)&&run.status!==0?run.status:1)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=runPublicCanary();
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'allowed='+result.allowed+'\n');
 console.log(result.allowed?'Public UI canary completed; matrix collection may start.':'Public UI canary failed; no matrix browsers will launch.');
 process.exitCode=result.exitCode;
}
