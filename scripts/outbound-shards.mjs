import {collectionGroup} from '../src/route-discovery.mjs';

// Five independent GitHub-hosted Windows runners. Regions are split so the
// longest Europe / Americas scans do not serialize behind one browser.
export const OUTBOUND_SHARDS=[
  {id:0,codes:['LHR','FCO','LIS','MAD','MXP','BCN','BUD']},
  {id:1,codes:['VIE','AMS','IST','ZRH','CDG','PRG','FRA']},
  {id:2,codes:['JFK','EWR','DFW','LAS','LAX','YVR','BOS']},
  {id:3,codes:['SFO','SEA','ORD','ATL','IAD','YYZ','HNL']},
  {id:4,codes:['MEL','BNE','SYD','AKL','DPS']}
];
export const GROUP_NAMES=['유럽','미주','오세아니아','아시아'];
export function validateShardPlan(){
  if(OUTBOUND_SHARDS.length!==5)throw Error('Exactly five workers required');
  const all=OUTBOUND_SHARDS.flatMap(s=>s.codes);
  if(all.length!==new Set(all).size)throw Error('Overlapping worker assignments');
  for(const shard of OUTBOUND_SHARDS){
    if(shard.codes.length===0||shard.codes.some(code=>!/^[A-Z]{3}$/.test(code)))
      throw Error('Invalid five-runner shard');
  }
  return all;
}
export function assignedShard(code){return OUTBOUND_SHARDS.find(s=>s.codes.includes(code))?.id??null;}
export function groupCodes(routes,group){
  return routes.filter(route=>collectionGroup(route.region)===group).map(route=>route.code);
}
