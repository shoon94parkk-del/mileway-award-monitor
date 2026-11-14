import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {watchPublicAccess} from '../src/public-access-limit.mjs';
import {readOutboundScreen} from '../src/outbound-ui-collector.mjs';

const response=(status,url='https://www.koreanair.com/api/hmp/bonusSeatView/bonusSeatView')=>({
 status:()=>status,url:()=>url,
 json:()=>{throw Error('Seat response body must never be read');}
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
