import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!edge) throw new Error('Microsoft Edge not found');
const modes=[
  {name:'old-success-like',headless:false,args:[]},
  {name:'headed-current-network-flags',headless:false,args:['--disable-http2','--disable-quic']},
  {name:'headless-default-network',headless:true,args:[]},
  {name:'current-regional',headless:true,args:['--disable-http2','--disable-quic']},
];
for(const mode of modes){
  const started=Date.now();
  let browser;
  try{
    browser=await chromium.launch({executablePath:edge,headless:mode.headless,args:mode.args});
    const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
    const response=await page.goto(PUBLIC_URL,{waitUntil:'commit',timeout:30000});
    const status=response?.status() ?? null;
    let ui=false;
    try{await page.locator('[id^="departureBtn"]').first().waitFor({state:'visible',timeout:20000});ui=true;}catch{}
    console.log(`PROBE ${mode.name}: status=${status} ui=${ui} elapsed_ms=${Date.now()-started}`);
  }catch(error){
    console.log(`PROBE ${mode.name}: ERROR ${error.message.split('\n')[0]} elapsed_ms=${Date.now()-started}`);
  }finally{if(browser)await browser.close().catch(()=>{});}
}
