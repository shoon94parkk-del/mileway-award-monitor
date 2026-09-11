import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseSourceUpdatedAt,readPublishedSourceUpdatedAt,publishedSnapshotNeedsRefresh,dailySourceIsStale,expectedDailySourceUpdatedAt,staleDailySafetyScanDue} from '../src/public-source-check.mjs';

const current='2026년 9월 10일 23:00';
const scopedRoutes=[
 {code:'CDG',region:'유럽'},
 {code:'JFK',region:'미주'},
 {code:'SYD',region:'대양주/괌'},
 {code:'DPS',region:'동남아시아/서남아시아'}
];

test('parses Korean Air public source timestamp',()=>{
  assert.equal(parseSourceUpdatedAt('일일 자료 · 대한민국 시간(2026년 9월 10일 23:00) 기준'),current);
  assert.equal(parseSourceUpdatedAt('timestamp missing'),null);
});

test('parses spacing and full-width parenthesis variants used by responsive UI',()=>{
  assert.equal(parseSourceUpdatedAt('좌석 상황은 대한민국 시간 （ 2026년 9월 11일 23:00 ） 기준'),'2026년 9월 11일 23:00');
  assert.equal(parseSourceUpdatedAt('좌석 상황은 대한민국 시간 : 2026년 9월 11일 23:00 기준'),'2026년 9월 11일 23:00');
});

test('selects the newest timestamp when stale and fresh copies coexist in the page',()=>{
  const body='숨은 이전 안내 대한민국 시간(2026년 9월 10일 23:00) / 현재 안내 대한민국 시간(2026년 9월 11일 23:00)';
  assert.equal(parseSourceUpdatedAt(body),'2026년 9월 11일 23:00');
});

test('daily freshness guard recognizes a missed previous-night refresh',()=>{
  const now=new Date('2026-09-11T23:35:00Z'); // 2026-09-12 08:35 KST
  assert.equal(expectedDailySourceUpdatedAt(now),'2026년 9월 11일 23:00');
  assert.equal(dailySourceIsStale('2026년 9월 10일 23:00',now),true);
  assert.equal(dailySourceIsStale('2026년 9월 11일 23:00',now),false);
});

test('stale source forces an independent retry after cooldown even if timestamp detector repeats old value',()=>{
  const now=new Date('2026-09-11T23:35:00Z');
  const recent={bootstrap:{report:{finished_at:'2026-09-11T21:35:00Z'}}};
  const old={bootstrap:{report:{finished_at:'2026-09-11T18:00:00Z'}}};
  assert.equal(staleDailySafetyScanDue(recent,'2026년 9월 10일 23:00',now),false);
  assert.equal(staleDailySafetyScanDue(old,'2026년 9월 10일 23:00',now),true);
  assert.equal(staleDailySafetyScanDue(old,'2026년 9월 11일 23:00',now),false);
});

test('reads published source timestamp from cloud snapshot',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-source-'));
  const file=path.join(dir,'snapshot.json');
  fs.writeFileSync(file,JSON.stringify({bootstrap:{report:{source_updated_at:current}}}));
  assert.equal(readPublishedSourceUpdatedAt(file),current);
  assert.equal(readPublishedSourceUpdatedAt(path.join(dir,'missing.json')),null);
});

test('legacy partial snapshot forces refresh even when source time is unchanged',()=>{
  const routes=[{code:'CDG',region:'유럽'},{code:'JFK',region:'미주'}];
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{routes}}},current),true);
});

test('old broad Asia or removed-region snapshot forces one cleanup refresh',()=>{
  const routes=[...scopedRoutes,{code:'NRT',region:'동북아시아'},{code:'BKK',region:'동남아시아/서남아시아'},{code:'DXB',region:'중동/아프리카'}];
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'WORLDWIDE',routes}}},current),true);
});

test('complete reduced-scope worldwide snapshot does not force duplicate refresh',()=>{
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'WORLDWIDE',routes:scopedRoutes}}},current),false);
});

test('Bali is required in the reduced Asia scope',()=>{
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'WORLDWIDE',routes:scopedRoutes.filter(r=>r.code!=='DPS')}}},current),true);
});

test('regional composite refreshes if one group is stale',()=>{
  const ok=Object.fromEntries(['유럽','미주','오세아니아','아시아'].map(group=>[group,{status:'success',source_updated_at:current}]));
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'REGIONAL_COMPOSITE',routes:scopedRoutes,region_status:ok}}},current),false);
  assert.equal(publishedSnapshotNeedsRefresh({bootstrap:{report:{scope:'REGIONAL_COMPOSITE',routes:scopedRoutes,region_status:{...ok,미주:{status:'success',source_updated_at:'old'}}}}},current),true);
});
