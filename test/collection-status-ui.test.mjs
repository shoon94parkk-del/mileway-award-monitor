import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

async function render({status={},health={},report={},deviceToken='',sourceBannerText}={}){
 const elements=new Map(['#ux-status-rail','#ux-health-value','#ux-source-value','#ux-result-value',
  '#ux-alert-value','.ux-health'].map(id=>[id,{textContent:'',title:'',classList:{toggle(){}}}]));
 if(sourceBannerText!==undefined)elements.set('#source-time',{textContent:sourceBannerText});
 const context=vm.createContext({Date,Intl,Number,String,Promise,console,
  document:{documentElement:{dataset:{uxReferenceBound:'1'}},querySelector:id=>elements.get(id)||null},
  localStorage:{getItem:()=>deviceToken},setTimeout(){},setInterval(){},
  fetch:async url=>{
   if(url.includes('/public-data/status.json'))return {ok:true,json:async()=>status};
   if(url.includes('/public-data/health.json'))return {ok:true,json:async()=>health};
   if(url.includes('/public-data/snapshot.json'))return {ok:true,json:async()=>({bootstrap:{report}})};
   if(url==='https://mileway-alert-api-hoon.onrender.com/me')return {
    ok:true,json:async()=>({telegram_linked:true,rule_count:2})};
   return {ok:false};
  }
 });
 vm.runInContext(fs.readFileSync('web/ux-reference-polish.js','utf8'),context);
 await vm.runInContext('syncHealth()',context);
 if(sourceBannerText!==undefined)vm.runInContext('syncVisibleValues()',context);
 return elements;
}

test('access denied is visibly distinct from general collection failure and keeps last-good meaning',async()=>{
 const e=await render({status:{collector_status:'failed',error_code:'ACCESS_LIMIT'},
  health:{status:'degraded',last_error_step:'collection',last_error_code:'ACCESS_LIMIT'},
  report:{source_updated_at:'2026년 11월 12일 01:30'}});
 assert.equal(e.get('#ux-health-value').textContent,'접근 제한');
 assert.match(e.get('.ux-health').title,/대한항공/);
 assert.match(e.get('.ux-health').title,/마지막 확인 자료/);
 assert.equal(e.get('#ux-source-value').textContent,'11/12 01:30 · 이전 자료');
});
test('an old denied attempt cannot label a newer successful publication blocked',async()=>{
 const e=await render({status:{publication_id:'old',collector_status:'failed',error_code:'ACCESS_LIMIT'},
  health:{status:'degraded',last_error_step:'collection',last_error_code:'ACCESS_LIMIT',last_error_at:'2026-11-12T00:00:00Z'},
  report:{publication_id:'new',attempt_complete:true,finished_at:'2026-11-14T00:00:00Z'}});
 assert.notEqual(e.get('#ux-health-value').textContent,'접근 제한');
});
test('general collection failure retains its separate label',async()=>{
 const e=await render({status:{collector_status:'failed',error_code:'collection'}});
 assert.equal(e.get('#ux-health-value').textContent,'수집 실패');
});
test('device alert status is read from the current production alert API',async()=>{
 const e=await render({deviceToken:'private-test-device'});
 assert.equal(e.get('#ux-alert-value').textContent,'Telegram ON · 2개');
});
test('background regional banner updates cannot replace the verified source date with prose',async()=>{
 const e=await render({status:{collector_status:'failed',error_code:'ACCESS_LIMIT'},
  report:{source_updated_at:'2026년 11월 12일 01:30'},
  sourceBannerText:'완료된 지역부터 즉시 반영 · 실시간 자료 아님'});
 assert.equal(e.get('#ux-source-value').textContent,'11/12 01:30 · 이전 자료');
});
