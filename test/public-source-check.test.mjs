import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseSourceUpdatedAt,readPublishedSourceUpdatedAt,publishedSnapshotNeedsRefresh} from '../src/public-source-check.mjs';

test('parses Korean Air public source timestamp',()=>{
  assert.equal(parseSourceUpdatedAt('일일 자료 · 대한민국 시간(2026년 9월 10일 23:00) 기준'),'2026년 9월 10일 23:00');
  assert.equal(parseSourceUpdatedAt('timestamp missing'),null);
});

test('reads published source timestamp from cloud snapshot',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-source-'));
  const file=path.join(dir,'snapshot.json');
  fs.writeFileSync(file,JSON.stringify({bootstrap:{report:{source_updated_at:'2026년 9월 10일 23:00'}}}));
  assert.equal(readPublishedSourceUpdatedAt(file),'2026년 9월 10일 23:00');
  assert.equal(readPublishedSourceUpdatedAt(path.join(dir,'missing.json')),null);
});

test('legacy partial snapshot forces worldwide refresh even when source time is unchanged',()=>{
  const routes=Array.from({length:26},(_,i)=>({code:`X${String(i).padStart(2,'0')}`}));
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{routes}}},'2026년 9월 10일 23:00'),true);
});

test('complete worldwide snapshot does not force duplicate refresh',()=>{
  const routes=Array.from({length:105},(_,i)=>({code:`R${String(i).padStart(3,'0')}`}));
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'WORLDWIDE',routes}}},'2026년 9월 10일 23:00'),false);
});

test('regional composite refreshes if one group is stale',()=>{
  const current='2026년 9월 10일 23:00';
  const routes=Array.from({length:105},(_,i)=>({code:`R${String(i).padStart(3,'0')}`}));
  const ok=Object.fromEntries(['유럽','미주','오세아니아','아시아'].map(group=>[group,{status:'success',source_updated_at:current}]));
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'REGIONAL_COMPOSITE',routes,region_status:ok}}},current),false);
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'REGIONAL_COMPOSITE',routes,region_status:{...ok,미주:{status:'success',source_updated_at:'old'}}}}},current),true);
});
