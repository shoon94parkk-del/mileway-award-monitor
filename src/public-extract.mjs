import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {PUBLIC_URL,PUBLIC_API,readPublicCalendar,parsePublicCalendar,parsePublicApi,monthRange} from './public-calendar.mjs';
import {writePublicReport} from './public-report.mjs';
import {claimCollection} from './collection-lock.mjs';
import {candidateRegionLabels,parseDestinationButton} from './route-discovery.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const NETWORK_ARGS=['--disable-http2','--disable-quic'];
let pw;
try { pw=require('playwright'); } catch {
  const bundled=path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE,'AppData','Local'),'..','..','.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright');
  pw=require(bundled);
}
const value=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1]};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const start=value('--start',today);
const horizon=new Date(`${today}T00:00:00Z`);horizon.setUTCDate(horizon.getUTCDate()+360);
const end=value('--end',horizon.toISOString().slice(0,10));
const months=monthRange(start,end);
const only=value('--route',null)?.split(',');
const intervalMs=Math.max(2000,Number(value('--interval-ms','5000')));
const maxRetries=Math.max(1,Math.min(5,Number(value('--max-retries','3'))));
const stopFile=value('--stop-file',null);
const checkStop=()=>{if(stopFile&&fs.existsSync(stopFile))throw Error('Collection stopped by user');};
if(!Number.isFinite(intervalMs)||!Number.isFinite(maxRetries)) throw new Error('Invalid collector option');
const output=path.resolve(value('--output',path.join(root,'data','public')));fs.mkdirSync(output,{recursive:true});
const releaseCollection=claimCollection(path.join(output,'collection.lock'));
const previous=process.argv.includes('--resume')&&fs.existsSync(path.join(output,'results.json'))?JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8')):null;
const report={source:PUBLIC_URL,source_type:'KOREAN_AIR_PUBLIC_DAILY',started_at:new Date().toISOString(),start_date:start,end_date:end,complete:false,attempt_complete:false,coverage:[],unqueryable:[],failed:[],errors:[],rows:[]};
const writeJson=(name,value)=>{const file=path.join(output,name),temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2));fs.renameSync(temporary,file);};
const save=()=>{writeJson('results.json',report);writeJson('available.json',{...report,rows:report.rows.filter(r=>r.available)});writePublicReport(report,output);};
const db=new DatabaseSync(path.join(output,'seats.db'));
db.exec('CREATE TABLE IF NOT EXISTS snapshots (origin TEXT, destination TEXT, month TEXT, checked_at TEXT, source_updated_at TEXT, snapshot_json TEXT, PRIMARY KEY(origin,destination,month));');
const store=db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?,?)');
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),args:NETWORK_ARGS,headless:process.argv.includes('--headless')});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
page.setDefaultTimeout(20000);
const pending=new Set();
let apiErrors=[];
let lastPublicResponse=null;
const isPublicSeatApi=url=>url===PUBLIC_API||url.startsWith(PUBLIC_API+'?');
page.on('request',r=>{if(isPublicSeatApi(r.url()))pending.add(r);});
page.on('requestfinished',r=>pending.delete(r));
page.on('requestfailed',r=>{if(pending.has(r))apiErrors.push({url:r.url(),error:r.failure()?.errorText});pending.delete(r);});
page.on('response',r=>{if(isPublicSeatApi(r.url())&&r.status()>=400)apiErrors.push({url:r.url(),status:r.status()});});
if(process.argv.includes('--diagnose')) page.on('response',async r=>{
  if(isPublicSeatApi(r.url())) {
    try {
      const data=await r.json();
      const name=new URL(r.url()).pathname.replace(/[^a-zA-Z0-9]/g,'_');
      fs.writeFileSync(path.join(output,`${name}.json`),JSON.stringify({url:r.url(),method:r.request().method(),body:r.request().postData(),data},null,2));
      console.log(`PUBLIC API ${r.status()} ${new URL(r.url()).pathname}`);
    } catch {}
  }
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitForMonth=()=>page.waitForResponse(r=>isPublicSeatApi(r.url()),{timeout:30000});
async function regionList(kind,region) {
  await page.locator(`[id^="${kind}Btn"]`).click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.getByRole('button',{name:region,exact:true}).click();
  return page.locator('[id^="acc-panel-mobile-web"]:visible button:visible');
}
async function discoverDestinationRegions() {
  await page.locator('[id^="destinationBtn"]').click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  const texts=await page.locator('[id^="acc-panel-mobile-web"]:visible button:visible').allTextContents();
  const regions=candidateRegionLabels(texts);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  if(!regions.length)throw new Error('No destination regions discovered from Korean Air public selector');
  return regions;
}
async function dismissCookie() {
  const cookie=page.locator('kc-global-cookie-banner');
  if(!await cookie.count()) return;
  const reject=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
  if(await reject.count()) { await reject.click(); return; }
  const close=cookie.getByRole('button',{name:/닫기|Close/i}).first();
  if(await close.count()) { await close.click(); return; }
  throw new Error('Cookie banner needs a supported dismissal: '+(await cookie.locator('button').allTextContents()).join('|'));
}
async function initializeSearchPage(expectedSourceUpdatedAt=null) {
  pending.clear();apiErrors=[];lastPublicResponse=null;
  await page.goto(PUBLIC_URL,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[id^="departureBtn"]').waitFor({state:'attached',timeout:60000});
  await dismissCookie();
  await regionList('departure','대한민국');
  await page.getByRole('button',{name:/^ICN 서울\/인천/}).click();
  await page.locator('label[for="bonusTripType_OW"]').click();
  const note=await page.locator('body').innerText();
  const sourceUpdatedAt=note.match(/대한민국 시간\(([^)]+)\)/)?.[1] || null;
  if(!sourceUpdatedAt) throw new Error('Missing public data update timestamp');
  if(expectedSourceUpdatedAt&&sourceUpdatedAt!==expectedSourceUpdatedAt) {
    throw new Error(`Public source timestamp changed during collection: ${expectedSourceUpdatedAt} -> ${sourceUpdatedAt}`);
  }
  return sourceUpdatedAt;
}
async function selectDestination(route) {
  await regionList('destination',route.region);
  await page.getByRole('button',{name:new RegExp(`^${route.code} `)}).click();
}
async function collectMonth(route,monthKey) {
  checkStop();pending.clear();apiErrors=[];lastPublicResponse=null;
  await page.locator('#seatCalendarBtn').click();
  const baseYear=Number(await page.locator('#monthCalendarPopup').innerText().then(t=>t.match(/20\d{2}/)?.[0]));
  if(!Number.isFinite(baseYear)) throw new Error('Month calendar did not expose a base year');
  const [year,month]=monthKey.split('-').map(Number);
  await page.locator(`#monthCalendarPopup [id="${(year-baseYear)*12+month-1}"]`).click();
  await page.getByRole('button',{name:'선택',exact:true}).click();
  const responsePromise=waitForMonth();
  await page.getByRole('button',{name:'조회',exact:true}).click();
  const response=await responsePromise;
  if(!response.ok()) throw new Error(`Public API returned ${response.status()}`);
  const data=await response.json();
  lastPublicResponse={request:response.request().postData(),data};
  let requested;
  try { requested=JSON.parse(lastPublicResponse.request); } catch { throw new Error('Public API request body was not valid JSON'); }
  if(requested.departureAirport!=='ICN'||requested.arrivalAirport!==route.code||requested.departureDate!==monthKey.replace('-','')+'01') throw new Error('Unexpected public request parameters');
  if(data.departureAirport==='ICN'&&data.arrivalAirport===route.code&&Array.isArray(data.flightList)&&data.flightList.length===0){
    const notice='검색하신 여정은 조회가 불가합니다.';
    await page.getByText(notice,{exact:true}).waitFor({state:'visible'});
    const record={destination:route.code,month:monthKey,status:'UNQUERYABLE',reason:notice,checked_at:new Date().toISOString()};
    report.unqueryable.push(record);store.run('ICN',route.code,monthKey,record.checked_at,report.source_updated_at,JSON.stringify({api:data,notice}));save();
    console.log(`${route.code} ${monthKey}: UNQUERYABLE (not unavailable seats)`);
    await page.getByRole('button',{name:'확인',exact:true}).click();await sleep(intervalMs);return;
  }
  await page.locator('#travelCalendarPopup [id^="day_"]').first().waitFor();
  await sleep(intervalMs);
  const deadline=Date.now()+30000;
  while(pending.size&&Date.now()<deadline) await sleep(250);
  if(pending.size||apiErrors.length) throw new Error('Incomplete public seat API response: '+JSON.stringify(apiErrors));
  const expected=monthKey.split('-').map(Number);
  const expectedLabel=new RegExp(`${expected[0]}년\\s*${expected[1]}월`);
  let snapshot=await page.evaluate(readPublicCalendar);
  const renderDeadline=Date.now()+15000;
  while(!expectedLabel.test(snapshot.month)&&Date.now()<renderDeadline){await sleep(500);snapshot=await page.evaluate(readPublicCalendar);}
  if(!expectedLabel.test(snapshot.month)) {
    fs.writeFileSync(path.join(output,'last-calendar-error.json'),JSON.stringify({expected:monthKey,snapshot,api:data},null,2));
    throw new Error(`Calendar month did not advance: expected ${monthKey}, got ${snapshot.month}`);
  }
  const options={origin:'ICN',destination:route.code,month:monthKey,startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at};
  const calendarRows=parsePublicCalendar(snapshot,options);
  const rows=parsePublicApi(data,options);
  for(const displayed of calendarRows.filter(r=>r.available!==null)) {
    const apiAvailable=rows.some(r=>r.date===displayed.date&&r.cabin===displayed.cabin&&r.available);
    if(apiAvailable!==displayed.available) throw new Error(`API/calendar mismatch: ${displayed.date} ${displayed.cabin}`);
  }
  report.rows.push(...rows.map(r=>({...r,region:route.region})));
  report.coverage.push({destination:route.code,month:monthKey,days:calendarRows.length/2,flightClassRows:rows.length});
  store.run('ICN',route.code,monthKey,new Date().toISOString(),report.source_updated_at,JSON.stringify({calendar:snapshot,api:data}));
  save();
  console.log(`${route.code} ${monthKey}: ${calendarRows.length/2} days, ${rows.filter(r=>r.available).length} flight/class matches`);
  await page.locator('#travelCalendarCloseBtn').click();
}
async function writeFailureDiagnostic(route,monthKey,attempt,error) {
  fs.writeFileSync(path.join(output,'last-public-error.json'),JSON.stringify({destination:route.code,month:monthKey,attempt,message:error.message,response:lastPublicResponse,pageText:await page.locator('body').innerText().catch(()=>''),calendar:await page.evaluate(readPublicCalendar).catch(()=>null)},null,2));
}

try {
  report.source_updated_at=await initializeSearchPage();
  if(previous&&(previous.source_updated_at!==report.source_updated_at||previous.start_date!==start||previous.end_date!==end)){
    const history=path.join(output,'history');fs.mkdirSync(history,{recursive:true});
    const stamp=(previous.source_updated_at||'unknown').replace(/[^0-9a-zA-Z]/g,'_');
    const filename=path.join(history,`${stamp}_${previous.start_date}_${previous.end_date}.json`);
    if(!fs.existsSync(filename))fs.writeFileSync(filename,JSON.stringify(previous,null,2),{flag:'wx'});
  }
  if(previous && previous.source_updated_at===report.source_updated_at && previous.start_date===start && previous.end_date===end) {
    report.rows=previous.rows||[];report.coverage=previous.coverage||[];report.unqueryable=previous.unqueryable||[];
    console.log(`Resuming ${report.coverage.length+report.unqueryable.length} saved route/months from the same daily data`);
  }
  const regions=await discoverDestinationRegions();
  const routes=[];
  for (const region of regions) {
    const buttons=await regionList('destination',region);
    const found=[];
    for(const text of await buttons.allTextContents()) {
      const route=parseDestinationButton(text,region);
      if(route&&!routes.some(r=>r.code===route.code)){routes.push(route);found.push(route);}
    }
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    if(!found.length)throw new Error(`Destination region ${region} contained no airport buttons`);
  }
  report.routes=routes;
  const selected=routes.filter(r=>!only||only.includes(r.code));
  if(!selected.length) throw new Error('No requested route appears in the public calendar');
  report.target_routes=selected.map(r=>r.code);
  console.log(`PUBLIC DAILY WORLDWIDE: ${selected.length} routes across ${regions.length} regions, ${months.length} months, updated ${report.source_updated_at}`);
  for (const route of selected) {
    checkStop();
    const routeMonths=months.filter(month=>!report.coverage.some(c=>c.destination===route.code&&c.month===month)&&!report.unqueryable.some(c=>c.destination===route.code&&c.month===month));
    if(!routeMonths.length) continue;
    await selectDestination(route);
    for(const monthKey of routeMonths) {
      let success=false,lastError=null;
      for(let attempt=1;attempt<=maxRetries;attempt++) {
        try {
          await collectMonth(route,monthKey);success=true;break;
        } catch(e) {
          lastError=e;await writeFailureDiagnostic(route,monthKey,attempt,e);
          console.error(`${route.code} ${monthKey}: attempt ${attempt}/${maxRetries} failed: ${e.message}`);
          if(attempt<maxRetries) {
            const backoff=Math.min(60000,5000*Math.pow(2,attempt-1));
            await sleep(backoff);
            await initializeSearchPage(report.source_updated_at);
            await selectDestination(route);
          }
        }
      }
      if(!success) {
        const failed={destination:route.code,month:monthKey,status:'FAILED',attempts:maxRetries,message:lastError?.message||'Unknown collection failure',checked_at:new Date().toISOString()};
        report.failed.push(failed);report.errors.push({destination:route.code,month:monthKey,message:failed.message});save();
        console.error(`${route.code} ${monthKey}: FAILED after ${maxRetries} attempts; continuing remaining route/months`);
        await initializeSearchPage(report.source_updated_at);
        await selectDestination(route);
      }
    }
  }
  report.complete=report.failed.length===0&&report.target_routes.every(code=>months.every(month=>report.coverage.some(c=>c.destination===code&&c.month===month)));
  report.attempt_complete=report.failed.length===0&&report.target_routes.every(code=>months.every(month=>[...report.coverage,...report.unqueryable].some(c=>c.destination===code&&c.month===month)));
  report.finished_at=new Date().toISOString();save();
  console.log(`Saved ${report.rows.filter(r=>r.available).length} matches to ${output}`);
  if(report.failed.length) {
    report.failure=`${report.failed.length} route/month collections failed after retries`;
    save();process.exitCode=1;
  }
} catch(e) {
  report.failure=e.message;report.finished_at=new Date().toISOString();
  if(report.coverage.length||report.unqueryable.length||report.failed.length)save();else writeJson('last-run-error.json',{at:new Date().toISOString(),message:e.message});
  console.error(e.message);process.exitCode=1;
}
finally {await browser.close();db.close();releaseCollection();}
