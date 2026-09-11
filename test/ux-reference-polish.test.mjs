import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');

test('cloud build ships compact status rail assets',()=>{
 const build=read('scripts/build-cloud.mjs');
 assert.match(build,/ux-reference-polish\.css/);
 assert.match(build,/ux-reference-polish\.js/);
 const run=spawnSync(process.execPath,['--no-warnings','scripts/build-cloud.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const html=read('dist/index.html');
 assert.match(html,/ux-reference-polish\.css/);
 assert.match(html,/ux-reference-polish\.js/);
});

test('status rail exposes collection source result and alert state',()=>{
 const js=read('web/ux-reference-polish.js');
 assert.match(js,/Mileway 상태 요약/);
 assert.match(js,/ux-health-value/);
 assert.match(js,/ux-source-value/);
 assert.match(js,/ux-result-value/);
 assert.match(js,/ux-alert-value/);
 assert.match(js,/HEALTH_URL/);
});

test('mobile polish removes duplicate source and stats blocks',()=>{
 const css=read('web/ux-reference-polish.css');
 assert.match(css,/\.source-banner\{display:none!important\}/);
 assert.match(css,/#mobile-stats-summary\{display:none!important\}/);
 assert.match(css,/\.ux-status-rail\{display:flex/);
});

test('ux polish script parses',()=>{
 const run=spawnSync(process.execPath,['--check','web/ux-reference-polish.js'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
});
