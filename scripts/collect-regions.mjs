import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

if(process.env.GITHUB_ACTIONS!=='true')throw Error('This publishing orchestrator runs only in GitHub Actions; use public-extract for local probes');
const groups=['유럽','미주','오세아니아','아시아'];
const files=['public-data/results.json.gz','public-data/snapshot.json','public-data/changes.json'];
const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit',shell:false});if(result.error)throw result.error;return result.status??1;};
const node=args=>run(process.execPath,['--no-warnings',...args]);
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

git(['config','user.name','github-actions[bot]']);git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
let failures=0;
for(let index=0;index<groups.length;index++){
 const group=groups[index],output=`data/region-${index}`;
 console.log(`REGION START: ${group}`);
 let result=1;
 for(let attempt=1;attempt<=3;attempt++){
  // Korean Air's public page currently fails from GitHub-hosted Windows runners in headless Edge.
  // Keep the proven headed Edge path used by the last successful production collection.
  result=node(['src/public-extract.mjs','--group',group,'--output',output,'--interval-ms','3000','--max-retries','3',...(attempt>1?['--resume']:[])]);
  if(result===0||result===75)break;
  await sleep(15000*attempt);
 }
 if(result===75){process.exitCode=75;break;}
 if(result!==0){console.error(`REGION FAILED: ${group}; previous published region retained`);failures++;continue;}
 const backup=new Map(files.map(file=>[file,fs.existsSync(file)?fs.readFileSync(file):null]));
 try{
  if(node(['scripts/publish-data.mjs',`${output}/results.json`])!==0)throw Error('Regional validation/publication failed');
  if(node(['scripts/build-cloud.mjs'])!==0||node(['--check','dist/app.js'])!==0)throw Error('Regional cloud build failed');
  fs.copyFileSync('dist/snapshot.json','public-data/snapshot.json');
 }catch(error){
  for(const [file,bytes] of backup){if(bytes)fs.writeFileSync(file,bytes);else if(fs.existsSync(file))fs.unlinkSync(file);}
  console.error(`REGION NOT PUBLISHED: ${group}: ${error.message}`);failures++;continue;
 }
 git(['add','--',...files]);
 await publishCommit(group);
 console.log(`REGION PUBLISHED: ${group}; website snapshot updated`);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'published=true\n');
}
if(failures)process.exitCode=1;
