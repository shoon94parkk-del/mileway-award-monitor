import test from 'node:test';
import assert from 'node:assert/strict';
import {OUTBOUND_SHARDS,GROUP_NAMES,validateShardPlan,assignedShard} from '../scripts/outbound-shards.mjs';
import {mergeOutboundShards} from '../scripts/merge-outbound-shards.mjs';

const groups={유럽:'유럽',미주:'미주',오세아니아:'대양주/괌',아시아:'동남아시아/서남아시아'};
function region(code){
 if(OUTBOUND_SHARDS[0].codes.includes(code)||OUTBOUND_SHARDS[1].codes.includes(code))return groups.유럽;
 if(OUTBOUND_SHARDS[2].codes.includes(code)||OUTBOUND_SHARDS[3].codes.includes(code))return groups.미주;
 return code==='DPS'?groups.아시아:groups.오세아니아;
}
const regions=['유럽','미주','대양주/괌','동남아시아/서남아시아'];
const routes=validateShardPlan().map(code=>({code,region:region(code),city:code,label:code}));
const stamp='2026년 11월 12일 01:30';
function worker(shard){
 const coverage=shard.codes.map(destination=>({destination,month:'2027-04',days:30}));
 return {source:'https://www.koreanair.com/booking/book-and-manage/award-seat-availability',
 source_type:'KOREAN_AIR_PUBLIC_DAILY',source_updated_at:stamp,
 start_date:'2027-04-01',end_date:'2027-04-30',started_at:'2026-11-11T23:00:00.000Z',
 finished_at:'2026-11-11T23:15:00.000Z',scope:'SMOKE',
 target_routes:shard.codes,routes,discovery:{validated:true,regions,route_count:routes.length},
 rows:[],coverage,unqueryable:[],failed:[],errors:[],attempt_complete:true,
 complete:true,collection_engine:'UI_ACCESSIBLE_ONLY'};
}
test('five separate workers cover every destination without overlap',()=>{
 assert.equal(OUTBOUND_SHARDS.length,5);
 assert.equal(validateShardPlan().length,33);
 assert.equal(new Set(validateShardPlan()).size,33);
 for(const shard of OUTBOUND_SHARDS)for(const code of shard.codes)assert.equal(assignedShard(code),shard.id);
});
test('five browser-worker reports merge into four validated region publications',()=>{
 const results=mergeOutboundShards(new Map(OUTBOUND_SHARDS.map(shard=>[shard.id,worker(shard)])));
 assert.deepEqual([...results.keys()],GROUP_NAMES);
 assert.deepEqual([...results.values()].map(r=>r.target_routes.length),[14,14,4,1]);
 assert.ok([...results.values()].every(r=>r.attempt_complete===true&&r.collection_engine==='UI_ACCESSIBLE_ONLY'));
});
test('missing worker and incomplete route-month coverage never publish',()=>{
 const entries=new Map(OUTBOUND_SHARDS.map(shard=>[shard.id,worker(shard)]));
 entries.delete(4);
 assert.throws(()=>mergeOutboundShards(entries),/Missing successful worker/);
 entries.set(4,worker(OUTBOUND_SHARDS[4]));
 entries.get(4).coverage.pop();
 assert.throws(()=>mergeOutboundShards(entries),/Incomplete/);
});
test('different daily airline source timestamps cannot be mixed',()=>{
 const entries=new Map(OUTBOUND_SHARDS.map(shard=>[shard.id,worker(shard)]));
 entries.get(3).source_updated_at='2026년 11월 11일 01:30';
 assert.throws(()=>mergeOutboundShards(entries),/incompatible/);
});
