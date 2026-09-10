import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mileway-api-test-'));
const child=spawn(process.execPath,['--no-warnings',path.join(root,'src/server.mjs')],{cwd:root,env:{...process.env,PORT:'4174',MILE_DB:path.join(dir,'test.db'),MILE_TEST_MODE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:4174';
try {
 await Promise.race([new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(d.toString().includes('Mileway is ready'))resolve();});child.once('error',reject);child.once('exit',code=>reject(Error('Test server exit '+code)));}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Test server startup timeout')),30000);t.unref();})]);
 const request=async(url,options)=>{const r=await fetch(base+url,options);return {status:r.status,data:await r.json()};};
 const {data:b}=await request('/api/bootstrap');assert.ok(b.report.coverage.length>0);assert.ok(b.token);
 const {data:all}=await request('/api/seats?limit=50000');assert.equal(all.total,b.stats.available);assert.ok(all.total>0);const seat=all.rows[0];
 const {data:filtered}=await request('/api/seats?destination='+seat.destination+'&cabin='+seat.cabin);assert.ok(filtered.rows.every(r=>r.destination===seat.destination&&r.cabin===seat.cabin));
 const {data:calendar}=await request('/api/calendar');assert.equal(calendar.reduce((n,d)=>n+d.count,0),all.total);
 const {data:exp}=await request('/api/export?offset=30');assert.equal(exp.rows.length,all.total);assert.equal(exp.offset,0);assert.equal(exp.source_type,'KOREAN_AIR_PUBLIC_DAILY');assert.deepEqual(exp.unqueryable,b.report.unqueryable||[]);assert.equal(exp.attempt_complete,!!b.report.attempt_complete);
 const mutate=(data,extra={})=>({method:'POST',headers:{'Content-Type':'application/json','x-local-token':b.token,...extra},body:JSON.stringify(data)});
 assert.equal((await request('/api/favorite',{method:'POST',body:'{}'})).status,403);
 assert.equal((await request('/api/favorite',mutate({id:seat.id,saved:true},{Origin:'https://example.com'}))).status,403);
 assert.equal((await request('/api/favorite',mutate({id:seat.id,saved:true}))).status,200);
 assert.equal((await request('/api/seats?saved=true')).data.total,1);
 assert.equal((await request('/api/seats/'+seat.id)).data.saved,1);
 const {data:search}=await request('/api/searches',mutate({name:'검증용 검색',filters:{destination:seat.destination}}));assert.ok(search.id);
 assert.equal((await request('/api/bootstrap')).data.searches.length,1);
 assert.equal((await request('/api/searches/'+search.id,{method:'DELETE',headers:{'x-local-token':b.token}})).status,200);
 for(const url of ['/','/app.js','/style.css','/favicon.svg']){const r=await fetch(base+url);assert.equal(r.status,200);assert.ok(r.headers.get('content-security-policy'));assert.ok((await r.text()).length>10);}
 assert.equal((await request('/not-a-route')).status,404);
 console.log(JSON.stringify({passed:true,checks:['bootstrap','filters','calendar aggregates','complete export','favorites','saved searches','CSRF and Origin rejection','static assets','404'],available:all.total,coverage:b.report.coverage.length}));
}finally{
 child.kill();await once(child,'exit').catch(()=>{});
 // Only this test's resolved mkdtemp child is removed, never the live application database.
 const target=path.resolve(dir),parent=path.resolve(os.tmpdir());
 if(path.dirname(target)!==parent||!path.basename(target).startsWith('mileway-api-test-'))throw Error('Unexpected temporary path');
 fs.rmSync(target,{recursive:true});
}
