import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore,seatKey} from '../src/app-store.mjs';
const row={date:'2027-04-04',origin:'ICN',destination:'CDG',flight:'KE901',departureTime:'10:00',cabin:'PRESTIGE',fareClass:'O',available:true,region:'유럽',sourceUpdatedAt:'day1',checkedAt:'2026-09-09T04:00:00Z',availabilityType:'AWARD'};
const report=(rows=[row],overrides={})=>({rows,coverage:[{destination:'CDG',month:'2027-04'}],routes:[{code:'CDG',region:'유럽'}],source_updated_at:'day1',start_date:'2027-04-01',end_date:'2027-04-30',complete:true,...overrides});
const catalog=[{code:'CDG',city:'파리',country:'프랑스'}];
test('SQLite import, filters, calendar, favorite persistence, and non-duplicated changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-test-')),file=path.join(dir,'test.db');let store=createStore(file,catalog);
 try {
 store.importReport(report());assert.equal(store.list().total,1);assert.equal(store.list({q:'파리'}).total,1);assert.equal(store.list({destination:'LAX'}).total,0);assert.equal(store.list({weekend:'true'}).total,1);assert.equal(store.calendar({})[0].count,1);
 assert.equal(store.bootstrap().changes.length,0);store.favorite(seatKey(row),true);store.saveSearch('봄 파리',{destination:'CDG'});store.importReport(report());assert.equal(store.bootstrap().changes.length,0);
 store.db.close();store=createStore(file,catalog);assert.equal(store.list({saved:'true'}).total,1);assert.equal(store.bootstrap().searches[0].name,'봄 파리');
 const changed={...row,sourceUpdatedAt:'day2',checkedAt:'2026-09-10T04:00:00Z',available:false};store.importReport(report([changed],{source_updated_at:'day2'}));assert.equal(store.list().total,0);assert.equal(store.list({saved:'true'}).rows[0].available,0);assert.equal(store.bootstrap().changes.length,1);store.importReport(report([changed],{source_updated_at:'day2'}));assert.equal(store.bootstrap().changes.length,1);
 assert.equal(store.list({limit:'Infinity',offset:'NaN'}).limit,30);assert.throws(()=>store.saveSearch('',{}));assert.throws(()=>store.favorite('missing',true));
 }finally{store.db.close();fs.rmSync(dir,{recursive:true});}
});
test('old and uncovered results never masquerade as current availability',()=>{
 const store=createStore(':memory:',catalog);try{store.importReport(report());store.favorite(seatKey(row),true);store.importReport(report([],{coverage:[],complete:false}));assert.equal(store.list().total,0);assert.equal(store.list({saved:'true'}).total,1);store.importReport(report([],{source_updated_at:'day2',coverage:[],complete:false}));assert.equal(store.bootstrap().stats.available,0);assert.equal(store.bootstrap().changes.length,0);}finally{store.db.close();}
});
