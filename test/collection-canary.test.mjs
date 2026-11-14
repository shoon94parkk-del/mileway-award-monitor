import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script=path.resolve('scripts/collection-canary.mjs');
const now=new Date('2026-11-14T16:10:00.000Z'); // November 15 in Seoul.
const report=()=>({source_type:'KOREAN_AIR_PUBLIC_DAILY',collection_engine:'UI_ACCESSIBLE_ONLY',
 start_date:'2026-11-15',end_date:'2026-11-15',target_routes:['LHR'],
 started_at:'2026-11-14T16:10:00.000Z',finished_at:'2026-11-14T16:10:20.000Z',
 attempt_complete:true,complete:true,coverage:[{destination:'LHR',month:'2026-11',days:30,engine:'UI_ACCESSIBLE'}],
 unqueryable:[],failed:[],errors:[],rows:[],acceleration:{ui_months:1,direct_months:0,direct_verification_calls:0}});
async function checkProbe(result,status,check){
 assert.ok(fs.existsSync(script),'public UI canary gate is not implemented');
 const {runPublicCanary}=await import('../scripts/collection-canary.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-canary-'));
 try{
  const output=path.join(dir,'canary');fs.mkdirSync(output);
  // A stale successful report must never authorize a failed new invocation.
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report()));
  let invocation;
  const gate=runPublicCanary({now,output,runCollector:(args,env)=>{
   assert.equal(fs.existsSync(path.join(output,'results.json')),false);
   invocation={args,env};
   if(result)fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result));
   return {status};
  }});
  check(gate,invocation,output);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('public canary checks only ICN to LHR for today in Seoul through the existing UI extractor',async()=>{
 await checkProbe(report(),0,(gate,{args,env},output)=>{
  assert.deepEqual(gate,{allowed:true,exitCode:0});
  assert.deepEqual(args,['--no-warnings',path.resolve('src/public-extract.mjs'),
   '--route','LHR','--start','2026-11-15','--end','2026-11-15',
   '--output',output,'--interval-ms','3000','--max-retries','1']);
  assert.equal(env.MILEWAY_DIRECT_API,'0');
 });
});

test('an official UI UNQUERYABLE result proves access without claiming available or unavailable seats',async()=>{
 const result=report();result.complete=false;result.coverage=[];
 result.unqueryable=[{destination:'LHR',month:'2026-11',status:'UNQUERYABLE',engine:'UI_ACCESSIBLE'}];
 await checkProbe(result,0,gate=>assert.deepEqual(gate,{allowed:true,exitCode:0}));
});

test('a denied or failed canary permits zero matrix workers even when a success report exists',async()=>{
 for(const [result,status] of [[{...report(),failure_code:'ACCESS_LIMIT'},75],[report(),1],[null,null]]){
  await checkProbe(result,status,gate=>{
   assert.equal(gate.allowed,false);
   assert.notEqual(gate.exitCode,0);
  });
 }
});

test('exit zero without completed exact route and month UI evidence cannot permit matrix workers',async()=>{
 for(const change of [
  {attempt_complete:false},{target_routes:['LHR','CDG']},{start_date:'2026-11-14'},
  {end_date:'2026-12-15'},{coverage:[]},{coverage:[{destination:'LHR',month:'2026-12',engine:'UI_ACCESSIBLE'}]},
  {coverage:[{destination:'CDG',month:'2026-11',engine:'UI_ACCESSIBLE'}]},
  {collection_engine:'HYBRID_DIRECT_VERIFIED'},{acceleration:{ui_months:1,direct_months:1}},
  {failed:[{destination:'LHR'}]},{errors:[{message:'incomplete'}]},{failure:'incomplete'},
  {finished_at:null}
 ])await checkProbe({...report(),...change},0,gate=>assert.equal(gate.allowed,false,JSON.stringify(change)));
});

test('both workflow matrices require a successful allowed canary and share a noncancelling browser budget',()=>{
 const configs=['collect.yml','collect-europe-returns.yml'].map(name=>fs.readFileSync('.github/workflows/'+name,'utf8'));
 for(const workflow of configs){
  const group=workflow.match(/^concurrency:\n  group: (.+)\n  cancel-in-progress: (.+)$/m);
  assert.ok(group,'workflow must serialize all public browser collection');
  assert.equal(group[1],'public-daily-collection');assert.equal(group[2],'false');
  const canary=workflow.split('\n  canary:\n')[1]?.split('\n  scan:\n')[0];
  assert.ok(canary,'cooldown expiry must run a single canary before the matrix');
  assert.match(canary,/runs-on: windows-latest/);
  assert.match(canary,/needs: preflight/);
  assert.match(canary,/needs\.preflight\.outputs\.allowed == 'true'/);
  assert.match(canary,/allowed: \$\{\{ steps\.probe\.outputs\.allowed \}\}/);
  assert.match(canary,/node scripts\/collection-canary\.mjs/);
  const scan=workflow.split('\n  scan:\n')[1].split('\n  publish:\n')[0];
  assert.match(scan,/needs: \[preflight, canary\]/);
  assert.match(scan,/needs\.canary\.result == 'success'/);
  assert.match(scan,/needs\.canary\.outputs\.allowed == 'true'/);
  assert.match(scan,/max-parallel: 5/);
  const publish=workflow.split('\n  publish:\n')[1];
  assert.doesNotMatch(publish,/pattern: .*canary/,'canary reports cannot enter a publication merge');
 }
});

test('return-side denied canary publishes shared cooldown health without claiming scan recovery',()=>{
 const workflow=fs.readFileSync('.github/workflows/collect-europe-returns.yml','utf8');
 const status=workflow.split('\n  status:\n')[1];
 assert.ok(status,'return denials must reach shared health even when the matrix is skipped');
 assert.match(status,/needs: \[preflight, canary, scan, publish\]/);
 assert.match(status,/if: always\(\)/);
 assert.match(status,/pattern: return-outcome-\*/);
 assert.match(status,/CANARY_OUTCOME: \$\{\{ needs\.canary\.result \}\}/);
 assert.equal((status.match(/if: env\.COLLECT_ERROR_CODE == 'ACCESS_LIMIT'/g)||[]).length,2);
 assert.match(status,/FULL_SCAN: 'false'/);
 for(const stage of ['SOURCE','PUBLISH','BUILD','NOTIFY'])assert.match(status,new RegExp(stage+'_OUTCOME: skipped'));
 assert.match(status,/scripts\/write-health\.mjs public-data\/health\.json/);
 assert.match(status,/git add public-data\/health\.json public-data\/status\.json/);
 assert.doesNotMatch(status,/git add .*returns\.json/);
});
