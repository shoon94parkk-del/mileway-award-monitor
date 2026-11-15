import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {watchPublicQueryDiagnostics} from '../src/public-query-diagnostics.mjs';

const endpoint='https://www.koreanair.com/api/hmp/bonusSeatView/bonusSeatView';
const expected={origin:'ICN',destination:'LHR',month:'2026-11'};
const secret='private-secret-marker';
function request(overrides={}){
 return {
  url:()=>endpoint+'?token='+secret,resourceType:()=> 'fetch',method:()=> 'POST',
  postData:()=>JSON.stringify({departureAirport:'ICN',arrivalAirport:'LHR',departureDate:'20261101',token:secret}),
  headerValue:async name=>{assert.equal(name,'content-type');return 'application/json; charset=utf-8';},
  headers:()=>assert.fail('All request headers must never be read'),
  failure:()=>({errorText:'net::ERR_FAILED '+secret}),...overrides
 };
}
function response(req,status=403){
 return {url:req.url,request:()=>req,status:()=>status,
  body:()=>assert.fail('Response bodies must never be read'),
  text:()=>assert.fail('Response bodies must never be read'),
  json:()=>assert.fail('Response bodies must never be read'),
  headers:()=>assert.fail('Response headers must never be read')};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('passive diagnostics separate preceding resource failures from an issued denied query',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 const script=request({url:()=> 'https://www.koreanair.com/app.js?token='+secret,resourceType:()=> 'script',
  postData:()=>assert.fail('Unrelated request body must never be read'),
  headerValue:()=>assert.fail('Unrelated request headers must never be read')});
 page.emit('request',script);
 diagnostic.setPhase('discovery');
 page.emit('requestfailed',script);
 page.emit('pageerror',Object.assign(Error(secret),{name:'TypeError'}));
 page.emit('console',{type:()=> 'error',text:()=>assert.fail('Console text must never be read')});
 diagnostic.beginQuery(expected);
 const req=request();
 page.emit('request',req);page.emit('response',response(req));
 await settle();
 const output=diagnostic.snapshot();
 assert.equal(output.phases.init.resources.same_origin.script.failed,1);
 assert.equal(output.phases.discovery.page_errors.TypeError,1);
 assert.equal(output.phases.discovery.console.error,1);
 assert.equal(output.phases.query.public_query.requests,1);
 assert.equal(output.phases.query.public_query.status_counts['403'],1);
 assert.deepEqual(output.queries[0].requests[0],{
  method:'POST',content_type:'application/json',body_schema:'KNOWN_FIELDS',
  departure_airport_matches:true,arrival_airport_matches:true,departure_date_matches:true
 });
 assert.doesNotMatch(JSON.stringify(output),/private-secret|https:|ICN|LHR|20261101|app\.js/);
});

test('query comparisons expose mismatches without disclosing unexpected request values',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 diagnostic.beginQuery(expected);
 page.emit('request',request({postData:()=>JSON.stringify({departureAirport:secret,arrivalAirport:'LHR',departureDate:secret})}));
 await settle();
 const value=diagnostic.snapshot().queries[0].requests[0];
 assert.equal(value.body_schema,'KNOWN_FIELDS');
 assert.equal(value.departure_airport_matches,false);
 assert.equal(value.arrival_airport_matches,true);
 assert.equal(value.departure_date_matches,false);
 assert.doesNotMatch(JSON.stringify(value),/private-secret/);
});

test('malformed, oversized, missing and unsupported schemas stay explicitly unknown',async()=>{
 for(const [body,want] of [[null,'NO_BODY'],['{'+secret,'MALFORMED_JSON'],
  [' '.repeat(16385),'OVERSIZED'],['"'+secret+'"','UNKNOWN'],
  [JSON.stringify({nested:{departureAirport:'ICN',arrivalAirport:'LHR',departureDate:'20261101'}}),'MISSING_FIELDS'],
  [JSON.stringify({departureAirport:1,arrivalAirport:'LHR',departureDate:'20261101'}),'MISSING_FIELDS']]){
  const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
  diagnostic.beginQuery(expected);page.emit('request',request({postData:()=>body}));
  await settle();
  const value=diagnostic.snapshot().queries[0].requests[0];
  assert.equal(value.body_schema,want);
  assert.equal(value.departure_airport_matches,null);
  assert.equal(value.arrival_airport_matches,null);
  assert.equal(value.departure_date_matches,null);
  assert.doesNotMatch(JSON.stringify(value),/private-secret|nested/);
 }
});

