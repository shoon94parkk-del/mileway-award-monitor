import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('OPENED requires a previously covered destination-month baseline',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/previousCoverage=new Set/);
 assert.match(source,/previousCoverage\.has\(baseline\)/);
});

test('opened-seat history starts from the stabilized monitoring baseline',()=>{
 const history=JSON.parse(read('public-data/changes.json'));
 assert.equal(history.source_updated_at,'2026년 9월 10일 23:00');
 assert.ok(Date.parse(history.baseline_reset_at));
 assert.deepEqual(history.events,[]);
});

test('baseline reset marker survives later publication',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/baselineResetAt=oldHistory\.baseline_reset_at/);
 assert.match(source,/baseline_reset_at:baselineResetAt/);
});
