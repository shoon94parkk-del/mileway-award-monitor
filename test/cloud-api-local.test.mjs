import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRows,isPastDeparture} from '../web/cloud-api.js';

const rows=[
 {id:'a',region:'유럽',destination:'CDG',city:'파리',country:'프랑스',flight:'KE901',date:'2027-04-03',time:'11:20',cabin:'PRESTIGE'},
 {id:'b',region:'미주',destination:'JFK',city:'뉴욕',country:'미국',flight:'KE081',date:'2027-04-04',time:'10:00',cabin:'FIRST'}
];

test('클라우드 조회는 브라우저에 저장한 좌석만 다시 필터링할 수 있다',()=>{
 const favorites=new Set(['b']);
 assert.deepEqual(filterRows(rows,{saved:'true'},favorites).map(r=>r.id),['b']);
 assert.deepEqual(filterRows(rows,{region:'유럽'},favorites).map(r=>r.id),['a']);
});

test('이미 출발한 항공편은 일반 목록에서 숨기고 저장 목록에서는 보존한다',()=>{
 const now=Date.parse('2026-09-13T00:06:00+09:00');
 const sample=[
  {id:'past-day',date:'2026-09-12',time:'22:40',region:'미주',destination:'YVR',city:'밴쿠버',country:'캐나다',flight:'KE075',cabin:'PRESTIGE'},
  {id:'past-today',date:'2026-09-13',time:'00:05',region:'미주',destination:'JFK',city:'뉴욕',country:'미국',flight:'KE081',cabin:'PRESTIGE'},
  {id:'future-today',date:'2026-09-13',time:'18:45',region:'미주',destination:'YVR',city:'밴쿠버',country:'캐나다',flight:'KE071',cabin:'PRESTIGE'}
 ];
 assert.equal(isPastDeparture(sample[0],now),true);
 assert.equal(isPastDeparture(sample[1],now),true);
 assert.equal(isPastDeparture(sample[2],now),false);
 assert.deepEqual(filterRows(sample,{},new Set(),now).map(r=>r.id),['future-today']);
 assert.deepEqual(filterRows(sample,{saved:'true'},new Set(['past-day','future-today']),now).map(r=>r.id),['past-day','future-today']);
});
