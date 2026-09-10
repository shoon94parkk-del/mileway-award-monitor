import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRows} from '../web/cloud-api.js';

const rows=[
 {id:'a',region:'유럽',destination:'CDG',city:'파리',country:'프랑스',flight:'KE901',date:'2027-04-03',cabin:'PRESTIGE'},
 {id:'b',region:'미주',destination:'JFK',city:'뉴욕',country:'미국',flight:'KE081',date:'2027-04-04',cabin:'FIRST'}
];

test('클라우드 조회는 브라우저에 저장한 좌석만 다시 필터링할 수 있다',()=>{
 const favorites=new Set(['b']);
 assert.deepEqual(filterRows(rows,{saved:'true'},favorites).map(r=>r.id),['b']);
 assert.deepEqual(filterRows(rows,{region:'유럽'},favorites).map(r=>r.id),['a']);
});
