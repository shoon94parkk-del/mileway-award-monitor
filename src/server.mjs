import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createStore} from './app-store.mjs';
import {createCollectionRunner} from './collection-runner.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});
const reportFile=path.join(data,'public/results.json');
const store=createStore(process.env.MILE_DB||path.join(data,'mileway.db'),JSON.parse(fs.readFileSync(path.join(root,'routes.json'),'utf8')).routes);
const token=randomBytes(24).toString('hex');const port=Number(process.env.PORT||4173);
const runner=createCollectionRunner(root,{disabled:process.env.MILE_TEST_MODE==='1'||process.env.MILE_COLLECTION_PAUSED==='1',stateDirectory:process.env.MILE_DB?path.dirname(process.env.MILE_DB):data});
store.sync(reportFile);const poll=setInterval(()=>{try{store.sync(reportFile);}catch(e){console.error('Import:',e.message);}},4000);
const scanState=()=>runner.status();
const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>20000)throw new Error('Request too large');}return JSON.parse(text||'{}');}
const server=http.createServer(async(req,res)=>{
 try {
  const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];if(!hosts.includes(req.headers.host)){json(res,403,{error:'Local access only'});return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`);const filters=Object.fromEntries(url.searchParams);
  if(req.method==='POST'||req.method==='DELETE'){
   if(req.headers['x-local-token']!==token||req.headers.origin&&!hosts.some(h=>req.headers.origin===`http://${h}`)){json(res,403,{error:'Invalid local request'});return;}
  }
  if(req.method==='GET'&&url.pathname==='/api/bootstrap'){store.sync(reportFile);json(res,200,{...store.bootstrap(),scan:scanState(),token});return;}
  if(req.method==='GET'&&url.pathname==='/api/seats'){json(res,200,store.list(filters));return;}
  if(req.method==='GET'&&url.pathname==='/api/calendar'){json(res,200,store.calendar(filters));return;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/seats/')){const row=store.getSeat(url.pathname.split('/').pop());json(res,row?200:404,row||{error:'Not found'});return;}
  if(req.method==='GET'&&url.pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="mileway-seats.json"');json(res,200,{source_type:'KOREAN_AIR_PUBLIC_DAILY',source_updated_at:store.report.source_updated_at,complete:store.report.complete,attempt_complete:!!store.report.attempt_complete,coverage:store.report.coverage,unqueryable:store.report.unqueryable||[],...store.list({...filters,offset:0,limit:50000})});return;}
  if(req.method==='POST'&&url.pathname==='/api/favorite'){const b=await body(req);store.favorite(b.id,b.saved===true);json(res,200,{ok:true});return;}
  if(req.method==='POST'&&url.pathname==='/api/searches'){const b=await body(req);json(res,200,{id:Number(store.saveSearch(b.name,b.filters||{}))});return;}
  if(req.method==='DELETE'&&/^\/api\/searches\/\d+$/.test(url.pathname)){store.deleteSearch(Number(url.pathname.split('/').pop()));json(res,200,{ok:true});return;}
  if(req.method==='POST'&&url.pathname==='/api/scan'){
   if(scanState().running){json(res,409,{error:'이미 수집 중입니다. 완료된 결과부터 확인할 수 있어요.'});return;}
   json(res,202,runner.start());return;
  }
  if(req.method==='POST'&&url.pathname==='/api/scan/stop'){json(res,200,runner.stop());return;}
  if(req.method==='POST'&&url.pathname==='/api/automation'){json(res,200,runner.configure(await body(req)));return;}
  if(req.method!=='GET'){json(res,404,{error:'Not found'});return;}
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};
  const file=files[url.pathname];if(!file){json(res,404,{error:'Not found'});return;}
  const content=fs.readFileSync(path.join(root,'web',file));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(content);
 }catch(e){json(res,400,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Mileway is ready: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.message);clearInterval(poll);runner.close();store.db.close();process.exitCode=1;});
process.on('SIGINT',()=>{clearInterval(poll);runner.close();server.close();store.db.close();process.exit();});
