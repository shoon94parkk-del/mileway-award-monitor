import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getReturnOrigins,makeReturnMonth,checkReturnReport,mergeReturnReports} from '../src/europe-returns.mjs';

const months=['2027-04','2027-05'],sourceAt='2026-11-11 23:00 KST';
const data={departureAirport:'CDG',arrivalAirport:'ICN',flightList:[{departureDate:'20270408',flightDetailList:[
  {flightNumber:'KE902',departureTime:'20:30',bookingClass:'O',availableSeat:true},
  {flightNumber:'KE902',departureTime:'20:30',bookingClass:'A',availableSeat:false},
  {flightNumber:'KE902',departureTime:'20:30',bookingClass:'Z',availableSeat:true}
]}]};
const source={origin:'CDG',month:'2027-04',start:'2027-04-01',end:'2027-05-31',sourceUpdatedAt:sourceAt};
const row=makeReturnMonth(data,source).rows[0];
function completed(){
 return {direction:'RETURN',destination:'ICN',source_type:'KOREAN_AIR_PUBLIC_DAILY',source_updated_at:sourceAt,
   origins:[{code:'CDG',region:'유럽',city:'파리'}],start_date:'2027-04-01',end_date:'2027-05-31',
   coverage:[{origin:'CDG',month:'2027-04'}],unqueryable:[{origin:'CDG',month:'2027-05',status:'UNQUERYABLE'}],
   failed:[],rows:[row],attempt_complete:true,finished_at:'2026-11-11T13:00:00Z'};
}
test('Europe return origins keep the verified outbound European scope only',()=>{
 assert.deepEqual(getReturnOrigins([{code:'CDG',region:'유럽'},{code:'CDG',region:'유럽'},{code:'JFK',region:'미주'},{code:'LHR',region:'유럽'}]).map(r=>r.code),['CDG','LHR']);
});
test('return parser uses CDG to ICN, includes only available O/A, never Z upgrades',()=>{
 const month=makeReturnMonth(data,source);
 assert.equal(month.status,'COVERED');assert.equal(month.rows.length,1);
 assert.equal(month.rows[0].origin,'CDG');assert.equal(month.rows[0].destination,'ICN');
 assert.equal(month.rows[0].flight,'KE902');assert.equal(month.rows[0].cabin,'PRESTIGE');
 assert.equal(month.rows[0].direction,'RETURN');
 assert.throws(()=>makeReturnMonth({...data,arrivalAirport:'LHR'},source));
 const unknown=makeReturnMonth({...data,flightList:[]},source);
 assert.equal(unknown.status,'UNQUERYABLE');assert.deepEqual(unknown.rows,[]);
});
test('complete coverage must account for every return origin/month without confusing unknown with no seats',()=>{
 const report=completed();assert.equal(checkReturnReport(report),true);
 for(const mutate of [r=>r.coverage.pop(),r=>r.coverage.push(r.coverage[0]),r=>r.failed.push({}),r=>r.rows[0].origin='ICN',r=>r.rows[0].destination='CDG',r=>r.rows[0].fareClass='Z',r=>r.rows[0].date='2027-06-01',r=>r.attempt_complete=false]){
  const copy=structuredClone(report);mutate(copy);assert.throws(()=>checkReturnReport(copy));
 }
});
test('unqueryable return months preserve old results as unverified but never signal live availability',()=>{
 const next=completed();
 const old={rows:[{...row,date:'2027-05-10',checkedAt:'old'},row]};
 const merged=mergeReturnReports(old,next);
 assert.equal(merged.rows.length,2);
 assert.equal(merged.rows.find(r=>r.date==='2027-05-10').verified,false);
 assert.equal(merged.rows.find(r=>r.date==='2027-04-08').verified,true);
 assert.equal(merged.preserved_unknown_rows,1);
 assert.equal(merged.last_successful_scan_at,next.finished_at);
});
test('site build and scheduled workflow expose independent return collection without changing outbound collector',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const workflow=read('.github/workflows/collect-europe-returns.yml'),builder=read('scripts/build-cloud.mjs'),home=read('web/index.html');
 assert.match(workflow,/scripts\/collect-europe-returns\.mjs/);
 assert.match(workflow,/scripts\/publish-europe-returns\.mjs/);
 assert.match(workflow,/schedule:/);
 assert.match(builder,/returns-data\.json/);
 assert.match(builder,/returns\.html/);
 assert.match(home,/href="\/returns\.html"/);
});
