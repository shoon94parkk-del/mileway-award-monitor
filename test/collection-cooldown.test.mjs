import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const preflight=path.resolve('scripts/collection-preflight.mjs');
const healthWriter=path.resolve('scripts/write-health.mjs');
const statusBuilder=path.resolve('scripts/build-public-status.mjs');
const limitedAt='2026-11-14T08:00:00.000Z';
const priorHealth={status:'degraded',last_error_step:'collection',last_error_code:'ACCESS_LIMIT',
 last_access_limit_at:limitedAt,last_error_at:limitedAt,source_updated_at:'2026년 9월 12일 23:00'};

test('actual collector preflight fails closed while cooling down and resumes after sixty minutes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-cooldown-'));
 try{
  const file=path.join(dir,'health.json'),output=path.join(dir,'github-output');
  fs.writeFileSync(file,JSON.stringify({...priorHealth,last_access_limit_at:new Date(Date.now()-30*60000).toISOString()}));
  const blocked=spawnSync(process.execPath,[preflight,file],{encoding:'utf8',env:{...process.env,GITHUB_OUTPUT:output}});
  assert.equal(blocked.status,75,blocked.stderr);
  assert.match(fs.readFileSync(output,'utf8'),/allowed=false\n/);
  fs.writeFileSync(file,JSON.stringify({...priorHealth,last_access_limit_at:new Date(Date.now()-61*60000).toISOString()}));
  const allowed=spawnSync(process.execPath,[preflight,file],{encoding:'utf8',env:{...process.env,GITHUB_OUTPUT:output}});
  assert.equal(allowed.status,0,allowed.stderr);
  const {collectionCooldown}=await import('../scripts/collection-preflight.mjs');
  assert.equal(collectionCooldown(priorHealth,new Date('2026-11-14T08:59:59.999Z')).allowed,false);
  assert.equal(collectionCooldown(priorHealth,new Date('2026-11-14T09:00:00.000Z')).allowed,true);
  assert.equal(collectionCooldown({},new Date()).allowed,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('cooldown skips and watcher-only success preserve failed health and its original access timestamp',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-cooldown-status-'));
 try{
  fs.mkdirSync(path.join(dir,'public-data'));
  const healthFile=path.join(dir,'public-data/health.json');
  fs.writeFileSync(healthFile,JSON.stringify(priorHealth));
  fs.writeFileSync(path.join(dir,'public-data/snapshot.json'),JSON.stringify({bootstrap:{report:{
   attempt_complete:true,finished_at:'2026-11-12T00:25:29.327Z',source_updated_at:'2026년 9월 12일 23:00',rows:[]
  }}}));
  for(const outcome of ['skipped','success']){
   const write=spawnSync(process.execPath,[healthWriter,healthFile],{cwd:dir,encoding:'utf8',env:{...process.env,
    INSTALL_OUTCOME:outcome,SOURCE_OUTCOME:outcome,TESTS_OUTCOME:'skipped',COLLECT_OUTCOME:'skipped',
    BUILD_OUTCOME:'skipped',PUBLISH_OUTCOME:'skipped',NOTIFY_OUTCOME:'skipped',FULL_SCAN:'false',
    TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:''}});
   assert.equal(write.status,0,write.stderr);
   const health=JSON.parse(fs.readFileSync(healthFile,'utf8'));
   assert.equal(health.status,'degraded');
   assert.equal(health.last_access_limit_at,limitedAt);
   assert.equal(health.last_error_at,limitedAt);
  }
  const build=spawnSync(process.execPath,[statusBuilder],{cwd:dir,encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const status=JSON.parse(fs.readFileSync(path.join(dir,'public-data/status.json'),'utf8'));
  assert.equal(status.error_code,'ACCESS_LIMIT');
  assert.equal(status.retry_after_at,'2026-11-14T09:00:00.000Z');
  assert.equal(status.collector_status,'failed');
  assert.equal(status.source_status,'delayed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a completed successful scan can recover without erasing the last access-limit observation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-cooldown-recovery-'));
 try{
  const healthFile=path.join(dir,'health.json');
  fs.writeFileSync(healthFile,JSON.stringify(priorHealth));
  const write=spawnSync(process.execPath,[healthWriter,healthFile],{cwd:dir,encoding:'utf8',env:{...process.env,
   INSTALL_OUTCOME:'success',SOURCE_OUTCOME:'skipped',TESTS_OUTCOME:'success',COLLECT_OUTCOME:'success',
   BUILD_OUTCOME:'success',PUBLISH_OUTCOME:'success',NOTIFY_OUTCOME:'skipped',FULL_SCAN:'true',
   TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:''}});
  assert.equal(write.status,0,write.stderr);
  const health=JSON.parse(fs.readFileSync(healthFile,'utf8'));
  assert.equal(health.status,'healthy');
  assert.equal(health.last_access_limit_at,limitedAt);
  assert.ok(health.last_successful_scan_at);
  assert.ok(health.recovered_at);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a later canary dependency, test, or non-denial collection failure retains outstanding access-limit recovery',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-canary-outstanding-limit-'));
 try{
  const healthFile=path.join(dir,'health.json');
  for(const [stage,step] of [['INSTALL','dependency_install'],['TESTS','tests'],['COLLECT','collection']]){
   fs.writeFileSync(healthFile,JSON.stringify(priorHealth));
   const write=spawnSync(process.execPath,[healthWriter,healthFile],{cwd:dir,encoding:'utf8',env:{...process.env,
    INSTALL_OUTCOME:'skipped',SOURCE_OUTCOME:'skipped',TESTS_OUTCOME:'skipped',COLLECT_OUTCOME:'skipped',
    BUILD_OUTCOME:'skipped',PUBLISH_OUTCOME:'skipped',NOTIFY_OUTCOME:'skipped',FULL_SCAN:'false',
    COLLECT_ERROR_CODE:'',COLLECT_ACCESS_LIMITED_AT:'',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:'',
    [stage+'_OUTCOME']:'failure'}});
   assert.equal(write.status,0,write.stderr);
   const health=JSON.parse(fs.readFileSync(healthFile,'utf8'));
   assert.equal(health.status,'degraded');
   assert.equal(health.last_error_step,step);
   assert.equal(health.last_error_code,'ACCESS_LIMIT');
   assert.equal(health.last_access_limit_at,limitedAt);
   assert.equal(health.source_updated_at,priorHealth.source_updated_at);
   assert.equal(health.last_successful_scan_at,undefined);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
