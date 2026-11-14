import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script=path.resolve('scripts/collection-outcomes.mjs');
const healthScript=path.resolve('scripts/write-health.mjs');
const worker=(id,overrides={})=>({worker_id:id,install:'success',tests:'success',collection:'success',...overrides});
function withReports(records,scanOutcome,check,canaryOutcome='skipped',priorHealth){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-outcomes-'));
 try{
  const reports=path.join(dir,'reports');fs.mkdirSync(reports);
  for(const [index,record] of records.entries())fs.writeFileSync(path.join(reports,index+'.json'),JSON.stringify(record));
  const envFile=path.join(dir,'github-env');
  const run=spawnSync(process.execPath,[script,'aggregate',reports],{
   cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_ENV:envFile,SCAN_OUTCOME:scanOutcome,CANARY_OUTCOME:canaryOutcome}
  });
  assert.equal(run.status,0,run.stderr);
  const outcomes=Object.fromEntries(fs.readFileSync(envFile,'utf8').trim().split('\n').map(line=>line.split('=')));
  const healthFile=path.join(dir,'health.json');
  if(priorHealth)fs.writeFileSync(healthFile,JSON.stringify(priorHealth));
  const healthRun=spawnSync(process.execPath,[healthScript,healthFile],{
   cwd:dir,encoding:'utf8',env:{...process.env,...outcomes,BUILD_OUTCOME:'skipped',
    PUBLISH_OUTCOME:'skipped',SOURCE_OUTCOME:'skipped',NOTIFY_OUTCOME:'skipped',
    TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:''}
  });
  assert.equal(healthRun.status,0,healthRun.stderr);
  check(outcomes,JSON.parse(fs.readFileSync(healthFile,'utf8')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('a browser scrape failure after passing preflight is reported as collection, not tests',()=>{
 withReports([worker(0),worker(1),worker(2,{collection:'failure'}),worker(3),worker(4)],'failure',(outcomes,health)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'failure'});
  assert.equal(health.status,'degraded');
  assert.equal(health.last_error_step,'collection');
 });
});

test('an actual preflight failure remains a tests error',()=>{
 withReports([worker(0),worker(1,{tests:'failure',collection:'skipped'}),worker(2),worker(3),worker(4)],'failure',(_,health)=>{
  assert.equal(health.last_error_step,'tests');
 });
});

test('missing worker evidence never invents successful install or tests',()=>{
 for(const outcome of ['failure','cancelled'])withReports([worker(0),worker(1),worker(2),worker(3)],outcome,(outcomes,health)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'skipped',TESTS_OUTCOME:'skipped',COLLECT_OUTCOME:outcome});
  assert.equal(health.last_error_step,'collection');
 });
});

test('successful evidence from every worker reports all measured stages successful',()=>{
 withReports([worker(0),worker(1),worker(2),worker(3),worker(4)],'success',(outcomes,health)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'success'});
  assert.equal(health.status,'healthy');
  assert.equal(health.last_notification_check_at,undefined);
 });
});

