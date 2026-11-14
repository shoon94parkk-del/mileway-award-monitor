// Collect only through the official Korean Air rendered UI, on a Windows PC
// that the user controls. No proxies, fingerprint spoofing, cloud scraping
// fallback, invented seats or third-party inventory.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {OUTBOUND_SHARDS,GROUP_NAMES,validateShardPlan} from './outbound-shards.mjs';
import {RETURN_SHARDS,assertReturnShards} from './europe-return-shards.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source='KOREAN_AIR_PUBLIC_DAILY';
const env={...process.env,MILEWAY_STANDARD_CHROME:'1',MILEWAY_DIRECT_API:'0'};
const outputRoot=path.join(root,'data','owned-windows-collector');
const options=new Set(process.argv.slice(2));
const dryRun=options.has('--dry-run');
const canaryOnly=options.has('--canary-only');
const outboundOnly=options.has('--outbound-only');
const skipPull=options.has('--skip-pull');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function officialRunnerPlan(){
 const outbound=validateShardPlan(),returns=assertReturnShards();
 if(outbound.length!==33||returns.length!==14)throw Error('Unexpected official Korean Air route scope');
 const expectedOutbound=new Set(outbound);
 if(returns.some(code=>!expectedOutbound.has(code)))throw Error('Return airport missing from official outbound scope');
 return {
  source,
  route_count:outbound.length,
  return_origin_count:returns.length,
  browser:'locally-installed-Google-Chrome',
  mode:'official-visible-UI-only',
  phases:['one-route-canary','33-route-outbound','publish-complete-outbound','14-origin-Europe-return','publish-complete-return']
 };
}

function checked(command,args,{step=command,failOnError=true}={}){
 console.log('\nMILEWAY STEP:',step);
 const r=spawnSync(command,args,{cwd:root,env,stdio:'inherit',shell:false,windowsHide:false});
 if(r.error)throw Error(step+': '+r.error.message);
 if(r.status!==0&&failOnError)throw Error(step+' failed (exit '+(r.status??'unknown')+'); previously published data preserved');
 return r.status;
}
const node=(script,args=[],step)=>checked(process.execPath,['--no-warnings',script,...args],{step:step||script});
function writePublishedSnapshot(){
 const content=path.join(root,'dist','snapshot.json');
 const target=path.join(root,'public-data','snapshot.json');
 if(!fs.existsSync(content))throw Error('No validated cloud snapshot generated');
 const tmp=target+'.tmp';
 fs.copyFileSync(content,tmp);
 fs.renameSync(tmp,target);
}
function ensureCleanWorkingTree(){
 const result=spawnSync('git',['status','--porcelain','--','public-data'],{cwd:root,env,encoding:'utf8'});
 if(result.status!==0||result.stdout?.trim())throw Error('Tracked public-data changes exist before collection; refusing to overwrite unpublished work');
}
function publishCommit(message,files){
 // git and authenticated gh on this PC handle publication; credentials
 // remain entirely in the user's local OS credential store.
 checked('git',['add','--',...files],{step:'Stage validated official Korean Air publications'});
 const diff=spawnSync('git',['diff','--cached','--quiet'],{cwd:root,env});
 if(diff.status===0){console.log('No changed verified official data to publish');return false}
 if(diff.status!==1)throw Error('Cannot inspect staged publication');
 checked('git',['commit','-m',message],{step:'Commit verified official data'});
 checked('git',['pull','--rebase','origin','main'],{step:'Reconcile with GitHub repository'});
 checked('git',['push','origin','HEAD:main'],{step:'Push official Korean Air data to Render site'});
 return true;
}
async function outbound(){
 for(const shard of OUTBOUND_SHARDS){
  const folder=path.join(outputRoot,'outbound-shards','outbound-shard-'+shard.id);
  node('src/public-extract.mjs',[
   '--route',shard.codes.join(','),'--output',folder,
   '--interval-ms','5500','--max-retries','1','--resume'
  ],'Official ICN outbound shard '+shard.id+' ('+shard.codes.length+' destinations)');
  // Deliberate gap before another independently initialized browser.
  await sleep(3000);
 }
 const merged=path.join(outputRoot,'outbound-merged');
 node('scripts/merge-outbound-shards.mjs',[path.join(outputRoot,'outbound-shards'),merged],
  'Validate all 33 official outbound airport/month combinations');
 for(let i=0;i<GROUP_NAMES.length;i++){
  node('scripts/publish-data.mjs',[path.join(merged,String(i)+'.json')],
   'Merge valid Korean Air '+GROUP_NAMES[i]+' region');
 }
 node('scripts/build-cloud.mjs',[],'Build validated public site snapshot');
 writePublishedSnapshot();
 publishCommit('Publish locally verified Korean Air official outbound availability',
  ['public-data/results.json.gz','public-data/snapshot.json','public-data/changes.json']);
}
async function europeReturns(){
 for(const shard of RETURN_SHARDS){
  const file=path.join(outputRoot,'return-parts','return-shard-'+shard.id,'returns-europe.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  // The collector saves each month as it is read; a failed shard is never merged.
  node('scripts/collect-europe-returns.mjs',[
   '--route',shard.codes.join(','),'--output',file,'--interval-ms','5500'
  ],'Official Europe-to-ICN return shard '+shard.id+' ('+shard.codes.length+' origins)');
  await sleep(3000);
 }
 const file=path.join(outputRoot,'returns-europe.json');
 node('scripts/merge-europe-return-shards.mjs',[path.join(outputRoot,'return-parts'),file],
  'Validate all 14 official European return origins');
 node('scripts/publish-europe-returns.mjs',[file,'public-data/returns.json'],
  'Publish validated official Europe-to-ICN results');
 publishCommit('Publish locally verified Korean Air official Europe returns',
  ['public-data/returns.json']);
}
async function main(){
 const plan=officialRunnerPlan();
 console.log('MILEWAY OFFICIAL SOURCE ONLY:',JSON.stringify(plan));
 if(dryRun){console.log('DRY RUN ONLY: no browser or remote requests');return}
 if(process.platform!=='win32')throw Error('User-owned Windows Chrome is required');
 checked('gh',['auth','status'],{step:'Check local GitHub authorization (no credentials displayed)'});
 checked('gh',['auth','setup-git'],{step:'Configure GitHub CLI credential helper'});
 if(!skipPull){
  ensureCleanWorkingTree();
  checked('git',['pull','--ff-only','origin','main'],{step:'Fetch current trusted project code'});
 }
 fs.mkdirSync(outputRoot,{recursive:true});
 // One small airline request; stop on 403/429 before any full scan.
 node('scripts/collection-canary.mjs',[],'One official Korean Air visible-calendar canary');
 console.log('OFFICIAL CANARY PASSED; full collection may proceed');
 if(canaryOnly)return;
 await outbound();
 if(!outboundOnly){
  try{await europeReturns()}
  catch(error){
   // Validated outbound rows have already been committed. Never claim a
   // return result when a route/month failed or the site refused access.
   console.error('EUROPE RETURN NOT PUBLISHED:',error.message);
   process.exitCode=1;
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{await main()}catch(error){console.error('MILEWAY COLLECTOR STOPPED:',error.message);process.exitCode=1}
}
