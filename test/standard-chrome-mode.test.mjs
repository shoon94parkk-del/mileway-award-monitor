import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openPublicPage} from '../src/public-navigation.mjs';
import {PUBLIC_URL} from '../src/public-calendar.mjs';

test('standard Chrome navigation does not mutate the official URL or require CDP network access',async()=>{
 const old=process.env.MILEWAY_STANDARD_CHROME;
 process.env.MILEWAY_STANDARD_CHROME='1';
 let url=null,cdpCalled=false;
 const page={
   context(){cdpCalled=true;throw Error('CDP was not expected');},
   goto:async target=>{url=target;return {ok:()=>true,status:()=>200};},
   locator:selector=>({first:()=>({waitFor:async()=>{
     if(selector.includes('kds-fromto_1'))return;
     throw Error('Old selector not present');
   }})}),
   waitForTimeout:async()=>{}
 };
 try{
  await openPublicPage(page,{attempts:1});
  assert.equal(url,PUBLIC_URL);
  assert.equal(cdpCalled,false);
 }finally{
  if(old===undefined)delete process.env.MILEWAY_STANDARD_CHROME;
  else process.env.MILEWAY_STANDARD_CHROME=old;
 }
});
test('outbound and return collectors use installed Chrome and the normal Seoul-time context in standard mode',()=>{
 const root=new URL('../',import.meta.url);
 for(const file of ['src/public-extract.mjs','scripts/collect-europe-returns.mjs']){
  const src=fs.readFileSync(new URL(file,root),'utf8');
  assert.match(src,/MILEWAY_STANDARD_CHROME/);
  assert.match(src,/channel:'chrome'/);
  assert.match(src,/timezoneId:'Asia\/Seoul'/);
  assert.match(src,/standardChrome\?\{/);
 }
});
test('both GitHub collection workflows only use standard Chrome after cooldown preflight',()=>{
 const root=new URL('../',import.meta.url);
 for(const file of ['.github/workflows/collect.yml','.github/workflows/collect-europe-returns.yml']){
  const workflow=fs.readFileSync(new URL(file,root),'utf8');
  assert.match(workflow,/MILEWAY_STANDARD_CHROME: '1'/);
  assert.match(workflow,/scripts\/collection-preflight\.mjs/);
  assert.match(workflow,/needs\.canary\.outputs\.allowed == 'true'/);
 }
});
