import test from 'node:test';
import assert from 'node:assert/strict';
import {airportLabel,normalizeAircraft,prestigeSeatHint,formatAlertRow} from '../src/alert-display.mjs';

test('airport codes are rendered with short Korean city labels',()=>{
 assert.equal(airportLabel('SEA'),'시애틀(SEA)');
 assert.equal(airportLabel('AKL'),'오클랜드(AKL)');
 assert.equal(airportLabel('DPS'),'발리(덴파사르)(DPS)');
 assert.equal(airportLabel('XYZ'),'XYZ');
});

test('common equipment codes normalize to readable aircraft types',()=>{
 assert.equal(normalizeAircraft('781'),'B787-10');
 assert.equal(normalizeAircraft('Boeing 787-9'),'B787-9');
 assert.equal(normalizeAircraft('359'),'A350-900');
 assert.equal(normalizeAircraft('77W'),'B777-300ER');
});

test('prestige seat hints distinguish known and configuration-dependent products',()=>{
 assert.match(prestigeSeatHint('781'),/스위트 2\.0/);
 assert.match(prestigeSeatHint('359'),/180°/);
 assert.match(prestigeSeatHint('77W'),/구성별/);
});

test('Telegram row includes Korean destination and seat detail when aircraft is known',()=>{
 const text=formatAlertRow({date:'2026-09-13',destination:'AKL',flight:'KE411',departureTime:'18:00',cabin:'PRESTIGE',aircraft:'781'});
 assert.match(text,/오클랜드\(AKL\)/);
 assert.match(text,/B787-10/);
 assert.match(text,/스위트 2\.0/);
 assert.match(text,/180°/);
});

test('unknown aircraft never invents a seat product',()=>{
 const text=formatAlertRow({date:'2026-09-13',destination:'SEA',flight:'KE041',departureTime:'16:40',cabin:'PRESTIGE'});
 assert.equal(text,'2026-09-13 · 시애틀(SEA) · KE041 16:40 · 프레스티지');
});
