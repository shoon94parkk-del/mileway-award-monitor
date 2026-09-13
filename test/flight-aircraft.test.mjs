import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateAircraft,normalizeFlight} from '../web/flight-aircraft.js';

test('normalizes zero-padded Korean Air flight numbers',()=>{
 assert.equal(normalizeFlight('KE041'),'KE41');
 assert.equal(normalizeFlight('ke005'),'KE5');
});

test('only source-provided aircraft is labelled confirmed',()=>{
 const result=estimateAircraft({flight:'KE041',date:'2026-09-13',aircraft:'B787-9'});
 assert.equal(result.aircraft,'B787-9');
 assert.equal(result.confidence,'confirmed');
 assert.equal(result.label,'확정');
});

test('KE041 current schedule is a high-confidence 787-10 estimate, not confirmed',()=>{
 const result=estimateAircraft({flight:'KE041',date:'2026-09-13'});
 assert.equal(result.aircraft,'B787-10');
 assert.equal(result.confidence,'high');
 assert.notEqual(result.label,'확정');
});

test('date and weekday can change the aircraft on the same flight number',()=>{
 assert.deepEqual([estimateAircraft({flight:'KE411',date:'2026-09-13'}).aircraft,estimateAircraft({flight:'KE411',date:'2026-09-14'}).aircraft],['B787-10','B787-9']);
 assert.deepEqual([estimateAircraft({flight:'KE011',date:'2026-09-13'}).aircraft,estimateAircraft({flight:'KE011',date:'2026-09-14'}).aircraft],['B747-8I','A380-800']);
});

test('future published schedule ranges are applied when available',()=>{
 assert.equal(estimateAircraft({flight:'KE075',date:'2027-04-11'}).aircraft,'B787-9');
 assert.equal(estimateAircraft({flight:'KE081',date:'2027-05-01'}).aircraft,'B777-300ER');
 assert.equal(estimateAircraft({flight:'KE955',date:'2027-08-16'}).aircraft,'B787-9');
});

test('outside exact schedule range falls back to medium typical aircraft when stable enough',()=>{
 const result=estimateAircraft({flight:'KE401',date:'2027-05-10'});
 assert.equal(result.aircraft,'B787-10');
 assert.equal(result.confidence,'medium');
});

test('special or unmapped flight remains unknown rather than inventing an aircraft',()=>{
 const result=estimateAircraft({flight:'KE8053',date:'2026-09-13'});
 assert.equal(result.aircraft,'');
 assert.equal(result.confidence,'unknown');
});
