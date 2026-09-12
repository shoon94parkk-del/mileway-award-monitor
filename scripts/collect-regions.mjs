import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';

if(process.env.GITHUB_ACTIONS!=='true')throw Error('This publishing orchestrator runs only in GitHub Actions; use public-extract for local probes');
const groups=['유럽','미주','오세아니아','아시아'];
const files=['public-data/results.json.gz','public-data/snapshot.json','public-data/changes.json'];
const parallelism=Math.max(1,Math.min(3,Number(process.env.COLLECT_PARALLELISM||'2')));
const parallelIntervalMs=Math.max(3000,Number(process.env.COLLECT_INTERVAL_MS||(parallelism>1?'4000':'3000')));
const fallbackIntervalMs=Math.max(6000,Number(process.env.COLLECT_FALLBACK_INTERVAL_MS||'7000'));
const laneStaggerMs=Math.max(0,Number(process.env.COLLECT_LANE_STAGGER_MS||'1500'));
const stopFile='data/parallel-stop.signal';
fs.mkdirSync('data',{recursive:true});
fs.rmSync(stopFile,{force:true});

const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit',shell:false});if(result.error)throw result.error;return result.status??1;};
const runAsync=(command,args)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{stdio:'inherit',shell:false});
 child.once('error',reject);
 child.once('close',code=>resolve(code??1));
});
const node=args=>run(process.execPath,['--no-warnings',...args]);
const nodeAsync=args=>runAsync(process.execPath,['--no-warnings',...args]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const git=args=>{if(run('git',args)!==0)throw Error('Git '+args[0]+' failed; stop to avoid replacing unconfirmed public state');};

async function publishCommit(group){
 if(run('git',['diff','--cached','--quiet'])===0)return;
 git(['commit','-m',`Publish completed ${group} award-seat region`]);
 // The collector can run for a long time. UI/ops commits may land while a region is being scanned,
 // so always rebase before pushing instead of failing the whole collection on a harmless fast-forward race.
 for(let attempt=1;attempt<=3;attempt++){
  const pull=run('git',['pull','--rebase','origin','main']);
  if(pull!==0){run('git',['rebase','--abort']);throw Error('Git rebase failed; stop to avoid replacing newer public state');}
  if(run('git',['push','origin','HEAD:main'])===0)return;
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

async function collectParallel(){
 const results=new Array(groups.length);
 let nextIndex=0;
 async function worker(lane){
  while(!parallelStopped){
   const index=nextIndex++;
   if(index>=groups.length)return;
   results[index]=await runCollector(index,{intervalMs:parallelIntervalMs,parallelMode:parallelism>1,lane});
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
  if(recovered.result===75){fatalRateLimit=true;break;}
 }
 return {results,fatalRateLimit};
}

async function publishResult(item){
 const {group,output}=item;
 const backup=new Map(files.map(file=>[file,fs.existsSync(file)?fs.readFileSync(file):null]));
 try{
  if(node(['scripts/publish-data.mjs',`${output}/results.json`])!==0)throw Error('Regional validation/publication failed');
  if(node(['scripts/build-cloud.mjs'])!==0||node(['--check','dist/app.js'])!==0)throw Error('Regional cloud build failed');
  fs.copyFileSync('dist/snapshot.json','public-data/snapshot.json');
 }catch(error){
  for(const [file,bytes] of backup){if(bytes)fs.writeFileSync(file,bytes);else if(fs.existsSync(file))fs.unlinkSync(file);}
  console.error(`REGION NOT PUBLISHED: ${group}: ${error.message}`);
  return false;
 }
 git(['add','--',...files]);
 await publishCommit(group);
 console.log(`REGION PUBLISHED: ${group}; website snapshot updated`);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'published=true\n');
 return true;
}

git(['config','user.name','github-actions[bot]']);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
let results=await collectParallel();
const recovered=await recoverAfterRateLimit(results);
results=recovered.results;
let failures=0;
for(let index=0;index<groups.length;index++){
 const item=results[index];
 if(!item||item.result!==0){
  console.error(`REGION FAILED: ${groups[index]}; previous published region retained`);
  failures++;
  continue;
 }
 if(!await publishResult(item))failures++;
}
fs.rmSync(stopFile,{force:true});
if(recovered.fatalRateLimit)process.exitCode=75;
else if(failures)process.exitCode=1;
