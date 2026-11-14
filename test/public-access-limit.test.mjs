import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {watchPublicAccess} from '../src/public-access-limit.mjs';
import {readOutboundScreen} from '../src/outbound-ui-collector.mjs';

const response=(status,url='https://www.koreanair.com/api/hmp/bonusSeatView/bonusSeatView')=>({
 status:()=>status,url:()=>url,
 json:()=>{throw Error('Seat response body must never be read');}
});
const denialResponse=(status,contentType,body,server=null)=>({
 ...response(status),
 headerValue:async name=>{
  assert.ok(['content-type','server'].includes(name));
  return name==='content-type'?contentType:server;
 },
 body:async()=>Buffer.from(body)
});
test('public query denial is latched from HTTP metadata and never becomes empty seats',()=>{
 for(const status of [403,429]){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  access.throwIfBlocked();
  page.emit('response',response(status));
  assert.throws(()=>access.throwIfBlocked(),error=>error.code==='ACCESS_LIMIT'&&error.httpStatus===status);
  page.emit('response',response(200));
  assert.throws(()=>access.throwIfBlocked(),/ACCESS_LIMIT/);
  assert.equal(watchPublicAccess(page),access);
  assert.equal(page.listenerCount('response'),1);
 }
});
test('unrelated advertising failures and successful public requests do not block collection',()=>{
 const page=new EventEmitter(),access=watchPublicAccess(page);
 page.emit('response',response(403,'https://advertiser.example/bonusSeatView'));
 page.emit('response',response(403,'https://www.koreanair.com/unrelated'));
 page.emit('response',response(200));
 page.emit('response',response(500));
 assert.doesNotThrow(()=>access.throwIfBlocked());
});
test('outbound reader stops an already denied query before parsing any calendar',async()=>{
 const page=new EventEmitter();
 watchPublicAccess(page);
 page.emit('response',response(403));
 await assert.rejects(readOutboundScreen(page,{route:{code:'LHR'},month:'2026-11',
  start:'2026-11-14',end:'2026-11-30',sourceUpdatedAt:null}),error=>error.code==='ACCESS_LIMIT');
});
test('denial arriving during the last polling delay retains its access-limit classification',async t=>{
 t.mock.timers.enable({apis:['Date'],now:100000});
 const page=new EventEmitter();
 page.locator=()=>({ariaSnapshot:async()=>'- heading "보너스 좌석 조회"'});
 page.waitForTimeout=async()=>{
  page.emit('response',response(403));
  t.mock.timers.tick(1001);
 };
 await assert.rejects(readOutboundScreen(page,{route:{code:'LHR'},month:'2026-11',
  start:'2026-11-14',end:'2026-11-30',sourceUpdatedAt:null,timeoutMs:1000}),error=>error.code==='ACCESS_LIMIT');
});
test('denial diagnostics retain only fixed classifications from an explicit HTML refusal',async()=>{
 const page=new EventEmitter(),access=watchPublicAccess(page);
 const secret='private-cookie-and-reference-token';
 page.emit('response',denialResponse(403,'text/html; charset=UTF-8',
  '<html><title>Access Denied</title><body>Request blocked. Reference '+secret+'</body></html>'));
 assert.throws(()=>access.throwIfBlocked(),error=>error.code==='ACCESS_LIMIT'&&!error.message.includes(secret));
 assert.deepEqual(await access.denialDiagnostic(),{
  http_status:403,content_type:'text/html',response_kind:'HTML',denial_kind:'ACCESS_DENIED',edge_provider_hint:'UNKNOWN'
 });
});
test('edge provider hints require exact known server markers and never retain raw header values',async()=>{
 for(const [server,want] of [['AkamaiGHost','AKAMAI'],[' cloudflare ','CLOUDFLARE'],
  ['akamai','UNKNOWN'],['nginx private-header-secret','UNKNOWN'],['cloudflare.private-header-secret','UNKNOWN']]){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  page.emit('response',denialResponse(403,'text/html','<title>Access Denied</title>private-body-secret',server));
  const diagnostic=await access.denialDiagnostic();
  assert.deepEqual(diagnostic,{http_status:403,content_type:'text/html',response_kind:'HTML',
   denial_kind:'ACCESS_DENIED',edge_provider_hint:want});
  assert.doesNotMatch(JSON.stringify(diagnostic),/private-|AkamaiGHost|cloudflare/);
 }
});
test('only explicit Akamai error-page URL domains provide an HTML vendor hint',async()=>{
 for(const [body,want] of [
  ['<title>Access Denied</title><p>https://errors.edgesuite.net/private-reference-token</p>','AKAMAI'],
  ['<title>Access Denied</title><a href="https://errors.akamai.com/private-reference-token">Error details</a>','AKAMAI'],
  ['<title>Access Denied</title><p>HTTP 403 Forbidden</p>','UNKNOWN'],
  ['<title>Access Denied</title><p>Served by Akamai or Cloudflare</p>','UNKNOWN'],
  ['<title>Access Denied</title><a href="https://errors.edgesuite.net.evil.example/private-reference-token">Error</a>','UNKNOWN'],
  ['<script>const help="https://errors.akamai.com/private-reference-token";</script><title>Error</title>','UNKNOWN']
 ]){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  page.emit('response',denialResponse(403,'text/html',body));
  const diagnostic=await access.denialDiagnostic();
  assert.equal(diagnostic.edge_provider_hint,want);
  assert.doesNotMatch(JSON.stringify(diagnostic),/private-|edgesuite|akamai\.com|evil\.example/);
 }
});
test('HTML format alone and script-only denial strings do not establish access-denied content',async()=>{
 for(const body of ['<html><title>Error</title><body>Please try again later</body></html>',
  '<html><script>const message="Access Denied";</script><body>Unknown error</body></html>']){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  page.emit('response',denialResponse(403,'text/html',body));
  assert.equal((await access.denialDiagnostic()).denial_kind,'UNKNOWN');
 }
});
test('JSON denial classification examines only bounded error fields and never returns their values',async()=>{
 const fixtures=[
  {body:{error:{code:'SESSION_EXPIRED',message:'private-session-token'}},want:'APPLICATION_SESSION_OR_CSRF'},
  {body:{errorCode:'INVALID_CSRF_TOKEN',token:'private-csrf-token'},want:'APPLICATION_SESSION_OR_CSRF'},
  {body:{code:'VALIDATION_FAILED',message:'Invalid request parameter: private-input'},want:'APPLICATION_VALIDATION'},
  {body:{errors:[{message:'Missing required parameter',value:'private-input'}]},want:'APPLICATION_VALIDATION'},
  {body:{error:{message:'Access denied',reference:'private-reference'}},want:'ACCESS_DENIED'},
  {body:{flightList:[{message:'Invalid CSRF token'}],session:'private-session-token'},want:'UNKNOWN'},
  {body:{error:{details:{message:'Invalid CSRF token'}}},want:'UNKNOWN'}
 ];
 for(const {body,want} of fixtures){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  page.emit('response',denialResponse(403,'application/json; charset=utf-8',JSON.stringify(body)));
  const diagnostic=await access.denialDiagnostic();
  assert.deepEqual(diagnostic,{http_status:403,content_type:'application/json',response_kind:'JSON',denial_kind:want,edge_provider_hint:'UNKNOWN'});
  assert.doesNotMatch(JSON.stringify(diagnostic),/private-|flightList|Invalid CSRF|Missing required/);
 }
});
test('oversized, malformed, and unreadable denial bodies remain unknown without leaking errors',async()=>{
 for(const item of [
  denialResponse(429,'application/problem+json','{"title":"Validation failed","padding":"'+'x'.repeat(16384)+'"}'),
  denialResponse(429,'application/problem+json','{"message":"private-malformed'),
  {...denialResponse(429,'application/problem+json',''),body:async()=>{throw Error('private-read-error');}}
 ]){
  const page=new EventEmitter(),access=watchPublicAccess(page);
  page.emit('response',item);
  assert.deepEqual(await access.denialDiagnostic(),{
   http_status:429,content_type:'application/problem+json',response_kind:'JSON',denial_kind:'UNKNOWN',edge_provider_hint:'UNKNOWN'
  });
 }
});
test('unrecognized content types cannot expose arbitrary header values or body classifications',async()=>{
 const page=new EventEmitter(),access=watchPublicAccess(page);
 page.emit('response',denialResponse(403,'private-header-secret','Access Denied private-body-secret'));
 assert.deepEqual(await access.denialDiagnostic(),{
  http_status:403,content_type:null,response_kind:'UNKNOWN',denial_kind:'UNKNOWN',edge_provider_hint:'UNKNOWN'
 });
});
test('a pending denial body cannot delay the status latch or diagnostic drain beyond one second',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const page=new EventEmitter(),access=watchPublicAccess(page);
 page.emit('response',{...denialResponse(403,'text/html',''),body:()=>new Promise(()=>{})});
 assert.throws(()=>access.throwIfBlocked(),error=>error.code==='ACCESS_LIMIT'&&error.httpStatus===403);
 const diagnostic=access.denialDiagnostic();
 await new Promise(resolve=>setImmediate(resolve));
 t.mock.timers.tick(1000);
 assert.deepEqual(await diagnostic,{http_status:403,content_type:'text/html',response_kind:'HTML',denial_kind:'UNKNOWN',edge_provider_hint:'UNKNOWN'});
});
test('denial diagnostics ignore successful and unrelated response bodies and keep the first refusal',async()=>{
 const page=new EventEmitter(),access=watchPublicAccess(page);
 const untouched=status=>({...response(status),
  body:()=>{assert.fail('Unrelated or successful response body was read');},
  headerValue:()=>{assert.fail('Unrelated or successful response headers were read');}
 });
 page.emit('response',untouched(200));
 page.emit('response',{...untouched(403),url:()=> 'https://advertiser.example/bonusSeatView'});
 assert.equal(await access.denialDiagnostic(),null);
 page.emit('response',denialResponse(403,'application/json','{"message":"Validation failed"}'));
 page.emit('response',untouched(429));
 assert.deepEqual(await access.denialDiagnostic(),{
  http_status:403,content_type:'application/json',response_kind:'JSON',denial_kind:'APPLICATION_VALIDATION',edge_provider_hint:'UNKNOWN'
 });
});
