import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const browser=await chromium.launch({...(edge?{executablePath:edge}:{}),headless:false,args:['--disable-http2','--disable-quic']});
try{
 const page=await browser.newPage({locale:'ko-KR',viewport:{width:1280,height:900},timezoneId:'Asia/Seoul'});
 await page.goto(PUBLIC_URL,{waitUntil:'commit',timeout:30000});
 await page.waitForTimeout(6000);
 const cookie=page.getByRole('button',{name:'필수 쿠키만 허용'});
 console.log('COOKIE BUTTON',await cookie.count());
 if(await cookie.isVisible().catch(()=>false))await cookie.click();
 const snapshot=async label=>{
  const aria=(await page.locator('body').ariaSnapshot().catch(e=>'ARIA '+e.message));
  const detail=await page.evaluate(()=>{
    const found=[];
    for(const selector of ['kds-fromto_1','ke-kds-airport-selector','ke-kds-common-airport-layer','ke-kds-airport-layer','ke-kds-airport-chooser','kds-autocomplete_1','kds-dialog_1','kds-dateinput_1']){
      for(const host of document.querySelectorAll(selector)){
        found.push({tag:host.localName,attrs:[...host.attributes].slice(0,8).map(x=>[x.name,x.value.slice(0,55)]),text:host.textContent?.trim().slice(0,700),
          shadow:host.shadowRoot?.innerHTML.slice(0,2500)});
      }
    }return found;
  });
  console.log('FLOW '+label+' ARIA',aria.slice(0,13000));
  console.log('FLOW '+label+' DETAILS',JSON.stringify(detail).slice(0,14000));
 };
 await snapshot('INITIAL');
 const from=page.locator('kds-fromto_1 button.ui-fromto__button').first();
 console.log('FROM locator count',await from.count());
 await from.click({timeout:15000});
 await page.waitForTimeout(1200);
 await snapshot('FROM_OPEN');
 const candidate=page.getByText(/모든 지역|유럽|대한민국/).first();
 console.log('REGION TEXT',await candidate.count());
 await page.close();
}finally{await browser.close()}
