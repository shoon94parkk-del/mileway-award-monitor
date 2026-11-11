import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({...(executable?{executablePath:executable}:{}),headless:false,args:['--disable-http2','--disable-quic']});
try{
 for(const width of [480,1280]){
  const page=await browser.newPage({locale:'ko-KR',viewport:{width,height:900},timezoneId:'Asia/Seoul'});
  try{
   const response=await page.goto(PUBLIC_URL,{waitUntil:'commit',timeout:30000});
   await page.waitForTimeout(9000);
   const diagnostic=await page.evaluate(()=>({
    title:document.title,url:location.origin+location.pathname,
    body:(document.body?.innerText||'').slice(0,1100),
    controls:[...document.querySelectorAll('button,input,select,[role="button"],[role="combobox"],[contenteditable]')]
      .slice(0,110).map(el=>({tag:el.tagName,id:el.id,name:el.getAttribute('name'),label:el.getAttribute('aria-label'),type:el.getAttribute('type'),role:el.getAttribute('role'),text:el.textContent?.trim().slice(0,65),placeholder:el.getAttribute('placeholder')})),
    iframes:[...document.querySelectorAll('iframe')].map(el=>({title:el.title,src:el.getAttribute('src')?.slice(0,100)})),
    customs:[...new Set([...document.querySelectorAll('*')].map(el=>el.localName).filter(tag=>tag.includes('-')))].slice(0,70),
    departureButtonCount:document.querySelectorAll('[id^="departureBtn"]').length
   }));
   console.log('PUBLIC DOM PROBE',JSON.stringify({width,status:response?.status(),...diagnostic}));
  }finally{await page.close();}
 }
}finally{await browser.close();}
