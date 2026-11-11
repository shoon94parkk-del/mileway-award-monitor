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
    departureButtonCount:document.querySelectorAll('[id^="departureBtn"]').length,
    shadowStructures:(()=>{
      const hosts=[];
      const inspect=(root,depth=0,parent='document')=>{
        if(depth>12||hosts.length>=100)return;
        for(const el of root.querySelectorAll('*')){
          if(!el.shadowRoot)continue;
          const tag=el.localName;
          const path=parent+' > '+tag;
          if(/fromto|airport|dateinput|view-bonus|chip|button|dialog|kds-list|basic-layout/.test(tag)){
            const inner=el.shadowRoot;
            const controls=[...inner.querySelectorAll('button,input,select,[role="button"],[role="combobox"]')].slice(0,12)
              .map(e=>({tag:e.localName,id:e.id,role:e.getAttribute('role'),type:e.getAttribute('type'),label:e.getAttribute('aria-label'),txt:e.textContent?.trim().slice(0,50)}));
            hosts.push({tag,path,id:el.id,attrs:[...el.attributes].filter(x=>!/token|session|data-value/i.test(x.name)).slice(0,8).map(x=>[x.name,x.value.slice(0,60)]),
              text:(inner.textContent||'').replace(/\\s+/g,' ').trim().slice(0,180),controls,html:inner.innerHTML.slice(0,1000)});
          }
          inspect(el.shadowRoot,depth+1,path);
        }
      };
      inspect(document);
      return hosts;
    })()
   }));
   console.log('PUBLIC DOM PROBE',JSON.stringify({width,status:response?.status(),...diagnostic}));
  }finally{await page.close();}
 }
}finally{await browser.close();}
