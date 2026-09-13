import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');

test('seat guide assets are loaded and shipped by the cloud build',()=>{
 const html=read('web/index.html'),build=read('scripts/build-cloud.mjs'),sw=read('web/service-worker.js');
 assert.match(html,/seat-info\.css/);assert.match(html,/seat-info\.js/);
 assert.match(build,/seat-info\.css/);assert.match(build,/seat-info\.js/);assert.match(build,/seat-metadata\.js/);
 assert.match(sw,/seat-info\.js/);assert.match(sw,/seat-metadata\.js/);
});

test('published rows preserve aircraft and cloud snapshot reattaches it',()=>{
 const publish=read('scripts/publish-data.mjs'),build=read('scripts/build-cloud.mjs');
 assert.match(publish,/departureTime','aircraft','cabin/);
 assert.match(build,/aircraft:sourceRow\.aircraft\|\|null/);
 assert.match(build,/aircraft_source:sourceRow\.aircraft\?'KOREAN_AIR_PUBLIC_DAILY':null/);
});

test('seat guide provides route/date booking, product facts, image fallback and variant warning',()=>{
 const js=read('web/seat-info.js'),css=read('web/seat-info.css');
 assert.match(js,/bookingType:'A'/);assert.match(js,/tripType:'OW'/);assert.match(js,/departure:'ICN'/);assert.match(js,/departureDate:String\(row\.date\|\|''\)/);
 assert.match(js,/dataSeatInfo|dataset\.seatInfo|data-seat-info/i);
 assert.match(js,/침대 모드/);assert.match(js,/통로 접근/);assert.match(js,/같은 기종 안에서도 좌석이 달라요/);
 assert.match(js,/seat-image-fallback/);assert.match(js,/기종 미확인/);
 assert.match(css,/\.seat-photo/);assert.match(css,/\.seat-facts/);assert.match(css,/\.seat-variants/);
});

test('new browser seat scripts parse successfully',()=>{
 for(const file of ['web/seat-info.js','web/seat-metadata.js']){const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(run.status,0,`${file}: ${run.stderr||run.stdout}`);}
});
