import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const COOLDOWN_MS=60*60*1000;
export function accessLimitRetryAfter(health){
 const observed=Date.parse(health?.last_access_limit_at||'');
 return Number.isFinite(observed)?new Date(observed+COOLDOWN_MS).toISOString():null;
}
export function collectionCooldown(health,now=new Date()){
 const retryAfter=accessLimitRetryAfter(health),observed=Date.parse(health?.last_access_limit_at||'');
 const active=!!retryAfter&&observed<=now.getTime()&&now.getTime()<Date.parse(retryAfter);
 return {allowed:!active,retry_after_at:retryAfter};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let health={};try{health=JSON.parse(fs.readFileSync(process.argv[2]||'public-data/health.json','utf8'));}catch{}
 const result=collectionCooldown(health);
 const outputs='allowed='+result.allowed+'\nretry_after_at='+(result.retry_after_at||'')+'\n';
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,outputs);
 if(result.allowed)console.log('Collection preflight: no active access-limit cooldown.');
 else{
  console.error('ACCESS_LIMIT: collection paused until '+result.retry_after_at+'; no browser launched.');
  // Keep the workflow unsuccessful: watchdogs must not mistake a cooldown skip
  // for a completed publication and suppress later eligible recovery.
  process.exitCode=75;
 }
}
