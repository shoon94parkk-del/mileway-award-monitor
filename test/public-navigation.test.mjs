import test from 'node:test';
import assert from 'node:assert/strict';
import {openPublicPage} from '../src/public-navigation.mjs';
test('navigation retries transport errors and waits for visible UI',async()=>{
 let calls=0,ready=false;const page={goto:async(_,o)=>{assert.equal(o.waitUntil,'commit');if(++calls===1)throw Error('network timeout');return {status:()=>200,ok:()=>true};},locator:()=>({first:()=>({waitFor:async o=>{assert.equal(o.state,'visible');ready=true;}})})};
 await openPublicPage(page,{delay:async()=>{}});assert.equal(calls,2);assert.equal(ready,true);
});
test('navigation stops immediately on 403 and 429',async()=>{
 for(const status of [403,429]){let calls=0;await assert.rejects(openPublicPage({goto:async()=>{calls++;return {status:()=>status,ok:()=>false};}},{delay:async()=>{}}),/ACCESS_LIMIT/);assert.equal(calls,1);}
});
test('fresh public navigation preserves native subresource headers and disables cache through CDP',async()=>{
 const commands=[],targets=[];
 const page={
  context:()=>({newCDPSession:async()=>({send:async(method,parameters)=>commands.push({method,parameters})})}),
  setExtraHTTPHeaders:async()=>{throw Error('Page-wide headers would contaminate cross-origin resources');},
  goto:async(url)=>{targets.push(url);return {status:()=>200,ok:()=>true};},
  locator:()=>({first:()=>({waitFor:async()=>{}})})
 };
 await openPublicPage(page,{attempts:1});
 assert.equal(targets.length,1);
 assert.ok(new URL(targets[0]).searchParams.get('_mileway_cb'));
 assert.ok(commands.some(x=>x.method==='Network.setCacheDisabled'&&x.parameters.cacheDisabled===true));
 assert.ok(commands.some(x=>x.method==='Emulation.setTimezoneOverride'&&x.parameters.timezoneId==='Asia/Seoul'));
});
