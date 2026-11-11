import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseRenderedSeatMonth} from '../src/public-rendered-seats.mjs';
const options={origin:'CDG',destination:'ICN',month:'2027-04',
  startDate:'2027-04-01',endDate:'2027-04-30',
  sourceUpdatedAt:'2026년 11월 12일 01:30'};
const legend='프레스티지석 보너스';
const legacy=()=>({
  kind:'LEGACY',origin:null,destination:null,heading:'CDG → ICN',
  month:'2027년 4월',legend:true,
  days:Array.from({length:30},(_,index)=>({
    day:index+1,disabled:false,
    labels:index===8?[legend,'일등석 보너스/좌석승급']:[]}))
});
const modern=()=>({
  kind:'MODERN',origin:'CDG',destination:'ICN',month:'가는 달 2027년 4월',legend:true,
  days:Array.from({length:30},(_,index)=>({
    label:'',text:index===8?'9일 '+legend:'',attrs:['2027-04-'+String(index+1).padStart(2,'0')],
    disabled:false,html:'button'
  }))
});
test('old airline calendar renders the same date-level award classifications without API',()=>{
  const parsed=parseRenderedSeatMonth(legacy(),options);
  assert.equal(parsed.status,'COVERED');
  assert.equal(parsed.days,30);
  assert.equal(parsed.rows.length,2);
  assert.deepEqual(parsed.rows.map(r=>r.fareClass),['O','A']);
  assert.ok(parsed.rows.every(r=>r.origin==='CDG'&&r.destination==='ICN'&&r.date==='2027-04-09'));
  assert.ok(parsed.rows.every(r=>r.flight===null&&r.direction==='RETURN'));
});
test('modern shadow-DOM day cells are accepted only when month and route match',()=>{
  const parsed=parseRenderedSeatMonth(modern(),options);
  assert.equal(parsed.rows.length,1);
  assert.equal(parsed.rows[0].fareClass,'O');
  assert.equal(parsed.rows[0].available,true);
  assert.throws(()=>parseRenderedSeatMonth({...modern(),destination:'CDG'},options),/airport/);
  assert.throws(()=>parseRenderedSeatMonth({...modern(),month:'2027년 5월'},options),/month/);
});
test('empty, partial or unknown-cabin screens never turn into confirmed no seats',()=>{
  const absent={...modern(),days:[]};
  assert.throws(()=>parseRenderedSeatMonth(absent,options),/insufficient dated/);
  const unknown={...modern(),legend:false,
    days:modern().days.map(item=>({...item,text:'',label:''}))};
  assert.throws(()=>parseRenderedSeatMonth(unknown,options),/verifiable award-class legend/);
});
test('explicit unqueryable is distinct from zero availability',()=>{
  const a={...modern(),unavailableMessage:true,days:[]};
  assert.equal(parseRenderedSeatMonth(a,options).status,'UNQUERYABLE');
});
test('return collector reads rendered DOM and never calls bonus seat endpoints',()=>{
  const script=fs.readFileSync(new URL('../scripts/collect-europe-returns.mjs',import.meta.url),'utf8');
  assert.match(script,/readRenderedSeatCalendar/);
  assert.match(script,/parseRenderedSeatMonth/);
  assert.doesNotMatch(script,/queryPublicSeatMonth|PUBLIC_API|waitForResponse|response\.json\(\)/);
});
