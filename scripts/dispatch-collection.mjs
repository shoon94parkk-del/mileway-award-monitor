import {collectionCycle} from '../src/collection-cycle.mjs';
import {pathToFileURL} from 'node:url';

const DEFAULT_REPOSITORY='shoon94parkk-del/mileway-award-monitor';
const DEFAULT_WORKFLOW='collect.yml';
const DEFAULT_REF='main';
const API_ROOT='https://api.github.com';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function requiredToken(env=process.env){
 const token=String(env.GITHUB_ACTIONS_TOKEN||env.GH_TOKEN||'').trim();
 if(!token)throw Error('GITHUB_ACTIONS_TOKEN is required (fine-grained token with Actions: read and write).');
 return token;
}

export function currentCycle(now=new Date()){
 return collectionCycle(now,{prewarmMinutes:15});
}

export function shouldSkipDispatch({cycle,status,runs}){
 if(status?.cycle_id===cycle.cycle_id&&status?.collector_status==='succeeded'&&status?.source_status==='current'){
  return 'current cycle already has a fresh successful publication';
 }
 const start=Date.parse(cycle.cycle_start_utc),end=start+86400000;
 for(const run of runs||[]){
  const created=Date.parse(run.created_at);
  if(!Number.isFinite(created)||created<start||created>=end)continue;
  if(run.status==='queued'||run.status==='in_progress')return `collector run ${run.id} is already ${run.status}`;
  if(run.status==='completed'&&run.conclusion==='success')return `collector run ${run.id} already succeeded for this cycle`;
 }
 return '';
}

async function request(fetchImpl,url,{token,method='GET',body,attempts=3}={}){
 let lastError;
 for(let attempt=1;attempt<=attempts;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetchImpl(url,{
    method,
    headers:{
     Accept:'application/vnd.github+json',
     Authorization:`Bearer ${token}`,
     'X-GitHub-Api-Version':'2022-11-28',
     'User-Agent':'mileway-render-dispatcher'
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:controller.signal
   });
   if(response.ok)return response;
   const detail=(await response.text().catch(()=>'' )).slice(0,500);
   const error=Error(`GitHub API ${method} ${url} failed: HTTP ${response.status}${detail?` ${detail}`:''}`);
   if(response.status!==429&&response.status<500)throw error;
   lastError=error;
  }catch(error){
   lastError=error;
   if(attempt===attempts)break;
  }finally{clearTimeout(timer);}
  await sleep(1000*attempt);
 }
 throw lastError;
}

async function readJson(fetchImpl,url,token){
 const response=await request(fetchImpl,url,{token});
 return response.json();
}

export async function dispatchCollection({
 now=new Date(),
 env=process.env,
 fetchImpl=fetch,
 wait=sleep,
 log=console.log
}={}){
 const token=requiredToken(env);
 const repository=env.GITHUB_REPOSITORY||DEFAULT_REPOSITORY;
 const workflow=env.GITHUB_WORKFLOW||DEFAULT_WORKFLOW;
 const ref=env.GITHUB_REF_NAME||DEFAULT_REF;
 const cycle=currentCycle(now);
 const target=Date.parse(cycle.cycle_start_utc);
 const delay=Math.max(0,target-now.getTime());
 if(delay){
  log(`Prewarmed for ${cycle.cycle_id}; waiting ${Math.ceil(delay/1000)} seconds until 23:00 KST.`);
  await wait(delay);
 }

 const encodedRepo=repository.split('/').map(encodeURIComponent).join('/');
 const statusUrl=`https://raw.githubusercontent.com/${encodedRepo}/${encodeURIComponent(ref)}/public-data/status.json?t=${Date.now()}`;
 const runsUrl=`${API_ROOT}/repos/${encodedRepo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=30`;
 const [status,runsPayload]=await Promise.all([
  readJson(fetchImpl,statusUrl,token).catch(()=>null),
  readJson(fetchImpl,runsUrl,token)
 ]);
 const reason=shouldSkipDispatch({cycle,status,runs:runsPayload.workflow_runs||[]});
 if(reason){
  log(`No dispatch needed: ${reason}.`);
  return {dispatched:false,cycle,reason};
 }

 const dispatchUrl=`${API_ROOT}/repos/${encodedRepo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
 await request(fetchImpl,dispatchUrl,{token,method:'POST',body:{ref}});
 log(`Dispatched ${repository}/${workflow}@${ref} for ${cycle.cycle_id}.`);
 return {dispatched:true,cycle};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 dispatchCollection().catch(error=>{
  console.error(error.message);
  process.exitCode=1;
 });
}
