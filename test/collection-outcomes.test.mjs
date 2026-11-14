import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script=path.resolve('scripts/collection-outcomes.mjs');
const healthScript=path.resolve('scripts/write-health.mjs');
const worker=(id,overrides={})=>({worker_id:id,install:'success',tests:'success',collection:'success',...overrides});
function withReports(records,scanOutcome,check){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-outcomes-'));
 try{
  const reports=path.join(dir,'reports');fs.mkdirSync(reports);
  for(const [index,record] of records.entries())fs.writeFileSync(path.join(reports,index+'.json'),JSON.stringify(record));
  const envFile=path.join(dir,'github-env');
  const run=spawnSync(process.execPath,[script,'aggregate',reports],{
   cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_ENV:envFile,SCAN_OUTCOME:scanOutcome}
  });
  assert.equal(run.status,0,run.stderr);
  const outcomes=Object.fromEntries(fs.readFileSync(envFile,'utf8').trim().split('\n').map(line=>line.split('=')));
  const healthFile=path.join(dir,'health.json');
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
