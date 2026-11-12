import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PUBLIC_URL,monthRange} from '../src/public-calendar.mjs';
import {readRenderedSeatCalendar,parseRenderedSeatMonth} from '../src/public-rendered-seats.mjs';
import {parsePublicAccessibleAwardMonth} from '../src/public-accessible-award.mjs';
import {selectPublicMonth} from '../src/public-month-ui.mjs';
import {openPublicPage} from '../src/public-navigation.mjs';
import {openPublicAirportRegion,choosePublicAirport,closePublicAirportRegion,selectPublicOneWay,dismissPublicCookies,hasModernAirportUi} from '../src/public-ui.mjs';
import {readLatestSourceUpdatedAt} from '../src/source-observer.mjs';
import {getReturnOrigins,makeReturnMonth} from '../src/europe-returns.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const horizon=new Date(today+'T00:00:00Z');horizon.setUTCDate(horizon.getUTCDate()+359);
const start=arg('--start',today),end=arg('--end',horizon.toISOString().slice(0,10));
const months=monthRange(start,end),output=path.resolve(arg('--output','data/returns-europe.json'));
const interval=Math.max(3500,Number(arg('--interval-ms','5000')));
const retries=2;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const codes=arg('--route','').split(',').map(v=>v.trim().toUpperCase()).filter(Boolean);
const source=JSON.parse(fs.readFileSync('public-data/snapshot.json','utf8'));
const allOrigins=getReturnOrigins(source.bootstrap?.routes||[]);
if(!allOrigins.length)throw Error('Published European destinations unavailable; cannot determine safe return scope');
const origins=allOrigins.filter(route=>!codes.length||codes.includes(route.code));
if(!origins.length||codes.some(code=>!origins.some(route=>route.code===code)))throw Error('Unknown return origin');
const report={direction:'RETURN',destination:'ICN',region:'유럽',source:PUBLIC_URL,
  source_type:'KOREAN_AIR_PUBLIC_DAILY',source_updated_at:null,
  started_at:new Date().toISOString(),start_date:start,end_date:end,
  attempt_complete:false,complete:false,origins,coverage:[],unqueryable:[],failed:[],rows:[],
  collection_engine:'UI_DOM_ONLY',acceleration:{ui_months:0}};