test('outcome artifact writer includes only worker id and measured stage outcomes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-outcome-write-'));
 try{
  const file=path.join(dir,'runner-3.json');
  const run=spawnSync(process.execPath,[script,'write',file],{encoding:'utf8',env:{...process.env,
   WORKER_ID:'3',INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'failure',
   TELEGRAM_BOT_TOKEN:'must-never-be-in-artifact',GITHUB_TOKEN:'also-private'}});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{
   worker_id:3,install:'success',tests:'success',collection:'failure'
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('only an allowlisted report failure code reaches the outcome artifact',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-outcome-code-'));
 try{
  const report=path.join(dir,'results.json'),file=path.join(dir,'runner-0.json');
  for(const code of ['ACCESS_LIMIT','private-value\nINJECTED=success']){
   fs.writeFileSync(report,JSON.stringify({failure_code:code,access_limited_at:'2026-11-14T08:00:00.000Z',secret:'not-allowed'}));
   const run=spawnSync(process.execPath,[script,'write',file,report],{encoding:'utf8',env:{...process.env,
    WORKER_ID:'0',INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'failure',
    COLLECT_ERROR_CODE:'untrusted-env'}});
   assert.equal(run.status,0,run.stderr);
   const record=JSON.parse(fs.readFileSync(file,'utf8'));
   assert.equal(record.collection_error_code,code==='ACCESS_LIMIT'?'ACCESS_LIMIT':undefined);
   assert.equal(record.collection_access_limited_at,code==='ACCESS_LIMIT'?'2026-11-14T08:00:00.000Z':undefined);
   assert.equal(record.secret,undefined);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('measured ACCESS_LIMIT is retained by health as a collection failure',()=>{
 withReports([worker(0,{collection:'failure',collection_error_code:'ACCESS_LIMIT',
  collection_access_limited_at:'2026-11-14T08:00:00.000Z'}),worker(1),worker(2),worker(3),worker(4)],'failure',(outcomes,health)=>{
  assert.equal(outcomes.COLLECT_ERROR_CODE,'ACCESS_LIMIT');
  assert.equal(health.status,'degraded');
  assert.equal(health.last_error_step,'collection');
  assert.equal(health.last_error_code,'ACCESS_LIMIT');
  assert.equal(health.last_access_limit_at,'2026-11-14T08:00:00.000Z');
 });
});

test('a different worker test failure cannot hide a measured collection access limit',()=>{
 withReports([worker(0,{tests:'failure',collection:'skipped'}),worker(1,{collection:'failure',
  collection_error_code:'ACCESS_LIMIT',collection_access_limited_at:'2026-11-14T08:00:00.000Z'}),
  worker(2),worker(3),worker(4)],'failure',(_,health)=>{
  assert.equal(health.last_error_step,'tests');
  assert.equal(health.last_error_code,'ACCESS_LIMIT');
  assert.equal(health.last_access_limit_at,'2026-11-14T08:00:00.000Z');
 });
});

test('a denied canary records ACCESS_LIMIT with zero scan workers and keeps shared source freshness unchanged',()=>{
 withReports([{kind:'canary',install:'success',tests:'success',collection:'failure',
  collection_error_code:'ACCESS_LIMIT',collection_access_limited_at:'2026-11-14T08:00:00.000Z'}],
 'skipped',(outcomes,health)=>{
  assert.equal(outcomes.COLLECT_OUTCOME,'failure');
  assert.equal(outcomes.COLLECT_ERROR_CODE,'ACCESS_LIMIT');
  assert.equal(health.status,'degraded');
  assert.equal(health.last_error_step,'collection');
  assert.equal(health.last_access_limit_at,'2026-11-14T08:00:00.000Z');
  assert.equal(health.last_successful_scan_at,'2026-11-12T00:25:29.327Z');
  assert.equal(health.source_updated_at,'2026년 9월 12일 23:00');
 },'failure',{status:'healthy',source_updated_at:'2026년 9월 12일 23:00',last_successful_scan_at:'2026-11-12T00:25:29.327Z'});
});

test('canary dependency or test failures keep collection skipped and cannot claim a passed search',()=>{
 for(const stages of [{install:'failure',tests:'skipped',collection:'skipped'},
  {install:'success',tests:'failure',collection:'skipped'}]){
  withReports([{kind:'canary',...stages}],'skipped',(outcomes,health)=>{
   assert.equal(outcomes.INSTALL_OUTCOME,stages.install);
   assert.equal(outcomes.TESTS_OUTCOME,stages.tests);
   assert.equal(outcomes.COLLECT_OUTCOME,'skipped');
   assert.equal(health.status,'degraded');
   assert.equal(health.last_successful_scan_at,undefined);
  },'failure');
 }
});

test('missing failed canary evidence keeps dependency and tests unproven while retaining gate failure',()=>{
 withReports([],'skipped',(outcomes,health)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'skipped',TESTS_OUTCOME:'skipped',COLLECT_OUTCOME:'failure'});
  assert.equal(health.status,'degraded');
 },'failure');
});

test('a successful canary cannot stand in for worker zero or a completed five-worker search',()=>{
 const canary={kind:'canary',install:'success',tests:'success',collection:'success'};
 withReports([canary],'skipped',(outcomes,health)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'skipped',TESTS_OUTCOME:'skipped',COLLECT_OUTCOME:'skipped'});
  assert.equal(health.last_successful_scan_at,undefined);
 },'success');
 withReports([canary,worker(0),worker(1),worker(2),worker(3),worker(4)],'success',(outcomes)=>{
  assert.deepEqual(outcomes,{INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'success'});
 },'success');
});

test('canary artifact has a separate allowlisted identity and preserves observed access denial',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-canary-outcome-'));
 try{
  const result=path.join(dir,'result.json'),file=path.join(dir,'canary.json');
  fs.writeFileSync(result,JSON.stringify({failure_code:'ACCESS_LIMIT',access_limited_at:'2026-11-14T08:00:00.000Z'}));
  const run=spawnSync(process.execPath,[script,'write-canary',file,result],{encoding:'utf8',env:{...process.env,
   INSTALL_OUTCOME:'success',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'failure',WORKER_ID:'0',GITHUB_TOKEN:'private'}});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{kind:'canary',install:'success',tests:'success',collection:'failure',
   collection_error_code:'ACCESS_LIMIT',collection_access_limited_at:'2026-11-14T08:00:00.000Z'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
