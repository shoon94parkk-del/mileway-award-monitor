import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {PUBLIC_URL} from '../src/public-calendar.mjs';
import {candidateRegionLabels,parseDestinationButton} from '../src/route-discovery.mjs';

const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch(e){throw new Error('Playwright is required for route discovery');}
const args=['--disable-http2','--disable-quic'];
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),args,headless:true});
const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
page.setDefaultTimeout(30000);

async function dismissCookie(){
 const cookie=page.locator('kc-global-cookie-banner');if(!await cookie.count())return;
 const button=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|닫기|Close/i}).first();if(await button.count())await button.click().catch(()=>{});
}
async function regionList(kind,region){
 await page.locator(`[id^="${kind}Btn"]`).click();
 await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
 await page.getByRole('button',{name:region,exact:true}).click();
 return page.locator('[id^="acc-panel-mobile-web"]:visible button:visible');
}
try{
 await page.goto(PUBLIC_URL,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('[id^="departureBtn"]').waitFor({state:'attached',timeout:60000});
 await dismissCookie();
 await regionList('departure','대한민국');
 await page.getByRole('button',{name:/^ICN 서울\/인천/}).click();
 await page.locator('label[for="bonusTripType_OW"]').click();
 await page.locator('[id^="destinationBtn"]').click();
 await page.getByRole('button',{name:'모든 지역 보기',exact:true}).click();
 const regionTexts=await page.locator('[id^="acc-panel-mobile-web"]:visible button:visible').allTextContents();
 const regions=candidateRegionLabels(regionTexts);
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 const routes=[];
 for(const region of regions){
   const buttons=await regionList('destination',region);
   for(const text of await buttons.allTextContents()){
     const route=parseDestinationButton(text,region);if(route&&!routes.some(r=>r.code===route.code))routes.push(route);
   }
   await page.getByRole('button',{name:'닫기',exact:true}).click();
 }
 const grouped=Object.fromEntries(regions.map(region=>[region,routes.filter(r=>r.region===region).map(r=>r.code)]));
 console.log(`WORLDWIDE ROUTE DISCOVERY: ${routes.length} destinations across ${regions.length} regions`);
 console.log(JSON.stringify(grouped,null,2));
 fs.mkdirSync('data/public',{recursive:true});
 fs.writeFileSync('data/public/discovered-routes.json',JSON.stringify({discovered_at:new Date().toISOString(),regions,routes},null,2));
 if(regions.length<3||routes.length<20)throw new Error(`Suspiciously small discovery: ${regions.length} regions / ${routes.length} routes`);
}finally{await browser.close();}
