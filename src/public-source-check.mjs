import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PUBLIC_URL} from './public-calendar.mjs';

const require=createRequire(import.meta.url);
const NETWORK_ARGS=['--disable-http2','--disable-quic'];

export function parseSourceUpdatedAt(text){
  return String(text||'').match(/대한민국 시간\(([^)]+)\)/)?.[1]?.trim()||null;
}

export function readPublishedSourceUpdatedAt(file){
  if(!file||!fs.existsSync(file))return null;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  return data?.bootstrap?.report?.source_updated_at||data?.report?.source_updated_at||data?.source_updated_at||null;
}

async function dismissCookie(page){
  const cookie=page.locator('kc-global-cookie-banner');
  if(!await cookie.count())return;
  const reject=cookie.getByRole('button',{name:/거부|필수.*허용|Reject|필수 쿠키/i}).first();
  if(await reject.count())await reject.click().catch(()=>{});
  else {
    const close=cookie.getByRole('button',{name:/닫기|Close/i}).first();
    if(await close.count())await close.click().catch(()=>{});
  }
}

export async function fetchSourceUpdatedAt(){
  let pw;
  try { pw=require('playwright'); }
  catch {
    const bundled=path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE||'','AppData','Local'),'..','..','.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright');
    pw=require(bundled);
  }
  const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
  const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),args:NETWORK_ARGS,headless:true});
  try{
    const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
    page.setDefaultTimeout(20000);
    await page.goto(PUBLIC_URL,{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('[id^="departureBtn"]').waitFor({state:'attached',timeout:60000});
    await dismissCookie(page);
    const body=await page.locator('body').innerText();
    const sourceUpdatedAt=parseSourceUpdatedAt(body);
    if(!sourceUpdatedAt)throw new Error('Missing public data update timestamp');
    return sourceUpdatedAt;
  }finally{await browser.close();}
}

async function main(){
  const snapshotArg=process.argv.indexOf('--snapshot');
  const snapshot=snapshotArg>=0?path.resolve(process.argv[snapshotArg+1]):path.resolve('public-data/snapshot.json');
  const previous=readPublishedSourceUpdatedAt(snapshot);
  const current=await fetchSourceUpdatedAt();
  const changed=!previous||previous!==current;
  console.log(`Published source: ${previous||'none'}`);
  console.log(`Korean Air source: ${current}`);
  console.log(changed?'Source changed: full collection required':'Source unchanged: skip full collection');
  if(process.env.GITHUB_OUTPUT){
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`changed=${changed}\ncurrent=${current}\nprevious=${previous||''}\n`);
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
