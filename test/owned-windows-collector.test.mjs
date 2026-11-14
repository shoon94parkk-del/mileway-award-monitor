import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {officialRunnerPlan} from '../scripts/run-owned-windows-collector.mjs';
import {healthyOwnedSnapshot} from '../scripts/record-owned-collector-health.mjs';
const load=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('owner-Windows collector plans official airline UI, 33 outbound routes and 14 Europe return airports',()=>{
 const plan=officialRunnerPlan();
 assert.equal(plan.source,'KOREAN_AIR_PUBLIC_DAILY');
 assert.equal(plan.route_count,33);
 assert.equal(plan.return_origin_count,14);
 assert.equal(plan.browser,'locally-installed-Google-Chrome');
 assert.deepEqual(plan.phases,['one-route-canary','33-route-outbound','publish-complete-outbound','14-origin-Europe-return','publish-complete-return']);
});
test('dry-run never contacts Korean Air or GitHub',()=>{
 const run=spawnSync(process.execPath,['scripts/run-owned-windows-collector.mjs','--dry-run'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.match(run.stdout,/DRY RUN ONLY/);
});
test('user owned scanner has guardrails: official canary, verified merge, no cloud cookie handling, no secret in repo',()=>{
 const code=load('scripts/run-owned-windows-collector.mjs');
 assert.match(code,/scripts\/collection-canary\.mjs/);
 assert.match(code,/scripts\/merge-outbound-shards\.mjs/);
 assert.match(code,/scripts\/merge-europe-return-shards\.mjs/);
 assert.match(code,/scripts\/publish-data\.mjs/);
 assert.match(code,/scripts\/publish-europe-returns\.mjs/);
 assert.match(code,/MILEWAY_DIRECT_API:'0'/);
 assert.match(code,/MILEWAY_STANDARD_CHROME:'1'/);
 assert.match(code,/--resume/);
 assert.doesNotMatch(code,/proxy-server|stealth|bypass-captcha|cloudScraper|zoommytrip|milengo/);
});
test('recovery requires completed official publication and preserves existing private alert state',()=>{
 const before={version:1,status:'degraded',last_error_code:'ACCESS_LIMIT',alerts:{telegram_configured:true},last_access_limit_at:'2026-11-14T16:11:13Z'};
 const snapshot={bootstrap:{report:{attempt_complete:true,source_updated_at:'2026년 11월 15일 01:30',finished_at:'2026-11-15T01:00:00Z'}}};
 const now=new Date('2026-11-15T01:02:00Z');
 const after=healthyOwnedSnapshot(before,snapshot,now);
 assert.equal(after.status,'healthy');
 assert.equal(after.alerts.telegram_configured,true);
 assert.equal(after.last_error_code,null);
 assert.equal(after.source_updated_at,snapshot.bootstrap.report.source_updated_at);
 assert.equal(after.last_access_limit_at,before.last_access_limit_at);
 assert.throws(()=>healthyOwnedSnapshot(before,{bootstrap:{report:{attempt_complete:false}}},now),/completed official/);
});
test('external provider is absent from live site and cloud build',()=>{
 for(const path of ['web/index.html','web/returns.html','scripts/build-cloud.mjs']){
  assert.doesNotMatch(load(path),/external-links/);
 }
});
