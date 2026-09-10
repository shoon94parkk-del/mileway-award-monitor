import fs from 'node:fs';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!edge) throw new Error('Microsoft Edge not found');
const browser=await chromium.launch({executablePath:edge,headless:false,args:['--disable-http2','--disable-quic']});
try{
  const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
  await page.goto(PUBLIC_URL,{waitUntil:'commit',timeout:30000});
  await page.locator('[id^="departureBtn"]').first().waitFor({state:'visible',timeout:60000});
  const cookie=page.locator('kc-global-cookie-banner');
  if(await cookie.count()){
    const reject=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
    if(await reject.count())await reject.click().catch(()=>{});
    else { const close=cookie.getByRole('button',{name:/닫기|Close/i}).first(); if(await close.count())await close.click().catch(()=>{}); }
  }
  await page.locator('[id^="departureBtn"]').click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.getByRole('button',{name:'대한민국',exact:true}).click();
  await page.getByRole('button',{name:/^ICN 서울\/인천/}).click();
  await page.locator('label[for="bonusTripType_OW"]').click();
  await page.locator('[id^="destinationBtn"]').click();
  await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
  await page.waitForTimeout(1000);
  const visible=await page.locator('button:visible, [role="button"]:visible, a:visible').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id||'',text:(n.innerText||n.textContent||'').replace(/\s+/g,' ').trim(),role:n.getAttribute('role')||'',expanded:n.getAttribute('aria-expanded')||''})).filter(x=>x.text&&x.text.length<=60));
  const accordion=await page.locator('[id*="acc-"]:visible, [id^="acc"]:visible').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id||'',text:(n.innerText||n.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),role:n.getAttribute('role')||'',expanded:n.getAttribute('aria-expanded')||''})));
  console.log('REGION_VISIBLE_CONTROLS '+JSON.stringify(visible.slice(0,120)));
  console.log('REGION_ACCORDION '+JSON.stringify(accordion.slice(0,120)));
} finally { await browser.close(); }
