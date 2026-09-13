import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:false,args:['--disable-http2','--disable-quic']});
const context=await browser.newContext({locale:'ko-KR',viewport:{width:1280,height:900},extraHTTPHeaders:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}});
const page=await context.newPage();
const api=[];
const pending=[];
page.on('response',r=>{
  const task=(async()=>{
    const url=r.url();
    if(!url.includes('koreanair.com')||!/\/api\//i.test(url)) return;
    const entry={status:r.status(),method:r.request().method(),url};
    try{
      const ct=r.headers()['content-type']||'';
      if(ct.includes('json')){
        const data=await Promise.race([r.json(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('body timeout')),5000))]);
        entry.keys=data&&typeof data==='object'?Object.keys(data).slice(0,40):[];
        const text=JSON.stringify(data);
        if(/aircraft|equipment|acft|equipType|fleet|aircraftType/i.test(text)){
          entry.hasAircraftLikeText=true;
          const matches=[...new Set((text.match(/.{0,60}(?:aircraft|equipment|acft|equipType|fleet).{0,140}/gi)||[]).slice(0,8))];
          entry.samples=matches;
        }
      }
    }catch{}
    api.push(entry);
  })();
  pending.push(task);
});
const target='https://www.koreanair.com/flight-status?isSchedule=T&_mileway_probe='+Date.now();
try{await page.goto(target,{waitUntil:'commit',timeout:45000});}catch(error){console.log('NAVIGATION_WARNING',error.message);}
await page.waitForTimeout(20000);
await Promise.allSettled(pending);
console.log('FINAL_URL',page.url());
console.log('FLIGHT_INFO_API_RESPONSES');
for(const e of api) console.log(JSON.stringify(e));
console.log('VISIBLE_TEXT');
console.log((await page.locator('body').innerText().catch(()=>'' )).replace(/\s+/g,' ').slice(0,5000));
await browser.close();
