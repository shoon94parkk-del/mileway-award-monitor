import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDestinationButton} from '../src/route-discovery.mjs';
import {parseSourceUpdatedAt,dailySourceIsStale} from '../src/source-timestamp.mjs';

test('official updated picker yields the same Europe route as legacy outward picker',()=>{
 const legacy=parseDestinationButton('CDG 파리','유럽');
 const modern=parseDestinationButton('파리/샤를 드 골 공항 CDG','유럽');
 assert.equal(modern.code,legacy.code);
 assert.equal(modern.region,legacy.region);
 assert.equal(modern.city,'파리/샤를 드 골 공항');
 assert.equal(parseDestinationButton('서울/인천 공항 ICN','대한민국'),null);
 assert.equal(parseDestinationButton('방콕 공항 BKK','동남아시아/서남아시아'),null);
});

test('official updated Korean Air timestamp is parsed and not mislabeled stale at 07:00 KST',()=>{
 const label='좌석 현황은 한국 시간 2026년 11월 12일 01:30 기준 정보로 실시간 현황이 아닙니다.';
 assert.equal(parseSourceUpdatedAt(label),'2026년 11월 12일 01:30');
 assert.equal(dailySourceIsStale('2026년 11월 12일 01:30',new Date('2026-11-11T22:00:00Z')),false);
 assert.equal(dailySourceIsStale('2026년 11월 11일 01:30',new Date('2026-11-11T22:00:00Z')),true);
});

test('outbound and return scanners use shared airport and month UI rather than removed selectors',()=>{
 const outbound=fs.readFileSync(new URL('../src/public-extract.mjs',import.meta.url),'utf8');
 const inbound=fs.readFileSync(new URL('../scripts/collect-europe-returns.mjs',import.meta.url),'utf8');
 const ready=fs.readFileSync(new URL('../src/public-navigation.mjs',import.meta.url),'utf8');
 for(const source of [outbound,inbound]){
   assert.match(source,/choosePublicAirport/);
   assert.match(source,/selectPublicMonth/);
   assert.match(source,/selectPublicOneWay/);
 }
 assert.match(ready,/kds-fromto_1/);
});
