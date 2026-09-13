import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

if(process.env.GITHUB_ACTIONS!=='true')throw Error('This publishing orchestrator runs only in GitHub Actions; use public-extract for local probes');
const groups=['유럽','미주','오세아니아','아시아'];
const files=['public-data/results.json.gz','public-data/snapshot.json','public-data/changes.json'];
const parallelism=Math.max(1,Math.min(3,Number(process.env.COLLECT_PARALLELISM||'2')));
const parallelIntervalMs=Math.max(3000,Number(process.env.COLLECT_INTERVAL_MS||(parallelism>1?'4000':'3000')));
const fallbackIntervalMs=Math.max(6000,Number(process.env.COLLECT_FALLBACK_INTERVAL_MS||'7000'));
const laneStaggerMs=Math.max(0,Number(process.env.COLLECT_LANE_STAGGER_MS||'1500'));
const stopFile='data/parallel-stop.signal';
const publisherDir=path.join(process.env.RUNNER_TEMP||os.tmpdir(),'mileway-region-publisher');
fs.mkdirSync('data',{recursive:true});
fs.rmSync(stopFile,{force:true});

const runAt=(cwd,command,args,options={})=>{const result=spawnSync(command,args,{stdio:options.stdio||'inherit',shell:false,cwd,encoding:options.encoding});if(result.error)throw result.error;return result;};
const run=(command,args)=>runAt(process.cwd(),command,args).status??1;
const runAsync=(command,args)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{stdio:'inherit',shell:false});
 child.once('error',reject);
 child.once('close',code=>resolve(code??1));
});
const node=args=>run(process.execPath,['--no-warnings',...args]);
const nodeAsync=args=>runAsync(process.execPath,['--no-warnings',...args]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const git=args=>{if(run('git',args)!==0)throw Error('Git '+args[0]+' failed; stop to avoid replacing unconfirmed public state');};
const gitAt=(cwd,args)=>{const result=runAt(cwd,'git',args);if((result.status??1)!==0)throw Error('Git '+args[0]+' failed in publisher worktree');};

function preparePublisher(){
 git(['fetch','origin','main']);
 run('git',['worktree','remove','--force',publisherDir]);
 fs.rmSync(publisherDir,{recursive:true,force:true});
 git(['worktree','prune']);
 git(['worktree','add','--force','--detach',publisherDir,'origin/main']);
 gitAt(publisherDir,['config','user.name','github-actions[bot]']);
 gitAt(publisherDir,['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
}

async function publishCommit(group){
 const quiet=runAt(publisherDir,'git',['diff','--cached','--quiet'],{stdio:'ignore'}).status??1;
 if(quiet===0)return;
 gitAt(publisherDir,['commit','-m',`Publish completed ${group} award-seat region`]);
 // Publishing is isolated from the collector checkout, so a rebase can never replace
 // source files underneath still-running browser collectors.
 for(let attempt=1;attempt<=3;attempt++){
  const pull=runAt(publisherDir,'git',['pull','--rebase','origin','main']).status??1;
  if(pull!==0){runAt(publisherDir,'git',['rebase','--abort'],{stdio:'ignore'});throw Error('Publisher rebase failed; stop to avoid replacing newer public state');}
  if((runAt(publisherDir,'git',['push','origin','HEAD:main']).status??1)===0)return;
  if(attempt<3){console.log(`Publication push raced with another commit; retry ${attempt}/3 after refresh.`);await sleep(5000*attempt);}
 }
 throw Error('Git push failed after retries; stop to avoid replacing newer public state');
}

let parallelStopped=false;
async function runCollector(index,{intervalMs,parallelMode=false,forceResume=false,lane=0}={}){
 const group=groups[index],output=`data/region-${index}`;
 if(parallelMode&&laneStaggerMs&&lane>0)await sleep(lane*laneStaggerMs);
 console.log(`REGION START: ${group} (${parallelMode?`parallel lane ${lane+1}/${parallelism}`:'safe sequential fallback'})`);
 let result=1;
 for(let attempt=1;attempt<=3;attempt++){
  if(parallelMode&&parallelStopped)return {index,group,output,result:1};
  const resume=forceResume||attempt>1||fs.existsSync(`${output}/results.json`);
  const args=['src/public-extract.mjs','--group',group,'--output',output,'--interval-ms',String(intervalMs),'--max-retries','3',...(parallelMode?['--stop-file',stopFile]:[]),...(resume?['--resume']:[])];
  try{result=await nodeAsync(args);}catch(error){console.error(`REGION PROCESS ERROR: ${group}: ${error.message}`);result=1;}
  if(result===0)return {index,group,output,result};
  if(result===75){
   if(parallelMode){
    parallelStopped=true;
    fs.writeFileSync(stopFile,'ACCESS_LIMIT');
    console.warn(`ACCESS_LIMIT detected in ${group}; stopping parallel mode and preparing safe sequential resume.`);
   }
   return {index,group,output,result};
  }
  if(parallelMode&&parallelStopped)return {index,group,output,result};
  if(attempt<3)await sleep(15000*attempt);
 }
 return {index,group,output,result};
}

const publicationQueued=new Set();
const publicationResults=new Map();
let publicationChain=Promise.resolve();
function queuePublication(item){
 if(!item||item.result!==0||publicationQueued.has(item.index))return;
 publicationQueued.add(item.index);
 publicationChain=publicationChain.then(async()=>{
  const ok=await publishResult(item);
  publicationResults.set(item.index,ok);
 }).catch(error=>{
  publicationResults.set(item.index,false);
  console.error(`REGION PUBLISHER ERROR: ${item.group}: ${error.message}`);
 });
}

async function collectParallel(){
 const results=new Array(groups.length);
 let nextIndex=0;
 async function worker(lane){
  while(!parallelStopped){
   const index=nextIndex++;
   if(index>=groups.length)return;
   const item=await runCollector(index,{intervalMs:parallelIntervalMs,parallelMode:parallelism>1,lane});
   results[index]=item;
   // Do not wait for the other collector lane. A single isolated publisher serializes
   // Git/public-data writes while collection continues in the original checkout.
   if(item.result===0)queuePublication(item);
  }
 }
 console.log(`PARALLEL COLLECTORS: ${parallelism}; request interval ${parallelIntervalMs}ms; lane stagger ${laneStaggerMs}ms`);
 await Promise.all(Array.from({length:Math.min(parallelism,groups.length)},(_,lane)=>worker(lane)));
 return results;
}

async function recoverAfterRateLimit(results){
 if(!parallelStopped)return {results,fatalRateLimit:false};
 fs.rmSync(stopFile,{force:true});
 console.warn(`PARALLEL FALLBACK: resuming unfinished regions one at a time at ${fallbackIntervalMs}ms intervals.`);
 let fatalRateLimit=false;
 for(let index=0;index<groups.length;index++){
  if(results[index]?.result===0)continue;
  const recovered=await runCollector(index,{intervalMs:fallbackIntervalMs,parallelMode:false,forceResume:true});
  results[index]=recovered;
  if(recovered.result===0)queuePublication(recovered);
  if(recovered.result===75){fatalRateLimit=true;break;}
 }
 return {results,fatalRateLimit};
}

async function publishResult(item){
 const {group,output}=item;
 const resultFile=path.resolve(`${output}/results.json`);
 try{
  gitAt(publisherDir,['fetch','origin','main']);
  gitAt(publisherDir,['reset','--hard','origin/main']);
  const publish=runAt(publisherDir,process.execPath,['--no-warnings','scripts/publish-data.mjs',resultFile]);
  if((publish.status??1)!==0)throw Error('Regional validation/publication failed');
  const build=runAt(publisherDir,process.execPath,['--no-warnings','scripts/build-cloud.mjs']);
  const check=runAt(publisherDir,process.execPath,['--no-warnings','--check','dist/app.js']);
  if((build.status??1)!==0||(check.status??1)!==0)throw Error('Regional cloud build failed');
  fs.copyFileSync(path.join(publisherDir,'dist/snapshot.json'),path.join(publisherDir,'public-data/snapshot.json'));
  gitAt(publisherDir,['add','--',...files]);
  await publishCommit(group);
  console.log(`REGION PUBLISHED: ${group}; website snapshot updated immediately after regional completion`);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`published_${item.index}=true\n`);
  return true;
 }catch(error){
  runAt(publisherDir,'git',['reset','--hard','origin/main'],{stdio:'ignore'});
  console.error(`REGION NOT PUBLISHED: ${group}: ${error.message}`);
  return false;
 }
}

function syncCollectorCheckoutAfterPublication(){
 // All browser collectors are finished now. Only at this point may the main checkout
 // move forward so subsequent notification/health steps read the publication just pushed.
 git(['fetch','origin','main']);
 git(['reset','--hard','origin/main']);
}

preparePublisher();
let results=await collectParallel();
const recovered=await recoverAfterRateLimit(results);
results=recovered.results;
await publicationChain;
let failures=0;
for(let index=0;index<groups.length;index++){
 const item=results[index];
 if(!item||item.result!==0){console.error(`REGION FAILED: ${groups[index]}; previous published region retained`);failures++;continue;}
 if(publicationResults.get(index)!==true)failures++;
}
syncCollectorCheckoutAfterPublication();
run('git',['worktree','remove','--force',publisherDir]);
fs.rmSync(stopFile,{force:true});
if(recovered.fatalRateLimit)process.exitCode=75;
else if(failures)process.exitCode=1;