test('unreadable metadata does not throw or retain its error',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 diagnostic.beginQuery(expected);
 assert.doesNotThrow(()=>page.emit('request',request({method:()=>{throw Error(secret);},
  postData:()=>{throw Error(secret);},headerValue:async()=>{throw Error(secret);}})));
 await settle();
 const value=diagnostic.snapshot().queries[0].requests[0];
 assert.equal(value.method,'UNKNOWN');assert.equal(value.content_type,'UNKNOWN');
 assert.equal(value.body_schema,'UNREADABLE');
 assert.doesNotMatch(JSON.stringify(diagnostic.snapshot()),/private-secret/);
});

test('exact endpoint matching prevents body inspection on similar or unrelated URLs',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 diagnostic.beginQuery(expected);
 for(const url of ['https://advertiser.example/bonusSeatView',endpoint+'/extra',endpoint.replace('www.koreanair.com','www.koreanair.com.evil.example')]){
  const req=request({url:()=>url,postData:()=>assert.fail('Unrelated body read'),headerValue:()=>assert.fail('Unrelated headers read')});
  page.emit('request',req);page.emit('response',response(req));
 }
 await settle();
 const output=diagnostic.snapshot();
 assert.equal(output.phases.query.public_query.requests,0);
 assert.deepEqual(output.queries[0].requests,[]);
 assert.equal(output.phases.query.resources.other_origin.fetch.http_errors,2);
 assert.equal(output.phases.query.resources.same_origin.fetch.http_errors,1);
});

test('successful responses remain metadata-only and delayed responses keep their query attribution',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 diagnostic.beginQuery(expected);const req=request();page.emit('request',req);
 diagnostic.setPhase('discovery');page.emit('response',response(req,200));
 page.emit('requestfailed',req);
 await settle();
 const output=diagnostic.snapshot();
 assert.equal(output.phases.query.public_query.status_counts['200'],1);
 assert.equal(output.queries[0].status_counts['200'],1);
 assert.equal(output.queries[0].failed,1);
 assert.equal(output.phases.discovery.public_query.requests,0);
});

test('only exact error names, methods, media types and resource categories can be reported',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 page.emit('pageerror',{name:'TypeError '+secret,message:secret});
 page.emit('pageerror',{name:'__proto__',message:secret});
 let reads=0;
 page.emit('pageerror',{get name(){return reads++===0?'TypeError':secret;}});
 page.emit('console',{type:()=> secret,text:()=>secret});
 diagnostic.beginQuery(expected);
 const req=request({method:()=>secret,headerValue:async()=>secret,resourceType:()=>secret});
 page.emit('request',req);page.emit('response',response(req,secret));
 await settle();
 const output=diagnostic.snapshot();
 assert.equal(output.phases.init.page_errors.UNKNOWN,2);
 assert.equal(output.phases.init.page_errors.TypeError,1);
 assert.equal(output.queries[0].requests[0].method,'UNKNOWN');
 assert.equal(output.queries[0].requests[0].content_type,'UNKNOWN');
 assert.equal(output.phases.query.resources.same_origin.other.requested,1);
 assert.equal(output.queries[0].status_counts.UNKNOWN,1);
 assert.doesNotMatch(JSON.stringify(output),/private-secret|__proto__/);
});

test('diagnostic output remains bounded and detached snapshots do not mutate live counters',async()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 for(let i=0;i<20;i++){
  diagnostic.beginQuery(expected);
  for(let j=0;j<5;j++)page.emit('request',request());
 }
 await settle();
 const output=diagnostic.snapshot();
 assert.equal(output.query_limit_reached,true);
 assert.ok(output.queries.length<=8);
 assert.ok(output.queries.every(query=>query.requests.length<=3));
 assert.equal(output.phases.query.public_query.requests,100);
 output.phases.query.public_query.requests=0;
 assert.equal(diagnostic.snapshot().phases.query.public_query.requests,100);
 assert.ok(JSON.stringify(diagnostic.snapshot()).length<12000);
});

test('pending content type metadata cannot delay a snapshot and dispose stops observation',()=>{
 const page=new EventEmitter(),diagnostic=watchPublicQueryDiagnostics(page);
 diagnostic.beginQuery(expected);
 page.emit('request',request({headerValue:()=>new Promise(()=>{})}));
 assert.equal(diagnostic.snapshot().queries[0].requests[0].content_type,'UNKNOWN');
 diagnostic.dispose();
 page.emit('request',request());
 assert.equal(diagnostic.snapshot().phases.query.public_query.requests,1);
});
