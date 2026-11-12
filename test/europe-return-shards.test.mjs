import test from 'node:test';
import assert from 'node:assert/strict';
import {RETURN_SHARDS,assertReturnShards} from '../scripts/europe-return-shards.mjs';
import {mergeReturnShards} from '../scripts/merge-europe-return-shards.mjs';

const codes=assertReturnShards();
const expected=codes.map(code=>({code,city:code,region:'유럽'}));
const stamp='2026년 11월 12일 01:30';
function part(shard){
 return {direction:'RETURN',destination:'ICN',region:'유럽',
  source_type:'KOREAN_AIR_PUBLIC_DAILY',source_updated_at:stamp,
  source:'https://www.koreanair.com/booking/book-and-manage/award-seat-availability',
  start_date:'2027-04-01',end_date:'2027-04-30',started_at:'2026-11-12T00:10:00Z',
  finished_at:'2026-11-12T00:16:00Z',attempt_complete:true,complete:true,
  origins:shard.codes.map(code=>({code,city:code,region:'유럽'})),
  rows:[],coverage:shard.codes.map(origin=>({origin,destination:'ICN',month:'2027-04',days:30})),
  unqueryable:[],failed:[],acceleration:{ui_months:shard.codes.length}};
}
const build=()=>new Map(RETURN_SHARDS.map(shard=>[shard.id,part(shard)]));
test('5 return workers together cover 14 European departure airports',()=>{
 assert.equal(RETURN_SHARDS.length,5);
 assert.equal(codes.length,14);
 assert.equal(new Set(codes).size,14);
 const result=mergeReturnShards(build(),expected);
 assert.equal(result.origins.length,14);
 assert.equal(result.coverage.length,14);
 assert.equal(result.attempt_complete,true);
 assert.equal(result.acceleration.ui_months,14);
});
test('missing shard or unfinished source cannot be published',()=>{
 const parts=build();parts.delete(4);
 assert.throws(()=>mergeReturnShards(parts,expected),/Unfinished return runner/);
 const second=build();second.get(3).source_updated_at='2026년 11월 11일 01:30';
 assert.throws(()=>mergeReturnShards(second,expected),/different source/);
});
test('new unassigned European route must block publication',()=>{
 assert.throws(()=>mergeReturnShards(build(),[...expected,{code:'MUC',region:'유럽'}]),/assignments differ/);
});
test('official unqueryable route/months remain unknown, not available',()=>{
 const parts=build();
 parts.get(0).coverage.shift();
 parts.get(0).unqueryable.push({origin:RETURN_SHARDS[0].codes[0],month:'2027-04',status:'UNQUERYABLE'});
 parts.get(0).complete=false;
 const merged=mergeReturnShards(parts,expected);
 assert.equal(merged.complete,false);
 assert.equal(merged.unqueryable.length,1);
});
