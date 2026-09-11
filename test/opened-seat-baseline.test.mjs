import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('OPENED requires a previously covered destination-month baseline',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/previousCoverage=new Set/);
 assert.match(source,/previousCoverage\.has\(baseline\)/);
});

test('opened-seat history only contains events detected after the stabilized baseline',()=>{
 const history=JSON.parse(read('public-data/changes.json'));
 assert.ok(history.source_updated_at);
 const baseline=Date.parse(history.baseline_reset_at);assert.ok(Number.isFinite(baseline));
 assert.ok(Array.isArray(history.events));
 for(const event of history.events){assert.ok(Date.parse(event.detected_at)>=baseline);assert.equal(event.kind,'OPENED');}
});

test('baseline reset marker survives later publication',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/baselineResetAt=oldHistory\.baseline_reset_at/);
 assert.match(source,/baseline_reset_at:baselineResetAt/);
});
