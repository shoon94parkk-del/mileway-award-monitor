import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PUBLIC_URL,PUBLIC_API,parsePublicApi,parsePublicCalendar,readPublicCalendar,monthRange} from '../src/public-calendar.mjs';
import {queryPublicSeatMonth} from '../src/public-direct-client.mjs';
import {openPublicPage} from '../src/public-navigation.mjs';
import {openPublicAirportRegion,choosePublicAirport,closePublicAirportRegion,selectPublicOneWay,dismissPublicCookies} from '../src/public-ui.mjs';
import {readLatestSourceUpdatedAt} from '../src/source-observer.mjs';
import {getReturnOrigins,makeReturnMonth} from '../src/europe-returns.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const horizon=new Date(today+'T00:00:00Z');horizon.setUTCDate(horizon.getUTCDate()+360);
const start=arg('--start',today),end=arg('--end',horizon.toISOString().slice(0,10));
const months=monthRange(start,end),output=path.resolve(arg('--output','data/returns-europe.json'));
const interval=Math.max(3500,Number(arg('--interval-ms','5000')));
const directInterval=Math.max(1000,Number(arg('--direct-interval-ms','1500')));
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
  acceleration:{ui_months:0,direct_months:0,direct_templates_verified:0,direct_fallbacks:0}};
