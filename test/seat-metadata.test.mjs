import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAircraft,prestigeSeatInfo,SEAT_METADATA_VERSION} from '../web/seat-metadata.js';

test('normalizes common Korean Air aircraft codes',()=>{
 assert.equal(normalizeAircraft('781'),'B787-10');
 assert.equal(normalizeAircraft('B789'),'B787-9');
 assert.equal(normalizeAircraft('77W'),'B777-300ER');
 assert.equal(normalizeAircraft('A359'),'A350-900');
 assert.equal(normalizeAircraft('32Q'),'A321NEO');
});

test('B787-10 resolves to Prestige Suite 2.0',()=>{
 const info=prestigeSeatInfo('B787-10');
 assert.equal(info.metadata_version,SEAT_METADATA_VERSION);
 assert.equal(info.seat_name,'프레스티지 스위트 2.0');
 assert.match(info.bed,/180/);
 assert.match(info.direct_aisle,/전 좌석/);
 assert.match(info.image_url,/koreanair\.com/);
});

test('B777-300ER stays variant-aware instead of guessing a seat',()=>{
 const info=prestigeSeatInfo('77W');
 assert.equal(info.confidence,'variant');
 assert.equal(info.variants.length,3);
 assert.deepEqual(info.variants.map(v=>v.seat_name),['프레스티지 스위트 2.0','프레스티지 스위트','프레스티지 슬리퍼']);
});

test('unknown aircraft is explicit rather than guessed',()=>{
 const info=prestigeSeatInfo('ZZZ');
 assert.equal(info.confidence,'unknown');
 assert.match(info.summary,/확인하지 못했습니다/);
});
