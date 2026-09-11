import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {openPublicPage} from './public-navigation.mjs';
import {collectionGroup,monitoredRoute} from './route-discovery.mjs';
import {parseSourceUpdatedAt,sourceTimestampKey,dailySourceIsStale,expectedDailySourceUpdatedAt} from './source-timestamp.mjs';

export {parseSourceUpdatedAt,sourceTimestampKey,dailySourceIsStale,expectedDailySourceUpdatedAt} from './source-timestamp.mjs';

const require=createRequire(import.meta.url);
const NETWORK_ARGS=['--disable-http2','--disable-quic'];
const REQUIRED_GROUPS=['유럽','미주','오세아니아','아시아'];

export function readPublishedSourceUpdatedAt(file){
  if(!file||!fs.existsSync(file))return null;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  return data?.bootstrap?.report?.source_updated_at||data?.report?.source_updated_at||data?.source_updated_at||null;
}

export function publishedSnapshotNeedsRefresh(data,current){
  const report=data?.bootstrap?.report||data?.report||{};
  const routes=Array.isArray(report.routes)?report.routes:(Array.isArray(data?.bootstrap?.routes)?data.bootstrap.routes:[]);
  if(!routes.length)return true;
  // A snapshot produced before the reduced-scope policy still contains routes that are intentionally no longer monitored.
  if(routes.some(route=>!monitoredRoute(route)))return true;
  const groups=new Set(routes.map(route=>collectionGroup(route.region)));
  if(REQUIRED_GROUPS.some(group=>!groups.has(group)))return true;
  if(!routes.some(route=>route.code==='DPS'))return true;
  if(report.scope==='REGIONAL_COMPOSITE'){
    return REQUIRED_GROUPS.some(group=>report.region_status?.[group]?.status!=='success'||report.region_status?.[group]?.source_updated_at!==current);
  }
  return false;
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

async function sampleSourceUpdatedAt(page,{sampleMs=6000,intervalMs=500}={}){
  const deadline=Date.now()+sampleMs;
  let best=null,bestKey=-Infinity;
  do{
    const body=await page.locator('body').innerText();
    const candidate=parseSourceUpdatedAt(body);
    const key=sourceTimestampKey(candidate);
    if(key!==null&&key>bestKey){best=candidate;bestKey=key;}
    if(Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }while(Date.now()<deadline);
  return best;
}

export async function fetchSourceUpdatedAt(){
  let pw;
  try { pw=require('playwright'); }
  catch {
    const bundled=path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE||'','AppData','Local'),'..','..','.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright');
    pw=require(bundled);
  }
  const edge=[process.env.KE_BROWSER_EXECUTABLE,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
  const browser=await pw.chromium.launch({...(edge?{executablePath:edge}:{}),args:NETWORK_ARGS,headless:false});
  try{
    const page=await browser.newPage({locale:'ko-KR',viewport:{width:480,height:900}});
    page.setDefaultTimeout(20000);
    await openPublicPage(page);
    await dismissCookie(page);
    const sourceUpdatedAt=await sampleSourceUpdatedAt(page);
    if(!sourceUpdatedAt)throw new Error('Missing public data update timestamp');
    return sourceUpdatedAt;
  }finally{await browser.close();}
}

async function main(){
  const snapshotArg=process.argv.indexOf('--snapshot');
  const snapshot=snapshotArg>=0?path.resolve(process.argv[snapshotArg+1]):path.resolve('public-data/snapshot.json');
  const previous=readPublishedSourceUpdatedAt(snapshot);
  const current=await fetchSourceUpdatedAt();
  const snapshotData=fs.existsSync(snapshot)?JSON.parse(fs.readFileSync(snapshot,'utf8')):null;
  const coverageNeedsRefresh=publishedSnapshotNeedsRefresh(snapshotData,current);
  const staleDaily=dailySourceIsStale(current);
  const forceIfStaleDaily=process.argv.includes('--force-if-stale-daily');
  const changed=!previous||previous!==current||coverageNeedsRefresh||(forceIfStaleDaily&&staleDaily);
  console.log(`Published source: ${previous||'none'}`);
  console.log(`Korean Air source: ${current}`);
  if(staleDaily)console.log(`Daily freshness warning: observed ${current}, expected at least ${expectedDailySourceUpdatedAt()}`);
  if(coverageNeedsRefresh)console.log('Published monitoring scope is incomplete/stale: collection required');
  if(forceIfStaleDaily&&staleDaily)console.log('Daily fail-safe: stale source marker forces a fresh collection attempt');
  console.log(changed?'Source changed: full collection required':'Source unchanged: skip full collection');
  if(process.env.GITHUB_OUTPUT){
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`changed=${changed}\ncurrent=${current}\nprevious=${previous||''}\nstale_daily=${staleDaily}\n`);
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
