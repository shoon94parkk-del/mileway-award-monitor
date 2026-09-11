import {validatePublication} from './publication-validation.mjs';
import {collectionGroup,monitoredRoute} from './route-discovery.mjs';

// Replace only a validated, fully attempted region. Other region observations retain their source times.
export function mergeCompletedRegion(previous,next){
  validatePublication(next);
  if(next.scope!=='REGION')throw Error('Regional publication requires REGION scope');
  const group=next.collection_group;
  const oldRoutes=previous?.routes||[],oldByCode=new Map(oldRoutes.map(r=>[r.code,r]));
  const keep=record=>{const route=oldByCode.get(record.destination);return route&&collectionGroup(route.region)!==group;};
  const targets=new Set(next.target_routes||[]);
  const nextRoutes=next.routes.filter(r=>collectionGroup(r.region)===group&&monitoredRoute(r)&&targets.has(r.code));
  const routes=[...oldRoutes.filter(r=>collectionGroup(r.region)!==group),...nextRoutes];
  const oldRows=(previous?.rows||[]).filter(keep),coverage=(previous?.coverage||[]).filter(keep).map(c=>({...c,source_updated_at:c.source_updated_at||previous.source_updated_at}));
  const unqueryable=(previous?.unqueryable||[]).filter(keep);
  const region_status={...(previous?.region_status||{})};
  for(const oldGroup of new Set(oldRoutes.map(r=>collectionGroup(r.region))))if(!region_status[oldGroup])region_status[oldGroup]={status:'preserved',source_updated_at:previous.source_updated_at,finished_at:previous.finished_at||null};
  region_status[group]={status:'success',source_updated_at:next.source_updated_at,finished_at:next.finished_at,routes:nextRoutes.length};
  const dates=[...oldRows.map(r=>r.date),next.start_date,next.end_date].sort();
  const groups=['유럽','미주','오세아니아','아시아'];
  return {...next,scope:'REGIONAL_COMPOSITE',collection_group:undefined,
    publication_id:next.finished_at+'|'+group,
    region_status,mixed_sources:new Set(Object.values(region_status).map(r=>r.source_updated_at)).size>1,
    worldwide_complete:groups.every(g=>region_status[g]?.status==='success'&&region_status[g].source_updated_at===next.source_updated_at),
    start_date:dates[0],end_date:dates.at(-1),routes,target_routes:routes.map(r=>r.code),
    coverage:[...coverage,...next.coverage.map(c=>({...c,source_updated_at:next.source_updated_at}))],
    unqueryable:[...unqueryable,...(next.unqueryable||[])],rows:[...oldRows,...next.rows],
    complete:false,attempt_complete:true};
}
