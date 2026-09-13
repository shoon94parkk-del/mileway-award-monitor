import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:true,args:['--disable-http2','--disable-quic']});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:1280,height:900}});
const api=[];
page.on('response',async r=>{
  const url=r.url();
  if(!url.includes('koreanair.com')) return;
  if(!/\/api\//i.test(url)) return;
  const entry={status:r.status(),method:r.request().method(),url};
  try{
    const ct=r.headers()['content-type']||'';
    if(ct.includes('json')){
      const data=await r.json();
      entry.keys=data&&typeof data==='object'?Object.keys(data).slice(0,40):[];
      const text=JSON.stringify(data);
      if(/aircraft|equipment|acft|equipType|fleet/i.test(text)) entry.hasAircraftLikeText=true;
    }
  }catch{}
  api.push(entry);
});
await page.goto('https://www.koreanair.com/contents/booking/flight-info',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(12000);
console.log('FLIGHT_INFO_API_RESPONSES');
for(const e of api) console.log(JSON.stringify(e));
console.log('VISIBLE_BUTTONS');
console.log((await page.getByRole('button').allTextContents()).filter(Boolean).slice(0,120).join(' | '));
console.log('VISIBLE_LINKS');
console.log((await page.getByRole('link').allTextContents()).filter(Boolean).slice(0,120).join(' | '));
await browser.close();
