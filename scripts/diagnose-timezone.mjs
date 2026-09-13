import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPublicPage} from '../src/public-navigation.mjs';
import {readLatestSourceUpdatedAt} from '../src/source-observer.mjs';

const require=createRequire(import.meta.url);
let pw;
try { pw=require('playwright'); } catch { throw new Error('playwright is required'); }
const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),args:['--disable-http2','--disable-quic'],headless:false});

async function probe(label, timezoneId) {
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:480,height:900},...(timezoneId?{timezoneId}:{})});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  const main=[];
  page.on('response',r=>{ if(r.request().resourceType()==='document') main.push({url:r.url(),status:r.status(),headers:r.headers()}); });
  try {
    const clock=await page.evaluate(()=>({date:new Date().toString(),iso:new Date().toISOString(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone,offset:new Date().getTimezoneOffset()}));
    console.log(`DIAG ${label} CLOCK ${JSON.stringify(clock)}`);
    await openPublicPage(page);
    const marker=await readLatestSourceUpdatedAt(page,{sampleMs:5000,intervalMs:500});
    const after=await page.evaluate(()=>({date:new Date().toString(),iso:new Date().toISOString(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone,offset:new Date().getTimezoneOffset(),lang:navigator.language}));
    console.log(`DIAG ${label} AFTER ${JSON.stringify(after)}`);
    console.log(`DIAG ${label} SOURCE ${marker}`);
    const h=main.at(-1)?.headers||{};
    console.log(`DIAG ${label} DOCUMENT ${JSON.stringify({url:main.at(-1)?.url,status:main.at(-1)?.status,date:h.date,age:h.age,server:h.server,cacheControl:h['cache-control'],via:h.via,xCache:h['x-cache'],akamai:h['x-akamai-transformed']})}`);
    return marker;
  } finally { await context.close(); }
}

try {
  const defaultMarker=await probe('DEFAULT',null);
  const seoulMarker=await probe('SEOUL','Asia/Seoul');
  console.log(`DIAG COMPARISON default=${defaultMarker} seoul=${seoulMarker}`);
} finally { await browser.close(); }
