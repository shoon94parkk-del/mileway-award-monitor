import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {PUBLIC_URL,PUBLIC_API,readPublicCalendar,parsePublicCalendar,parsePublicApi,monthRange} from './public-calendar.mjs';
import {writePublicReport} from './public-report.mjs';
import {claimCollection} from './collection-lock.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
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
const stopFile=value('--stop-file',null);
const checkStop=()=>{if(stopFile&&fs.existsSync(stopFile))throw Error('Collection stopped by user');};
if(!Number.isFinite(intervalMs)) throw new Error('Invalid interval');
const output=path.resolve(value('--output',path.join(root,'data','public')));fs.mkdirSync(output,{recursive:true});
const releaseCollection=claimCollection(path.join(output,'collection.lock'));
const previous=process.argv.includes('--resume')&&fs.existsSync(path.join(output,'results.json'))?JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8')):null;
const report={source:PUBLIC_URL,source_type:'KOREAN_AIR_PUBLIC_DAILY',started_at:new Date().toISOString(),start_date:start,end_date:end,complete:false,coverage:[],unqueryable:[],errors:[],rows:[]};
const writeJson=(name,value)=>{const file=path.join(output,name),temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2));fs.renameSync(temporary,file);};
const save=()=>{writeJson('results.json',report);writeJson('available.json',{...report,rows:report.rows.filter(r=>r.available)});writePublicReport(report,output);};
const db=new DatabaseSync(path.join(output,'seats.db'));
db.exec('CREATE TABLE IF NOT EXISTS snapshots (origin TEXT, destination TEXT, month TEXT, checked_at TEXT, source_updated_at TEXT, snapshot_json TEXT, PRIMARY KEY(origin,destination,month));');
const store=db.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?,?)');
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),headless:process.argv.includes('--headless')});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
page.setDefaultTimeout(20000);
const pending=new Set();
const apiErrors=[];
let lastPublicResponse=null;
page.on('request',r=>{if(r.url().startsWith('https://www.koreanair.com/api/'))pending.add(r);});
page.on('requestfinished',r=>pending.delete(r));
page.on('requestfailed',r=>{if(pending.has(r))apiErrors.push({url:r.url(),error:r.failure()?.errorText});pending.delete(r);});
page.on('response',r=>{if(r.url().startsWith('https://www.koreanair.com/api/')&&r.status()>=400)apiErrors.push({url:r.url(),status:r.status()});});
if(process.argv.includes('--diagnose')) page.on('response',async r=>{
  if(r.url().startsWith('https://www.koreanair.com/api/')&&!/uiCommon|\/main\/|gdpr|languageInfo/.test(r.url())) {
    try {
      const data=await r.json();
      const name=new URL(r.url()).pathname.replace(/[^a-zA-Z0-9]/g,'_');
      fs.writeFileSync(path.join(output,`${name}.json`),JSON.stringify({url:r.url(),method:r.request().method(),body:r.request().postData(),data},null,2));
      console.log(`PUBLIC API ${r.status()} ${new URL(r.url()).pathname}`);
    } catch {}
  }
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitForMonth=()=>page.waitForResponse(r=>r.url()===PUBLIC_API,{timeout:30000});
async function regionList(kind,region) {
  await page.locator(`[id^="${kind}Btn"]`).click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.getByRole('button',{name:region,exact:true}).click();
  return page.locator('[id^="acc-panel-mobile-web"]:visible button:visible');
}
try {
  await page.goto(PUBLIC_URL,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[id^="departureBtn"]').waitFor({state:'attached',timeout:60000});
  // Cookie banner actions are resolved from the visible control labels.
  const cookie=page.locator('kc-global-cookie-banner');
  if(await cookie.count()) {
    const reject=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
    if(await reject.count()) await reject.click();
    else {
      const close=cookie.getByRole('button',{name:/닫기|Close/i}).first();
      if(await close.count()) await close.click();
      else throw new Error('Cookie banner needs a supported dismissal: '+(await cookie.locator('button').allTextContents()).join('|'));
    }
  }
  await regionList('departure','대한민국');
  await page.getByRole('button',{name:/^ICN 서울\/인천/}).click();
  await page.locator('label[for="bonusTripType_OW"]').click();
  const note=await page.locator('body').innerText();
  report.source_updated_at=note.match(/대한민국 시간\(([^)]+)\)/)?.[1] || null;
  if(!report.source_updated_at) throw new Error('Missing public data update timestamp');
  if(previous&&(previous.source_updated_at!==report.source_updated_at||previous.start_date!==start||previous.end_date!==end)){
    const history=path.join(output,'history');fs.mkdirSync(history,{recursive:true});
    const stamp=(previous.source_updated_at||'unknown').replace(/[^0-9a-zA-Z]/g,'_');
    const filename=path.join(history,`${stamp}_${previous.start_date}_${previous.end_date}.json`);
    if(!fs.existsSync(filename))fs.writeFileSync(filename,JSON.stringify(previous,null,2),{flag:'wx'});
  }
  if(previous && previous.source_updated_at===report.source_updated_at && previous.start_date===start && previous.end_date===end) {
    report.rows=previous.rows||[];report.coverage=previous.coverage||[];report.unqueryable=previous.unqueryable||[];
    console.log(`Resuming ${report.coverage.length} saved route/months from the same daily data`);
  }
  const routes=[];
  for (const region of ['미주','유럽']) {
    const buttons=await regionList('destination',region);
    for(const text of await buttons.allTextContents()) {
      const code=text.trim().match(/^([A-Z]{3})\b/)?.[1];
      if(code && !routes.some(r=>r.code===code)) routes.push({code,region,label:text.trim()});
    }
    await page.getByRole('button',{name:'닫기',exact:true}).click();
  }
  report.routes=routes;
  const selected=routes.filter(r=>!only||only.includes(r.code));
  if(!selected.length) throw new Error('No requested route appears in the public calendar');
  report.target_routes=previous?.target_routes||(previous?.routes&&previous.start_date===start&&previous.end_date===end?previous.routes.map(r=>r.code):selected.map(r=>r.code));
  console.log(`PUBLIC DAILY: ${selected.length} routes, ${months.length} months, updated ${report.source_updated_at}`);
  for (const route of selected) {
    checkStop();
    const routeMonths=months.filter(month=>!report.coverage.some(c=>c.destination===route.code&&c.month===month)&&!report.unqueryable.some(c=>c.destination===route.code&&c.month===month));
    if(!routeMonths.length) continue;
    try {
      await regionList('destination',route.region);
      await page.getByRole('button',{name:new RegExp(`^${route.code} `)}).click();
      for (let i=0;i<routeMonths.length;i++) {
        checkStop();
        await page.locator('#seatCalendarBtn').click();
        const baseYear=Number(await page.locator('#monthCalendarPopup').innerText().then(t=>t.match(/20\d{2}/)?.[0]));
        const [year,month]=routeMonths[i].split('-').map(Number);
        await page.locator(`#monthCalendarPopup [id="${(year-baseYear)*12+month-1}"]`).click();
        await page.getByRole('button',{name:'선택',exact:true}).click();
        const responsePromise=waitForMonth();
        await page.getByRole('button',{name:'조회',exact:true}).click();
        const response=await responsePromise;
        if(!response.ok()) throw new Error(`Public API returned ${response.status()}`);
        const data=await response.json();
        lastPublicResponse={request:response.request().postData(),data};
        const requested=JSON.parse(lastPublicResponse.request);
        if(requested.departureAirport!=='ICN'||requested.arrivalAirport!==route.code||requested.departureDate!==routeMonths[i].replace('-','')+'01')throw new Error('Unexpected public request parameters');
        if(data.departureAirport==='ICN'&&data.arrivalAirport===route.code&&Array.isArray(data.flightList)&&data.flightList.length===0){
          const notice='검색하신 여정은 조회가 불가합니다.';
          await page.getByText(notice,{exact:true}).waitFor({state:'visible'});
          const record={destination:route.code,month:routeMonths[i],status:'UNQUERYABLE',reason:notice,checked_at:new Date().toISOString()};
          report.unqueryable.push(record);store.run('ICN',route.code,routeMonths[i],record.checked_at,report.source_updated_at,JSON.stringify({api:data,notice}));save();
          console.log(`${route.code} ${routeMonths[i]}: UNQUERYABLE (not unavailable seats)`);
          await page.getByRole('button',{name:'확인',exact:true}).click();await sleep(intervalMs);continue;
        }
        await page.locator('#travelCalendarPopup [id^="day_"]').first().waitFor();
        await sleep(intervalMs);
        const deadline=Date.now()+30000;
        while(pending.size&&Date.now()<deadline) await sleep(250);
        if(pending.size||apiErrors.length) throw new Error('Incomplete public API response: '+JSON.stringify(apiErrors));
        const expected=routeMonths[i].split('-').map(Number);
        const expectedLabel=new RegExp(`${expected[0]}년\\s*${expected[1]}월`);
        let snapshot=await page.evaluate(readPublicCalendar);
        const renderDeadline=Date.now()+15000;
        while(!expectedLabel.test(snapshot.month)&&Date.now()<renderDeadline){await sleep(500);snapshot=await page.evaluate(readPublicCalendar);}
        if(!expectedLabel.test(snapshot.month)) {
          fs.writeFileSync(path.join(output,'last-calendar-error.json'),JSON.stringify({expected:routeMonths[i],snapshot,api:data},null,2));
          throw new Error(`Calendar month did not advance: expected ${routeMonths[i]}, got ${snapshot.month}`);
        }
        const options={origin:'ICN',destination:route.code,month:routeMonths[i],startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at};
        const calendarRows=parsePublicCalendar(snapshot,options);
        const rows=parsePublicApi(data,options);
        for(const displayed of calendarRows.filter(r=>r.available!==null)) {
          const apiAvailable=rows.some(r=>r.date===displayed.date&&r.cabin===displayed.cabin&&r.available);
          if(apiAvailable!==displayed.available) throw new Error(`API/calendar mismatch: ${displayed.date} ${displayed.cabin}`);
        }
        report.rows.push(...rows.map(r=>({...r,region:route.region})));
        report.coverage.push({destination:route.code,month:routeMonths[i],days:calendarRows.length/2,flightClassRows:rows.length});
        store.run('ICN',route.code,routeMonths[i],new Date().toISOString(),report.source_updated_at,JSON.stringify({calendar:snapshot,api:data}));
        save();
        console.log(`${route.code} ${routeMonths[i]}: ${calendarRows.length/2} days, ${rows.filter(r=>r.available).length} flight/class matches`);
        await page.locator('#travelCalendarCloseBtn').click();
      }
    } catch(e) {
      fs.writeFileSync(path.join(output,'last-public-error.json'),JSON.stringify({destination:route.code,message:e.message,response:lastPublicResponse,pageText:await page.locator('body').innerText().catch(()=>''),calendar:await page.evaluate(readPublicCalendar).catch(()=>null)},null,2));
      report.errors.push({destination:route.code,message:e.message});if(report.coverage.length||report.unqueryable.length)save();
      // Stop instead of assigning a failed or stale page to subsequent routes.
      throw e;
    }
  }
  report.complete=report.errors.length===0&&report.target_routes.every(code=>months.every(month=>report.coverage.some(c=>c.destination===code&&c.month===month)));
  report.attempt_complete=report.errors.length===0&&report.target_routes.every(code=>months.every(month=>[...report.coverage,...report.unqueryable].some(c=>c.destination===code&&c.month===month)));
  report.finished_at=new Date().toISOString();save();
  console.log(`Saved ${report.rows.filter(r=>r.available).length} matches to ${output}`);
} catch(e) {report.failure=e.message;if(report.coverage.length||report.unqueryable.length)save();else writeJson('last-run-error.json',{at:new Date().toISOString(),message:e.message});console.error(e.message);process.exitCode=1;}
finally {await browser.close();db.close();releaseCollection();}
