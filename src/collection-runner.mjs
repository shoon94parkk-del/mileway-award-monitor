import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {activeCollection} from './collection-lock.mjs';

export function nextDailyRun(time,now=new Date()){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('실행 시각은 HH:MM 형식으로 입력해 주세요.');
 const korea=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
 let next=new Date(`${korea}T${time}:00+09:00`);if(next<=now)next=new Date(next.getTime()+86400000);return next.toISOString();
}
export function createCollectionRunner(root,{disabled=false,stateDirectory=path.join(root,'data'),spawnProcess=spawn}={}){
 const file=path.join(stateDirectory,'automation.json'),lockFile=path.join(root,'data/public/collection.lock');
 const stopFile=path.join(stateDirectory,'collection.stop'),logFile=path.join(stateDirectory,'collection.log');
 let state={enabled:false,time:'09:10',next_run:null,last_run:null,history:[]},child=null,logs=[],timer;
 if(fs.existsSync(file))state={...state,...JSON.parse(fs.readFileSync(file,'utf8'))};
 if(disabled)state.enabled=false;
 state.next_run=state.enabled?nextDailyRun(state.time):null;
 const save=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state,null,2));fs.renameSync(tmp,file);};
 const running=()=>!!child||!!activeCollection(lockFile);
 const status=()=>({...state,paused:disabled,running:running(),can_stop:!!child,log:logs.slice(-12)});
 function configure({enabled,time}){
  if(disabled&&enabled)throw Error('현재 실행에서는 수집이 비활성화되어 있습니다.');
  if(typeof enabled!=='boolean')throw Error('자동 수집 설정이 올바르지 않습니다.');
  nextDailyRun(time);state.enabled=enabled;state.time=time;state.next_run=enabled?nextDailyRun(time):null;save();return status();
 }
 function start(trigger='manual'){
  if(disabled)throw Error('현재 실행에서는 수집이 비활성화되어 있습니다.');
  if(running())throw Error('이미 수집 중입니다.');
  fs.rmSync(stopFile,{force:true});
  const job={started_at:new Date().toISOString(),trigger,status:'running',finished_at:null,error:null};
  state.last_run=job;logs=[];save();
  let finished=false;
  const finish=(code,error)=>{
   if(finished)return;finished=true;child=null;job.finished_at=new Date().toISOString();job.status=job.status==='stopping'?'stopped':code===0?'completed':'failed';job.error=error||null;
   state.history=[{...job},...state.history].slice(0,20);save();
  };
  try{
   fs.writeFileSync(logFile,`Started ${job.started_at} (${trigger})\n`);
   child=spawnProcess(process.execPath,['--no-warnings',path.join(root,'src/public-extract.mjs'),'--resume','--interval-ms','5000','--stop-file',stopFile],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
   const log=d=>{logs.push(d.toString().trim());logs=logs.slice(-100);fs.appendFileSync(logFile,d);};
   child.stdout.on('data',log);child.stderr.on('data',log);
   child.once('error',e=>finish(1,e.message));child.once('exit',code=>finish(code,code===0?null:logs.at(-1)||'수집 프로세스가 종료되었습니다.'));
  }catch(e){finish(1,e.message);throw e;}
  return status();
 }
 function stop(){if(!child)throw Error('이 서버에서 시작한 실행 중 작업이 없습니다.');state.last_run.status='stopping';save();fs.writeFileSync(stopFile,'stop');return status();}
 function tick(){
  if(!state.enabled||!state.next_run||Date.now()<Date.parse(state.next_run)||running())return;
  state.next_run=nextDailyRun(state.time);save();
  try{start('daily');}catch(e){logs.push(e.message);}
 }
 save();timer=setInterval(tick,30000);timer.unref();
 return {status,configure,start,stop,close(){clearInterval(timer);if(child)stop();}};
}
