import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublication,confidentlyAbsent} from '../src/publication-validation.mjs';
import {validateDiscovery,parseDestinationButton} from '../src/route-discovery.mjs';
const codes='NRT HND KIX FUK NGO CTS OKA PEK PVG CAN HKG TPE BKK SIN KUL DPS SYD AKL LAX JFK CDG'.split(' ');
function report(){const regions=['일본','동남아시아','유럽'];const routes=codes.map((code,i)=>({code,region:regions[i%3]}));return {scope:'WORLDWIDE',discovery:{validated:true,regions},routes,target_routes:codes,attempt_complete:true,source_updated_at:'daily',finished_at:'2026-09-10T12:00:00Z',start_date:'2026-09-10',end_date:'2026-09-30',coverage:codes.map(destination=>({destination,month:'2026-09'})),rows:[]};}
test('publication validates actual worldwide coverage, not completion flag alone',()=>{
 assert.equal(validatePublication(report()),true);
 for(const mutate of [r=>r.attempt_complete=false,r=>r.coverage.pop(),r=>r.scope='SMOKE',r=>r.failed=[{}],r=>r.target_routes=['NRT'],r=>r.discovery.validated=false,r=>r.coverage.push(r.coverage[0]),r=>r.rows=[{origin:'ICN',destination:'NRT',date:'2026-09-10',available:true,sourceUpdatedAt:'daily',fareClass:'Z',cabin:'PRESTIGE'}]]){const r=report();mutate(r);assert.throws(()=>validatePublication(r));}
});
test('unqueryable and out-of-range observations are not closed seats',()=>{
 const r=report(),row={destination:'NRT',date:'2026-09-12'};
 assert.equal(confidentlyAbsent(row,r),true);r.coverage=r.coverage.filter(x=>x.destination!=='NRT');assert.equal(confidentlyAbsent(row,r),false);
 assert.equal(confidentlyAbsent({destination:'JFK',date:'2026-09-09'},r),false);
});
test('discovery excludes domestic airports and rejects duplicate/small sets',()=>{
 assert.equal(parseDestinationButton('ICN 서울/인천','대한민국'),null);
 const r=report();assert.equal(validateDiscovery(r.discovery.regions,r.routes),true);
 assert.throws(()=>validateDiscovery(['미주'],r.routes));assert.throws(()=>validateDiscovery(r.discovery.regions,[...r.routes,r.routes[0]]));
});
