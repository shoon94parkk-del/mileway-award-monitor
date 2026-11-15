import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=name=>fs.readFileSync('.github/workflows/'+name,'utf8');
const triggers=name=>{
 const src=workflow(name);
 const begin=src.indexOf('on:\n'),end=src.indexOf('permissions:\n',begin);
 assert.ok(begin>=0&&end>begin,'workflow has valid triggers: '+name);
 return src.slice(begin,end);
};
const sourceJobs=[
 'collect.yml','collect-europe-returns.yml','source-watch.yml',
 'force-2305.yml','recover-access-limit.yml',
 'diagnose-timezone.yml','direct-daily-api-probe.yml','direct-hybrid-smoke.yml',
 'guest-realtime-probe.yml','probe-standard-chrome.yml'
];

test('all GitHub-hosted airline access jobs are manual only and cannot be scheduled or pushed automatically',()=>{
 for(const name of sourceJobs){
  const section=triggers(name);
  assert.match(section,/^  workflow_dispatch:\s*$/m,name+' must still permit deliberate one-off debugging');
  assert.doesNotMatch(section,/^  (schedule|push|workflow_run|repository_dispatch):/m,name+' must not auto-query airline');
 }
});
test('Telegram sync and public status still receive scheduled updates',()=>{
 for(const name of ['telegram-sync.yml','status.yml']){
  const section=triggers(name);
  assert.match(section,/^  schedule:\s*$/m,name+' must retain schedule');
  assert.match(section,/cron:/,name+' must retain valid cron');
 }
});
test('GitHub-hosted collection can still be manually tested and site rebuild remains supported',()=>{
 const collector=workflow('collect.yml');
 assert.match(collector,/  workflow_dispatch:\n/);
 assert.match(collector,/needs\.canary\.outputs\.allowed == 'true'/);
 const local=fs.readFileSync('scripts/run-owned-windows-collector.mjs','utf8');
 assert.match(local,/KOREAN_AIR_PUBLIC_DAILY/);
 assert.match(local,/scripts\/collection-canary\.mjs/);
 assert.match(local,/scripts\/merge-europe-return-shards\.mjs/);
});

test('external legacy Cloudflare dispatch gets an explicitly named no-op, never source query or health publication',()=>{
 const collector=workflow('collect.yml');
 assert.match(collector,/ignore-external:/);
 assert.ok(collector.includes('if: inputs.retry_now != true'));
 assert.ok(collector.includes('if: inputs.retry_now == true'));
 assert.ok(collector.includes('if: always() && inputs.retry_now == true'));
 assert.ok(collector.includes('Ignored external dispatch'));
 const config=JSON.parse(fs.readFileSync('worker/wrangler.jsonc','utf8'));
 assert.deepEqual(config.triggers.crons,[]);
 const worker=fs.readFileSync('worker/src/index.mjs','utf8');
 assert.ok(worker.includes('Mileway remote collection dispatcher disabled'));
});
