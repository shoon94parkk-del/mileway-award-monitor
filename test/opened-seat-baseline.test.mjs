import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('OPENED requires a previously covered destination-month baseline',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/previousCoverage=new Set/);
 assert.match(source,/previousCoverage\.has\(baseline\)/);
});

test('seat-change history contains only supported transitions after the stabilized baseline',()=>{
 const history=JSON.parse(read('public-data/changes.json'));
 assert.ok(history.source_updated_at);
 const baseline=Date.parse(history.baseline_reset_at);assert.ok(Number.isFinite(baseline));
 assert.ok(Array.isArray(history.events));
 for(const event of history.events){
  assert.ok(Date.parse(event.detected_at)>=baseline);
  assert.ok(event.kind==='OPENED'||event.kind==='CLOSED');
 }
});

test('publisher records OPENED and confidently absent CLOSED transitions',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/kind:'OPENED'/);
 assert.match(source,/kind:'CLOSED'/);
 assert.match(source,/confidentlyAbsent\(row,incoming\)/);
});

test('baseline reset marker survives later publication',()=>{
 const source=read('scripts/publish-data.mjs');
 assert.match(source,/baselineResetAt=oldHistory\.baseline_reset_at/);
 assert.match(source,/baseline_reset_at:baselineResetAt/);
});