fs.mkdirSync(path.dirname(output),{recursive:true});
const save=()=>{const tmp=output+'.tmp';fs.writeFileSync(tmp,JSON.stringify(report,null,2));fs.renameSync(tmp,output);};
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:process.argv.includes('--headless'),args:['--disable-http2','--disable-quic']});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:1280,height:900}});
page.setDefaultTimeout(20000);
const regionList=(kind,region)=>openPublicAirportRegion(page,kind,region);
async function setup(){
  try{
    await openPublicPage(page);
  }catch(error){
    // Record public page state on failures without logging cookies, sessions or tokens.
    const state=await page.evaluate(()=>({
      url:location.origin+location.pathname,
      title:document.title,
      readyState:document.readyState,
      bodyPreview:(document.body?.innerText||'').slice(0,650),
      visibleDepartureButtons:document.querySelectorAll('[id^="departureBtn"]').length,
      captchaLike:/(captcha|cloudflare|access denied|접근이 제한|로봇이 아닙니다|403 forbidden)/i.test(document.body?.innerText||'')
    })).catch(e=>({diagnosticError:e.message}));
    console.error('RETURN PUBLIC NAV DIAGNOSTIC',JSON.stringify(state));
    throw error;
  }
  await dismissPublicCookies(page);
  const updated=await readLatestSourceUpdatedAt(page,{sampleMs:8000,intervalMs:750});
  if(!updated)throw Error('Missing Korean Air daily timestamp');
  if(report.source_updated_at&&report.source_updated_at!==updated)throw Error('Source changed during return collection');
  report.source_updated_at=updated;
}
async function availableOrigins(){
  const buttons=await regionList('departure','유럽');
  const labels=await buttons.allTextContents();
  await closePublicAirportRegion(page);
  return new Set(labels.map(value=>value.trim().match(/^([A-Z]{3})\b/)?.[1]||value.trim().match(/\b([A-Z]{3})$/)?.[1]).filter(Boolean));
}
async function selectOrigin(code){
  // Both directions use the same public UI. A new origin may reset destination.
  await choosePublicAirport(page,'departure','유럽',code);
  await choosePublicAirport(page,'destination','대한민국','ICN');
  await selectPublicOneWay(page);
}
async function closePopups(){
  const calendar=page.locator('#travelCalendarCloseBtn');
  if(await calendar.isVisible().catch(()=>false))await calendar.click().catch(()=>{});
  const confirm=page.getByRole('button',{name:'확인',exact:true});
  if(await confirm.isVisible().catch(()=>false))await confirm.click().catch(()=>{});
}
function record(origin,month,item){
  if(item.status==='UNQUERYABLE'){
    report.unqueryable.push({origin,month,status:'UNQUERYABLE',
      reason:'대한항공 화면에 해당 구간 조회 불가가 명시됨',engine:'UI_DOM'});
  }else if(item.status==='COVERED'){
    report.coverage.push({origin,destination:'ICN',month,days:item.days,engine:'UI_DOM'});
    report.rows.push(...item.rows);
  }else throw Error('Unrecognized public UI status');
  report.acceleration.ui_months++;
  save();
  console.log('RETURN UI ONLY',origin,'→ ICN',month,item.status,item.rows.length,'available date/class markers');
}
async function readUiMonthResult(origin,month){
  const deadline=Date.now()+20000;
  let lastError;
  while(Date.now()<deadline){
    const tree=await page.locator('body').ariaSnapshot();
    let parsed;
    try{
      parsed=parsePublicAccessibleAwardMonth(tree,{
        origin,destination:'ICN',month,startDate:start,endDate:end,
        sourceUpdatedAt:report.source_updated_at
      });
    }catch(error){
      lastError=error;
      if(!tree.includes('heading "보너스 좌석 상황"')){
        const snapshot=await page.evaluate(readRenderedSeatCalendar);
        try{
          parsed=parseRenderedSeatMonth(snapshot,{origin,destination:'ICN',month,
            startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at});
        }catch(legacyError){lastError=legacyError;}
      }
    }
    if(parsed){
      await closePopups();
      await sleep(interval);
      return parsed;
    }
    await sleep(850);
  }
  // A request denied by the airline leaves no verifiable calendar in the UI.
  // Never convert that case to zero inventory or publish a successful report.
  const aria=await page.locator('body').ariaSnapshot().catch(()=> '');
  const i=Math.max(0,aria.indexOf('heading "보너스 좌석 상황"'));
  console.error('RETURN UI RESULT DIAGNOSTIC',JSON.stringify({
    origin,destination:'ICN',month,reason:lastError?.message,
    visiblePageOutline:aria.slice(i,i+10500)
  }));
  throw Error('Public UI displayed no verifiable award calendar for '+origin+'→ICN '+month+
    ': '+(lastError?.message||'no dated result'));
}
async function uiMonth(origin,month){
  await selectPublicMonth(page,month);
  await page.getByRole('button',{name:'조회',exact:true}).click();
  return readUiMonthResult(origin,month);
}
async function uiNextMonth(origin,month){
  const navigation=page.getByRole('navigation',{name:'가는 여정'});
  await navigation.getByRole('button',{name:'다음 달',exact:true}).click();
  return readUiMonthResult(origin,month);
}
try{
  await setup();
  // Route scope is the last validated outbound discovery. The public picker
  // is used to verify each European origin before the return-month search.
  for(const [routeIndex,route] of origins.entries()){
    for(const [monthIndex,month] of months.entries()){
      let completed=false,lastError=null;
      for(let attempt=1;attempt<=retries&&!completed;attempt++){
        try{
          let result;
          if(attempt===1&&monthIndex>0){
            // Reuse the visible airline result calendar. Its own next-month
            // control avoids an unnecessary new route search / network call.
            result=await uiNextMonth(route.code,month);
          }else{
            // First month of a route, or a retry after a failed calendar step.
            if(routeIndex>0||monthIndex>0||attempt>1)await setup();
            await selectOrigin(route.code);
            result=await uiMonth(route.code,month);
          }
          record(route.code,month,result);
          completed=true;
        }catch(error){
          lastError=error;
          console.error('RETURN UI FAILURE',route.code,month,attempt,error.message);
          await closePopups().catch(()=>{});
          if(attempt<retries)await sleep(6000);
        }
      }
      if(!completed){
        report.failed.push({origin:route.code,month,status:'FAILED',
          message:lastError?.message||'Unknown public UI failure'});
        save();
        // Failure is not zero seats. Stop rather than scan other months against
        // an inaccessible or structurally changed official result page.
        throw lastError;
      }
    }
  }
  report.finished_at=new Date().toISOString();
  report.attempt_complete=report.failed.length===0;
  report.complete=report.attempt_complete&&!report.unqueryable.length;
  save();
  if(!report.attempt_complete)throw Error('Unfinished public UI return collection');
  console.log('RETURN UI COMPLETE',report.coverage.length,'covered',
    report.unqueryable.length,'unqueryable',report.rows.length,'available');
}catch(error){
  report.failure=error.message;
  save();
  console.error(error);
  process.exitCode=1;
}finally{
  await page.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
