import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePublicCalendar,parsePublicApi,monthRange} from '../src/public-calendar.mjs';

test('invalid and reversed date ranges are rejected before collection',()=>{
 assert.throws(()=>monthRange('2027-02-30','2027-03-01'));
 assert.throws(()=>monthRange('2027-04-02','2027-04-01'));
 assert.throws(()=>monthRange('bad','2027-04-01'));
});
const options={origin:'ICN',destination:'CDG',startDate:'2027-04-01',endDate:'2027-04-30',sourceUpdatedAt:'2026-09-08 23:00 KST'};
test('public calendar does not mistake prestige upgrade space for award space',()=>{
 const rows=parsePublicCalendar({month:'2027년 4월',heading:'ICN CDG',days:[{day:1,labels:['일반석 보너스','프레스티지석 좌석승급']},{day:2,labels:['프레스티지석 보너스','일등석 보너스/좌석승급']}]},options);
 assert.equal(rows[0].available,false); assert.equal(rows[2].available,true);
 assert.equal(rows[3].availabilityType,'AWARD_OR_UPGRADE'); assert.equal(rows[3].seats,null);
});
test('wrong route and empty/loading results cannot become unavailable records',()=>{
 assert.throws(()=>parsePublicCalendar({month:'2027년 4월',heading:'ICN LAS',days:[{day:1,labels:[]}]},options));
 assert.throws(()=>parsePublicCalendar({month:'2027년 4월',heading:'ICN CDG',days:[]},options));
});
test('month ranges cover year boundary and partial final month',()=>{
 assert.deepEqual(monthRange('2026-12-09','2027-02-04'),['2026-12','2027-01','2027-02']);
});
test('public API preserves flight-level O/A inventory, aircraft metadata, and excludes Z upgrades',()=>{
 const data={departureAirport:'ICN',arrivalAirport:'CDG',flightList:[{departureDate:'20270401',flightDetailList:[
 {flightNumber:'KE901',departureTime:'10:00',bookingClass:'Z',availableSeat:true,aircraftType:'789'},
 {flightNumber:'KE901',departureTime:'10:00',bookingClass:'O',availableSeat:false,aircraftType:'789'},
 {flightNumber:'KE901',departureTime:'10:00',bookingClass:'A',availableSeat:true,aircraftType:'789'}]}]};
 const rows=parsePublicApi(data,{...options,month:'2027-04'});
 assert.equal(rows.length,2);assert.equal(rows[0].available,false);assert.equal(rows[1].flight,'KE901');
 assert.equal(rows[0].aircraft,'789');
 assert.throws(()=>parsePublicApi(data,{...options,month:'2027-05'}));
});
test('representative public API fixture keeps O/A semantics and rejects route drift',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./fixtures/public-api-sample.json',import.meta.url),'utf8'));
 const rows=parsePublicApi(data,{...options,month:'2027-04'});
 assert.equal(rows.length,4);
 assert.equal(rows.filter(r=>r.available).length,2);
 assert.equal(rows.some(r=>r.fareClass==='Z'),false);
 assert.equal(rows.find(r=>r.date==='2027-04-02'&&r.fareClass==='A')?.available,true);
 assert.throws(()=>parsePublicApi({...data,arrivalAirport:'LHR'},{...options,month:'2027-04'}));
});
