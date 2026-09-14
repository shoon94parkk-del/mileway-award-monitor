import {collectionCycle} from '../../src/collection-cycle.mjs';

const API_ROOT='https://api.github.com';

function githubHeaders(token){
 return {
  Accept:'application/vnd.github+json',
  Authorization:`Bearer ${token}`,
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'mileway-cloudflare-dispatcher'
 };
}

async function githubRequest(fetchImpl,url,{token,method='GET',body}={}){
 let lastError;
 for(let attempt=1;attempt<=3;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetchImpl(url,{
    method,
    headers:githubHeaders(token),
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:controller.signal
   });
   if(response.ok)return response;
   const detail=(await response.text().catch(()=>'' )).slice(0,300);
   lastError=Error(`GitHub API returned HTTP ${response.status}${detail?`: ${detail}`:''}`);
   if(response.status!==429&&response.status<500)break;
  }catch(error){lastError=error;}
  finally{clearTimeout(timer);}
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*attempt));
 }
 throw lastError;
}

export function skipReason({cycle,status,runs}){
 if(status?.cycle_id===cycle.cycle_id&&status?.collector_status==='succeeded'&&status?.source_status==='current'){
  return 'current cycle is already published';
 }
 const start=Date.parse(cycle.cycle_start_utc),end=start+86400000;
 for(const run of runs||[]){
  const created=Date.parse(run.created_at);
  if(!Number.isFinite(created)||created<start||created>=end)continue;
  if(run.status==='queued'||run.status==='in_progress')return `collector ${run.id} is ${run.status}`;
  if(run.status==='completed'&&run.conclusion==='success')return `collector ${run.id} already succeeded`;
 }
 return '';
}

export async function dispatchFromCloudflare({env,now=new Date(),fetchImpl=fetch,log=console.log}){
 const token=String(env.GITHUB_ACTIONS_TOKEN||'').trim();
 if(!token)throw Error('GITHUB_ACTIONS_TOKEN secret is required.');
 const repository=env.GITHUB_REPOSITORY||'shoon94parkk-del/mileway-award-monitor';
 const workflow=env.GITHUB_WORKFLOW||'collect.yml';
 const ref=env.GITHUB_REF_NAME||'main';
 const cycle=collectionCycle(now,{prewarmMinutes:15});
 const encodedRepo=repository.split('/').map(encodeURIComponent).join('/');
 const statusUrl=`https://raw.githubusercontent.com/${encodedRepo}/${encodeURIComponent(ref)}/public-data/status.json?t=${now.getTime()}`;
 const runsUrl=`${API_ROOT}/repos/${encodedRepo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=30`;
 const [statusResponse,runsResponse]=await Promise.all([
  fetchImpl(statusUrl,{headers:{'User-Agent':'mileway-cloudflare-dispatcher'}}).catch(()=>null),
  githubRequest(fetchImpl,runsUrl,{token})
 ]);
 const status=statusResponse?.ok?await statusResponse.json().catch(()=>null):null;
 const runs=await runsResponse.json();
 const reason=skipReason({cycle,status,runs:runs.workflow_runs||[]});
 if(reason){log(`No dispatch needed for ${cycle.cycle_id}: ${reason}.`);return {dispatched:false,cycle,reason};}
 const dispatchUrl=`${API_ROOT}/repos/${encodedRepo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
 await githubRequest(fetchImpl,dispatchUrl,{token,method:'POST',body:{ref}});
 log(`Dispatched ${repository}/${workflow}@${ref} for ${cycle.cycle_id}.`);
 return {dispatched:true,cycle};
}

export default {
 async scheduled(_controller,env,ctx){
  ctx.waitUntil(dispatchFromCloudflare({env}));
 }
};
