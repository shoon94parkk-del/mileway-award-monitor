import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCollection,shouldSkipDispatch} from '../scripts/dispatch-collection.mjs';

const cycle={cycle_id:'2026-09-14T23:00:00+09:00',cycle_start_utc:'2026-09-14T14:00:00.000Z'};

test('dispatcher skips a fresh successful current cycle',()=>{
 assert.match(shouldSkipDispatch({cycle,status:{cycle_id:cycle.cycle_id,collector_status:'succeeded',source_status:'current'},runs:[]}),/fresh successful/);
});

test('dispatcher skips an active or successful same-cycle collector',()=>{
 assert.match(shouldSkipDispatch({cycle,status:null,runs:[{id:1,status:'queued',created_at:'2026-09-14T14:01:00Z'}]}),/queued/);
 assert.match(shouldSkipDispatch({cycle,status:null,runs:[{id:2,status:'completed',conclusion:'success',created_at:'2026-09-14T15:01:00Z'}]}),/succeeded/);
 assert.equal(shouldSkipDispatch({cycle,status:null,runs:[{id:3,status:'completed',conclusion:'failure',created_at:'2026-09-14T15:01:00Z'}]}),'');
});

test('dispatcher waits for 23:00 KST and sends one workflow dispatch',async()=>{
 const calls=[];
 const waits=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  if(url.includes('status.json'))return new Response(JSON.stringify({cycle_id:'old'}));
  if(url.includes('/runs?'))return new Response(JSON.stringify({workflow_runs:[]}));
  if(url.endsWith('/dispatches'))return new Response(null,{status:204});
  throw Error(`Unexpected URL ${url}`);
 };
 const result=await dispatchCollection({
  now:new Date('2026-09-14T13:55:00Z'),
  env:{GITHUB_ACTIONS_TOKEN:'test-token'},
  fetchImpl,
  wait:async ms=>waits.push(ms),
  log:()=>{}
 });
 assert.equal(result.dispatched,true);
 assert.deepEqual(waits,[300000]);
 const dispatch=calls.find(call=>call.url.endsWith('/dispatches'));
 assert.deepEqual(JSON.parse(dispatch.options.body),{ref:'main'});
 assert.equal(dispatch.options.headers.Authorization,'Bearer test-token');
});

test('dispatcher fails clearly when the Render secret is missing',async()=>{
 await assert.rejects(()=>dispatchCollection({env:{},log:()=>{}}),/GITHUB_ACTIONS_TOKEN is required/);
});
