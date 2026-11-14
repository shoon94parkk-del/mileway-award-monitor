import fs from 'node:fs';
import {createRequire} from 'node:module';
import {openPublicPage} from '../src/public-navigation.mjs';
import {choosePublicAirport,selectPublicOneWay,dismissPublicCookies} from '../src/public-ui.mjs';
import {selectPublicMonth} from '../src/public-month-ui.mjs';
import {parsePublicAccessibleAwardMonth} from '../src/public-accessible-award.mjs';
import {watchPublicAccess} from '../src/public-access-limit.mjs';

// Only public UI state and HTTP status/path metadata. Never dump cookies,
// headers, API bodies, storage, or browser session state into Actions logs.
const {chromium}=createRequire(import.meta.url)('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:false,args:['--disable-http2','--disable-quic']});
const begun=Date.now();
const log=(name,value)=>console.log('PUBLIC QUERY RUNTIME',Math.round((Date.now()-begun)/1000)+'s',name,JSON.stringify(value));
try{
 const page=await browser.newPage({locale:'ko-KR',viewport:{width:1280,height:900}});
 const access=watchPublicAccess(page);
 page.setDefaultTimeout(20000);
 page.on('pageerror',e=>log('page-error',e.message.slice(0,500)));
 page.on('response',r=>{
  const url=new URL(r.url());
  if(url.hostname==='www.koreanair.com'&&url.pathname.includes('bonusSeatView'))
   log('response',{path:url.pathname,status:r.status()});
 });
 page.on('requestfailed',r=>{
  const url=new URL(r.url());
  if(url.hostname==='www.koreanair.com'&&url.pathname.includes('bonusSeatView'))
   log('request-failed',{path:url.pathname,error:r.failure()?.errorText});
 });
 await openPublicPage(page);
 await dismissPublicCookies(page);
 await choosePublicAirport(page,'departure','대한민국','ICN');
 await selectPublicOneWay(page);
 await choosePublicAirport(page,'destination','유럽','LHR');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const month=today.slice(0,7);
 const monthEnd=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 await selectPublicMonth(page,month);
 log('before-query',(await page.locator('body').ariaSnapshot()).slice(0,2900));
 await page.getByRole('button',{name:'조회',exact:true}).click();
 const deadline=Date.now()+90000;
 let lastTree='',lastError='',lastOutline='';
 while(Date.now()<deadline){
  access.throwIfBlocked();
  lastTree=await page.locator('body').ariaSnapshot();
  access.throwIfBlocked();
  try{
   const parsed=parsePublicAccessibleAwardMonth(lastTree,{origin:'ICN',destination:'LHR',month,startDate:today,endDate:monthEnd,sourceUpdatedAt:null});
   log('verified-calendar',{days:parsed.days,awards:parsed.rows.length});
   lastError='';
   break;
  }catch(error){lastError=error.message;}
  const outline=lastTree.slice(0,2900);
  if(outline!==lastOutline){log('visible-state',outline);lastOutline=outline;}
  await page.waitForTimeout(2000);
 }
 if(lastError){log('unverified-calendar',{reason:lastError,outline:lastTree.slice(0,7000)});process.exitCode=1;}
}finally{await browser.close();}