fs.mkdirSync(path.dirname(output),{recursive:true});
const save=()=>{const tmp=output+'.tmp';fs.writeFileSync(tmp,JSON.stringify(report,null,2));fs.renameSync(tmp,output);};
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:process.argv.includes('--headless'),args:['--disable-http2','--disable-quic']});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
page.setDefaultTimeout(20000);
const isApi=url=>url===PUBLIC_API||url.startsWith(PUBLIC_API+'?');
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
  await selectPublicOneWay(page);
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
}
async function closePopups(){
  const calendar=page.locator('#travelCalendarCloseBtn');
  if(await calendar.isVisible().catch(()=>false))await calendar.click().catch(()=>{});
  const confirm=page.getByRole('button',{name:'확인',exact:true});
  if(await confirm.isVisible().catch(()=>false))await confirm.click().catch(()=>{});
}
function signature(data,origin,month){
  return parsePublicApi(data,{origin,destination:'ICN',month,startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at})
    .map(r=>[r.date,r.flight,r.departureTime||'',r.cabin,r.fareClass,r.available].join('|')).sort().join('\n');
}
function record(origin,month,data,engine){
  const item=makeReturnMonth(data,{origin,month,start,end,sourceUpdatedAt:report.source_updated_at});
  if(item.status==='UNQUERYABLE'){
    report.unqueryable.push({origin,month,status:'UNQUERYABLE',reason:'항공사에서 해당 구간을 조회할 수 없음',engine});
  }else{
    report.coverage.push({origin,destination:'ICN',month,days:item.days,engine});
    report.rows.push(...item.rows);
  }
  report.acceleration[engine==='UI'?'ui_months':'direct_months']++;
  save();
  console.log('RETURN',origin,'→ ICN',month,item.status,item.rows.length,engine);
}
async function uiMonth(origin,month){
  await page.locator('#seatCalendarBtn').click();
  const baseYear=Number((await page.locator('#monthCalendarPopup').innerText()).match(/20\d{2}/)?.[0]);
  if(!Number.isFinite(baseYear))throw Error('No month calendar base year');
  const [year,number]=month.split('-').map(Number);
  await page.locator('#monthCalendarPopup [id="'+((year-baseYear)*12+number-1)+'"]').click();
  await page.getByRole('button',{name:'선택',exact:true}).click();
  const pending=page.waitForResponse(r=>isApi(r.url()),{timeout:30000});
  await page.getByRole('button',{name:'조회',exact:true}).click();
  const response=await pending;
  if([403,429].includes(response.status()))throw Error('ACCESS_LIMIT '+response.status());
  if(!response.ok())throw Error('Return public API HTTP '+response.status());
  const request=JSON.parse(response.request().postData()||'{}'),data=await response.json();
  if(request.departureAirport!==origin||request.arrivalAirport!=='ICN'||request.departureDate!==month.replace('-','')+'01')throw Error('Return UI request route/month mismatch');
  if(data.departureAirport!==origin||data.arrivalAirport!=='ICN'||!Array.isArray(data.flightList))throw Error('Return API response route mismatch');
  if(data.flightList.length){
    await page.locator('#travelCalendarPopup [id^="day_"]').first().waitFor({timeout:20000});
    const expectedLabel=new RegExp(month.replace(/^(\d{4})-(\d{2})$/,(_,year,m)=>year+'년\\s*'+Number(m)+'월'));
    let snapshot=await page.evaluate(readPublicCalendar);
    const displayDeadline=Date.now()+15000;
    while(!expectedLabel.test(snapshot.month||'')&&Date.now()<displayDeadline){
      await sleep(500);snapshot=await page.evaluate(readPublicCalendar);
    }
    if(!expectedLabel.test(snapshot.month||''))throw Error('Return UI calendar month did not advance to '+month);
    const calendar=parsePublicCalendar(snapshot,{origin,destination:'ICN',startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at});
    const api=parsePublicApi(data,{origin,destination:'ICN',month,startDate:start,endDate:end,sourceUpdatedAt:report.source_updated_at});
    for(const day of calendar.filter(r=>r.available!==null)){
      const found=api.some(r=>r.date===day.date&&r.cabin===day.cabin&&r.available);
      if(found!==day.available)throw Error('Return UI/calendar API mismatch '+origin+' '+day.date);
    }
  }else{
    await page.getByText('검색하신 여정은 조회가 불가합니다.',{exact:true}).waitFor({timeout:8000});
  }
  await closePopups();
  await sleep(interval);
  return {data,request};
}
try{
  await setup();
  const selectable=await availableOrigins();
  console.log('RETURN ORIGINS',origins.map(o=>o.code).join(','),'UI selectable',selectable.size);
  for(const route of origins){
    const origin=route.code;
    if(!selectable.has(origin)){
      console.warn('Return origin absent from source selector:',origin);
      for(const month of months)report.unqueryable.push({origin,month,status:'UNQUERYABLE',reason:'출발 공항 선택 불가'});
      save();continue;
    }
    let template=null,directTrusted=false;
    for(const month of months){
      let success=false,lastError;
      for(let attempt=1;attempt<=retries&&!success;attempt++){
        try{
          await selectOrigin(origin);
          if(directTrusted&&template){
            try{
              const remote=await queryPublicSeatMonth(page,template,{origin,destination:'ICN',month});
              record(origin,month,remote.data,'DIRECT_API');
              await sleep(directInterval);
              success=true;break;
            }catch(error){
              if(/ACCESS_LIMIT/.test(error.message))throw error;
              report.acceleration.direct_fallbacks++;
              directTrusted=false;
              console.warn('Return direct/API fallback to UI',origin,month,error.message);
            }
          }
          const ui=await uiMonth(origin,month);
          record(origin,month,ui.data,'UI');
          if(!template){
            template=ui.request;
            try{
              const direct=await queryPublicSeatMonth(page,template,{origin,destination:'ICN',month});
              if(signature(direct.data,origin,month)!==signature(ui.data,origin,month))throw Error('Return direct/UI verification mismatch');
              report.acceleration.direct_templates_verified++;
              directTrusted=true;
              await sleep(directInterval);
            }catch(error){
              if(/ACCESS_LIMIT/.test(error.message))throw error;
              console.warn('Return route remains UI-only',origin,error.message);
            }
          }
          success=true;
        }catch(error){
          lastError=error;
          console.error('RETURN FAILURE',origin,month,attempt,error.message);
          if(/ACCESS_LIMIT|Source changed/.test(error.message))throw error;
          await closePopups().catch(()=>{});
          if(attempt<retries){await sleep(12000);await setup();}
        }
      }
      if(!success){report.failed.push({origin,month,status:'FAILED',message:lastError?.message||'Unknown error'});save();}
    }
  }
  report.finished_at=new Date().toISOString();
  report.attempt_complete=report.failed.length===0;
  report.complete=report.attempt_complete&&!report.unqueryable.length;
  save();
  if(!report.attempt_complete)throw Error(report.failed.length+' return route/month failures; previous publication preserved');
  console.log('RETURN COMPLETE',report.coverage.length,'covered',report.unqueryable.length,'unqueryable',report.rows.length,'available');
}catch(error){
  report.failure=error.message;save();console.error(error);process.exitCode=1;
}finally{await page.close().catch(()=>{});await browser.close().catch(()=>{});}
