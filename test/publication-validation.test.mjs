import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublication,confidentlyAbsent} from '../src/publication-validation.mjs';
import {validateDiscovery,parseDestinationButton,monitoredRoute} from '../src/route-discovery.mjs';

const routes=[
 {code:'CDG',region:'유럽'},{code:'LHR',region:'유럽'},{code:'FRA',region:'유럽'},{code:'FCO',region:'유럽'},{code:'MXP',region:'유럽'},{code:'MAD',region:'유럽'},
 {code:'JFK',region:'미주'},{code:'LAX',region:'미주'},{code:'SFO',region:'미주'},{code:'SEA',region:'미주'},{code:'DFW',region:'미주'},{code:'BOS',region:'미주'},
 {code:'SYD',region:'대양주/괌'},{code:'BNE',region:'대양주/괌'},{code:'AKL',region:'대양주/괌'},
 {code:'DXB',region:'중동/아프리카'},{code:'TLV',region:'중동/아프리카'},{code:'IST',region:'중동/아프리카'},
 {code:'NRT',region:'동북아시아'},{code:'PVG',region:'동북아시아'},
 {code:'BKK',region:'동남아시아/서남아시아'},{code:'DPS',region:'동남아시아/서남아시아'}
];
const regions=[...new Set(routes.map(r=>r.region))];
function report(){
 const target=routes.filter(monitoredRoute).map(r=>r.code);
 return {scope:'WORLDWIDE',discovery:{validated:true,regions},routes,target_routes:target,attempt_complete:true,source_updated_at:'daily',finished_at:'2026-09-10T12:00:00Z',start_date:'2026-09-10',end_date:'2026-09-30',coverage:target.map(destination=>({destination,month:'2026-09'})),rows:[]};
}
test('publication validates complete monitored coverage while allowing intentionally excluded routes',()=>{
 assert.equal(validatePublication(report()),true);
 for(const mutate of [r=>r.attempt_complete=false,r=>r.coverage.pop(),r=>r.scope='SMOKE',r=>r.failed=[{}],r=>r.target_routes=['NRT'],r=>r.discovery.validated=false,r=>r.coverage.push(r.coverage[0]),r=>r.rows=[{origin:'ICN',destination:'CDG',date:'2026-09-10',available:true,sourceUpdatedAt:'daily',fareClass:'Z',cabin:'PRESTIGE'}]]){const r=report();mutate(r);assert.throws(()=>validatePublication(r));}
});
test('unqueryable and out-of-range observations are not closed seats',()=>{
 const r=report(),row={destination:'CDG',date:'2026-09-12'};
 assert.equal(confidentlyAbsent(row,r),true);r.coverage=r.coverage.filter(x=>x.destination!=='CDG');assert.equal(confidentlyAbsent(row,r),false);
 assert.equal(confidentlyAbsent({destination:'JFK',date:'2026-09-09'},r),false);
});
test('discovery still validates the full Korean Air selector before monitoring policy is applied',()=>{
 assert.equal(parseDestinationButton('ICN 서울/인천','대한민국'),null);
 const r=report();assert.equal(validateDiscovery(r.discovery.regions,r.routes),true);
 assert.throws(()=>validateDiscovery(['미주'],r.routes));assert.throws(()=>validateDiscovery(r.discovery.regions,[...r.routes,r.routes[0]]));
});
