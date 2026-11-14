import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {collectionCooldown} from './collection-preflight.mjs';
import {dispatchCollection} from './dispatch-collection.mjs';

export async function recoverAccessLimit({
 health=JSON.parse(fs.readFileSync('public-data/health.json','utf8')),
 now=new Date(),
 env=process.env,
 fetchImpl=fetch,
 log=console.log
}={}){
 if(health?.status!=='degraded'||health?.last_error_code!=='ACCESS_LIMIT'){
  const reason='no degraded access-limit collection to recover';
  log('Recovery skipped: '+reason+'.');
  return {dispatched:false,reason};
 }
 const cooldown=collectionCooldown(health,now);
 if(!cooldown.allowed){
  const reason='public-source access-limit cooldown is active';
  log('Recovery skipped: '+reason+' until '+cooldown.retry_after_at+'.');
  return {dispatched:false,reason,retry_after_at:cooldown.retry_after_at};
 }
 // GitHub supplies a workflow title in GITHUB_WORKFLOW. The dispatcher needs
 // the collector's file name, and recovery always targets the production ref.
 return dispatchCollection({now,env:{...env,GITHUB_WORKFLOW:'collect.yml',GITHUB_REF_NAME:'main'},fetchImpl,log});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 recoverAccessLimit().catch(error=>{
  console.error(error.message);
  process.exitCode=1;
 });
}
