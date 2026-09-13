import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicSeatRequest,validatePublicSeatResponse} from '../src/public-direct-client.mjs';

test('builds direct monthly request without mutating captured template',()=>{
  const template={departureAirport:'ICN',arrivalAirport:'LAX',departureDate:'20260901',tripType:'OW',keep:'same'};
  const body=buildPublicSeatRequest(template,{origin:'LAX',destination:'ICN',month:'2026-10'});
  assert.deepEqual(body,{departureAirport:'LAX',arrivalAirport:'ICN',departureDate:'20261001',tripType:'OW',keep:'same'});
  assert.deepEqual(template,{departureAirport:'ICN',arrivalAirport:'LAX',departureDate:'20260901',tripType:'OW',keep:'same'});
});

test('rejects malformed direct request coordinates and month',()=>{
  assert.throws(()=>buildPublicSeatRequest({}, {origin:'ICN',destination:'LA',month:'2026-10'}),/IATA/);
  assert.throws(()=>buildPublicSeatRequest({}, {origin:'ICN',destination:'LAX',month:'202610'}),/YYYY-MM/);
});

test('validates direct API route, month and flight day schema',()=>{
  const data={departureAirport:'ICN',arrivalAirport:'LAX',flightList:[{departureDate:'20261003',flightDetailList:[]}]};
  assert.equal(validatePublicSeatResponse(data,{origin:'ICN',destination:'LAX',month:'2026-10'}),data);
  assert.throws(()=>validatePublicSeatResponse(data,{origin:'LAX',destination:'ICN',month:'2026-10'}),/route or schema/);
  assert.throws(()=>validatePublicSeatResponse(data,{origin:'ICN',destination:'LAX',month:'2026-11'}),/different month/);
});
