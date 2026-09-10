import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!edge)throw Error('Microsoft Edge not found');
const browser=await chromium.launch({executablePath:edge,headless:false,args:['--disable-http2','--disable-quic']});
const modes=[
  {name:'normal',url:PUBLIC_URL,headers:{}},
  {name:'query-cache-bust',url:`${PUBLIC_URL}?_mileway=${Date.now()}`,headers:{}},
  {name:'no-cache-headers',url:PUBLIC_URL,headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}},
];
try{
  for(const mode of modes){
    const context=await browser.newContext({locale:'ko-KR',extraHTTPHeaders:mode.headers});
    const page=await context.newPage();
    const started=Date.now();
    try{
      const response=await page.goto(mode.url,{waitUntil:'commit',timeout:30000});
      await page.locator('[id^="departureBtn"]').first().waitFor({state:'visible',timeout:60000});
      const body=await page.locator('body').innerText();
      const timestamp=body.match(/대한민국 시간\(([^)]+)\)/)?.[1]?.trim()||'missing';
      console.log(`FRESHNESS ${mode.name}: status=${response?.status()??'none'} timestamp=${timestamp} elapsed_ms=${Date.now()-started}`);
    }catch(error){
      console.log(`FRESHNESS ${mode.name}: ERROR ${error.message.split('\n')[0]} elapsed_ms=${Date.now()-started}`);
    }finally{await context.close();}
  }
}finally{await browser.close();}
