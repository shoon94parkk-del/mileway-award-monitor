import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');

test('cloud build exposes an exact seven-day opened-seat summary',()=>{
 const run=spawnSync(process.execPath,['--no-warnings','scripts/build-cloud.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const snapshot=JSON.parse(read('dist/snapshot.json'));
 const recent=snapshot.bootstrap?.recent_opened;
 assert.equal(recent?.days,7);
 assert.ok(Number.isInteger(recent?.total));
 assert.ok(Array.isArray(recent?.items));
 assert.ok(recent.total>=recent.items.length);
 assert.ok(recent.items.length<=8);
});

test('recent change history never truncates events from the last seven days',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/const recent=events\.filter/);
 assert.match(source,/const older=events\.filter/);
 assert.match(source,/events=\[\.\.\.recent,\.\.\.older\]/);
});

test('mobile UI prioritizes filters and results while keeping stats expandable',()=>{
 const js=read('web/ui-v2.js'),css=read('web/ui-v2.css');
 assert.match(js,/mobile-stats-summary/);
 assert.match(js,/moveRecentOpenedBelowResults/);
 assert.match(css,/@media\(max-width:850px\).*?\.stats\{display:none!important\}/s);
 assert.match(css,/\.mobile-stats-summary\{display:block/);
});

test('region labels and copy describe the reduced monitoring scope',()=>{
 const status=read('web/regional-status.js'),html=read('web/index.html'),build=read('scripts/build-cloud.mjs');
 assert.match(status,/발리·기타/);
 assert.doesNotMatch(html,/대한항공 미주·유럽 보너스 좌석/);
 assert.match(html,/선택한 모니터링 노선/);
 assert.match(build,/동북아와 발리를 제외한 동남아\/서남아는 현재 수집하지 않습니다/);
});

test('one-time production refresh workflow is removed',()=>{
 assert.equal(fs.existsSync('.github/workflows/force-worldwide-refresh.yml'),false);
});

test('browser shell cache version advances with this UI release',()=>{
 assert.match(read('web/service-worker.js'),/mileway-shell-v2/);
});

test('changed browser scripts parse successfully',()=>{
 for(const file of ['web/cloud-enhancements.js','web/ui-v2.js','web/regional-status.js','web/service-worker.js']){
  const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(run.status,0,`${file}: ${run.stderr||run.stdout}`);
 }
});
