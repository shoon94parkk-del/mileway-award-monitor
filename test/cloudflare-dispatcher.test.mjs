import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker,{dispatchFromCloudflare,skipReason} from '../worker/src/index.mjs';

const cycle={cycle_id:'2026-09-14T23:00:00+09:00',cycle_start_utc:'2026-09-14T14:00:00.000Z'};

test('Cloudflare dispatch crons are removed after owner-PC migration',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../worker/wrangler.jsonc',import.meta.url),'utf8'));
 assert.deepEqual(config.triggers.crons,[]);
});

test('Cloudflare scheduled events no longer launch any dispatch',async()=>{
 const context={waitUntil(){throw Error('Retired worker should never schedule GitHub requests')}};
 const output=[],original=console.log;console.log=(...args)=>output.push(args.join(' '));
 try{await worker.scheduled({}, {GITHUB_ACTIONS_TOKEN:'unused'},context)}finally{console.log=original}
 assert.match(output[0],/disabled/);
});

test('Cloudflare recovery trigger skips an active or successful cycle',()=>{
 assert.match(skipReason({cycle,status:{cycle_id:cycle.cycle_id,collector_status:'succeeded',source_status:'current'},runs:[]}),/published/);
 assert.match(skipReason({cycle,status:null,runs:[{id:7,status:'in_progress',created_at:'2026-09-14T14:01:00Z'}]}),/in_progress/);
});

test('Cloudflare trigger dispatches the current cycle once when idle',async()=>{
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  if(url.includes('status.json'))return new Response(JSON.stringify({cycle_id:'old'}));
  if(url.includes('/runs?'))return new Response(JSON.stringify({workflow_runs:[]}));
  if(url.endsWith('/dispatches'))return new Response(null,{status:204});
  throw Error(`Unexpected URL ${url}`);
 };
 const result=await dispatchFromCloudflare({
  env:{GITHUB_ACTIONS_TOKEN:'secret'},
  now:new Date('2026-09-14T14:00:00Z'),
  fetchImpl,
  log:()=>{}
 });
 assert.equal(result.dispatched,true);
 const dispatch=calls.find(call=>call.url.endsWith('/dispatches'));
 assert.deepEqual(JSON.parse(dispatch.options.body),{ref:'main'});
 assert.equal(dispatch.options.headers.Authorization,'Bearer secret');
});

test('Cloudflare trigger requires its secret',async()=>{
 await assert.rejects(()=>dispatchFromCloudflare({env:{},log:()=>{}}),/GITHUB_ACTIONS_TOKEN/);
});

test('Cloudflare worker exposes a lightweight health endpoint',async()=>{
 const response=await worker.fetch();
 assert.equal(response.status,200);
 assert.equal(await response.text(),'Mileway legacy dispatcher retired. Airline collection runs on the owner PC.');
});
