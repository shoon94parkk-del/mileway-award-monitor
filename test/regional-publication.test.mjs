import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCompletedRegion} from '../src/regional-publication.mjs';
import {createStore} from '../src/app-store.mjs';
const codes='CDG LHR FRA FCO MXP MAD PRG VIE JFK LAX SEA DFW BOS ORD SYD AKL BNE NRT KIX BKK SIN'.split(' ');
const routes=codes.map((code,i)=>({code,region:i<8?'유럽':i<14?'미주':i<17?'대양주':'일본'}));
const row=(destination,sourceUpdatedAt)=>({date:'2026-09-20',origin:'ICN',destination,region:routes.find(r=>r.code===destination).region,flight:'KE001',departureTime:'10:00',cabin:'PRESTIGE',fareClass:'O',availabilityType:'AWARD',available:true,sourceUpdatedAt,checkedAt:sourceUpdatedAt});
const previous={routes:routes.filter(r=>['CDG','JFK'].includes(r.code)),rows:[row('CDG','day1'),row('JFK','day1')],coverage:[{destination:'CDG',month:'2026-09'},{destination:'JFK',month:'2026-09'}],source_updated_at:'day1',start_date:'2026-09-10',end_date:'2026-09-30',attempt_complete:true};
function europe(){return {scope:'REGION',collection_group:'유럽',discovery:{validated:true,regions:['유럽','미주','대양주','일본']},routes,target_routes:codes.slice(0,8),coverage:codes.slice(0,8).map(destination=>({destination,month:'2026-09'})),rows:[row('CDG','day2')],source_updated_at:'day2',start_date:'2026-09-10',end_date:'2026-09-30',finished_at:'2026-09-10T14:00:00Z',attempt_complete:true};}
test('Europe publishes immediately while America retains last good source and seats',()=>{
 const before=JSON.stringify(previous),merged=mergeCompletedRegion(previous,europe());
 assert.equal(JSON.stringify(previous),before);assert.equal(merged.rows.length,2);assert.equal(merged.rows.find(r=>r.destination==='JFK').sourceUpdatedAt,'day1');assert.equal(merged.rows.find(r=>r.destination==='CDG').sourceUpdatedAt,'day2');assert.equal(merged.mixed_sources,true);assert.equal(merged.worldwide_complete,false);
 const store=createStore(':memory:');try{store.importReport(merged);assert.equal(store.list().total,2);assert.equal(store.bootstrap().destinations.length,2);assert.equal(store.list({destination:'JFK'}).rows[0].source_updated_at,'day1');}finally{store.db.close();}
});
test('failed or missing month in a region cannot replace that region',()=>{
 const r=europe();r.coverage.pop();assert.throws(()=>mergeCompletedRegion(previous,r));r.coverage=europe().coverage;r.failed=[{destination:'CDG'}];assert.throws(()=>mergeCompletedRegion(previous,r));
});
