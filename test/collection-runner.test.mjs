import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createCollectionRunner,nextDailyRun} from '../src/collection-runner.mjs';

test('daily Korean time rolls forward across dates',()=>{
 assert.equal(nextDailyRun('09:10',new Date('2026-09-10T00:00:00Z')),'2026-09-10T00:10:00.000Z');
 assert.equal(nextDailyRun('09:10',new Date('2026-09-10T00:10:00Z')),'2026-09-11T00:10:00.000Z');
 assert.throws(()=>nextDailyRun('25:00'));
});
test('runner spawns monthly collector, blocks duplicate, stops cooperatively and persists history',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-runner-'));
 let args,child;const runner=createCollectionRunner(dir,{stateDirectory:dir,spawnProcess:(exe,a)=>{args=a;child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();return child;}});
 try{
  runner.configure({enabled:true,time:'09:10'});assert.ok(runner.status().next_run);
  runner.start();assert.ok(args.includes('--resume'));assert.ok(args.includes('--stop-file'));assert.equal(runner.status().running,true);
  assert.throws(()=>runner.start());child.stdout.emit('data',Buffer.from('CDG month complete\n'));
  runner.stop();assert.equal(fs.existsSync(path.join(dir,'collection.stop')),true);
  child.emit('exit',1);assert.equal(runner.status().history[0].status,'stopped');assert.equal(runner.status().running,false);
  runner.start();assert.equal(fs.existsSync(path.join(dir,'collection.stop')),false);child.emit('exit',0);
  assert.equal(runner.status().history[0].status,'completed');
 }finally{runner.close();fs.rmSync(dir,{recursive:true});}
});
