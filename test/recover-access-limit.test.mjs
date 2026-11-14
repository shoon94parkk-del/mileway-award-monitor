import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverAccessLimit} from '../scripts/recover-access-limit.mjs';

const now=new Date('2026-11-14T03:17:00Z');
const blockedHealth={status:'degraded',last_error_code:'ACCESS_LIMIT',last_access_limit_at:'2026-11-14T01:53:00Z'};
const env={GH_TOKEN:'test-token',GITHUB_REPOSITORY:'owner/monitor',GITHUB_WORKFLOW:'Recover access-limited collection',GITHUB_REF_NAME:'feature-branch'};
const noFetch=async()=>{throw Error('Skipped recovery must not make network requests');};

test('hourly recovery does not query or dispatch during the access-limit cooldown',async()=>{
 const result=await recoverAccessLimit({health:{...blockedHealth,last_access_limit_at:'2026-11-14T02:53:00Z'},now,env,fetchImpl:noFetch,log:()=>{}});
 assert.equal(result.dispatched,false);
 assert.equal(result.retry_after_at,'2026-11-14T03:53:00.000Z');
 assert.match(result.reason,/cooldown/i);
});

test('hourly recovery stops after collection health recovers',async()=>{
 const result=await recoverAccessLimit({health:{...blockedHealth,status:'ok'},now,env,fetchImpl:noFetch,log:()=>{}});
 assert.equal(result.dispatched,false);
});

test('hourly recovery ignores failures unrelated to a public access limit',async()=>{
 const result=await recoverAccessLimit({health:{...blockedHealth,last_error_code:'COLLECTION_FAILED'},now,env,fetchImpl:noFetch,log:()=>{}});
 assert.equal(result.dispatched,false);
});

function githubFixture(runs=[]){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  if(url.startsWith('https://raw.githubusercontent.com/owner/monitor/main/public-data/status.json?'))return new Response(JSON.stringify({collector_status:'failed',source_status:'delayed'}));
  if(url==='https://api.github.com/repos/owner/monitor/actions/workflows/collect.yml/runs?per_page=30')return new Response(JSON.stringify({workflow_runs:runs}));
  if(url==='https://api.github.com/repos/owner/monitor/actions/workflows/collect.yml/dispatches')return new Response(null,{status:204});
  throw Error('Recovery used an unexpected endpoint: '+url);
 };
 return {calls,fetchImpl};
}

test('expired access-limit recovery dispatches the existing main collector once',async()=>{
 const {calls,fetchImpl}=githubFixture();
 const result=await recoverAccessLimit({health:blockedHealth,now,env,fetchImpl,log:()=>{}});
 assert.equal(result.dispatched,true);
 const writes=calls.filter(call=>call.options.method==='POST');
 assert.equal(writes.length,1);
 assert.equal(writes[0].url,'https://api.github.com/repos/owner/monitor/actions/workflows/collect.yml/dispatches');
 assert.deepEqual(JSON.parse(writes[0].options.body),{ref:'main'});
});

test('expired access-limit recovery does not duplicate an active collector',async()=>{
 const {calls,fetchImpl}=githubFixture([{id:42,status:'in_progress',created_at:'2026-11-14T03:05:00Z'}]);
 const result=await recoverAccessLimit({health:blockedHealth,now,env,fetchImpl,log:()=>{}});
 assert.equal(result.dispatched,false);
 assert.match(result.reason,/already in_progress/);
 assert.equal(calls.filter(call=>call.options.method==='POST').length,0);
});
