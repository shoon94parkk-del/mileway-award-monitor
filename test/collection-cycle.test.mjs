import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionCycle} from '../src/collection-cycle.mjs';

const cycle=value=>collectionCycle(new Date(value),{prewarmMinutes:15});

test('22:44 KST still belongs to the previous 23:00 cycle',()=>{
 assert.equal(cycle('2026-09-13T13:44:59Z').cycle_id,'2026-09-12T23:00:00+09:00');
});

test('22:47 KST prewarmed watcher targets the upcoming same-day cycle',()=>{
 assert.equal(cycle('2026-09-13T13:47:00Z').cycle_id,'2026-09-13T23:00:00+09:00');
});

test('22:57, 23:00, 23:05 and 00:05 resolve to the intended daily cycle',()=>{
 assert.equal(cycle('2026-09-13T13:57:00Z').cycle_id,'2026-09-13T23:00:00+09:00');
 assert.equal(cycle('2026-09-13T14:00:00Z').cycle_id,'2026-09-13T23:00:00+09:00');
 assert.equal(cycle('2026-09-13T14:05:00Z').cycle_id,'2026-09-13T23:00:00+09:00');
 assert.equal(cycle('2026-09-13T15:05:00Z').cycle_id,'2026-09-13T23:00:00+09:00');
});

test('expected source label follows the cycle date',()=>{
 const info=cycle('2026-12-31T13:57:00Z');
 assert.equal(info.expected_source_at,'2026년 12월 31일 23:00');
 assert.equal(info.cycle_start_utc,'2026-12-31T14:00:00.000Z');
});
