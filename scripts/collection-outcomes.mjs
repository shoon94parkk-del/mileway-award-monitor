import fs from 'node:fs';
import path from 'node:path';
import {OUTBOUND_SHARDS} from './outbound-shards.mjs';

const validOutcomes=new Set(['success','failure','cancelled','skipped']);
const workerIds=new Set(OUTBOUND_SHARDS.map(worker=>worker.id));
const stages={INSTALL_OUTCOME:'install',TESTS_OUTCOME:'tests',COLLECT_OUTCOME:'collection'};
const validIso=value=>{
 const stamp=typeof value==='string'?Date.parse(value):NaN;
 return Number.isFinite(stamp)?new Date(stamp).toISOString():null;
};
const validRecord=record=>workerIds.has(record?.worker_id)&&
 Object.values(stages).every(stage=>validOutcomes.has(record[stage]));
const [command,file]=process.argv.slice(2);
if(!file)throw Error('Usage: collection-outcomes.mjs write FILE | aggregate DIRECTORY');

if(command==='write'){
 // Deliberately allowlist only nonsecret workflow facts, never the environment.
 const record={worker_id:Number(process.env.WORKER_ID)};
 for(const [variable,stage] of Object.entries(stages))record[stage]=process.env[variable]||'skipped';
 if(!validRecord(record))throw Error('Invalid worker stage outcomes');
 let result;try{result=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));}catch{}
 if(record.collection==='failure'&&result?.failure_code==='ACCESS_LIMIT'){
  record.collection_error_code='ACCESS_LIMIT';
  const at=validIso(result.access_limited_at);if(at)record.collection_access_limited_at=at;
 }
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
}else if(command==='aggregate'){
 const reports=new Map(),duplicates=new Set();
 for(const name of fs.existsSync(file)?fs.readdirSync(file):[]){
  if(!name.endsWith('.json'))continue;
  let record;try{record=JSON.parse(fs.readFileSync(path.join(file,name),'utf8'));}catch{continue;}
  if(!validRecord(record))continue;
  if(reports.has(record.worker_id))duplicates.add(record.worker_id);
  reports.set(record.worker_id,record);
 }
 for(const id of duplicates)reports.delete(id);
 const records=[...reports.values()],complete=records.length===workerIds.size;
 const outcomes={};
 for(const [variable,stage] of Object.entries(stages)){
  const measured=records.map(record=>record[stage]);
  outcomes[variable]=measured.includes('failure')?'failure':measured.includes('cancelled')?'cancelled':
   complete&&measured.every(outcome=>outcome==='success')?'success':'skipped';
 }
 // A runner may stop before it can upload evidence. Never call its tests failed
 // (or passed) from the job result; retain the overall collection failure.
 if(['failure','cancelled'].includes(process.env.SCAN_OUTCOME)&&
  !['failure','cancelled'].includes(outcomes.COLLECT_OUTCOME))outcomes.COLLECT_OUTCOME=process.env.SCAN_OUTCOME;
 const limited=records.filter(record=>record.collection==='failure'&&record.collection_error_code==='ACCESS_LIMIT');
 if(limited.length){
  outcomes.COLLECT_ERROR_CODE='ACCESS_LIMIT';
  const dates=limited.map(record=>validIso(record.collection_access_limited_at)).filter(Boolean).sort();
  if(dates.length)outcomes.COLLECT_ACCESS_LIMITED_AT=dates.at(-1);
 }
 const lines=Object.entries(outcomes).map(([key,value])=>key+'='+value).join('\n')+'\n';
 if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,lines);
 process.stdout.write(lines);
}else throw Error('Unknown collection outcome command');
